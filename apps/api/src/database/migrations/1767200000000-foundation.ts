import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Foundation1767200000000 implements MigrationInterface {
  name = 'Foundation1767200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_events" (
        "id" uuid PRIMARY KEY,
        "topic" varchar(160) NOT NULL,
        "aggregate_type" varchar(120) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "payload" jsonb NOT NULL,
        "correlation_id" varchar(128),
        "occurred_at" timestamptz NOT NULL,
        "published_at" timestamptz,
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_outbox_pending"
      ON "outbox_events" ("occurred_at") WHERE "published_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inbox_receipts" (
        "id" uuid PRIMARY KEY,
        "consumer" varchar(160) NOT NULL,
        "event_id" uuid NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_inbox_consumer_event" UNIQUE ("consumer", "event_id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "inbox_receipts"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_outbox_pending"');
    await queryRunner.query('DROP TABLE IF EXISTS "outbox_events"');
  }
}
