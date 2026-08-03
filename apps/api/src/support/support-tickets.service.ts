import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  type MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  distinctUntilChanged,
  from,
  interval,
  map,
  merge,
  type Observable,
  startWith,
  switchMap,
} from 'rxjs';
import { DataSource, type Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkspaceMembershipEntity } from '../workspaces/entities/workspace-membership.entity';
import type {
  CreateSupportTicketDto,
  CreateSupportTicketMessageDto,
  UpdateSupportTicketDto,
} from './dto/support-ticket.dto';
import { SupportTicketEntity } from './entities/support-ticket.entity';
import { SupportTicketMessageEntity } from './entities/support-ticket-message.entity';

@Injectable()
export class SupportTicketsService {
  constructor(
    @InjectRepository(SupportTicketEntity)
    private readonly tickets: Repository<SupportTicketEntity>,
    @InjectRepository(SupportTicketMessageEntity)
    private readonly messages: Repository<SupportTicketMessageEntity>,
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly memberships: Repository<WorkspaceMembershipEntity>,
    private readonly database: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async listForUser(workspaceId: string, userId: string): Promise<SupportTicketEntity[]> {
    await this.assertMembership(workspaceId, userId);
    return this.tickets.find({ where: { workspaceId }, order: { updatedAt: 'DESC' }, take: 100 });
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateSupportTicketDto,
  ): Promise<SupportTicketEntity> {
    await this.assertMembership(workspaceId, userId);
    const now = new Date();
    const ticket = await this.database.transaction(async (manager) => {
      const ticketRepository = manager.getRepository(SupportTicketEntity);
      const messageRepository = manager.getRepository(SupportTicketMessageEntity);
      const ticket = await ticketRepository.save(
        ticketRepository.create({
          id: randomUUID(),
          workspaceId,
          openedByUserId: userId,
          subject: dto.subject.trim(),
          category: dto.category,
          priority: dto.priority,
          status: 'open',
          description: dto.description.trim(),
          createdAt: now,
          updatedAt: now,
          resolvedAt: null,
        }),
      );
      await messageRepository.save(
        messageRepository.create({
          id: randomUUID(),
          ticketId: ticket.id,
          authorType: 'user',
          authorUserId: userId,
          authorStaffId: null,
          body: dto.description.trim(),
          createdAt: now,
        }),
      );
      return ticket;
    });
    await this.notifications.notifySupportStaff({
      ticketId: ticket.id,
      workspaceId,
      subject: ticket.subject,
      body: ticket.description,
      eventId: `opened:${ticket.id}`,
    });
    return ticket;
  }

  listForStaff(): Promise<SupportTicketEntity[]> {
    return this.tickets.find({ order: { updatedAt: 'DESC' }, take: 250 });
  }

  async updateForStaff(id: string, dto: UpdateSupportTicketDto): Promise<SupportTicketEntity> {
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('Ticket non trovato');
    ticket.status = dto.status;
    ticket.priority = dto.priority;
    ticket.updatedAt = new Date();
    ticket.resolvedAt = ['resolved', 'closed'].includes(dto.status) ? new Date() : null;
    return this.tickets.save(ticket);
  }

  async listMessagesForUser(workspaceId: string, userId: string, ticketId: string) {
    await this.assertUserTicket(workspaceId, userId, ticketId);
    return this.listMessages(ticketId);
  }

  async addUserMessage(
    workspaceId: string,
    userId: string,
    ticketId: string,
    dto: CreateSupportTicketMessageDto,
  ) {
    const ticket = await this.assertUserTicket(workspaceId, userId, ticketId);
    if (ticket.status === 'closed') throw new ConflictException('Il ticket è chiuso');
    const message = await this.messages.save(
      this.messages.create({
        id: randomUUID(),
        ticketId,
        authorType: 'user',
        authorUserId: userId,
        authorStaffId: null,
        body: dto.body.trim(),
        createdAt: new Date(),
      }),
    );
    ticket.updatedAt = message.createdAt;
    if (ticket.status === 'waiting_user' || ticket.status === 'resolved') ticket.status = 'open';
    ticket.resolvedAt = null;
    await this.tickets.save(ticket);
    await this.notifications.notifySupportStaff({
      ticketId,
      workspaceId,
      subject: ticket.subject,
      body: message.body,
      eventId: message.id,
    });
    return message;
  }

  async listMessagesForStaff(ticketId: string) {
    await this.ticket(ticketId);
    return this.listMessages(ticketId);
  }

  async addStaffMessage(staffUserId: string, ticketId: string, dto: CreateSupportTicketMessageDto) {
    const ticket = await this.ticket(ticketId);
    if (ticket.status === 'closed') throw new ConflictException('Il ticket è chiuso');
    const message = await this.messages.save(
      this.messages.create({
        id: randomUUID(),
        ticketId,
        authorType: 'staff',
        authorUserId: null,
        authorStaffId: staffUserId,
        body: dto.body.trim(),
        createdAt: new Date(),
      }),
    );
    ticket.updatedAt = message.createdAt;
    ticket.status = 'waiting_user';
    ticket.resolvedAt = null;
    await this.tickets.save(ticket);
    if (ticket.openedByUserId) {
      await this.notifications.notifyTicketUser({
        userId: ticket.openedByUserId,
        ticketId,
        workspaceId: ticket.workspaceId,
        subject: ticket.subject,
        body: message.body.slice(0, 1000),
        eventId: message.id,
      });
    }
    return message;
  }

  async streamForUser(
    workspaceId: string,
    userId: string,
    ticketId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.assertUserTicket(workspaceId, userId, ticketId);
    return this.messageStream(ticketId);
  }

  async streamForStaff(ticketId: string): Promise<Observable<MessageEvent>> {
    await this.ticket(ticketId);
    return this.messageStream(ticketId);
  }

  private messageStream(ticketId: string): Observable<MessageEvent> {
    const messages = interval(2_000).pipe(
      startWith(0),
      switchMap(() => from(this.listMessages(ticketId))),
      distinctUntilChanged(
        (previous, current) =>
          previous.length === current.length && previous.at(-1)?.id === current.at(-1)?.id,
      ),
      map((items) => ({ data: { ticketId, messages: items } })),
    );
    const heartbeat = interval(15_000).pipe(map(() => ({ data: { heartbeat: true } })));
    return merge(messages, heartbeat);
  }

  private listMessages(ticketId: string): Promise<SupportTicketMessageEntity[]> {
    return this.messages.find({ where: { ticketId }, order: { createdAt: 'ASC' }, take: 500 });
  }

  private async ticket(ticketId: string): Promise<SupportTicketEntity> {
    const ticket = await this.tickets.findOneBy({ id: ticketId });
    if (!ticket) throw new NotFoundException('Ticket non trovato');
    return ticket;
  }

  private async assertUserTicket(
    workspaceId: string,
    userId: string,
    ticketId: string,
  ): Promise<SupportTicketEntity> {
    await this.assertMembership(workspaceId, userId);
    const ticket = await this.tickets.findOneBy({ id: ticketId, workspaceId });
    if (!ticket) throw new NotFoundException('Ticket non trovato');
    return ticket;
  }

  private async assertMembership(workspaceId: string, userId: string): Promise<void> {
    if (!(await this.memberships.existsBy({ workspaceId, userId, status: 'active' })))
      throw new ForbiddenException('Accesso al workspace negato');
  }
}
