import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { ProjectEntity } from '../projects/entities/project.entity';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import { QuotaLedgerEntity } from './entities/quota-ledger.entity';

const GB = 1_000_000_000n;
const PLAN_LIMITS = {
  free: { storage: 50n * GB, traffic: 50n * GB, projects: 1, maxFile: 50n * GB },
  pro: {
    storage: 1024n * GB,
    traffic: 3n * 1024n * GB,
    projects: Number.POSITIVE_INFINITY,
    maxFile: 100n * GB,
  },
  unlimited: {
    storage: null,
    traffic: null,
    projects: Number.POSITIVE_INFINITY,
    maxFile: 100n * GB,
  },
} as const;

@Injectable()
export class QuotaService {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(QuotaLedgerEntity)
    private readonly ledger: Repository<QuotaLedgerEntity>,
  ) {}

  async assertProjectCreation(workspaceId: string): Promise<void> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    if (workspace.status !== 'active')
      throw new ConflictException('Workspace bloccato: aggiorna il piano o svuota i dati');
    const count = await this.database
      .getRepository(ProjectEntity)
      .countBy({ workspaceId, status: 'active' });
    if (count >= PLAN_LIMITS[workspace.plan].projects)
      throw new ConflictException('Limite progetti del piano raggiunto');
  }

  async assertUploadReservation(workspaceId: string, bytes: bigint): Promise<void> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    if (workspace.status !== 'active')
      throw new ConflictException('Workspace bloccato: aggiorna il piano o svuota i dati');
    const limits = PLAN_LIMITS[workspace.plan];
    if (bytes <= 0n || bytes > limits.maxFile)
      throw new ConflictException('Dimensione file non consentita dal piano');
    await this.assertStorageReservation(workspaceId, bytes);
  }

  async assertStorageReservation(workspaceId: string, bytes: bigint): Promise<void> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    if (workspace.status !== 'active')
      throw new ConflictException('Workspace bloccato: aggiorna il piano o svuota i dati');
    const limits = PLAN_LIMITS[workspace.plan];
    if (bytes <= 0n) throw new ConflictException('Dimensione non valida');
    if (limits.storage === null) return;
    const [{ used }] = await this.database.query<Array<{ used: string }>>(
      `SELECT COALESCE(SUM(storage_delta_bytes), 0)::text AS used FROM quota_ledger WHERE workspace_id = $1`,
      [workspaceId],
    );
    const [{ reserved }] = await this.database.query<Array<{ reserved: string }>>(
      `SELECT COALESCE(SUM(expected_size), 0)::text AS reserved FROM upload_sessions WHERE workspace_id = $1 AND status IN ('pending', 'uploading') AND expires_at > now()`,
      [workspaceId],
    );
    if (BigInt(used) + BigInt(reserved) + bytes > limits.storage) {
      throw new ConflictException('Quota storage insufficiente');
    }
  }

  async recordStorage(
    workspaceId: string,
    bytes: bigint,
    referenceId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager?.getRepository(QuotaLedgerEntity) ?? this.ledger;
    await repository
      .createQueryBuilder()
      .insert()
      .values({
        id: randomUUID(),
        workspaceId,
        storageDeltaBytes: bytes.toString(),
        trafficDeltaBytes: '0',
        reason: 'file-version-created',
        referenceId,
        createdAt: new Date(),
      })
      .orIgnore()
      .execute();
  }

  async recordStorageBatch(
    entries: Array<{ workspaceId: string; bytes: bigint; referenceId: string }>,
    manager?: EntityManager,
  ): Promise<void> {
    if (entries.length === 0) return;
    const repository = manager?.getRepository(QuotaLedgerEntity) ?? this.ledger;
    const now = new Date();
    await repository
      .createQueryBuilder()
      .insert()
      .values(
        entries.map((entry) => ({
          id: randomUUID(),
          workspaceId: entry.workspaceId,
          storageDeltaBytes: entry.bytes.toString(),
          trafficDeltaBytes: '0',
          reason: 'file-version-created',
          referenceId: entry.referenceId,
          createdAt: now,
        })),
      )
      .orIgnore()
      .execute();
  }

  async recordCompletedDownload(
    workspaceId: string,
    bytes: bigint,
    referenceId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager?.getRepository(QuotaLedgerEntity) ?? this.ledger;
    await repository
      .createQueryBuilder()
      .insert()
      .values({
        id: randomUUID(),
        workspaceId,
        storageDeltaBytes: '0',
        trafficDeltaBytes: bytes.toString(),
        reason: 'download-completed',
        referenceId,
        createdAt: new Date(),
      })
      .orIgnore()
      .execute();
    if (!manager) await this.evaluateFreeWorkspace(workspaceId);
  }

  async usage(workspaceId: string): Promise<{ storageBytes: string; trafficBytes: string }> {
    const [usage] = await this.database.query<Array<{ storage: string; traffic: string }>>(
      `SELECT COALESCE(SUM(storage_delta_bytes), 0)::text AS storage,
        COALESCE(SUM(traffic_delta_bytes) FILTER (WHERE created_at >= COALESCE((SELECT current_period_start FROM billing_subscriptions WHERE workspace_id = $1), date_trunc('month', now()))), 0)::text AS traffic
       FROM quota_ledger WHERE workspace_id = $1`,
      [workspaceId],
    );
    return { storageBytes: usage.storage, trafficBytes: usage.traffic };
  }

  async storageUsage(workspaceId: string): Promise<{
    plan: 'free' | 'pro' | 'unlimited';
    storageBytes: string;
    storageLimitBytes: string | null;
  }> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    const usage = await this.usage(workspaceId);
    const limit = PLAN_LIMITS[workspace.plan].storage;
    return {
      plan: workspace.plan,
      storageBytes: usage.storageBytes,
      storageLimitBytes: limit?.toString() ?? null,
    };
  }

  async commercialUsage(workspaceId: string): Promise<{ storageGb: number; trafficGb: number }> {
    const usage = await this.usage(workspaceId);
    return {
      storageGb: Number((BigInt(usage.storageBytes) + GB - 1n) / GB),
      trafficGb: Number((BigInt(usage.trafficBytes) + GB - 1n) / GB),
    };
  }

  async evaluateFreeWorkspace(workspaceId: string): Promise<boolean> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    if (workspace.plan !== 'free') return false;
    const usage = await this.usage(workspaceId);
    const blocked =
      BigInt(usage.storageBytes) > PLAN_LIMITS.free.storage ||
      BigInt(usage.trafficBytes) > PLAN_LIMITS.free.traffic;
    await this.database.getRepository(WorkspaceEntity).update(workspaceId, {
      status: blocked ? 'blocked-over-quota' : 'active',
      updatedAt: new Date(),
    });
    return blocked;
  }
}
