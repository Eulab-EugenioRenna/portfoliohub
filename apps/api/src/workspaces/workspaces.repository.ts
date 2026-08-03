import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { WorkspaceEntity } from './entities/workspace.entity';
import { WorkspaceMembershipEntity } from './entities/workspace-membership.entity';

@Injectable()
export class WorkspacesRepository {
  constructor(
    @InjectRepository(WorkspaceEntity) private readonly workspaces: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly memberships: Repository<WorkspaceMembershipEntity>,
  ) {}

  async listForUser(
    userId: string,
  ): Promise<Array<{ workspace: WorkspaceEntity; membership: WorkspaceMembershipEntity }>> {
    const memberships = await this.memberships.find({ where: { userId, status: 'active' } });
    if (memberships.length === 0) return [];
    const workspaces = await this.workspaces
      .createQueryBuilder('workspace')
      .where('workspace.id IN (:...ids)', { ids: memberships.map((item) => item.workspaceId) })
      .orderBy('workspace.name', 'ASC')
      .getMany();
    const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    return memberships.flatMap((membership) => {
      const workspace = byId.get(membership.workspaceId);
      return workspace ? [{ workspace, membership }] : [];
    });
  }

  membership(
    workspaceId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<WorkspaceMembershipEntity | null> {
    return (manager?.getRepository(WorkspaceMembershipEntity) ?? this.memberships).findOneBy({
      workspaceId,
      userId,
      status: 'active',
    });
  }
}
