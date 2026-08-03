import { randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { OutboxService } from '../events/outbox.service';
import { UsersRepository } from '../identity/users.repository';
import type {
  CreateWorkspaceDto,
  TransferOwnershipDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto';
import { WorkspaceEntity } from './entities/workspace.entity';
import {
  WorkspaceMembershipEntity,
  type WorkspaceRole,
} from './entities/workspace-membership.entity';
import { workspaceCreationCapability } from './workspace-plan-policy';
import { WorkspacesRepository } from './workspaces.repository';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly database: DataSource,
    private readonly repository: WorkspacesRepository,
    private readonly users: UsersRepository,
    private readonly outbox: OutboxService,
  ) {}

  list(userId: string) {
    return this.repository.listForUser(userId);
  }

  async capabilities(userId: string) {
    const owned = await this.database
      .getRepository(WorkspaceEntity)
      .find({ where: { ownerUserId: userId }, select: { plan: true } });
    return workspaceCreationCapability(owned.map((workspace) => workspace.plan));
  }

  async create(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceEntity> {
    return this.database.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `workspace-owner:${userId}`,
      ]);
      const owned = await manager
        .getRepository(WorkspaceEntity)
        .find({ where: { ownerUserId: userId }, select: { plan: true } });
      const capability = workspaceCreationCapability(owned.map((workspace) => workspace.plan));
      if (!capability.canCreate) {
        throw new ConflictException(
          `Il piano ${capability.entitlementPlan} consente ${capability.limit} workspace`,
        );
      }
      const now = new Date();
      const workspaceRepository = manager.getRepository(WorkspaceEntity);
      const workspace = await workspaceRepository.save(
        workspaceRepository.create({
          id: randomUUID(),
          name: dto.name.trim(),
          slug: `${this.slugify(dto.name)}-${randomBytes(3).toString('hex')}`,
          type: dto.type,
          ownerUserId: userId,
          plan: 'free',
          status: 'active',
          onboardingCompletedAt: null,
          createdAt: now,
          updatedAt: now,
          deletionScheduledAt: null,
          trialEndsAt: null,
        }),
      );
      await manager.getRepository(WorkspaceMembershipEntity).save({
        id: randomUUID(),
        workspaceId: workspace.id,
        userId,
        role: 'owner',
        status: 'active',
        createdAt: now,
      });
      await this.outbox.record(
        {
          topic: 'workspace.created',
          aggregateType: 'Workspace',
          aggregateId: workspace.id,
          payload: { ownerUserId: userId, type: dto.type },
        },
        manager,
      );
      return workspace;
    });
  }

  async get(
    workspaceId: string,
    userId: string,
  ): Promise<{ workspace: WorkspaceEntity; role: WorkspaceRole }> {
    const membership = await this.repository.membership(workspaceId, userId);
    if (!membership) throw new NotFoundException('Workspace non trovato');
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: workspaceId });
    if (!workspace) throw new NotFoundException('Workspace non trovato');
    return { workspace, role: membership.role };
  }

  async update(workspaceId: string, userId: string, dto: UpdateWorkspaceDto) {
    await this.assertRole(workspaceId, userId, ['owner', 'admin']);
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    workspace.name = dto.name.trim();
    workspace.updatedAt = new Date();
    return this.database.getRepository(WorkspaceEntity).save(workspace);
  }

  async completeOnboarding(workspaceId: string, userId: string): Promise<void> {
    await this.assertRole(workspaceId, userId, ['owner', 'admin']);
    await this.database
      .getRepository(WorkspaceEntity)
      .update({ id: workspaceId }, { onboardingCompletedAt: new Date(), updatedAt: new Date() });
  }

  async search(workspaceId: string, userId: string, rawQuery: string) {
    await this.assertRole(workspaceId, userId, [
      'owner',
      'admin',
      'editor',
      'uploader',
      'viewer',
      'guest',
    ]);
    const query = rawQuery.trim().slice(0, 120);
    if (query.length < 2) return [];
    return this.database.query<
      Array<{
        id: string;
        type: 'project' | 'client' | 'file' | 'folder';
        title: string;
        subtitle: string;
        actionUrl: string;
        rank: number;
      }>
    >(
      `
        WITH search_query AS (SELECT websearch_to_tsquery('simple', $2) AS value), results AS (
          SELECT p.id, 'project'::text AS type, p.name AS title,
            'Progetto'::text AS subtitle, '/progetti/' || p.id::text AS "actionUrl",
            ts_rank(to_tsvector('simple', p.name), search_query.value) AS rank
          FROM projects p, search_query
          WHERE p.workspace_id = $1 AND p.status <> 'trashed'
            AND (to_tsvector('simple', p.name) @@ search_query.value OR p.name ILIKE $3)
          UNION ALL
          SELECT c.id, 'client', c.name,
            COALESCE(c.email, 'Cliente'), '/clienti',
            ts_rank(to_tsvector('simple', c.name || ' ' || COALESCE(c.email, '')), search_query.value)
          FROM clients c, search_query
          WHERE c.workspace_id = $1
            AND (
              to_tsvector('simple', c.name || ' ' || COALESCE(c.email, '')) @@ search_query.value
              OR c.name ILIKE $3 OR c.email ILIKE $3
            )
          UNION ALL
          SELECT f.id, f.kind::text, f.name,
            'File in ' || p.name, '/progetti/' || f.project_id::text,
            ts_rank(to_tsvector('simple', f.name || ' ' || p.name), search_query.value)
          FROM file_nodes f
          JOIN projects p ON p.id = f.project_id
          CROSS JOIN search_query
          WHERE f.workspace_id = $1 AND f.trashed_at IS NULL
            AND (
              to_tsvector('simple', f.name || ' ' || p.name) @@ search_query.value
              OR f.name ILIKE $3
            )
        )
        SELECT * FROM results ORDER BY rank DESC, title ASC LIMIT 30
      `,
      [workspaceId, query, `%${query}%`],
    );
  }

  async transferOwnership(
    workspaceId: string,
    userId: string,
    dto: TransferOwnershipDto,
  ): Promise<void> {
    const currentUser = await this.users.findByEmailWithPassword(
      (await this.users.findById(userId))?.email ?? '',
    );
    if (
      !currentUser?.passwordHash ||
      !(await argon2.verify(currentUser.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Riautenticazione non valida');
    }
    await this.database.transaction('SERIALIZABLE', async (manager) => {
      const workspaceRepository = manager.getRepository(WorkspaceEntity);
      const membershipRepository = manager.getRepository(WorkspaceMembershipEntity);
      const workspace = await workspaceRepository
        .createQueryBuilder('workspace')
        .setLock('pessimistic_write')
        .where('workspace.id = :workspaceId', { workspaceId })
        .getOne();
      if (!workspace || workspace.ownerUserId !== userId)
        throw new ForbiddenException('Solo l’Owner può trasferire la proprietà');
      const target = await membershipRepository.findOneBy({
        workspaceId,
        userId: dto.newOwnerUserId,
        status: 'active',
      });
      const current = await membershipRepository.findOneBy({
        workspaceId,
        userId,
        role: 'owner',
        status: 'active',
      });
      if (!target || !current)
        throw new NotFoundException('Il nuovo Owner deve essere un membro attivo');
      current.role = 'admin';
      target.role = 'owner';
      workspace.ownerUserId = target.userId;
      workspace.updatedAt = new Date();
      await membershipRepository.save([current, target]);
      await workspaceRepository.save(workspace);
      await this.outbox.record(
        {
          topic: 'workspace.ownership.transferred',
          aggregateType: 'Workspace',
          aggregateId: workspaceId,
          payload: {
            previousOwnerUserId: userId,
            newOwnerUserId: target.userId,
          },
        },
        manager,
      );
    });
  }

  async assertRole(
    workspaceId: string,
    userId: string,
    allowed: WorkspaceRole[],
  ): Promise<WorkspaceMembershipEntity> {
    const membership = await this.repository.membership(workspaceId, userId);
    if (!membership || !allowed.includes(membership.role))
      throw new ForbiddenException('Permessi insufficienti');
    return membership;
  }

  private slugify(value: string): string {
    return (
      value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'workspace'
    );
  }
}
