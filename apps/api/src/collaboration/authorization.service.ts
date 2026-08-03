import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import {
  WorkspaceMembershipEntity,
  type WorkspaceRole,
} from '../workspaces/entities/workspace-membership.entity';

const ROLE_PERMISSIONS: Record<WorkspaceRole, string[]> = {
  owner: ['*'],
  admin: ['*'],
  editor: [
    'project.read',
    'project.write',
    'file.read',
    'file.upload',
    'file.manage',
    'delivery.manage',
    'client.manage',
  ],
  uploader: ['project.read', 'file.read', 'file.upload'],
  viewer: ['project.read', 'file.read'],
  guest: [],
};

@Injectable()
export class AuthorizationService {
  constructor(private readonly database: DataSource) {}

  async assert(input: {
    workspaceId: string;
    userId: string;
    permission: string;
    projectId?: string;
    nodeId?: string;
  }): Promise<WorkspaceMembershipEntity> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: input.workspaceId });
    if (workspace?.status !== 'active') throw new ForbiddenException('Workspace bloccato');
    const membership = await this.database.getRepository(WorkspaceMembershipEntity).findOneBy({
      workspaceId: input.workspaceId,
      userId: input.userId,
      status: 'active',
    });
    if (!membership) throw new ForbiddenException('Accesso al workspace negato');
    if (membership.role === 'owner') return membership;
    const entries = await this.database.query<
      Array<{ permission: string; effect: 'allow' | 'deny' }>
    >(
      `WITH RECURSIVE ancestors AS (
        SELECT id, parent_id FROM file_nodes WHERE id = $4::uuid
        UNION ALL SELECT parent.id, parent.parent_id FROM file_nodes parent JOIN ancestors child ON child.parent_id = parent.id
      )
      SELECT permission, effect FROM acl_entries
      WHERE workspace_id = $1 AND user_id = $2
        AND (project_id IS NULL OR project_id = $3::uuid)
        AND (node_id IS NULL OR node_id IN (SELECT id FROM ancestors))`,
      [input.workspaceId, input.userId, input.projectId ?? null, input.nodeId ?? null],
    );
    const matches = entries.filter(
      (entry) => entry.permission === '*' || entry.permission === input.permission,
    );
    if (matches.some((entry) => entry.effect === 'deny'))
      throw new ForbiddenException('Permesso negato da una regola esplicita');
    const roleAllows =
      ROLE_PERMISSIONS[membership.role].includes('*') ||
      ROLE_PERMISSIONS[membership.role].includes(input.permission);
    const aclAllows = matches.some((entry) => entry.effect === 'allow');
    if (!roleAllows && !aclAllows) throw new ForbiddenException('Permesso non assegnato');
    return membership;
  }

  async visibleProjectIds(workspaceId: string, userId: string): Promise<string[] | null> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: workspaceId });
    if (workspace?.status !== 'active') throw new ForbiddenException('Workspace bloccato');
    const membership = await this.database.getRepository(WorkspaceMembershipEntity).findOneBy({
      workspaceId,
      userId,
      status: 'active',
    });
    if (!membership) throw new ForbiddenException('Accesso al workspace negato');
    if (membership.role !== 'guest') return null;
    const rows = await this.database.query<Array<{ projectId: string }>>(
      `SELECT DISTINCT COALESCE(project_id, node.project_id) AS "projectId"
       FROM acl_entries acl LEFT JOIN file_nodes node ON node.id = acl.node_id
       WHERE acl.workspace_id = $1 AND acl.user_id = $2 AND acl.effect = 'allow'
         AND acl.permission IN ('*', 'project.read', 'file.read')`,
      [workspaceId, userId],
    );
    return rows.map((row) => row.projectId).filter(Boolean);
  }

  async visibleNodeIdsForListing(
    workspaceId: string,
    userId: string,
    projectId: string,
    parentId?: string,
  ): Promise<string[] | null> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: workspaceId });
    if (workspace?.status !== 'active') throw new ForbiddenException('Workspace bloccato');
    const membership = await this.database.getRepository(WorkspaceMembershipEntity).findOneBy({
      workspaceId,
      userId,
      status: 'active',
    });
    if (!membership) throw new ForbiddenException('Accesso al workspace negato');
    if (membership.role !== 'guest') return null;
    const rows = await this.database.query<Array<{ id: string }>>(
      `WITH RECURSIVE ancestry AS (
        SELECT id AS leaf_id, id, parent_id
        FROM file_nodes
        WHERE workspace_id = $1 AND project_id = $3 AND trashed_at IS NULL
        UNION ALL
        SELECT child.leaf_id, parent.id, parent.parent_id
        FROM file_nodes parent JOIN ancestry child ON child.parent_id = parent.id
      )
      SELECT DISTINCT child.id
      FROM file_nodes child
      JOIN acl_entries acl ON acl.workspace_id = $1 AND acl.user_id = $2
      WHERE child.workspace_id = $1 AND child.project_id = $3
        AND child.parent_id IS NOT DISTINCT FROM $4::uuid
        AND child.trashed_at IS NULL AND acl.effect = 'allow'
        AND (acl.project_id IS NULL OR acl.project_id = $3)
        AND acl.permission IN ('*', 'project.read', 'file.read')
        AND (
          acl.node_id IS NULL
          OR acl.node_id IN (SELECT id FROM ancestry WHERE leaf_id = child.id)
          OR child.id IN (SELECT id FROM ancestry WHERE leaf_id = acl.node_id)
        )`,
      [workspaceId, userId, projectId, parentId ?? null],
    );
    return rows.map((row) => row.id);
  }
}
