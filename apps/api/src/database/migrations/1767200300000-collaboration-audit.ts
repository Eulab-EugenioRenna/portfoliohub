import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CollaborationAudit1767200300000 implements MigrationInterface {
  name = 'CollaborationAudit1767200300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "acl_effect" AS ENUM ('allow', 'deny')`);
    await queryRunner.query(`
      CREATE TABLE "workspace_invites" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "email" varchar(320) NOT NULL,
        "role" "workspace_role" NOT NULL,
        "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
        "folder_id" uuid REFERENCES "file_nodes"("id") ON DELETE CASCADE,
        "token_hash" char(64) NOT NULL UNIQUE,
        "invited_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "revoked_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_invites_workspace" ON "workspace_invites" ("workspace_id", "created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE "acl_entries" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
        "folder_id" uuid REFERENCES "file_nodes"("id") ON DELETE CASCADE,
        "permission" varchar(80) NOT NULL,
        "effect" "acl_effect" NOT NULL,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_acl_scope" CHECK ("project_id" IS NOT NULL OR "folder_id" IS NOT NULL)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_acl_resolution" ON "acl_entries" ("workspace_id", "user_id", "project_id", "folder_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "activity_events" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
        "kind" varchar(120) NOT NULL,
        "summary" varchar(500) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_activity_workspace" ON "activity_events" ("workspace_id", "created_at" DESC)`,
    );
    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "action" varchar(160) NOT NULL,
        "target_type" varchar(100) NOT NULL,
        "target_id" varchar(160) NOT NULL,
        "correlation_id" varchar(128),
        "ip_address" varchar(64),
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_workspace" ON "audit_events" ("workspace_id", "created_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "audit_events"');
    await queryRunner.query('DROP TABLE IF EXISTS "activity_events"');
    await queryRunner.query('DROP TABLE IF EXISTS "acl_entries"');
    await queryRunner.query('DROP TABLE IF EXISTS "workspace_invites"');
    await queryRunner.query('DROP TYPE IF EXISTS "acl_effect"');
  }
}
