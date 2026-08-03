import type { MigrationInterface, QueryRunner } from 'typeorm';

export class StoragePerformance1767201300000 implements MigrationInterface {
  name = 'StoragePerformance1767201300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "file_nodes" ADD COLUMN IF NOT EXISTS "purge_requested_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "source_ip_hash" char(64)`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_finalize_queue" (
        "upload_id" uuid PRIMARY KEY REFERENCES "upload_sessions"("id") ON DELETE CASCADE,
        "account_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "ip_hash" char(64) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'queued',
        "attempts" integer NOT NULL DEFAULT 0,
        "queued_at" timestamptz NOT NULL DEFAULT now(),
        "started_at" timestamptz,
        "lease_until" timestamptz,
        "last_error" varchar(1000),
        CONSTRAINT "ck_file_finalize_status" CHECK ("status" IN ('queued', 'processing', 'failed'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_file_finalize_fair"
      ON "file_finalize_queue" ("status", "account_id", "queued_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_file_finalize_lease"
      ON "file_finalize_queue" ("lease_until") WHERE "status" = 'processing'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_upload_sessions_account_active"
      ON "upload_sessions" ("created_by", "status")
      WHERE "status" IN ('pending', 'uploading')
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_upload_sessions_ip_active"
      ON "upload_sessions" ("source_ip_hash", "status")
      WHERE "status" IN ('pending', 'uploading')
    `);
    await queryRunner.query(
      `ALTER TABLE "file_nodes" DROP CONSTRAINT IF EXISTS "file_nodes_parent_id_fkey"`,
    );
    await queryRunner.query(`
      ALTER TABLE "file_nodes"
      ADD CONSTRAINT "file_nodes_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "file_nodes"("id") ON DELETE CASCADE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "file_nodes" DROP CONSTRAINT IF EXISTS "file_nodes_parent_id_fkey"`,
    );
    await queryRunner.query(`
      ALTER TABLE "file_nodes"
      ADD CONSTRAINT "file_nodes_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "file_nodes"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_upload_sessions_ip_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_upload_sessions_account_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_finalize_queue"`);
    await queryRunner.query(`ALTER TABLE "upload_sessions" DROP COLUMN IF EXISTS "source_ip_hash"`);
    await queryRunner.query(`ALTER TABLE "file_nodes" DROP COLUMN IF EXISTS "purge_requested_at"`);
  }
}
