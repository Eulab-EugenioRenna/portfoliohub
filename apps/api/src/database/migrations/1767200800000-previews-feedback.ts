import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PreviewsFeedback1767200800000 implements MigrationInterface {
  name = 'PreviewsFeedback1767200800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "preview_assets" (
        "id" uuid PRIMARY KEY,
        "file_version_id" uuid NOT NULL REFERENCES "file_versions"("id") ON DELETE CASCADE,
        "kind" varchar(40) NOT NULL,
        "status" varchar(40) NOT NULL,
        "object_key" varchar(512),
        "mime_type" varchar(255),
        "size_bytes" bigint,
        "wrapped_key" jsonb,
        "checksum" char(64),
        "failure_code" varchar(100),
        "attempts" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz,
        CONSTRAINT "uq_preview_version_kind" UNIQUE ("file_version_id", "kind")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "delivery_comments" (
        "id" uuid PRIMARY KEY,
        "delivery_id" uuid NOT NULL REFERENCES "deliveries"("id") ON DELETE CASCADE,
        "file_version_id" uuid REFERENCES "file_versions"("id") ON DELETE SET NULL,
        "author_name" varchar(120) NOT NULL,
        "body" varchar(5000) NOT NULL,
        "timecode_ms" integer,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "delivery_approvals" (
        "id" uuid PRIMARY KEY,
        "delivery_id" uuid NOT NULL REFERENCES "deliveries"("id") ON DELETE CASCADE,
        "file_version_id" uuid REFERENCES "file_versions"("id") ON DELETE SET NULL,
        "decision" varchar(40) NOT NULL,
        "author_name" varchar(120) NOT NULL,
        "note" varchar(5000),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_delivery_approval" UNIQUE NULLS NOT DISTINCT ("delivery_id", "file_version_id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "delivery_approvals"');
    await queryRunner.query('DROP TABLE IF EXISTS "delivery_comments"');
    await queryRunner.query('DROP TABLE IF EXISTS "preview_assets"');
  }
}
