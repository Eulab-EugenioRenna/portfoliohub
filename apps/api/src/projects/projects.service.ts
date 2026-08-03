import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { IsNull, type Repository } from 'typeorm';
import { QuotaService } from '../billing/quota.service';
import { AuthorizationService } from '../collaboration/authorization.service';
import { OutboxService } from '../events/outbox.service';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { queueJobId } from '../platform/queue-job-id';
import type { CreateClientDto, CreateProjectDto, UpdateProjectDto } from './dto/projects.dto';
import { ClientEntity } from './entities/client.entity';
import { ProjectEntity } from './entities/project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ClientEntity) private readonly clients: Repository<ClientEntity>,
    private readonly authorization: AuthorizationService,
    private readonly quota: QuotaService,
    private readonly outbox: OutboxService,
    @InjectQueue('file-maintenance') private readonly maintenanceQueue: Queue,
  ) {}

  async list(workspaceId: string, userId: string): Promise<ProjectEntity[]> {
    const visible = await this.authorization.visibleProjectIds(workspaceId, userId);
    const query = this.projects
      .createQueryBuilder('project')
      .where('project.workspaceId = :workspaceId', { workspaceId })
      .andWhere('project.trashedAt IS NULL');
    if (visible) {
      if (visible.length === 0) return [];
      query.andWhere('project.id IN (:...visible)', { visible });
    }
    return query.orderBy('project.updatedAt', 'DESC').getMany();
  }

  async create(workspaceId: string, userId: string, dto: CreateProjectDto): Promise<ProjectEntity> {
    await this.authorization.assert({ workspaceId, userId, permission: 'project.write' });
    await this.quota.assertProjectCreation(workspaceId);
    if (dto.clientId && !(await this.clients.existsBy({ id: dto.clientId, workspaceId }))) {
      throw new NotFoundException('Cliente non trovato');
    }
    const now = new Date();
    const project = await this.projects.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ProjectEntity);
      const created = await repository.save(
        repository.create({
          id: randomUUID(),
          workspaceId,
          clientId: dto.clientId ?? null,
          name: dto.name.trim(),
          status: 'active',
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
          trashedAt: null,
        }),
      );
      await manager.getRepository(FileNodeEntity).save({
        id: randomUUID(),
        workspaceId,
        projectId: created.id,
        parentId: null,
        kind: 'folder',
        name: created.name,
        currentVersionId: null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        trashedAt: null,
      });
      await this.outbox.record(
        {
          topic: 'project.created',
          aggregateType: 'Project',
          aggregateId: created.id,
          payload: { workspaceId },
        },
        manager,
      );
      return created;
    });
    return project;
  }

  async update(
    workspaceId: string,
    projectId: string,
    userId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectEntity> {
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'project.write',
      projectId,
    });
    const project = await this.projects.findOneBy({
      id: projectId,
      workspaceId,
      trashedAt: IsNull(),
    });
    if (!project) throw new NotFoundException('Progetto non trovato');
    if (dto.clientId && !(await this.clients.existsBy({ id: dto.clientId, workspaceId }))) {
      throw new NotFoundException('Cliente non trovato');
    }
    if (dto.name !== undefined) project.name = dto.name.trim();
    if (dto.clientId !== undefined) project.clientId = dto.clientId;
    project.updatedAt = new Date();
    return this.projects.save(project);
  }

  async clientsList(workspaceId: string, userId: string): Promise<ClientEntity[]> {
    await this.authorization.assert({ workspaceId, userId, permission: 'project.read' });
    return this.clients.find({ where: { workspaceId }, order: { name: 'ASC' } });
  }

  async createClient(
    workspaceId: string,
    userId: string,
    dto: CreateClientDto,
  ): Promise<ClientEntity> {
    await this.authorization.assert({ workspaceId, userId, permission: 'client.manage' });
    const now = new Date();
    return this.clients.save(
      this.clients.create({
        id: randomUUID(),
        workspaceId,
        name: dto.name.trim(),
        email: dto.email ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  async deleteProject(workspaceId: string, projectId: string, userId: string): Promise<void> {
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'project.write',
      projectId,
    });
    const project = await this.projects.findOneBy({
      id: projectId,
      workspaceId,
      trashedAt: IsNull(),
    });
    if (!project) throw new NotFoundException('Progetto non trovato');

    const roots = await this.projects.manager.query<Array<{ id: string }>>(
      `SELECT id FROM file_nodes
       WHERE workspace_id = $1 AND project_id = $2 AND parent_id IS NULL`,
      [workspaceId, projectId],
    );
    for (const root of roots) {
      await this.maintenanceQueue.add(
        'purge-trash',
        { workspaceId, projectId, nodeId: root.id },
        {
          jobId: queueJobId('deleted-project', projectId, root.id),
          delay: 30 * 24 * 60 * 60 * 1000,
        },
      );
    }

    const now = new Date();
    await this.projects.manager.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM acl_entries
         WHERE workspace_id = $1
           AND (project_id = $2 OR node_id IN (
             SELECT id FROM file_nodes WHERE workspace_id = $1 AND project_id = $2
           ))`,
        [workspaceId, projectId],
      );
      await manager.query(
        `DELETE FROM workspace_invites
         WHERE workspace_id = $1
           AND (project_id = $2 OR node_id IN (
             SELECT id FROM file_nodes WHERE workspace_id = $1 AND project_id = $2
           ))`,
        [workspaceId, projectId],
      );
      await manager.query('DELETE FROM deliveries WHERE workspace_id = $1 AND project_id = $2', [
        workspaceId,
        projectId,
      ]);
      await manager.query(
        `UPDATE file_nodes SET trashed_at = $3, updated_at = $3
         WHERE workspace_id = $1 AND project_id = $2`,
        [workspaceId, projectId, now],
      );
      await manager
        .getRepository(ProjectEntity)
        .update(
          { id: projectId, workspaceId },
          { status: 'trashed', trashedAt: now, updatedAt: now },
        );
      await this.outbox.record(
        {
          topic: 'project.deleted',
          aggregateType: 'Project',
          aggregateId: projectId,
          payload: { workspaceId, purgeAfterDays: 30 },
        },
        manager,
      );
    });
  }

  async deleteClient(workspaceId: string, clientId: string, userId: string): Promise<void> {
    await this.authorization.assert({ workspaceId, userId, permission: 'client.manage' });
    const client = await this.clients.findOneBy({ id: clientId, workspaceId });
    if (!client) throw new NotFoundException('Cliente non trovato');
    await this.clients.manager.transaction(async (manager) => {
      await manager.getRepository(ClientEntity).delete({ id: clientId, workspaceId });
      await this.outbox.record(
        {
          topic: 'client.deleted',
          aggregateType: 'Client',
          aggregateId: clientId,
          payload: { workspaceId },
        },
        manager,
      );
    });
  }

  async assertProject(workspaceId: string, projectId: string): Promise<ProjectEntity> {
    const project = await this.projects.findOneBy({
      id: projectId,
      workspaceId,
      trashedAt: IsNull(),
    });
    if (!project) throw new NotFoundException('Progetto non trovato');
    return project;
  }
}
