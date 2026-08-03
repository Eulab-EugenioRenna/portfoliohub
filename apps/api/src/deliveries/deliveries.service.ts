import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import { DataSource, IsNull, type Repository } from 'typeorm';
import { KEY_PROVIDER, type KeyProvider } from '../adapters/contracts';
import { QuotaService } from '../billing/quota.service';
import { AuthorizationService } from '../collaboration/authorization.service';
import { integrationsConfig } from '../config/integrations.config';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { FileVersionEntity } from '../files/entities/file-version.entity';
import { RedisService } from '../platform/redis.service';
import { ClientEntity } from '../projects/entities/client.entity';
import { ProjectsService } from '../projects/projects.service';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import type {
  AccessDeliveryDto,
  CreateDeliveryDto,
  DeliveryApprovalDto,
  DeliveryCommentDto,
} from './dto/deliveries.dto';
import { DeliveryEntity } from './entities/delivery.entity';
import { DeliveryApprovalEntity } from './entities/delivery-approval.entity';
import { DeliveryCommentEntity } from './entities/delivery-comment.entity';
import { DeliveryItemEntity } from './entities/delivery-item.entity';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(DeliveryEntity) private readonly deliveries: Repository<DeliveryEntity>,
    @InjectRepository(DeliveryItemEntity) private readonly items: Repository<DeliveryItemEntity>,
    @InjectRepository(DeliveryCommentEntity)
    private readonly comments: Repository<DeliveryCommentEntity>,
    @InjectRepository(DeliveryApprovalEntity)
    private readonly approvals: Repository<DeliveryApprovalEntity>,
    private readonly authorization: AuthorizationService,
    private readonly projects: ProjectsService,
    private readonly redis: RedisService,
    private readonly quota: QuotaService,
    @Inject(KEY_PROVIDER) private readonly keys: KeyProvider,
    @Inject(integrationsConfig.KEY) private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
  ): Promise<
    Array<
      DeliveryEntity & {
        url: string | null;
        projectName: string;
        clientName: string | null;
        itemCount: number;
        commentCount: number;
        approvalCount: number;
        lastActivityAt: Date;
      }
    >
  > {
    await this.authorization.assert({ workspaceId, userId, permission: 'project.read' });
    const rows = await this.deliveries
      .createQueryBuilder('delivery')
      .addSelect('delivery.publicTokenWrapped')
      .innerJoin('projects', 'project', 'project.id = delivery.project_id')
      .leftJoin('clients', 'client', 'client.id = delivery.client_id')
      .select('delivery')
      .addSelect('delivery.publicTokenWrapped')
      .addSelect('project.name', 'projectName')
      .addSelect('client.name', 'clientName')
      .addSelect(
        '(SELECT count(*)::int FROM delivery_items item WHERE item.delivery_id = delivery.id)',
        'itemCount',
      )
      .addSelect(
        '(SELECT count(*)::int FROM delivery_comments comment WHERE comment.delivery_id = delivery.id)',
        'commentCount',
      )
      .addSelect(
        '(SELECT count(*)::int FROM delivery_approvals approval WHERE approval.delivery_id = delivery.id)',
        'approvalCount',
      )
      .addSelect(
        `GREATEST(delivery.created_at,
        COALESCE((SELECT max(comment.created_at) FROM delivery_comments comment WHERE comment.delivery_id = delivery.id), delivery.created_at),
        COALESCE((SELECT max(approval.created_at) FROM delivery_approvals approval WHERE approval.delivery_id = delivery.id), delivery.created_at))`,
        'lastActivityAt',
      )
      .where('delivery.workspace_id = :workspaceId', { workspaceId })
      .orderBy('delivery.created_at', 'DESC')
      .getRawAndEntities();
    return Promise.all(
      rows.entities.map(async (delivery, index) => {
        const raw = rows.raw[index];
        const token = delivery.publicTokenWrapped
          ? (await this.keys.unwrap(delivery.publicTokenWrapped)).toString('utf8')
          : null;
        return Object.assign(delivery, {
          url: token ? `/d/${token}` : null,
          projectName: raw.projectName,
          clientName: raw.clientName ?? null,
          itemCount: Number(raw.itemCount ?? 0),
          commentCount: Number(raw.commentCount ?? 0),
          approvalCount: Number(raw.approvalCount ?? 0),
          lastActivityAt: new Date(raw.lastActivityAt),
        });
      }),
    );
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateDeliveryDto,
  ): Promise<{ delivery: DeliveryEntity; url: string }> {
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'delivery.manage',
      projectId: dto.projectId,
    });
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    if (
      workspace.plan === 'free' &&
      (dto.oneShot || dto.maxDownloads || dto.allowComments || dto.allowApproval)
    ) {
      throw new ConflictException(
        'One-shot, limiti, commenti e approvazioni richiedono Pro o Unlimited',
      );
    }
    await this.projects.assertProject(workspaceId, dto.projectId);
    if (
      dto.clientId &&
      !(await this.database.getRepository(ClientEntity).existsBy({ id: dto.clientId, workspaceId }))
    ) {
      throw new NotFoundException('Cliente non trovato');
    }
    const snapshot = await this.snapshotNodes(workspaceId, dto.projectId, dto.nodeIds);
    if (snapshot.length === 0)
      throw new BadRequestException('La consegna non contiene file o cartelle valide');
    const token = randomBytes(32).toString('base64url');
    const publicTokenWrapped = await this.keys.wrap(Buffer.from(token, 'utf8'));
    const passwordHash = dto.password
      ? await argon2.hash(dto.password, { type: argon2.argon2id })
      : null;
    const now = new Date();
    const delivery = await this.database.transaction(async (manager) => {
      const repository = manager.getRepository(DeliveryEntity);
      const created = await repository.save(
        repository.create({
          id: randomUUID(),
          workspaceId,
          projectId: dto.projectId,
          clientId: dto.clientId ?? null,
          title: dto.title.trim(),
          status: 'active',
          publicTokenHash: this.hash(token),
          publicTokenWrapped,
          passwordHash,
          allowDownload: dto.allowDownload,
          allowComments: dto.allowComments,
          allowApproval: dto.allowApproval,
          oneShot: dto.oneShot,
          oneShotRedeemedAt: null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          maxDownloads: dto.maxDownloads ?? null,
          completedDownloads: 0,
          createdBy: userId,
          createdAt: now,
          activatedAt: now,
          revokedAt: null,
        }),
      );
      await manager.getRepository(DeliveryItemEntity).save(
        snapshot.map((item) => ({
          id: randomUUID(),
          deliveryId: created.id,
          fileNodeId: item.nodeId,
          fileVersionId: item.versionId,
          snapshotPath: item.path,
        })),
      );
      return created;
    });
    return { delivery, url: `/d/${token}` };
  }

  async activity(workspaceId: string, deliveryId: string, userId: string) {
    await this.authorization.assert({ workspaceId, userId, permission: 'project.read' });
    const delivery = await this.deliveries.findOneBy({ id: deliveryId, workspaceId });
    if (!delivery) throw new NotFoundException('Consegna non trovata');
    const [comments, approvals] = await Promise.all([
      this.comments.find({ where: { deliveryId }, order: { createdAt: 'DESC' } }),
      this.approvals.find({ where: { deliveryId }, order: { createdAt: 'DESC' } }),
    ]);
    return { comments, approvals };
  }

  async revoke(workspaceId: string, deliveryId: string, userId: string): Promise<void> {
    await this.authorization.assert({ workspaceId, userId, permission: 'delivery.manage' });
    const delivery = await this.deliveries.findOneBy({ id: deliveryId, workspaceId });
    if (!delivery) throw new NotFoundException('Consegna non trovata');
    if (delivery.status === 'revoked') return;
    delivery.status = 'revoked';
    delivery.revokedAt = new Date();
    await this.deliveries.save(delivery);
  }

  async deletePermanently(workspaceId: string, deliveryId: string, userId: string): Promise<void> {
    await this.authorization.assert({ workspaceId, userId, permission: 'delivery.manage' });
    const delivery = await this.deliveries.findOneBy({ id: deliveryId, workspaceId });
    if (!delivery) throw new NotFoundException('Consegna non trovata');
    await this.deliveries.remove(delivery);
  }

  async publicInfo(token: string): Promise<{
    title: string;
    passwordRequired: boolean;
    oneShot: boolean;
    expiresAt: Date | null;
    createdAt: Date;
    itemCount: number;
    roots: Array<{ name: string; kind: 'file' | 'folder' }>;
  }> {
    const delivery = await this.findPublic(token);
    await this.assertWorkspaceOperational(delivery.workspaceId);
    const content = await this.content(delivery.id);
    return {
      title: delivery.title,
      passwordRequired: Boolean(delivery.passwordHash),
      oneShot: delivery.oneShot,
      expiresAt: delivery.expiresAt,
      createdAt: delivery.createdAt,
      itemCount: content.length,
      roots: content
        .filter((item) => !item.path.includes('/'))
        .map((item) => ({
          name: item.path,
          kind: item.kind === 'folder' ? 'folder' : 'file',
        })),
    };
  }

  async access(
    token: string,
    dto: AccessDeliveryDto,
  ): Promise<{
    grant: string;
    expiresIn: number;
    permissions: { download: boolean; comments: boolean; approval: boolean };
    content: Awaited<ReturnType<DeliveriesService['content']>>;
  }> {
    const tokenHash = this.hash(token);
    const delivery = await this.database.transaction('SERIALIZABLE', async (manager) => {
      const repository = manager.getRepository(DeliveryEntity);
      const current = await repository
        .createQueryBuilder('delivery')
        .addSelect('delivery.passwordHash')
        .setLock('pessimistic_write')
        .where('delivery.publicTokenHash = :tokenHash', { tokenHash })
        .getOne();
      this.assertPublicState(current);
      if (
        current.passwordHash &&
        (!dto.password || !(await argon2.verify(current.passwordHash, dto.password)))
      ) {
        throw new ForbiddenException('Password non valida');
      }
      if (current.oneShot) {
        if (current.oneShotRedeemedAt) throw new ConflictException('Link one-shot già utilizzato');
        current.oneShotRedeemedAt = new Date();
        await repository.save(current);
      }
      return current;
    });
    const grant = randomBytes(32).toString('base64url');
    await this.assertWorkspaceOperational(delivery.workspaceId);
    await this.redis.client.set(
      `delivery-grant:${this.hash(grant)}`,
      delivery.id,
      'EX',
      4 * 60 * 60,
    );
    return {
      grant,
      expiresIn: 4 * 60 * 60,
      permissions: {
        download: delivery.allowDownload,
        comments: delivery.allowComments,
        approval: delivery.allowApproval,
      },
      content: await this.content(delivery.id),
    };
  }

  async content(deliveryId: string): Promise<
    Array<{
      nodeId: string;
      versionId: string | null;
      path: string;
      kind: string;
      sizeBytes: string | null;
      mimeType: string | null;
    }>
  > {
    return this.items
      .createQueryBuilder('item')
      .innerJoin(FileNodeEntity, 'node', 'node.id = item.fileNodeId')
      .leftJoin(FileVersionEntity, 'version', 'version.id = item.fileVersionId')
      .select('item.fileNodeId', 'nodeId')
      .addSelect('item.fileVersionId', 'versionId')
      .addSelect('item.snapshotPath', 'path')
      .addSelect('node.kind', 'kind')
      .addSelect('version.sizeBytes', 'sizeBytes')
      .addSelect('version.mimeType', 'mimeType')
      .where('item.deliveryId = :deliveryId', { deliveryId })
      .orderBy('item.snapshotPath', 'ASC')
      .getRawMany();
  }

  async issueAuthenticatedPageGrant(deliveryId: string): Promise<{
    grant: string;
    expiresIn: number;
    content: Awaited<ReturnType<DeliveriesService['content']>>;
  }> {
    const delivery = await this.deliveries.findOneBy({ id: deliveryId });
    this.assertPublicState(delivery);
    await this.assertWorkspaceOperational(delivery.workspaceId);
    const grant = randomBytes(32).toString('base64url');
    await this.redis.client.set(
      `delivery-grant:${this.hash(grant)}`,
      delivery.id,
      'EX',
      4 * 60 * 60,
    );
    return { grant, expiresIn: 4 * 60 * 60, content: await this.content(delivery.id) };
  }

  async issueFileGrant(
    pageGrant: string,
    nodeId: string,
  ): Promise<{ grant: string; expiresIn: number }> {
    const deliveryId = await this.redis.client.get(`delivery-grant:${this.hash(pageGrant)}`);
    if (!deliveryId) throw new ForbiddenException('Sessione consegna scaduta');
    const item = await this.items.findOneBy({ deliveryId, fileNodeId: nodeId });
    if (!item?.fileVersionId) throw new NotFoundException('File non presente nella consegna');
    const version = await this.database
      .getRepository(FileVersionEntity)
      .findOneByOrFail({ id: item.fileVersionId });
    const expiresIn =
      version.mimeType.startsWith('video/') || version.mimeType.startsWith('audio/') ? 300 : 120;
    const grant = randomBytes(32).toString('base64url');
    await this.redis.client.set(
      `file-grant:${this.hash(grant)}`,
      JSON.stringify({ deliveryId, nodeId }),
      'EX',
      expiresIn,
    );
    return { grant, expiresIn };
  }

  async issueArchiveGrant(
    pageGrant: string,
    nodeId: string,
  ): Promise<{ grant: string; expiresIn: number }> {
    const deliveryId = await this.resolvePageGrant(pageGrant);
    const item = await this.items.findOneBy({ deliveryId, fileNodeId: nodeId });
    if (!item) throw new NotFoundException('Cartella non presente nella consegna');
    const node = await this.database
      .getRepository(FileNodeEntity)
      .findOneBy({ id: nodeId, kind: 'folder' });
    if (!node) throw new NotFoundException('Cartella non presente nella consegna');
    const grant = randomBytes(32).toString('base64url');
    await this.redis.client.set(
      `archive-grant:${this.hash(grant)}`,
      JSON.stringify({ deliveryId, nodeId }),
      'EX',
      120,
    );
    return { grant, expiresIn: 120 };
  }

  async feedback(
    pageGrant: string,
  ): Promise<{ comments: DeliveryCommentEntity[]; approvals: DeliveryApprovalEntity[] }> {
    const deliveryId = await this.resolvePageGrant(pageGrant);
    return {
      comments: await this.comments.find({ where: { deliveryId }, order: { createdAt: 'ASC' } }),
      approvals: await this.approvals.find({ where: { deliveryId }, order: { createdAt: 'ASC' } }),
    };
  }

  async comment(pageGrant: string, dto: DeliveryCommentDto): Promise<DeliveryCommentEntity> {
    const deliveryId = await this.resolvePageGrant(pageGrant);
    const delivery = await this.deliveries.findOneByOrFail({ id: deliveryId });
    if (!delivery.allowComments) throw new ForbiddenException('Commenti non consentiti');
    await this.assertSnapshotVersion(deliveryId, dto.fileVersionId);
    return this.comments.save(
      this.comments.create({
        id: randomUUID(),
        deliveryId,
        fileVersionId: dto.fileVersionId ?? null,
        authorName: dto.authorName.trim(),
        body: dto.body.trim(),
        timecodeMs: dto.timecodeMs ?? null,
        createdAt: new Date(),
      }),
    );
  }

  async approve(pageGrant: string, dto: DeliveryApprovalDto): Promise<DeliveryApprovalEntity> {
    const deliveryId = await this.resolvePageGrant(pageGrant);
    const delivery = await this.deliveries.findOneByOrFail({ id: deliveryId });
    if (!delivery.allowApproval) throw new ForbiddenException('Approvazioni non consentite');
    await this.assertSnapshotVersion(deliveryId, dto.fileVersionId);
    await this.approvals
      .createQueryBuilder()
      .insert()
      .values({
        id: randomUUID(),
        deliveryId,
        fileVersionId: dto.fileVersionId ?? null,
        decision: dto.decision,
        authorName: dto.authorName.trim(),
        note: dto.note?.trim() ?? null,
        createdAt: new Date(),
      })
      .orUpdate(
        ['decision', 'author_name', 'note', 'created_at'],
        ['delivery_id', 'file_version_id'],
      )
      .execute();
    return this.approvals.findOneByOrFail({
      deliveryId,
      fileVersionId: dto.fileVersionId ?? IsNull(),
    });
  }

  async authorizeDownload(grant: string): Promise<{
    delivery: DeliveryEntity;
    version: FileVersionEntity;
    path: string;
    reservationId: string;
    counted: boolean;
  }> {
    const grantId = this.hash(grant);
    const encoded = await this.redis.client.get(`file-grant:${grantId}`);
    if (!encoded) throw new ForbiddenException('Autorizzazione file scaduta');
    const { deliveryId, nodeId } = JSON.parse(encoded) as { deliveryId: string; nodeId: string };
    const counted = Boolean(
      await this.redis.client.set(`download-counted:${grantId}`, '1', 'EX', 3600, 'NX'),
    );
    const result = await this.database.transaction('SERIALIZABLE', async (manager) => {
      const repository = manager.getRepository(DeliveryEntity);
      const delivery = await repository
        .createQueryBuilder('delivery')
        .setLock('pessimistic_write')
        .where('delivery.id = :deliveryId', { deliveryId })
        .getOne();
      this.assertPublicState(delivery);
      await this.assertWorkspaceOperational(delivery.workspaceId);
      if (!delivery.allowDownload) throw new ForbiddenException('Download non consentito');
      if (
        counted &&
        delivery.maxDownloads !== null &&
        delivery.completedDownloads >= delivery.maxDownloads
      ) {
        throw new ConflictException('Limite download raggiunto');
      }
      if (counted) {
        delivery.completedDownloads += 1;
        await repository.save(delivery);
      }
      const item = await manager
        .getRepository(DeliveryItemEntity)
        .findOneBy({ deliveryId, fileNodeId: nodeId });
      if (!item?.fileVersionId) throw new NotFoundException('File non presente nella consegna');
      const version = await manager
        .getRepository(FileVersionEntity)
        .findOneByOrFail({ id: item.fileVersionId });
      return { delivery, version, path: item.snapshotPath };
    });
    return { ...result, reservationId: grantId, counted };
  }

  async completeDownload(
    delivery: DeliveryEntity,
    bytes: number,
    reservationId: string,
  ): Promise<void> {
    await this.quota.recordCompletedDownload(delivery.workspaceId, BigInt(bytes), reservationId);
  }

  async releaseDownload(
    deliveryId: string,
    reservationId: string,
    counted: boolean,
  ): Promise<void> {
    if (!counted) return;
    await this.redis.client.del(`download-counted:${reservationId}`);
    await this.database.query(
      'UPDATE deliveries SET completed_downloads = GREATEST(0, completed_downloads - 1) WHERE id = $1',
      [deliveryId],
    );
  }

  async authorizeArchive(grant: string): Promise<{
    delivery: DeliveryEntity;
    folderName: string;
    entries: Array<{ path: string; version: FileVersionEntity }>;
    reservationId: string;
    counted: boolean;
  }> {
    const grantId = this.hash(grant);
    const encoded = await this.redis.client.get(`archive-grant:${grantId}`);
    if (!encoded) throw new ForbiddenException('Autorizzazione ZIP scaduta');
    const { deliveryId, nodeId } = JSON.parse(encoded) as { deliveryId: string; nodeId: string };
    const counted = Boolean(
      await this.redis.client.set(`download-counted:${grantId}`, '1', 'EX', 3600, 'NX'),
    );
    const delivery = await this.deliveries.findOneBy({ id: deliveryId });
    this.assertPublicState(delivery);
    await this.assertWorkspaceOperational(delivery.workspaceId);
    if (!delivery.allowDownload) throw new ForbiddenException('Download non consentito');
    if (counted) {
      const result = await this.database.createQueryRunner();
      await result.connect();
      await result.startTransaction('SERIALIZABLE');
      try {
        const locked = await result.manager
          .getRepository(DeliveryEntity)
          .createQueryBuilder('delivery')
          .setLock('pessimistic_write')
          .where('delivery.id=:deliveryId', { deliveryId })
          .getOneOrFail();
        if (locked.maxDownloads !== null && locked.completedDownloads >= locked.maxDownloads)
          throw new ConflictException('Limite download raggiunto');
        locked.completedDownloads += 1;
        await result.manager.save(locked);
        await result.commitTransaction();
      } catch (error) {
        await result.rollbackTransaction();
        await this.redis.client.del(`download-counted:${grantId}`);
        throw error;
      } finally {
        await result.release();
      }
    }
    const root = await this.items.findOneByOrFail({ deliveryId, fileNodeId: nodeId });
    const rows = await this.items
      .createQueryBuilder('item')
      .innerJoinAndMapOne(
        'item.version',
        FileVersionEntity,
        'version',
        'version.id=item.fileVersionId',
      )
      .where('item.deliveryId=:deliveryId', { deliveryId })
      .andWhere('item.fileVersionId IS NOT NULL')
      .andWhere('(item.snapshotPath = :path OR item.snapshotPath LIKE :prefix)', {
        path: root.snapshotPath,
        prefix: `${root.snapshotPath}/%`,
      })
      .orderBy('item.snapshotPath', 'ASC')
      .getRawMany<{ item_snapshot_path: string; version_id: string }>();
    const entries: Array<{ path: string; version: FileVersionEntity }> = [];
    for (const row of rows)
      entries.push({
        path: row.item_snapshot_path,
        version: await this.database
          .getRepository(FileVersionEntity)
          .findOneByOrFail({ id: row.version_id }),
      });
    return {
      delivery,
      folderName: root.snapshotPath.split('/').at(-1) ?? 'consegna',
      entries,
      reservationId: grantId,
      counted,
    };
  }

  private async findPublic(token: string): Promise<DeliveryEntity> {
    const delivery = await this.deliveries
      .createQueryBuilder('delivery')
      .addSelect('delivery.passwordHash')
      .where('delivery.publicTokenHash = :hash', { hash: this.hash(token) })
      .getOne();
    this.assertPublicState(delivery);
    return delivery;
  }

  private assertPublicState(delivery: DeliveryEntity | null): asserts delivery is DeliveryEntity {
    if (!delivery || delivery.status !== 'active' || delivery.revokedAt)
      throw new NotFoundException('Consegna non disponibile');
    if (delivery.expiresAt && delivery.expiresAt <= new Date())
      throw new NotFoundException('Consegna scaduta');
  }

  private async snapshotNodes(
    workspaceId: string,
    projectId: string,
    selected: string[],
  ): Promise<Array<{ nodeId: string; versionId: string | null; path: string }>> {
    return this.database.query(
      `WITH RECURSIVE tree AS (
        SELECT id, parent_id, name, kind, current_version_id, name::text AS path
        FROM file_nodes WHERE workspace_id = $1 AND project_id = $2 AND id = ANY($3::uuid[]) AND trashed_at IS NULL
        UNION ALL
        SELECT child.id, child.parent_id, child.name, child.kind, child.current_version_id, tree.path || '/' || child.name
        FROM file_nodes child JOIN tree ON child.parent_id = tree.id WHERE child.trashed_at IS NULL
      ) SELECT id AS "nodeId", current_version_id AS "versionId", path FROM tree ORDER BY path`,
      [workspaceId, projectId, selected],
    );
  }

  private hash(value: string): string {
    return createHmac('sha256', this.config.sessionPepper).update(value).digest('hex');
  }

  private async resolvePageGrant(pageGrant: string): Promise<string> {
    const deliveryId = await this.redis.client.get(`delivery-grant:${this.hash(pageGrant)}`);
    if (!deliveryId) throw new ForbiddenException('Sessione consegna scaduta');
    return deliveryId;
  }

  private async assertSnapshotVersion(deliveryId: string, versionId?: string): Promise<void> {
    if (versionId && !(await this.items.existsBy({ deliveryId, fileVersionId: versionId })))
      throw new NotFoundException('Versione non presente nella consegna');
  }

  private async assertWorkspaceOperational(workspaceId: string): Promise<void> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: workspaceId });
    if (!workspace || workspace.status !== 'active')
      throw new NotFoundException('Consegna non disponibile');
  }
}
