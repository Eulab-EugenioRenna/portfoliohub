import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { EMAIL_PROVIDER, type EmailProvider } from '../adapters/contracts';
import { AuditService } from '../audit/audit.service';
import { integrationsConfig } from '../config/integrations.config';
import { OutboxService } from '../events/outbox.service';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { UserEntity } from '../identity/entities/user.entity';
import { ProjectEntity } from '../projects/entities/project.entity';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import {
  WorkspaceMembershipEntity,
  type WorkspaceRole,
} from '../workspaces/entities/workspace-membership.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import type { CreateInviteDto } from './dto/collaboration.dto';
import { AclEntryEntity } from './entities/acl-entry.entity';
import { WorkspaceInviteEntity } from './entities/workspace-invite.entity';

const SCOPED_PERMISSIONS: Record<Exclude<WorkspaceRole, 'owner'>, string[]> = {
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
  guest: ['project.read', 'file.read'],
};

@Injectable()
export class CollaborationService {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(WorkspaceInviteEntity)
    private readonly invites: Repository<WorkspaceInviteEntity>,
    private readonly workspaces: WorkspacesService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    @Inject(integrationsConfig.KEY) private readonly config: ConfigType<typeof integrationsConfig>,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
  ): Promise<
    Array<WorkspaceInviteEntity & { scopeKind: 'file' | 'folder' | null; scopeName: string | null }>
  > {
    await this.workspaces.assertRole(workspaceId, userId, ['owner', 'admin']);
    const result = await this.invites
      .createQueryBuilder('invite')
      .leftJoin(FileNodeEntity, 'node', 'node.id = invite.node_id')
      .addSelect('node.kind', 'scopeKind')
      .addSelect('node.name', 'scopeName')
      .where('invite.workspace_id = :workspaceId', { workspaceId })
      .orderBy('invite.created_at', 'DESC')
      .getRawAndEntities();
    return result.entities.map((invite, index) =>
      Object.assign(invite, {
        scopeKind: (result.raw[index]?.scopeKind as 'file' | 'folder' | undefined) ?? null,
        scopeName: (result.raw[index]?.scopeName as string | undefined) ?? null,
      }),
    );
  }

  async invite(
    workspaceId: string,
    userId: string,
    dto: CreateInviteDto,
  ): Promise<{ invite: WorkspaceInviteEntity; url: string }> {
    await this.workspaces.assertRole(workspaceId, userId, ['owner', 'admin']);
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    const memberLimit =
      workspace.plan === 'free' ? 3 : workspace.plan === 'pro' ? 10 : Number.POSITIVE_INFINITY;
    const [{ count }] = await this.database.query<Array<{ count: string }>>(
      `SELECT (SELECT count(*) FROM workspace_memberships WHERE workspace_id=$1 AND status='active') + (SELECT count(*) FROM workspace_invites WHERE workspace_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()) AS count`,
      [workspaceId],
    );
    if (Number(count) >= memberLimit)
      throw new ConflictException('Limite membri del piano raggiunto');
    const scopedNode = dto.nodeId
      ? await this.database.getRepository(FileNodeEntity).findOneBy({ id: dto.nodeId, workspaceId })
      : null;
    if (dto.nodeId && !scopedNode) throw new NotFoundException('File o cartella non trovato');
    const projectId = dto.projectId ?? scopedNode?.projectId;
    if (
      projectId &&
      !(await this.database.getRepository(ProjectEntity).existsBy({ id: projectId, workspaceId }))
    ) {
      throw new NotFoundException('Progetto non trovato');
    }
    if (scopedNode && projectId !== scopedNode.projectId)
      throw new ConflictException('Il contenuto non appartiene al progetto selezionato');
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const invite = await this.invites.save(
      this.invites.create({
        id: randomUUID(),
        workspaceId,
        email: dto.email,
        role: dto.role,
        projectId: projectId ?? null,
        nodeId: scopedNode?.id ?? null,
        tokenHash: this.hash(token),
        invitedBy: userId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        revokedAt: null,
      }),
    );
    await this.email.send({
      idempotencyKey: `workspace-invite:${invite.id}`,
      to: invite.email,
      template: 'workspace-invite',
      locale: 'it',
      variables: { inviteUrl: `/collab/${token}`, role: invite.role },
    });
    return { invite, url: `/collab/${token}` };
  }

  async preview(
    token: string,
  ): Promise<{ workspaceName: string; role: WorkspaceRole; emailHint: string; expiresAt: Date }> {
    const invite = await this.findActive(token);
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: invite.workspaceId });
    const [name, domain = ''] = invite.email.split('@');
    return {
      workspaceName: workspace.name,
      role: invite.role,
      emailHint: `${name.slice(0, 2)}***@${domain}`,
      expiresAt: invite.expiresAt,
    };
  }

  async accept(token: string, userId: string): Promise<{ workspaceId: string }> {
    const user = await this.database.getRepository(UserEntity).findOneByOrFail({ id: userId });
    return this.database.transaction('SERIALIZABLE', async (manager) => {
      const repository = manager.getRepository(WorkspaceInviteEntity);
      const invite = await repository
        .createQueryBuilder('invite')
        .addSelect('invite.tokenHash')
        .setLock('pessimistic_write')
        .where('invite.tokenHash = :hash', { hash: this.hash(token) })
        .getOne();
      if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date())
        throw new ConflictException('Invito non disponibile');
      if (user.email.toLowerCase() !== invite.email.toLowerCase())
        throw new ForbiddenException('Accedi con l’indirizzo email invitato');
      const membershipRepository = manager.getRepository(WorkspaceMembershipEntity);
      let membership = await membershipRepository.findOneBy({
        workspaceId: invite.workspaceId,
        userId,
      });
      const scoped = Boolean(invite.projectId || invite.nodeId);
      if (!membership) {
        membership = await membershipRepository.save({
          id: randomUUID(),
          workspaceId: invite.workspaceId,
          userId,
          role: scoped ? 'guest' : invite.role,
          status: 'active',
          createdAt: new Date(),
        });
      }
      if (scoped) {
        if (invite.role === 'owner')
          throw new ConflictException('Il ruolo owner non può essere assegnato tramite invito');
        const acl = manager.getRepository(AclEntryEntity);
        await acl.save(
          SCOPED_PERMISSIONS[invite.role].map((permission) =>
            acl.create({
              id: randomUUID(),
              workspaceId: invite.workspaceId,
              userId,
              projectId: invite.projectId,
              nodeId: invite.nodeId,
              inviteId: invite.id,
              permission,
              effect: 'allow',
              createdBy: invite.invitedBy,
              createdAt: new Date(),
            }),
          ),
        );
      }
      invite.acceptedAt = new Date();
      await repository.save(invite);
      await this.audit.recordAudit(
        {
          workspaceId: invite.workspaceId,
          actorUserId: userId,
          action: 'collaboration.invite.accepted',
          targetType: 'WorkspaceInvite',
          targetId: invite.id,
          correlationId: null,
          ipAddress: null,
          metadata: { role: invite.role, scoped },
        },
        manager,
      );
      await this.outbox.record(
        {
          topic: 'collaboration.invite.accepted',
          aggregateType: 'WorkspaceInvite',
          aggregateId: invite.id,
          payload: { workspaceId: invite.workspaceId, userId, role: membership.role },
        },
        manager,
      );
      return { workspaceId: invite.workspaceId };
    });
  }

  async revoke(workspaceId: string, inviteId: string, userId: string): Promise<void> {
    await this.workspaces.assertRole(workspaceId, userId, ['owner', 'admin']);
    await this.database.transaction(async (manager) => {
      const inviteRepository = manager.getRepository(WorkspaceInviteEntity);
      const invite = await inviteRepository.findOneBy({ id: inviteId, workspaceId });
      if (!invite) throw new NotFoundException('Invito non trovato');
      if (invite.revokedAt) return;
      invite.revokedAt = new Date();
      await inviteRepository.save(invite);
      if (!invite.acceptedAt) return;
      const invitedUser = await manager
        .getRepository(UserEntity)
        .findOneBy({ email: invite.email });
      if (!invitedUser) return;
      await manager.getRepository(AclEntryEntity).delete({ inviteId: invite.id });
      const remainingAcl = await manager.getRepository(AclEntryEntity).existsBy({
        workspaceId,
        userId: invitedUser.id,
      });
      const membershipRepository = manager.getRepository(WorkspaceMembershipEntity);
      const membership = await membershipRepository.findOneBy({
        workspaceId,
        userId: invitedUser.id,
      });
      if (membership?.role === 'guest' && !remainingAcl)
        await membershipRepository.delete(membership.id);
    });
  }

  private async findActive(token: string): Promise<WorkspaceInviteEntity> {
    const invite = await this.invites
      .createQueryBuilder('invite')
      .addSelect('invite.tokenHash')
      .where('invite.tokenHash = :hash', { hash: this.hash(token) })
      .getOne();
    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date())
      throw new NotFoundException('Invito non disponibile');
    return invite;
  }

  private hash(token: string): string {
    return createHmac('sha256', this.config.sessionPepper).update(token).digest('hex');
  }
}
