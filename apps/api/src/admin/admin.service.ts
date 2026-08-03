import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, IsNull, MoreThan, type Repository } from 'typeorm';
import { STORAGE_PROVIDER, type StorageProvider } from '../adapters/contracts';
import { BillingService } from '../billing/billing.service';
import { RabbitMqService } from '../events/rabbitmq.service';
import { AuthService } from '../identity/auth.service';
import { AuthTokenEntity } from '../identity/entities/auth-token.entity';
import { UserEntity } from '../identity/entities/user.entity';
import { LegalHoldEntity } from '../lifecycle/entities/legal-hold.entity';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { RedisService } from '../platform/redis.service';
import type {
  CreateSupportTicketMessageDto,
  UpdateSupportTicketDto,
} from '../support/dto/support-ticket.dto';
import { SupportTicketsService } from '../support/support-tickets.service';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import type { StaffPrincipal } from './admin.types';
import type { CreateAccountDto, LegalHoldDto, SupportSessionDto } from './dto/admin.dto';
import { StaffActionRequestEntity } from './entities/staff-action-request.entity';
import { StaffAuditEventEntity } from './entities/staff-audit-event.entity';
import { SupportAccessGrantEntity } from './entities/support-access-grant.entity';
import { SupportSessionEntity } from './entities/support-session.entity';

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DataSource,
    private readonly lifecycle: LifecycleService,
    @InjectRepository(StaffAuditEventEntity)
    private readonly audit: Repository<StaffAuditEventEntity>,
    @InjectRepository(SupportSessionEntity)
    private readonly support: Repository<SupportSessionEntity>,
    @InjectRepository(LegalHoldEntity) private readonly holds: Repository<LegalHoldEntity>,
    @InjectRepository(SupportAccessGrantEntity)
    private readonly grants: Repository<SupportAccessGrantEntity>,
    @InjectRepository(StaffActionRequestEntity)
    private readonly actionRequests: Repository<StaffActionRequestEntity>,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly supportTickets: SupportTicketsService,
    private readonly auth: AuthService,
    private readonly billing: BillingService,
  ) {}

  async services() {
    const checkedAt = new Date().toISOString();
    const checks = await Promise.all([
      this.measure(
        'api',
        'API PortfolioHub',
        async () => `uptime ${Math.floor(process.uptime())}s`,
      ),
      this.measure('database', 'PostgreSQL', async () => {
        await this.database.query('SELECT 1');
        return 'query SELECT 1';
      }),
      this.measure('redis', 'Redis', async () => {
        await this.redis.ping();
        return 'PONG';
      }),
      this.measure('rabbitmq', 'RabbitMQ', async () => {
        await this.rabbitMq.ping();
        return 'connessione AMQP';
      }),
      this.measure('storage', 'Storage provider', async () => {
        await this.storage.inspect('__portfoliohub_healthcheck__');
        return 'lettura metadata';
      }),
      this.measure('preview-worker', 'Worker anteprime', async () => {
        await this.redis.ping();
        const heartbeat = await this.redis.client.get('portfoliohub:preview-worker:heartbeat');
        if (!heartbeat || Date.now() - Number(heartbeat) > 30_000)
          throw new Error('heartbeat scaduto');
        return 'heartbeat recente';
      }),
      this.measure('storage-worker', 'Worker file', async () => {
        await this.redis.ping();
        const heartbeat = await this.redis.client.get('portfoliohub:storage-worker:heartbeat');
        if (!heartbeat || Date.now() - Number(heartbeat) > 30_000)
          throw new Error('heartbeat scaduto');
        return 'finalizzazione e cestino attivi';
      }),
    ]);
    return { checkedAt, checks };
  }

  tickets() {
    return this.supportTickets.listForStaff();
  }

  async updateTicket(staff: StaffPrincipal, id: string, dto: UpdateSupportTicketDto) {
    const ticket = await this.supportTickets.updateForStaff(id, dto);
    await this.record(
      staff.staffUserId,
      'ticket.update',
      'support-ticket',
      id,
      'Ticket aggiornato',
      {
        status: dto.status,
        priority: dto.priority,
      },
    );
    return ticket;
  }

  ticketMessages(id: string) {
    return this.supportTickets.listMessagesForStaff(id);
  }

  ticketEvents(id: string) {
    return this.supportTickets.streamForStaff(id);
  }

  async replyToTicket(staff: StaffPrincipal, id: string, dto: CreateSupportTicketMessageDto) {
    const message = await this.supportTickets.addStaffMessage(staff.staffUserId, id, dto);
    await this.record(
      staff.staffUserId,
      'ticket.reply',
      'support-ticket',
      id,
      'Risposta inviata al cliente',
      { messageId: message.id },
    );
    return message;
  }

  async overview(): Promise<Record<string, unknown>> {
    const [counts] = await this.database.query<Array<Record<string, string>>>(`
      SELECT
        (SELECT count(*) FROM users)::text AS users,
        (SELECT count(*) FROM workspaces)::text AS workspaces,
        (SELECT count(*) FROM workspaces WHERE status = 'suspended')::text AS suspended,
        (SELECT count(*) FROM upload_sessions WHERE status IN ('pending','uploading'))::text AS active_uploads,
        (SELECT count(*) FROM file_finalize_queue WHERE status = 'queued')::text AS queued_finalizations,
        (SELECT count(*) FROM file_finalize_queue WHERE status = 'processing')::text AS active_finalizations,
        (SELECT count(*) FROM file_finalize_queue WHERE status = 'failed')::text AS failed_finalizations,
        (SELECT count(*) FROM email_deliveries WHERE status = 'failed')::text AS failed_emails,
        (SELECT count(*) FROM legal_holds WHERE active = true)::text AS legal_holds
    `);
    return counts;
  }

  async workspaces(query = ''): Promise<Array<Record<string, unknown>>> {
    const where = query ? { name: ILike(`%${query}%`) } : {};
    const workspaces = await this.database
      .getRepository(WorkspaceEntity)
      .find({ where, order: { createdAt: 'DESC' }, take: 100 });
    return Promise.all(
      workspaces.map(async (workspace) => {
        const [stats] = await this.database.query<
          Array<{ projects: string; members: string; bytes: string }>
        >(
          `
        SELECT (SELECT count(*) FROM projects WHERE workspace_id = $1)::text AS projects,
          (SELECT count(*) FROM workspace_memberships WHERE workspace_id = $1 AND status = 'active')::text AS members,
          (SELECT COALESCE(sum(storage_delta_bytes),0) FROM quota_ledger WHERE workspace_id = $1)::text AS bytes
      `,
          [workspace.id],
        );
        return { ...workspace, stats };
      }),
    );
  }

  async accounts(query = ''): Promise<Array<Record<string, unknown>>> {
    const term = `%${query.trim()}%`;
    return this.database.query<Array<Record<string, unknown>>>(
      `
        SELECT
          u.id,
          u.email,
          u.display_name AS "displayName",
          u.status,
          u.email_verified_at AS "emailVerifiedAt",
          u.created_at AS "createdAt",
          COALESCE(
            json_agg(
              json_build_object(
                'id', w.id,
                'name', w.name,
                'plan', w.plan,
                'status', w.status
              ) ORDER BY w.created_at DESC
            ) FILTER (WHERE w.id IS NOT NULL),
            '[]'::json
          ) AS workspaces
        FROM users u
        LEFT JOIN workspaces w ON w.owner_user_id = u.id
        WHERE ($1 = '%%' OR u.email ILIKE $1 OR u.display_name ILIKE $1 OR w.name ILIKE $1)
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 100
      `,
      [term],
    );
  }

  async createAccount(staff: StaffPrincipal, dto: CreateAccountDto) {
    this.assertRole(staff, ['admin']);
    const created = await this.auth.signUp({
      ...dto,
      email: dto.email.trim().toLowerCase(),
      displayName: dto.displayName.trim(),
      workspaceName: dto.workspaceName.trim(),
    });
    await this.billing.assignManualPlan(created.workspaceId, 'free');
    await this.record(
      staff.staffUserId,
      'account.create',
      'user',
      created.userId,
      'Account creato dal backoffice',
      { workspaceId: created.workspaceId, initialPlan: 'free' },
    );
    return created;
  }

  async verifyAccount(staff: StaffPrincipal, userId: string, reason: string) {
    this.assertRole(staff, ['admin']);
    const user = await this.database.transaction(async (manager) => {
      const repository = manager.getRepository(UserEntity);
      const current = await repository.findOneBy({ id: userId });
      if (!current) throw new NotFoundException('Account non trovato');
      if (current.status === 'suspended' || current.status === 'deleting')
        throw new ConflictException('Lo stato dell’account non consente la verifica');
      if (current.emailVerifiedAt) throw new ConflictException('Account già verificato');
      current.status = 'active';
      current.emailVerifiedAt = new Date();
      current.updatedAt = new Date();
      await manager
        .getRepository(AuthTokenEntity)
        .update(
          { userId: current.id, purpose: 'verify-email', consumedAt: IsNull() },
          { consumedAt: current.emailVerifiedAt },
        );
      return repository.save(current);
    });
    await this.record(staff.staffUserId, 'account.verify', 'user', userId, reason, {
      email: user.email,
    });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }

  async assignManualPlan(
    staff: StaffPrincipal,
    workspaceId: string,
    plan: 'free' | 'pro' | 'unlimited',
    reason: string,
  ) {
    this.assertRole(staff, ['admin']);
    const result = await this.billing.assignManualPlan(workspaceId, plan);
    await this.record(staff.staffUserId, 'billing.manual-plan', 'workspace', workspaceId, reason, {
      plan,
      source: 'manual',
    });
    return result;
  }

  async suspend(staff: StaffPrincipal, workspaceId: string, reason: string) {
    this.assertRole(staff, ['admin', 'compliance']);
    const abuse = await this.lifecycle.suspendWorkspace(workspaceId, reason, staff.staffUserId);
    await this.record(staff.staffUserId, 'workspace.suspend', 'workspace', workspaceId, reason, {
      abuseCaseId: abuse.id,
    });
    return abuse;
  }

  async createLegalHold(
    staff: StaffPrincipal,
    workspaceId: string,
    dto: LegalHoldDto,
  ): Promise<LegalHoldEntity> {
    this.assertRole(staff, ['admin', 'compliance']);
    if (!(await this.database.getRepository(WorkspaceEntity).existsBy({ id: workspaceId })))
      throw new NotFoundException('Workspace non trovato');
    const hold = await this.holds.save(
      this.holds.create({
        id: randomUUID(),
        workspaceId,
        reason: dto.reason,
        authorityReference: dto.authorityReference ?? null,
        active: true,
        createdByStaffId: staff.staffUserId,
        createdAt: new Date(),
        releasedAt: null,
      }),
    );
    await this.record(
      staff.staffUserId,
      'legal-hold.create',
      'workspace',
      workspaceId,
      dto.reason,
      { holdId: hold.id, authorityReference: hold.authorityReference },
    );
    return hold;
  }

  async releaseLegalHold(staff: StaffPrincipal, id: string, reason: string): Promise<void> {
    this.assertRole(staff, ['admin', 'compliance']);
    const hold = await this.holds.findOneBy({ id, active: true });
    if (!hold) throw new NotFoundException('Legal hold non trovato');
    await this.holds.update(id, { active: false, releasedAt: new Date() });
    await this.record(staff.staffUserId, 'legal-hold.release', 'legal-hold', id, reason, {
      workspaceId: hold.workspaceId,
    });
  }

  async startSupportSession(
    staff: StaffPrincipal,
    dto: SupportSessionDto,
  ): Promise<SupportSessionEntity> {
    this.assertRole(
      staff,
      dto.mode === 'break_glass' ? ['admin'] : ['admin', 'support', 'compliance'],
    );
    if (!(await this.database.getRepository(WorkspaceEntity).existsBy({ id: dto.workspaceId })))
      throw new NotFoundException('Workspace non trovato');
    if (dto.mode === 'read_only') {
      const grant = await this.grants.findOne({
        where: {
          workspaceId: dto.workspaceId,
          usedAt: IsNull(),
          revokedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        order: { createdAt: 'DESC' },
      });
      if (!grant) throw new ForbiddenException('Consenso Owner mancante o scaduto');
      grant.usedAt = new Date();
      await this.grants.save(grant);
    } else {
      const request = dto.actionRequestId
        ? await this.actionRequests.findOneBy({
            id: dto.actionRequestId,
            action: 'break_glass',
            targetId: dto.workspaceId,
            status: 'approved',
          })
        : null;
      if (!request || request.requestedBy !== staff.staffUserId || request.expiresAt <= new Date())
        throw new ForbiddenException('Break-glass privo di seconda approvazione valida');
      request.status = 'used';
      await this.actionRequests.save(request);
    }
    const duration = dto.mode === 'break_glass' ? 15 : 60;
    const session = await this.support.save(
      this.support.create({
        id: randomUUID(),
        staffUserId: staff.staffUserId,
        workspaceId: dto.workspaceId,
        reason: dto.reason,
        mode: dto.mode,
        expiresAt: new Date(Date.now() + duration * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
      }),
    );
    await this.record(
      staff.staffUserId,
      `support-session.${dto.mode}`,
      'workspace',
      dto.workspaceId,
      dto.reason,
      { supportSessionId: session.id, expiresAt: session.expiresAt },
    );
    return session;
  }

  activeSupportSessions(staff: StaffPrincipal): Promise<SupportSessionEntity[]> {
    return this.support.find({
      where: {
        staffUserId: staff.staffUserId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  staffAudit(staff: StaffPrincipal): Promise<StaffAuditEventEntity[]> {
    this.assertRole(staff, ['admin', 'compliance']);
    return this.audit.find({ order: { createdAt: 'DESC' }, take: 500 });
  }

  async grantSupport(
    ownerUserId: string,
    workspaceId: string,
    reason: string,
  ): Promise<SupportAccessGrantEntity> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: workspaceId, ownerUserId });
    if (!workspace) throw new ForbiddenException('Solo l’Owner può autorizzare il supporto');
    return this.grants.save(
      this.grants.create({
        id: randomUUID(),
        workspaceId,
        ownerUserId,
        reason,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: null,
        revokedAt: null,
        createdAt: new Date(),
      }),
    );
  }

  async requestBreakGlass(
    staff: StaffPrincipal,
    workspaceId: string,
    reason: string,
  ): Promise<StaffActionRequestEntity> {
    this.assertRole(staff, ['admin', 'compliance']);
    const request = await this.actionRequests.save(
      this.actionRequests.create({
        id: randomUUID(),
        requestedBy: staff.staffUserId,
        approvedBy: null,
        action: 'break_glass',
        targetId: workspaceId,
        reason,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        createdAt: new Date(),
        approvedAt: null,
      }),
    );
    await this.record(staff.staffUserId, 'break-glass.request', 'workspace', workspaceId, reason, {
      requestId: request.id,
    });
    return request;
  }

  async approveAction(staff: StaffPrincipal, requestId: string): Promise<StaffActionRequestEntity> {
    this.assertRole(staff, ['admin', 'compliance']);
    const request = await this.actionRequests.findOneBy({ id: requestId, status: 'pending' });
    if (!request || request.expiresAt <= new Date())
      throw new NotFoundException('Richiesta non disponibile');
    if (request.requestedBy === staff.staffUserId)
      throw new ForbiddenException('Non puoi approvare la tua stessa richiesta');
    request.status = 'approved';
    request.approvedBy = staff.staffUserId;
    request.approvedAt = new Date();
    await this.actionRequests.save(request);
    await this.record(
      staff.staffUserId,
      'staff-action.approve',
      'staff-action',
      request.id,
      request.reason,
      { action: request.action, requestedBy: request.requestedBy },
    );
    return request;
  }

  private assertRole(staff: StaffPrincipal, roles: StaffPrincipal['role'][]): void {
    if (!roles.includes(staff.role)) throw new ForbiddenException('Ruolo staff insufficiente');
  }

  private async measure(
    key: string,
    label: string,
    ping: () => Promise<string>,
  ): Promise<{
    key: string;
    label: string;
    status: 'up' | 'down';
    latencyMs: number;
    detail: string;
  }> {
    const startedAt = performance.now();
    try {
      const detail = await ping();
      return {
        key,
        label,
        status: 'up',
        latencyMs: Math.round(performance.now() - startedAt),
        detail,
      };
    } catch (error) {
      return {
        key,
        label,
        status: 'down',
        latencyMs: Math.round(performance.now() - startedAt),
        detail: error instanceof Error ? error.message.slice(0, 160) : 'ping fallito',
      };
    }
  }

  private async record(
    staffUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    reason: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.save(
      this.audit.create({
        id: randomUUID(),
        staffUserId,
        action,
        targetType,
        targetId,
        reason,
        metadata,
        createdAt: new Date(),
      }),
    );
  }
}
