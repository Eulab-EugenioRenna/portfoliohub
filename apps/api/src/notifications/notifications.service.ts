import { createHash, randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { In, IsNull, type Repository } from 'typeorm';
import { StaffUserEntity } from '../admin/entities/staff-user.entity';
import { UserEntity } from '../identity/entities/user.entity';
import { WorkspaceMembershipEntity } from '../workspaces/entities/workspace-membership.entity';
import type {
  SendWorkspaceEmailDto,
  UpdateNotificationPreferencesDto,
} from './dto/notifications.dto';
import { EmailDeliveryEntity } from './entities/email-delivery.entity';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationPreferenceEntity } from './entities/notification-preference.entity';
import { StaffNotificationEntity } from './entities/staff-notification.entity';

export interface EmailJobData {
  deliveryId: string;
  workspaceId: string | null;
  recipient: string;
  template: string;
  category: 'transactional' | 'product' | 'mass';
  variables: Record<string, string>;
  idempotencyKey: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
    @InjectRepository(NotificationPreferenceEntity)
    private readonly preferences: Repository<NotificationPreferenceEntity>,
    @InjectRepository(EmailDeliveryEntity)
    private readonly deliveries: Repository<EmailDeliveryEntity>,
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly memberships: Repository<WorkspaceMembershipEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(StaffUserEntity) private readonly staffUsers: Repository<StaffUserEntity>,
    @InjectRepository(StaffNotificationEntity)
    private readonly staffNotifications: Repository<StaffNotificationEntity>,
    @InjectQueue('email') private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  list(userId: string, workspaceId: string): Promise<NotificationEntity[]> {
    return this.notifications.find({
      where: { userId, workspaceId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const result = await this.notifications.update({ id, userId }, { readAt: new Date() });
    if (!result.affected) throw new NotFoundException('Notifica non trovata');
  }

  async markAllRead(userId: string, workspaceId: string): Promise<void> {
    await this.notifications.update(
      { userId, workspaceId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async getPreferences(userId: string, workspaceId: string): Promise<NotificationPreferenceEntity> {
    const existing = await this.preferences.findOneBy({ userId, workspaceId });
    return (
      existing ??
      this.preferences.create({
        id: randomUUID(),
        userId,
        workspaceId,
        transactionalEmail: true,
        productEmail: true,
        massEmail: false,
        inAppBanner: true,
        ticketUpdates: true,
        deliveryActivity: true,
        workspaceActivity: true,
        updatedAt: new Date(),
      })
    );
  }

  async updatePreferences(
    userId: string,
    workspaceId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferenceEntity> {
    const preference = await this.getPreferences(userId, workspaceId);
    Object.assign(preference, dto, { updatedAt: new Date() });
    return this.preferences.save(preference);
  }

  async notify(input: Omit<NotificationEntity, 'id' | 'readAt' | 'createdAt'>): Promise<void> {
    await this.notifications.save(
      this.notifications.create({
        id: randomUUID(),
        ...input,
        readAt: null,
        createdAt: new Date(),
      }),
    );
  }

  listForStaff(staffUserId: string): Promise<StaffNotificationEntity[]> {
    return this.staffNotifications.find({
      where: { staffUserId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async markStaffRead(staffUserId: string, id: string): Promise<void> {
    const result = await this.staffNotifications.update(
      { id, staffUserId },
      { readAt: new Date() },
    );
    if (!result.affected) throw new NotFoundException('Notifica staff non trovata');
  }

  async notifySupportStaff(input: {
    ticketId: string;
    workspaceId: string;
    subject: string;
    body: string;
    eventId: string;
  }): Promise<void> {
    const recipients = await this.staffUsers.findBy({
      role: In(['admin', 'support']),
      status: 'active',
    });
    for (const staff of recipients) {
      await this.staffNotifications.save(
        this.staffNotifications.create({
          id: randomUUID(),
          staffUserId: staff.id,
          kind: 'support.ticket.activity',
          title: `Ticket: ${input.subject}`,
          body: input.body.slice(0, 1000),
          actionUrl: `#tickets:${input.ticketId}`,
          readAt: null,
          createdAt: new Date(),
        }),
      );
      await this.queueEmail({
        workspaceId: input.workspaceId,
        recipient: staff.email,
        template: 'support.ticket.staff_activity',
        category: 'transactional',
        variables: {
          subject: input.subject,
          message: input.body.slice(0, 1000),
          actionUrl: '#tickets',
        },
        idempotencyKey: `ticket:${input.ticketId}:${input.eventId}:staff:${staff.id}`,
      });
    }
  }

  async notifyTicketUser(input: {
    userId: string;
    ticketId: string;
    workspaceId: string;
    subject: string;
    body: string;
    eventId: string;
  }): Promise<void> {
    const user = await this.users.findOneBy({ id: input.userId });
    if (!user) return;
    await this.notify({
      userId: user.id,
      workspaceId: input.workspaceId,
      kind: 'support.ticket.reply',
      title: `Nuova risposta: ${input.subject}`,
      body: input.body.slice(0, 1000),
      actionUrl: '/ticket',
    });
    await this.queueEmail({
      workspaceId: input.workspaceId,
      recipient: user.email,
      template: 'support.ticket.user_reply',
      category: 'transactional',
      variables: {
        subject: input.subject,
        message: input.body.slice(0, 1000),
        actionUrl: '/ticket',
      },
      idempotencyKey: `ticket:${input.ticketId}:${input.eventId}:user:${user.id}`,
    });
  }

  async queueEmail(input: Omit<EmailJobData, 'deliveryId'>): Promise<void> {
    const existing = await this.deliveries.findOneBy({ idempotencyKey: input.idempotencyKey });
    if (existing) return;
    const delivery = await this.deliveries.save(
      this.deliveries.create({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        recipient: input.recipient.toLowerCase(),
        template: input.template,
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        providerId: null,
        failureReason: null,
        createdAt: new Date(),
        sentAt: null,
      }),
    );
    await this.emailQueue.add(
      'send',
      { ...input, deliveryId: delivery.id },
      { jobId: createHash('sha256').update(input.idempotencyKey).digest('hex') },
    );
  }

  async sendWorkspaceMessage(
    workspaceId: string,
    dto: SendWorkspaceEmailDto,
  ): Promise<{ queued: number }> {
    const memberships = await this.memberships.findBy({ workspaceId, status: 'active' });
    const users = await this.users.findBy({
      id: In(memberships.map((membership) => membership.userId)),
    });
    let queued = 0;
    for (const user of users) {
      const preference = await this.getPreferences(user.id, workspaceId);
      if (
        (dto.category === 'product' && !preference.productEmail) ||
        (dto.category === 'mass' && !preference.massEmail)
      )
        continue;
      await this.queueEmail({
        workspaceId,
        recipient: user.email,
        template: `workspace.${dto.category}`,
        category: dto.category,
        variables: { subject: dto.subject, message: dto.message, actionUrl: dto.actionUrl ?? '' },
        idempotencyKey: `workspace:${workspaceId}:${dto.category}:${Buffer.from(dto.subject).toString('base64url')}:${user.id}`,
      });
      queued += 1;
    }
    return { queued };
  }
}
