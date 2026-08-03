import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PortfolioPolicy1767200600000 implements MigrationInterface {
  name = 'PortfolioPolicy1767200600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "portfolio_sites" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL UNIQUE REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "slug" varchar(80) NOT NULL UNIQUE,
        "draft" jsonb NOT NULL,
        "draft_revision" integer NOT NULL DEFAULT 1,
        "published_snapshot" jsonb,
        "published_revision" integer,
        "published_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "policy_versions" (
        "id" uuid PRIMARY KEY,
        "kind" varchar(80) NOT NULL,
        "locale" varchar(10) NOT NULL,
        "version" varchar(40) NOT NULL,
        "content" jsonb NOT NULL,
        "content_hash" char(64) NOT NULL,
        "material" boolean NOT NULL DEFAULT false,
        "effective_at" timestamptz NOT NULL,
        "published_at" timestamptz NOT NULL,
        CONSTRAINT "uq_policy_version" UNIQUE ("kind", "locale", "version")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "policy_acceptances" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "policy_version_id" uuid NOT NULL REFERENCES "policy_versions"("id") ON DELETE RESTRICT,
        "accepted_at" timestamptz NOT NULL DEFAULT now(),
        "ip_address" varchar(64),
        CONSTRAINT "uq_policy_acceptance" UNIQUE ("user_id", "policy_version_id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "policy_acceptances"');
    await queryRunner.query('DROP TABLE IF EXISTS "policy_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "portfolio_sites"');
  }
}
