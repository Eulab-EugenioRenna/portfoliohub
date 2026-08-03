import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, rm, stat, truncate } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import type { Request } from 'express';
import { DataSource, In, IsNull, type Repository } from 'typeorm';
import { STORAGE_PROVIDER, type StorageProvider } from '../adapters/contracts';
import { QuotaService } from '../billing/quota.service';
import { AuthorizationService } from '../collaboration/authorization.service';
import { integrationsConfig } from '../config/integrations.config';
import { OutboxService } from '../events/outbox.service';
import { queueJobId } from '../platform/queue-job-id';
import { RedisService } from '../platform/redis.service';
import { ProjectsService } from '../projects/projects.service';
import type { BeginUploadDto, CreateFolderDto, UpdateNodeDto } from './dto/files.dto';
import { FileNodeEntity } from './entities/file-node.entity';
import { FileVersionEntity } from './entities/file-version.entity';
import { UploadSessionEntity } from './entities/upload-session.entity';
import { FileEncryptionService } from './file-encryption.service';
import { FileFinalizeQueueService } from './file-finalize-queue.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(FileNodeEntity) private readonly nodes: Repository<FileNodeEntity>,
    @InjectRepository(FileVersionEntity) private readonly versions: Repository<FileVersionEntity>,
    @InjectRepository(UploadSessionEntity)
    private readonly uploads: Repository<UploadSessionEntity>,
    private readonly authorization: AuthorizationService,
    private readonly projects: ProjectsService,
    private readonly quota: QuotaService,
    private readonly encryption: FileEncryptionService,
    private readonly outbox: OutboxService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(integrationsConfig.KEY) private readonly config: ConfigType<typeof integrationsConfig>,
    @InjectQueue('file-maintenance') private readonly maintenanceQueue: Queue,
    private readonly redis: RedisService,
    private readonly finalizeQueue: FileFinalizeQueueService,
  ) {}

  async list(
    workspaceId: string,
    projectId: string,
    userId: string,
    parentId?: string,
  ): Promise<FileNodeEntity[]> {
    await this.projects.assertProject(workspaceId, projectId);
    const visible = await this.authorization.visibleNodeIdsForListing(
      workspaceId,
      userId,
      projectId,
      parentId,
    );
    if (visible?.length === 0) return [];
    if (visible === null)
      await this.authorization.assert({
        workspaceId,
        userId,
        permission: 'file.read',
        projectId,
        nodeId: parentId,
      });
    return this.nodes.find({
      where: {
        workspaceId,
        projectId,
        parentId: parentId ?? IsNull(),
        trashedAt: IsNull(),
        ...(visible ? { id: In(visible) } : {}),
      },
      order: { kind: 'DESC', name: 'ASC' },
    });
  }

  async listTrash(
    workspaceId: string,
    projectId: string,
    userId: string,
  ): Promise<FileNodeEntity[]> {
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.read',
      projectId,
    });
    await this.projects.assertProject(workspaceId, projectId);
    return this.nodes
      .createQueryBuilder('node')
      .where('node.workspace_id = :workspaceId', { workspaceId })
      .andWhere('node.project_id = :projectId', { projectId })
      .andWhere('node.trashed_at IS NOT NULL')
      .andWhere('node.purge_requested_at IS NULL')
      .andWhere(
        '(node.parent_id IS NULL OR NOT EXISTS (SELECT 1 FROM file_nodes parent WHERE parent.id = node.parent_id AND parent.trashed_at IS NOT NULL))',
      )
      .orderBy('node.trashed_at', 'DESC')
      .getMany();
  }

  async createFolder(
    workspaceId: string,
    projectId: string,
    userId: string,
    dto: CreateFolderDto,
  ): Promise<FileNodeEntity> {
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.manage',
      projectId,
      nodeId: dto.parentId,
    });
    await this.projects.assertProject(workspaceId, projectId);
    if (dto.parentId) await this.assertFolder(workspaceId, projectId, dto.parentId);
    const now = new Date();
    return this.nodes.save(
      this.nodes.create({
        id: randomUUID(),
        workspaceId,
        projectId,
        parentId: dto.parentId ?? null,
        kind: 'folder',
        name: dto.name.trim(),
        currentVersionId: null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        trashedAt: null,
      }),
    );
  }

  async updateNode(
    workspaceId: string,
    projectId: string,
    nodeId: string,
    userId: string,
    dto: UpdateNodeDto,
  ): Promise<FileNodeEntity> {
    const node = await this.nodes.findOneBy({
      id: nodeId,
      workspaceId,
      projectId,
      trashedAt: IsNull(),
    });
    if (!node) throw new NotFoundException('Elemento non trovato');
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.manage',
      projectId,
      nodeId: node.id,
    });
    if (dto.parentId !== undefined) {
      if (dto.parentId === node.id)
        throw new BadRequestException('Una cartella non può contenere se stessa');
      if (dto.parentId) {
        await this.assertFolder(workspaceId, projectId, dto.parentId);
        const descendants = await this.database.query<Array<{ id: string }>>(
          `WITH RECURSIVE tree AS (SELECT id FROM file_nodes WHERE parent_id = $1 UNION ALL SELECT child.id FROM file_nodes child JOIN tree ON child.parent_id = tree.id) SELECT id FROM tree`,
          [node.id],
        );
        if (descendants.some((item) => item.id === dto.parentId))
          throw new BadRequestException('Spostamento ciclico non consentito');
      }
      node.parentId = dto.parentId ?? null;
    }
    if (dto.name !== undefined) node.name = dto.name.trim();
    node.updatedAt = new Date();
    return this.nodes.save(node);
  }

  async trashNode(
    workspaceId: string,
    projectId: string,
    nodeId: string,
    userId: string,
  ): Promise<void> {
    const node = await this.nodes.findOneBy({
      id: nodeId,
      workspaceId,
      projectId,
      trashedAt: IsNull(),
    });
    if (!node) throw new NotFoundException('Elemento non trovato');
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.manage',
      projectId,
      nodeId: node.id,
    });
    const trashedAt = new Date();
    await this.database.query(
      `WITH RECURSIVE tree AS (SELECT id FROM file_nodes WHERE id = $1 UNION ALL SELECT child.id FROM file_nodes child JOIN tree ON child.parent_id = tree.id) UPDATE file_nodes SET trashed_at = $2, updated_at = $2 WHERE id IN (SELECT id FROM tree)`,
      [nodeId, trashedAt],
    );
    await this.maintenanceQueue.add(
      'purge-trash',
      { workspaceId, projectId, nodeId },
      { jobId: queueJobId('trash', nodeId), delay: 30 * 24 * 60 * 60 * 1000 },
    );
  }

  async restoreNode(
    workspaceId: string,
    projectId: string,
    nodeId: string,
    userId: string,
  ): Promise<void> {
    const node = await this.nodes.findOneBy({ id: nodeId, workspaceId, projectId });
    if (!node?.trashedAt) throw new NotFoundException('Elemento non presente nel cestino');
    if (node.purgeRequestedAt)
      throw new ConflictException('Eliminazione già in corso: ripristino non disponibile');
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.manage',
      projectId,
      nodeId: node.id,
    });
    await this.database.query(
      `WITH RECURSIVE tree AS (SELECT id FROM file_nodes WHERE id = $1 UNION ALL SELECT child.id FROM file_nodes child JOIN tree ON child.parent_id = tree.id) UPDATE file_nodes SET trashed_at = NULL, purge_requested_at = NULL, updated_at = now() WHERE id IN (SELECT id FROM tree)`,
      [nodeId],
    );
    await this.maintenanceQueue.remove(queueJobId('trash', nodeId));
  }

  async permanentlyDeleteNode(
    workspaceId: string,
    projectId: string,
    nodeId: string,
    userId: string,
  ): Promise<void> {
    const node = await this.nodes.findOneBy({ id: nodeId, workspaceId, projectId });
    if (!node?.trashedAt) throw new NotFoundException('Elemento non presente nel cestino');
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.manage',
      projectId,
      nodeId: node.id,
    });
    await this.maintenanceQueue.remove(queueJobId('trash', nodeId));
    await this.purgeTrashedNode(workspaceId, projectId, nodeId, true);
  }

  async emptyTrash(
    workspaceId: string,
    projectId: string,
    userId: string,
  ): Promise<{ queued: number; jobId: string | null }> {
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.manage',
      projectId,
    });
    await this.projects.assertProject(workspaceId, projectId);
    const roots = await this.nodes
      .createQueryBuilder('node')
      .where('node.workspace_id = :workspaceId', { workspaceId })
      .andWhere('node.project_id = :projectId', { projectId })
      .andWhere('node.trashed_at IS NOT NULL')
      .andWhere('node.purge_requested_at IS NULL')
      .andWhere(
        '(node.parent_id IS NULL OR NOT EXISTS (SELECT 1 FROM file_nodes parent WHERE parent.id = node.parent_id AND parent.trashed_at IS NOT NULL))',
      )
      .getMany();
    if (roots.length === 0) return { queued: 0, jobId: null };
    const rootIds = roots.map((root) => root.id);
    const requestedAt = new Date();
    await this.database.query(
      `WITH RECURSIVE tree AS (
         SELECT id FROM file_nodes WHERE id = ANY($1::uuid[])
         UNION ALL
         SELECT child.id FROM file_nodes child JOIN tree ON child.parent_id = tree.id
       )
       UPDATE file_nodes SET purge_requested_at = $2, updated_at = $2
       WHERE id IN (SELECT id FROM tree)`,
      [rootIds, requestedAt],
    );
    const jobId = queueJobId('empty-trash', randomUUID());
    try {
      await this.maintenanceQueue.add(
        'empty-trash',
        { workspaceId, projectId, rootIds },
        { jobId },
      );
    } catch (error) {
      await this.database.query(
        `UPDATE file_nodes SET purge_requested_at = NULL
         WHERE workspace_id = $1 AND project_id = $2 AND purge_requested_at = $3`,
        [workspaceId, projectId, requestedAt],
      );
      throw error;
    }
    return { queued: roots.length, jobId };
  }

  async copyNode(
    workspaceId: string,
    projectId: string,
    nodeId: string,
    userId: string,
    parentId?: string,
  ): Promise<FileNodeEntity> {
    const source = await this.nodes.findOneBy({
      id: nodeId,
      workspaceId,
      projectId,
      trashedAt: IsNull(),
    });
    if (!source) throw new NotFoundException('Elemento non trovato');
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.manage',
      projectId,
      nodeId: parentId,
    });
    if (parentId) await this.assertFolder(workspaceId, projectId, parentId);
    const [copySize] = await this.database.query<Array<{ bytes: string }>>(
      `WITH RECURSIVE tree AS (SELECT id,current_version_id FROM file_nodes WHERE id=$1 UNION ALL SELECT child.id,child.current_version_id FROM file_nodes child JOIN tree ON child.parent_id=tree.id) SELECT COALESCE(sum(version.size_bytes),0)::text AS bytes FROM tree LEFT JOIN file_versions version ON version.id=tree.current_version_id`,
      [nodeId],
    );
    if (BigInt(copySize?.bytes ?? '0') > 0n)
      await this.quota.assertStorageReservation(workspaceId, BigInt(copySize.bytes));
    return this.database.transaction(async (manager) => {
      const copyRecursive = async (
        original: FileNodeEntity,
        destinationParent: string | null,
        root: boolean,
      ): Promise<FileNodeEntity> => {
        const now = new Date();
        const nodeRepository = manager.getRepository(FileNodeEntity);
        const copy = await nodeRepository.save(
          nodeRepository.create({
            ...original,
            id: randomUUID(),
            parentId: destinationParent,
            name: root ? `${original.name} copia` : original.name,
            currentVersionId: null,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
            trashedAt: null,
          }),
        );
        if (original.kind === 'file' && original.currentVersionId) {
          const version = await manager
            .getRepository(FileVersionEntity)
            .findOneByOrFail({ id: original.currentVersionId });
          const copiedVersion = await manager.getRepository(FileVersionEntity).save({
            ...version,
            id: randomUUID(),
            fileNodeId: copy.id,
            versionNumber: 1,
            createdBy: userId,
            createdAt: now,
          });
          copy.currentVersionId = copiedVersion.id;
          await manager.getRepository(FileNodeEntity).save(copy);
          await this.quota.recordStorage(
            workspaceId,
            BigInt(version.sizeBytes),
            `copy:${copiedVersion.id}`,
            manager,
          );
        }
        if (original.kind === 'folder') {
          const children = await manager
            .getRepository(FileNodeEntity)
            .findBy({ parentId: original.id, trashedAt: IsNull() });
          for (const child of children) await copyRecursive(child, copy.id, false);
        }
        return copy;
      };
      return copyRecursive(source, parentId ?? null, true);
    });
  }

  async archiveEntries(
    workspaceId: string,
    projectId: string,
    nodeId: string,
    userId: string,
  ): Promise<Array<{ path: string; version: FileVersionEntity }>> {
    const root = await this.nodes.findOneBy({
      id: nodeId,
      workspaceId,
      projectId,
      kind: 'folder',
      trashedAt: IsNull(),
    });
    if (!root) throw new NotFoundException('Cartella non trovata');
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.read',
      projectId,
      nodeId: root.id,
    });
    const rows = await this.database.query<Array<{ versionId: string; path: string }>>(
      `WITH RECURSIVE tree AS (SELECT id,name,parent_id,current_version_id,name::text AS path FROM file_nodes WHERE id=$1 UNION ALL SELECT child.id,child.name,child.parent_id,child.current_version_id,tree.path||'/'||child.name FROM file_nodes child JOIN tree ON child.parent_id=tree.id WHERE child.trashed_at IS NULL) SELECT current_version_id AS "versionId", path FROM tree WHERE current_version_id IS NOT NULL LIMIT 5000`,
      [nodeId],
    );
    const result: Array<{ path: string; version: FileVersionEntity }> = [];
    for (const row of rows)
      result.push({
        path: row.path
          .split('/')
          .map((part) => part.replace(/[\\/]/g, '_'))
          .join('/'),
        version: await this.versions.findOneByOrFail({ id: row.versionId }),
      });
    return result;
  }

  async purgeTrashedNode(
    workspaceId: string,
    projectId: string,
    nodeId: string,
    immediate = false,
  ): Promise<void> {
    const root = await this.nodes.findOneBy({ id: nodeId, workspaceId, projectId });
    if (
      !root?.trashedAt ||
      (!immediate && root.trashedAt.getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000)
    )
      return;
    await this.purgeTrashedNodes(workspaceId, projectId, [nodeId], immediate);
  }

  async purgeTrashedNodes(
    workspaceId: string,
    projectId: string,
    requestedRootIds: string[],
    immediate = false,
  ): Promise<void> {
    const roots = await this.database.query<Array<{ id: string }>>(
      `SELECT id FROM file_nodes
       WHERE workspace_id = $1 AND project_id = $2 AND id = ANY($3::uuid[])
         AND trashed_at IS NOT NULL
         AND ($4::boolean OR trashed_at <= now() - interval '30 days')`,
      [workspaceId, projectId, requestedRootIds, immediate],
    );
    if (roots.length === 0) return;
    const rootIds = roots.map((root) => root.id);
    const tree = await this.database.query<Array<{ id: string }>>(
      `WITH RECURSIVE tree AS (
         SELECT id FROM file_nodes WHERE id = ANY($1::uuid[])
         UNION
         SELECT child.id FROM file_nodes child JOIN tree ON child.parent_id = tree.id
       ) SELECT id FROM tree`,
      [rootIds],
    );
    const nodeIds = tree.map((item) => item.id);
    const references = await this.database.query<Array<{ count: string }>>(
      `SELECT count(*)::text AS count FROM delivery_items WHERE file_node_id = ANY($1::uuid[])`,
      [nodeIds],
    );
    if (Number(references[0]?.count ?? 0) > 0) {
      if (!immediate) return;
    }
    const versions = await this.versions.findBy({ fileNodeId: In(nodeIds) });
    const deletable = await this.database.query<Array<{ objectKey: string }>>(
      `SELECT object_key AS "objectKey"
       FROM file_versions
       WHERE object_key IN (
         SELECT object_key FROM file_versions WHERE file_node_id = ANY($1::uuid[])
       )
       GROUP BY object_key
       HAVING count(*) = count(*) FILTER (WHERE file_node_id = ANY($1::uuid[]))`,
      [nodeIds],
    );
    const keys = deletable.map((item) => item.objectKey);
    for (let offset = 0; offset < keys.length; offset += this.config.storageDeleteBatchSize) {
      await this.storage.deleteMany(
        keys.slice(offset, offset + this.config.storageDeleteBatchSize),
      );
    }
    await this.database.transaction(async (manager) => {
      if (immediate) {
        await manager.query(`DELETE FROM delivery_items WHERE file_node_id = ANY($1::uuid[])`, [
          nodeIds,
        ]);
      }
      await this.quota.recordStorageBatch(
        versions.map((version) => ({
          workspaceId,
          bytes: -BigInt(version.sizeBytes),
          referenceId: `purge:${version.id}`,
        })),
        manager,
      );
      await manager.getRepository(FileNodeEntity).delete(rootIds);
    });
  }

  async beginUpload(
    workspaceId: string,
    projectId: string,
    userId: string,
    dto: BeginUploadDto,
    sourceIp?: string,
  ): Promise<{ id: string; uploadUrl: string; offset: number; expiresAt: Date }> {
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.upload',
      projectId,
      nodeId: dto.fileNodeId ?? dto.parentId,
    });
    await this.projects.assertProject(workspaceId, projectId);
    if (dto.parentId) await this.assertFolder(workspaceId, projectId, dto.parentId);
    if (dto.fileNodeId) {
      const node = await this.nodes.findOneBy({
        id: dto.fileNodeId,
        workspaceId,
        projectId,
        kind: 'file',
        trashedAt: IsNull(),
      });
      if (!node) throw new NotFoundException('File da versionare non trovato');
    }
    await this.quota.assertUploadReservation(workspaceId, BigInt(dto.size));
    const sourceIpHash = this.finalizeQueue.hashIp(sourceIp);
    const id = randomUUID();
    const directory = join(this.config.localDataPath, 'uploads');
    const tempPath = join(directory, `${id}.part`);
    await mkdir(directory, { recursive: true });
    await (await open(tempPath, 'wx')).close();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const upload = this.uploads.create({
      id,
      workspaceId,
      projectId,
      parentId: dto.parentId ?? null,
      fileNodeId: dto.fileNodeId ?? null,
      fileName: dto.fileName.trim(),
      mimeType: dto.mimeType,
      expectedSize: String(dto.size),
      receivedSize: '0',
      tempPath,
      status: 'pending',
      createdBy: userId,
      createdAt: now,
      expiresAt,
      completedAt: null,
      errorCode: null,
      sourceIpHash,
    });
    try {
      await this.database.transaction('READ COMMITTED', async (manager) => {
        for (const lock of [`account:${userId}`, `ip:${sourceIpHash}`].sort()) {
          await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lock]);
        }
        await this.finalizeQueue.assertUploadCapacity(userId, sourceIpHash, manager);
        await manager.getRepository(UploadSessionEntity).save(upload);
      });
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
    return { id, uploadUrl: `/api/v1/uploads/${id}`, offset: 0, expiresAt };
  }

  async inspectUpload(uploadId: string, userId: string): Promise<UploadSessionEntity> {
    const upload = await this.uploads.findOneBy({ id: uploadId, createdBy: userId });
    if (!upload) throw new NotFoundException('Upload non trovato');
    return upload;
  }

  async appendUpload(
    uploadId: string,
    userId: string,
    offset: number,
    contentLength: number,
    request: Request,
  ): Promise<number> {
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(contentLength) ||
      contentLength <= 0
    ) {
      throw new BadRequestException('Offset o Content-Length non valido');
    }
    const received = await this.redis.withRenewingLock(
      `upload-lock:${uploadId}`,
      this.config.uploadLockTtlMs,
      async () => {
        const upload = await this.uploads.findOneBy({ id: uploadId, createdBy: userId });
        if (!upload) throw new NotFoundException('Upload non trovato');
        if (upload.expiresAt <= new Date()) throw new ConflictException('Upload scaduto');
        if (!['pending', 'uploading'].includes(upload.status))
          throw new ConflictException('Upload non modificabile');
        const current = Number(upload.receivedSize);
        if (offset !== current)
          throw new ConflictException({ message: 'Offset non valido', expectedOffset: current });
        if (current + contentLength > Number(upload.expectedSize))
          throw new BadRequestException('Chunk oltre la dimensione dichiarata');
        await truncate(upload.tempPath, current);
        try {
          await pipeline(
            request,
            createWriteStream(upload.tempPath, { flags: 'r+', start: current }),
          );
          const metadata = await stat(upload.tempPath);
          if (metadata.size !== current + contentLength)
            throw new BadRequestException('Dimensione ricevuta non valida');
          const result = await this.uploads
            .createQueryBuilder()
            .update(UploadSessionEntity)
            .set({ receivedSize: String(metadata.size), status: 'uploading' })
            .where('id = :uploadId', { uploadId })
            .andWhere('created_by = :userId', { userId })
            .andWhere('received_size = :current', { current: String(current) })
            .andWhere("status IN ('pending', 'uploading')")
            .execute();
          if (result.affected !== 1)
            throw new ConflictException('Sessione upload modificata durante il trasferimento');
          return metadata.size;
        } catch (error) {
          await truncate(upload.tempPath, current).catch(() => undefined);
          throw error;
        }
      },
    );
    if (received === null) throw new ConflictException('Upload già in corso su questa sessione');
    const upload = await this.uploads.findOneByOrFail({ id: uploadId });
    if (received === Number(upload.expectedSize)) {
      await this.finalizeQueue.enqueue(upload);
    }
    return received;
  }

  async finalize(uploadId: string): Promise<FileVersionEntity | null> {
    const upload = await this.uploads.findOneBy({ id: uploadId });
    if (!upload) return null;
    if (upload.status === 'completed' && upload.fileNodeId) {
      const node = await this.nodes.findOneBy({ id: upload.fileNodeId });
      return node?.currentVersionId ? this.versions.findOneBy({ id: node.currentVersionId }) : null;
    }
    if (upload.receivedSize !== upload.expectedSize)
      throw new ConflictException('Upload incompleto');
    const objectKey = `${upload.workspaceId}/${upload.projectId}/${upload.id}.phub`;
    try {
      const encrypted = await this.encryption.encryptAndStore(upload.tempPath, objectKey);
      const version = await this.database.transaction('READ COMMITTED', async (manager) => {
        const nodeRepository = manager.getRepository(FileNodeEntity);
        const versionRepository = manager.getRepository(FileVersionEntity);
        if (upload.fileNodeId) {
          await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
            `file-version:${upload.fileNodeId}`,
          ]);
        }
        let node = upload.fileNodeId
          ? await nodeRepository.findOneBy({ id: upload.fileNodeId })
          : null;
        const now = new Date();
        if (!node) {
          node = await nodeRepository.save(
            nodeRepository.create({
              id: randomUUID(),
              workspaceId: upload.workspaceId,
              projectId: upload.projectId,
              parentId: upload.parentId,
              kind: 'file',
              name: upload.fileName,
              currentVersionId: null,
              createdBy: upload.createdBy,
              createdAt: now,
              updatedAt: now,
              trashedAt: null,
            }),
          );
        }
        const raw = await versionRepository
          .createQueryBuilder('version')
          .select('COALESCE(MAX(version.versionNumber), 0)', 'max')
          .where('version.fileNodeId = :nodeId', { nodeId: node.id })
          .getRawOne<{ max: string }>();
        const version = await versionRepository.save(
          versionRepository.create({
            id: randomUUID(),
            fileNodeId: node.id,
            versionNumber: Number(raw?.max ?? 0) + 1,
            objectKey,
            sizeBytes: upload.expectedSize,
            checksum: encrypted.checksum,
            mimeType: upload.mimeType,
            wrappedKey: encrypted.wrappedKey,
            createdBy: upload.createdBy,
            createdAt: now,
          }),
        );
        node.currentVersionId = version.id;
        node.updatedAt = now;
        await nodeRepository.save(node);
        await manager
          .getRepository(UploadSessionEntity)
          .update(
            { id: upload.id },
            { status: 'completed', completedAt: now, fileNodeId: node.id, errorCode: null },
          );
        await this.quota.recordStorage(
          upload.workspaceId,
          BigInt(upload.expectedSize),
          version.id,
          manager,
        );
        await this.outbox.record(
          {
            topic: 'file.version.created',
            aggregateType: 'File',
            aggregateId: node.id,
            payload: {
              workspaceId: upload.workspaceId,
              projectId: upload.projectId,
              versionId: version.id,
              sizeBytes: upload.expectedSize,
            },
          },
          manager,
        );
        return version;
      });
      await rm(upload.tempPath, { force: true }).catch(() => undefined);
      return version;
    } catch (error) {
      await this.storage.delete(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async currentVersion(
    workspaceId: string,
    projectId: string,
    nodeId: string,
    userId: string,
  ): Promise<{ node: FileNodeEntity; version: FileVersionEntity }> {
    const node = await this.nodes.findOneBy({
      id: nodeId,
      workspaceId,
      projectId,
      kind: 'file',
      trashedAt: IsNull(),
    });
    if (!node?.currentVersionId) throw new NotFoundException('Versione non trovata');
    await this.authorization.assert({
      workspaceId,
      userId,
      permission: 'file.read',
      projectId,
      nodeId: node.id,
    });
    const version = await this.versions.findOneByOrFail({
      id: node.currentVersionId,
      fileNodeId: node.id,
    });
    return { node, version };
  }

  streamVersion(version: FileVersionEntity, start: number, end: number): AsyncGenerator<Buffer> {
    return this.encryption.decryptRange({
      objectKey: version.objectKey,
      wrappedKey: version.wrappedKey,
      plaintextSize: Number(version.sizeBytes),
      start,
      end,
    });
  }

  recordDownload(workspaceId: string, bytes: number, referenceId: string): Promise<void> {
    return this.quota.recordCompletedDownload(workspaceId, BigInt(bytes), referenceId);
  }

  private async assertFolder(
    workspaceId: string,
    projectId: string,
    folderId: string,
  ): Promise<void> {
    const exists = await this.nodes.existsBy({
      id: folderId,
      workspaceId,
      projectId,
      kind: 'folder',
      trashedAt: IsNull(),
    });
    if (!exists) throw new NotFoundException('Cartella non trovata');
  }
}
