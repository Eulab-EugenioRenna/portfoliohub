import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IdentityWorkspaces1767200100000 implements MigrationInterface {
  name = 'IdentityWorkspaces1767200100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_status" AS ENUM ('pending', 'active', 'suspended', 'deleting')`,
    );
    await queryRunner.query(`CREATE TYPE "workspace_type" AS ENUM ('freelance', 'studio')`);
    await queryRunner.query(
      `CREATE TYPE "workspace_role" AS ENUM ('owner', 'admin', 'editor', 'uploader', 'viewer', 'guest')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY,
        "email" varchar(320) NOT NULL,
        "display_name" varchar(120) NOT NULL,
        "password_hash" text,
        "status" "user_status" NOT NULL DEFAULT 'pending',
        "email_verified_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deletion_scheduled_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email_lower" ON "users" (lower("email"))`,
    );
    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id" uuid PRIMARY KEY,
        "name" varchar(120) NOT NULL,
        "slug" varchar(80) NOT NULL UNIQUE,
        "type" "workspace_type" NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "plan" varchar(40) NOT NULL DEFAULT 'free',
        "status" varchar(40) NOT NULL DEFAULT 'active',
        "onboarding_completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deletion_scheduled_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "workspace_memberships" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role" "workspace_role" NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_workspace_member" UNIQUE ("workspace_id", "user_id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_workspace_single_owner" ON "workspace_memberships" ("workspace_id") WHERE "role" = 'owner'`,
    );
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" char(64) NOT NULL UNIQUE,
        "user_agent" varchar(512),
        "ip_address" varchar(64),
        "expires_at" timestamptz NOT NULL,
        "last_seen_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "revoked_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sessions_user_active" ON "sessions" ("user_id", "expires_at") WHERE "revoked_at" IS NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "auth_tokens" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "purpose" varchar(40) NOT NULL,
        "token_hash" char(64) NOT NULL UNIQUE,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "consumed_at" timestamptz
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "auth_tokens"');
    await queryRunner.query('DROP TABLE IF EXISTS "sessions"');
    await queryRunner.query('DROP TABLE IF EXISTS "workspace_memberships"');
    await queryRunner.query('DROP TABLE IF EXISTS "workspaces"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
    await queryRunner.query('DROP TYPE IF EXISTS "workspace_role"');
    await queryRunner.query('DROP TYPE IF EXISTS "workspace_type"');
    await queryRunner.query('DROP TYPE IF EXISTS "user_status"');
  }
}
