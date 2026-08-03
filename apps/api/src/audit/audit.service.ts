import { randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { WorkspaceMembershipEntity } from '../workspaces/entities/workspace-membership.entity';
import { ActivityEventEntity } from './entities/activity-event.entity';
import { AuditEventEntity } from './entities/audit-event.entity';

@Injectable()
export class AuditService {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(ActivityEventEntity)
    private readonly activity: Repository<ActivityEventEntity>,
    @InjectRepository(AuditEventEntity) private readonly audit: Repository<AuditEventEntity>,
  ) {}

  async recordActivity(
    input: Omit<ActivityEventEntity, 'id' | 'createdAt'>,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager?.getRepository(ActivityEventEntity) ?? this.activity;
    await repository.save(repository.create({ id: randomUUID(), ...input, createdAt: new Date() }));
  }

  async recordAudit(
    input: Omit<AuditEventEntity, 'id' | 'createdAt'>,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager?.getRepository(AuditEventEntity) ?? this.audit;
    await repository.save(repository.create({ id: randomUUID(), ...input, createdAt: new Date() }));
  }

  activityFeed(
    workspaceId: string,
    projectIds: string[],
    limit = 50,
  ): Promise<ActivityEventEntity[]> {
    const query = this.activity
      .createQueryBuilder('event')
      .where('event.workspaceId = :workspaceId', { workspaceId });
    if (projectIds.length > 0)
      query.andWhere('(event.projectId IS NULL OR event.projectId IN (:...projectIds))', {
        projectIds,
      });
    return query.orderBy('event.createdAt', 'DESC').take(Math.min(limit, 100)).getMany();
  }

  async activityFeedForUser(
    workspaceId: string,
    userId: string,
    projectId?: string,
  ): Promise<ActivityEventEntity[]> {
    const membership = await this.database
      .getRepository(WorkspaceMembershipEntity)
      .findOneBy({ workspaceId, userId, status: 'active' });
    if (!membership) throw new ForbiddenException('Accesso al workspace negato');
    if (membership.role !== 'guest')
      return this.activityFeed(workspaceId, projectId ? [projectId] : [], 50);
    const rows = await this.database.query<Array<{ projectId: string }>>(
      `SELECT DISTINCT COALESCE(acl.project_id,node.project_id) AS "projectId" FROM acl_entries acl LEFT JOIN file_nodes node ON node.id=acl.node_id WHERE acl.workspace_id=$1 AND acl.user_id=$2 AND acl.effect='allow' AND acl.permission IN ('*','project.read','file.read')`,
      [workspaceId, userId],
    );
    const allowed = rows.map((row) => row.projectId).filter(Boolean);
    if (projectId && !allowed.includes(projectId))
      throw new ForbiddenException('Progetto non visibile');
    if (allowed.length === 0) return [];
    return this.activityFeed(workspaceId, projectId ? [projectId] : allowed, 50);
  }

  auditFeed(workspaceId: string, limit = 100): Promise<AuditEventEntity[]> {
    return this.audit.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }
}
