import { createHash, randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { verify } from 'argon2';
import type { Queue } from 'bullmq';
import { DataSource, IsNull, type Repository } from 'typeorm';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../adapters/contracts';
import { UserEntity } from '../identity/entities/user.entity';
import { queueJobId } from '../platform/queue-job-id';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import type { AccountDeletionDto, AppealDto, PrivacyRequestDto } from './dto/lifecycle.dto';
import { AbuseCaseEntity } from './entities/abuse-case.entity';
import { AccountDeletionRequestEntity } from './entities/account-deletion-request.entity';
import { LegalHoldEntity } from './entities/legal-hold.entity';
import { PrivacyRequestEntity } from './entities/privacy-request.entity';

@Injectable()
export class LifecycleService {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(AccountDeletionRequestEntity)
    private readonly deletions: Repository<AccountDeletionRequestEntity>,
    @InjectRepository(PrivacyRequestEntity)
    private readonly privacy: Repository<PrivacyRequestEntity>,
    @InjectRepository(LegalHoldEntity) private readonly holds: Repository<LegalHoldEntity>,
    @InjectRepository(AbuseCaseEntity) private readonly abuse: Repository<AbuseCaseEntity>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @InjectQueue('maintenance') private readonly maintenance: Queue,
  ) {}

  accountDeletion(userId: string): Promise<AccountDeletionRequestEntity | null> {
    return this.deletions.findOne({
      where: { userId, completedAt: IsNull(), cancelledAt: IsNull() },
      order: { requestedAt: 'DESC' },
    });
  }

  async scheduleAccountDeletion(
    userId: string,
    currentSessionId: string,
    dto: AccountDeletionDto,
  ): Promise<AccountDeletionRequestEntity> {
    await this.reauthenticate(userId, dto.password);
    const existing = await this.deletions.findOneBy({
      userId,
      completedAt: IsNull(),
      cancelledAt: IsNull(),
    });
    if (existing) return existing;
    const requestedAt = new Date();
    const scheduledFor = new Date(requestedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const owned = await this.database
      .getRepository(WorkspaceEntity)
      .findBy({ ownerUserId: userId });
    if (owned.length) {
      const blocked = await this.holds
        .createQueryBuilder('hold')
        .where('hold.workspaceId IN (:...ids)', { ids: owned.map((workspace) => workspace.id) })
        .andWhere('hold.active = true')
        .getCount();
      if (blocked) throw new ConflictException('Eliminazione sospesa per obbligo legale');
    }
    const request = await this.database.transaction(async (manager) => {
      await manager.getRepository(UserEntity).update(userId, { deletionScheduledAt: scheduledFor });
      await manager.query(
        `UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL`,
        [userId, currentSessionId],
      );
      if (owned.length)
        await manager
          .getRepository(WorkspaceEntity)
          .createQueryBuilder()
          .update()
          .set({ status: 'deleting', deletionScheduledAt: scheduledFor })
          .where('owner_user_id = :userId', { userId })
          .execute();
      return manager.getRepository(AccountDeletionRequestEntity).save({
        id: randomUUID(),
        userId,
        subjectHash: createHash('sha256').update(userId).digest('hex'),
        requestedAt,
        scheduledFor,
        cancelledAt: null,
        completedAt: null,
        certificate: null,
      });
    });
    await this.maintenance.add(
      'purge-account',
      { requestId: request.id },
      { jobId: queueJobId('purge', request.id), delay: scheduledFor.getTime() - Date.now() },
    );
    for (const day of [0, 7, 23, 29])
      await this.maintenance.add(
        'deletion-reminder',
        { requestId: request.id, day },
        {
          jobId: queueJobId('deletion-reminder', request.id, day),
          delay: day * 24 * 60 * 60 * 1000,
        },
      );
    return request;
  }

  async cancelAccountDeletion(userId: string, dto: AccountDeletionDto): Promise<void> {
    await this.reauthenticate(userId, dto.password);
    const request = await this.deletions.findOneBy({
      userId,
      completedAt: IsNull(),
      cancelledAt: IsNull(),
    });
    if (!request) throw new NotFoundException('Eliminazione non programmata');
    await this.database.transaction(async (manager) => {
      await manager
        .getRepository(AccountDeletionRequestEntity)
        .update(request.id, { cancelledAt: new Date() });
      await manager
        .getRepository(UserEntity)
        .update(userId, { status: 'active', deletionScheduledAt: null });
      await manager
        .getRepository(WorkspaceEntity)
        .createQueryBuilder()
        .update()
        .set({ status: 'active', deletionScheduledAt: null })
        .where('owner_user_id = :userId', { userId })
        .execute();
    });
    await this.maintenance.remove(queueJobId('purge', request.id));
    for (const day of [0, 7, 23, 29])
      await this.maintenance.remove(queueJobId('deletion-reminder', request.id, day));
  }

  async requestPrivacy(userId: string, dto: PrivacyRequestDto): Promise<PrivacyRequestEntity> {
    const request = await this.privacy.save(
      this.privacy.create({
        id: randomUUID(),
        userId,
        kind: dto.kind,
        status: 'queued',
        resultKey: null,
        requestedAt: new Date(),
        completedAt: null,
      }),
    );
    if (dto.kind === 'portability' || dto.kind === 'access') {
      await this.maintenance.add(
        'privacy-export',
        { requestId: request.id },
        {
          jobId: queueJobId('privacy-export', request.id),
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      );
    }
    return request;
  }

  listPrivacy(userId: string): Promise<PrivacyRequestEntity[]> {
    return this.privacy.find({ where: { userId }, order: { requestedAt: 'DESC' } });
  }

  async downloadPrivacyExport(userId: string, requestId: string): Promise<Buffer> {
    const request = await this.privacy.findOneBy({ id: requestId, userId });
    if (!request?.resultKey || request.status !== 'completed')
      throw new NotFoundException('Backup non disponibile');
    return this.storage.read(request.resultKey);
  }

  async processPrivacyExport(requestId: string): Promise<void> {
    const request = await this.privacy.findOneBy({ id: requestId });
    if (!request || request.status === 'completed') return;
    await this.privacy.update(request.id, { status: 'processing' });
    try {
      const ownedWorkspaces = await this.database
        .getRepository(WorkspaceEntity)
        .findBy({ ownerUserId: request.userId });
      const workspaceIds = ownedWorkspaces.map((workspace) => workspace.id);
      const directTables = [
        'workspace_memberships',
        'projects',
        'clients',
        'file_nodes',
        'deliveries',
        'support_tickets',
        'portfolio_sites',
        'activity_events',
        'audit_events',
        'notifications',
        'notification_preferences',
        'billing_subscriptions',
        'quota_ledger',
        'workspace_invites',
        'acl_entries',
      ] as const;
      const tables: Record<string, unknown[]> = {};
      for (const table of directTables) {
        tables[table] = workspaceIds.length
          ? await this.database.query(
              `SELECT * FROM "${table}" WHERE workspace_id = ANY($1::uuid[])`,
              [workspaceIds],
            )
          : [];
      }
      tables['file_versions'] = workspaceIds.length
        ? await this.database.query(
            'SELECT fv.* FROM file_versions fv JOIN file_nodes fn ON fn.id=fv.file_node_id WHERE fn.workspace_id = ANY($1::uuid[])',
            [workspaceIds],
          )
        : [];
      for (const table of ['delivery_items', 'delivery_comments', 'delivery_approvals'] as const) {
        tables[table] = workspaceIds.length
          ? await this.database.query(
              `SELECT child.* FROM "${table}" child JOIN deliveries d ON d.id=child.delivery_id WHERE d.workspace_id = ANY($1::uuid[])`,
              [workspaceIds],
            )
          : [];
      }
      tables['support_ticket_messages'] = workspaceIds.length
        ? await this.database.query(
            'SELECT message.* FROM support_ticket_messages message JOIN support_tickets ticket ON ticket.id=message.ticket_id WHERE ticket.workspace_id = ANY($1::uuid[])',
            [workspaceIds],
          )
        : [];
      const [account] = await this.database.query(
        'SELECT id, email, display_name, status, email_verified_at, created_at, updated_at FROM users WHERE id=$1',
        [request.userId],
      );
      const completedAt = new Date();
      const content = Buffer.from(
        JSON.stringify(
          {
            format: 'portfoliohub-portability-v1',
            generatedAt: completedAt.toISOString(),
            account,
            workspaces: ownedWorkspaces,
            data: tables,
          },
          null,
          2,
        ),
      );
      const key = `privacy/${request.userId}/${request.id}.json`;
      await this.storage.put(key, content);
      await this.privacy.update(request.id, { status: 'completed', resultKey: key, completedAt });
      const user = await this.database.getRepository(UserEntity).findOneBy({ id: request.userId });
      if (user)
        await this.email.send({
          idempotencyKey: `privacy-export:${request.id}:ready`,
          to: user.email,
          template: 'account.privacy_export_ready',
          locale: 'it',
          variables: { displayName: user.displayName, requestId: request.id },
        });
    } catch (error) {
      await this.privacy.update(request.id, { status: 'rejected' });
      throw error;
    }
  }

  async appeal(userId: string, workspaceId: string, dto: AppealDto): Promise<AbuseCaseEntity> {
    const owns = await this.database
      .getRepository(WorkspaceEntity)
      .existsBy({ id: workspaceId, ownerUserId: userId });
    if (!owns) throw new NotFoundException('Workspace non trovato');
    const abuseCase = await this.abuse.findOne({
      where: { workspaceId, status: 'suspended' },
      order: { createdAt: 'DESC' },
    });
    if (!abuseCase) throw new NotFoundException('Sospensione non trovata');
    abuseCase.status = 'appealed';
    abuseCase.appealText = dto.text;
    abuseCase.appealedAt = new Date();
    return this.abuse.save(abuseCase);
  }

  async wipeWorkspace(userId: string, workspaceId: string): Promise<{ deletedObjects: number }> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: workspaceId, ownerUserId: userId });
    if (!workspace) throw new NotFoundException('Workspace non trovato');
    if (await this.holds.existsBy({ workspaceId, active: true }))
      throw new ConflictException('I dati sono soggetti a legal hold');
    const versions = await this.database.query<Array<{ object_key: string }>>(
      `SELECT fv.object_key FROM file_versions fv JOIN file_nodes fn ON fn.id = fv.file_node_id WHERE fn.workspace_id = $1`,
      [workspaceId],
    );
    for (const version of versions)
      await this.storage.delete(version.object_key).catch(() => undefined);
    await this.database.transaction(async (manager) => {
      await manager.query(`DELETE FROM projects WHERE workspace_id = $1`, [workspaceId]);
      await manager.query(`DELETE FROM quota_ledger WHERE workspace_id = $1`, [workspaceId]);
      await manager.getRepository(WorkspaceEntity).update(workspaceId, { status: 'active' });
    });
    return { deletedObjects: versions.length };
  }

  async suspendWorkspace(
    workspaceId: string,
    reason: string,
    staffUserId: string,
  ): Promise<AbuseCaseEntity> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: workspaceId });
    if (!workspace) throw new NotFoundException('Workspace non trovato');
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const abuseCase = await this.abuse.save(
      this.abuse.create({
        id: randomUUID(),
        workspaceId,
        status: 'suspended',
        reason,
        suspendedAt: now,
        purgeAfter: scheduledFor,
        appealText: null,
        appealedAt: null,
        resolvedAt: null,
        createdAt: now,
      }),
    );
    let deletion = await this.deletions.findOneBy({
      userId: workspace.ownerUserId,
      completedAt: IsNull(),
      cancelledAt: IsNull(),
    });
    await this.database.transaction(async (manager) => {
      await manager
        .getRepository(WorkspaceEntity)
        .update(workspaceId, { status: 'suspended', deletionScheduledAt: scheduledFor });
      await manager
        .getRepository(UserEntity)
        .update(workspace.ownerUserId, { status: 'suspended', deletionScheduledAt: scheduledFor });
      if (!deletion) {
        deletion = await manager.getRepository(AccountDeletionRequestEntity).save({
          id: randomUUID(),
          userId: workspace.ownerUserId,
          subjectHash: createHash('sha256').update(workspace.ownerUserId).digest('hex'),
          requestedAt: now,
          scheduledFor,
          cancelledAt: null,
          completedAt: null,
          certificate: { origin: 'abuse', abuseCaseId: abuseCase.id, staffUserId },
        });
      }
    });
    if (deletion)
      await this.maintenance.add(
        'purge-account',
        { requestId: deletion.id },
        {
          jobId: queueJobId('purge', deletion.id),
          delay: Math.max(0, scheduledFor.getTime() - Date.now()),
        },
      );
    return abuseCase;
  }

  async purgeAccount(requestId: string): Promise<void> {
    const request = await this.deletions.findOneBy({
      id: requestId,
      completedAt: IsNull(),
      cancelledAt: IsNull(),
    });
    if (!request?.userId || request.scheduledFor > new Date()) return;
    const userId = request.userId;
    const workspaces = await this.database
      .getRepository(WorkspaceEntity)
      .findBy({ ownerUserId: userId });
    for (const workspace of workspaces) {
      if (await this.holds.existsBy({ workspaceId: workspace.id, active: true })) return;
      await this.wipeWorkspace(userId, workspace.id);
    }
    const certificate: Record<string, unknown> = {
      requestId,
      subjectHash: request.subjectHash,
      completedAt: new Date().toISOString(),
      workspaceCount: workspaces.length,
    };
    certificate['sha256'] = createHash('sha256').update(JSON.stringify(certificate)).digest('hex');
    await this.database.transaction(async (manager) => {
      for (const workspace of workspaces)
        await manager.getRepository(WorkspaceEntity).delete(workspace.id);
      await manager.query(
        'UPDATE account_deletion_requests SET completed_at=$2, certificate=$3::jsonb WHERE id=$1',
        [request.id, new Date(), JSON.stringify(certificate)],
      );
      await manager.getRepository(UserEntity).delete(userId);
    });
  }

  async remindDeletion(requestId: string, day: number): Promise<void> {
    const request = await this.deletions.findOneBy({
      id: requestId,
      completedAt: IsNull(),
      cancelledAt: IsNull(),
    });
    if (!request?.userId) return;
    const user = await this.database.getRepository(UserEntity).findOneBy({ id: request.userId });
    if (!user) return;
    await this.email.send({
      idempotencyKey: `deletion-reminder:${request.id}:${day}`,
      to: user.email,
      template: 'account.deletion_scheduled',
      locale: 'it',
      variables: {
        displayName: user.displayName,
        scheduledFor: request.scheduledFor.toISOString(),
        day: String(day),
      },
    });
  }

  private async reauthenticate(userId: string, password: string): Promise<void> {
    const user = await this.database
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id=:userId', { userId })
      .getOne();
    if (!user?.passwordHash || !(await verify(user.passwordHash, password)))
      throw new ConflictException('Riautenticazione non valida');
  }
}
