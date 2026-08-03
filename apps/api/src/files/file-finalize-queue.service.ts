import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { integrationsConfig } from '../config/integrations.config';
import type { UploadSessionEntity } from './entities/upload-session.entity';

export interface ClaimedFinalizeJob {
  uploadId: string;
  accountId: string;
  ipHash: string;
  attempts: number;
}

export function returningRows<T>(result: T[] | [T[], number]): T[] {
  return Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]);
}

@Injectable()
export class FileFinalizeQueueService {
  constructor(
    private readonly database: DataSource,
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  hashIp(ip: string | undefined): string {
    return createHash('sha256')
      .update(ip?.trim() || 'unknown')
      .digest('hex');
  }

  async assertUploadCapacity(
    accountId: string,
    ipHash: string,
    manager?: EntityManager,
  ): Promise<void> {
    const query = manager?.query.bind(manager) ?? this.database.query.bind(this.database);
    const [counts] = await query<Array<{ account: string; ip: string }>>(
      `SELECT
        count(*) FILTER (WHERE created_by = $1)::text AS account,
        count(*) FILTER (WHERE source_ip_hash = $2)::text AS ip
       FROM upload_sessions
       WHERE status IN ('pending', 'uploading') AND expires_at > now()
         AND (created_by = $1 OR source_ip_hash = $2)`,
      [accountId, ipHash],
    );
    if (Number(counts?.account ?? 0) >= this.config.uploadMaxActivePerAccount) {
      throw new HttpException(
        'Limite di upload attivi raggiunto per questo account',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (Number(counts?.ip ?? 0) >= this.config.uploadMaxActivePerIp) {
      throw new HttpException(
        'Limite di upload attivi raggiunto per questo indirizzo IP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async enqueue(upload: UploadSessionEntity): Promise<void> {
    await this.database.query(
      `INSERT INTO file_finalize_queue (upload_id, account_id, ip_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (upload_id) DO NOTHING`,
      [upload.id, upload.createdBy, upload.sourceIpHash ?? this.hashIp(undefined)],
    );
  }

  async recoverReadyUploads(): Promise<void> {
    await this.database.query(
      `INSERT INTO file_finalize_queue (upload_id, account_id, ip_hash)
       SELECT upload.id, upload.created_by,
         COALESCE(upload.source_ip_hash, repeat('0', 64))
       FROM upload_sessions upload
       WHERE upload.status = 'uploading' AND upload.received_size = upload.expected_size
       ON CONFLICT (upload_id) DO NOTHING`,
    );
  }

  async claim(): Promise<ClaimedFinalizeJob | null> {
    return this.database.transaction(async (manager) => {
      // Serializza soltanto l'assegnazione (pochi ms), non il lavoro: due repliche non possono
      // fotografare lo stesso carico e assegnare consecutivamente due job allo stesso account.
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext('file-finalize-fair-claim'))`);
      const raw = (await manager.query(
        `WITH account_load AS (
         SELECT account_id, count(*) AS active
         FROM file_finalize_queue
         WHERE status = 'processing' AND lease_until >= now()
         GROUP BY account_id
       ), candidate AS (
         SELECT queue.upload_id
         FROM file_finalize_queue queue
         LEFT JOIN account_load ON account_load.account_id = queue.account_id
         WHERE queue.status = 'queued'
           OR (queue.status = 'processing' AND queue.lease_until < now())
         ORDER BY COALESCE(account_load.active, 0), queue.queued_at, queue.upload_id
         FOR UPDATE OF queue SKIP LOCKED
         LIMIT 1
       )
       UPDATE file_finalize_queue queue
       SET status = 'processing', started_at = now(),
         lease_until = now() + ($1::integer * interval '1 millisecond'),
         attempts = attempts + 1, last_error = NULL
       FROM candidate
       WHERE queue.upload_id = candidate.upload_id
       RETURNING queue.upload_id AS "uploadId", queue.account_id AS "accountId",
         queue.ip_hash AS "ipHash", queue.attempts`,
        [this.config.fileFinalizeLeaseMs],
      )) as
        | Array<{ uploadId: string; accountId: string; ipHash: string; attempts: number }>
        | [
            Array<{ uploadId: string; accountId: string; ipHash: string; attempts: number }>,
            number,
          ];
      const [job] = returningRows(raw);
      return job ?? null;
    });
  }

  async renew(uploadId: string): Promise<void> {
    await this.database.query(
      `UPDATE file_finalize_queue
       SET lease_until = now() + ($2::integer * interval '1 millisecond')
       WHERE upload_id = $1 AND status = 'processing'`,
      [uploadId, this.config.fileFinalizeLeaseMs],
    );
  }

  async complete(uploadId: string): Promise<void> {
    await this.database.query(`DELETE FROM file_finalize_queue WHERE upload_id = $1`, [uploadId]);
  }

  async fail(uploadId: string, error: unknown): Promise<void> {
    const detail =
      error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
    const raw = (await this.database.query(
      `UPDATE file_finalize_queue
       SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
         lease_until = NULL, queued_at = CASE WHEN attempts >= 3 THEN queued_at ELSE now() END,
         last_error = $2
       WHERE upload_id = $1
       RETURNING attempts`,
      [uploadId, detail],
    )) as Array<{ attempts: number }> | [Array<{ attempts: number }>, number];
    const [job] = returningRows(raw);
    if ((job?.attempts ?? 0) >= 3) {
      await this.database.query(
        `UPDATE upload_sessions SET status = 'failed', error_code = 'FINALIZE_RETRIES_EXHAUSTED'
         WHERE id = $1 AND status <> 'completed'`,
        [uploadId],
      );
    }
  }

  async depth(): Promise<{ queued: number; processing: number; failed: number }> {
    const rows = await this.database.query<Array<{ status: string; count: string }>>(
      `SELECT status, count(*)::text AS count FROM file_finalize_queue GROUP BY status`,
    );
    const counts = { queued: 0, processing: 0, failed: 0 };
    for (const row of rows) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.count);
    }
    return counts;
  }
}
