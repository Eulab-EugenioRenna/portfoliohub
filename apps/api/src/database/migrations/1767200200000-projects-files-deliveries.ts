import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectsFilesDeliveries1767200200000 implements MigrationInterface {
  name = 'ProjectsFilesDeliveries1767200200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "project_status" AS ENUM ('active', 'archived', 'trashed')`,
    );
    await queryRunner.query(`CREATE TYPE "file_node_kind" AS ENUM ('file', 'folder')`);
    await queryRunner.query(
      `CREATE TYPE "upload_status" AS ENUM ('pending', 'uploading', 'completed', 'failed', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TYPE "delivery_status" AS ENUM ('draft', 'active', 'expired', 'revoked')`,
    );
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "name" varchar(160) NOT NULL,
        "email" varchar(320),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_clients_workspace" ON "clients" ("workspace_id", "name")`,
    );
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
        "name" varchar(180) NOT NULL,
        "status" "project_status" NOT NULL DEFAULT 'active',
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "trashed_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_projects_workspace_status" ON "projects" ("workspace_id", "status")`,
    );
    await queryRunner.query(`
      CREATE TABLE "file_nodes" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "parent_id" uuid REFERENCES "file_nodes"("id") ON DELETE RESTRICT,
        "kind" "file_node_kind" NOT NULL,
        "name" varchar(255) NOT NULL,
        "current_version_id" uuid,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "trashed_at" timestamptz,
        CONSTRAINT "uq_file_node_sibling_name" UNIQUE NULLS NOT DISTINCT ("project_id", "parent_id", "name", "trashed_at")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_file_nodes_parent" ON "file_nodes" ("project_id", "parent_id") WHERE "trashed_at" IS NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "file_versions" (
        "id" uuid PRIMARY KEY,
        "file_node_id" uuid NOT NULL REFERENCES "file_nodes"("id") ON DELETE CASCADE,
        "version_number" integer NOT NULL,
        "object_key" varchar(512) NOT NULL,
        "size_bytes" bigint NOT NULL,
        "checksum" char(64) NOT NULL,
        "mime_type" varchar(255) NOT NULL,
        "wrapped_key" jsonb NOT NULL,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_file_version_number" UNIQUE ("file_node_id", "version_number")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "file_nodes" ADD CONSTRAINT "fk_file_current_version" FOREIGN KEY ("current_version_id") REFERENCES "file_versions"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "upload_sessions" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "parent_id" uuid REFERENCES "file_nodes"("id") ON DELETE RESTRICT,
        "file_node_id" uuid REFERENCES "file_nodes"("id") ON DELETE CASCADE,
        "file_name" varchar(255) NOT NULL,
        "mime_type" varchar(255) NOT NULL,
        "expected_size" bigint NOT NULL,
        "received_size" bigint NOT NULL DEFAULT 0,
        "temp_path" text NOT NULL,
        "status" "upload_status" NOT NULL DEFAULT 'pending',
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "completed_at" timestamptz,
        "error_code" varchar(80)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_upload_sessions_active" ON "upload_sessions" ("workspace_id", "expires_at") WHERE "status" IN ('pending', 'uploading')`,
    );
    await queryRunner.query(`
      CREATE TABLE "quota_ledger" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "storage_delta_bytes" bigint NOT NULL DEFAULT 0,
        "traffic_delta_bytes" bigint NOT NULL DEFAULT 0,
        "reason" varchar(80) NOT NULL,
        "reference_id" varchar(160) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_quota_reference" UNIQUE ("workspace_id", "reason", "reference_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_quota_workspace" ON "quota_ledger" ("workspace_id", "created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE "deliveries" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
        "title" varchar(180) NOT NULL,
        "status" "delivery_status" NOT NULL DEFAULT 'draft',
        "public_token_hash" char(64) NOT NULL UNIQUE,
        "password_hash" text,
        "allow_download" boolean NOT NULL DEFAULT true,
        "allow_comments" boolean NOT NULL DEFAULT true,
        "allow_approval" boolean NOT NULL DEFAULT true,
        "one_shot" boolean NOT NULL DEFAULT false,
        "one_shot_redeemed_at" timestamptz,
        "expires_at" timestamptz,
        "max_downloads" integer,
        "completed_downloads" integer NOT NULL DEFAULT 0,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "activated_at" timestamptz,
        "revoked_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_deliveries_workspace" ON "deliveries" ("workspace_id", "status")`,
    );
    await queryRunner.query(`
      CREATE TABLE "delivery_items" (
        "id" uuid PRIMARY KEY,
        "delivery_id" uuid NOT NULL REFERENCES "deliveries"("id") ON DELETE CASCADE,
        "file_node_id" uuid NOT NULL REFERENCES "file_nodes"("id") ON DELETE RESTRICT,
        "file_version_id" uuid REFERENCES "file_versions"("id") ON DELETE RESTRICT,
        "snapshot_path" text NOT NULL,
        CONSTRAINT "uq_delivery_item" UNIQUE ("delivery_id", "file_node_id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "delivery_items"');
    await queryRunner.query('DROP TABLE IF EXISTS "deliveries"');
    await queryRunner.query('DROP TABLE IF EXISTS "quota_ledger"');
    await queryRunner.query('DROP TABLE IF EXISTS "upload_sessions"');
    await queryRunner.query(
      'ALTER TABLE "file_nodes" DROP CONSTRAINT IF EXISTS "fk_file_current_version"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "file_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "file_nodes"');
    await queryRunner.query('DROP TABLE IF EXISTS "projects"');
    await queryRunner.query('DROP TABLE IF EXISTS "clients"');
    await queryRunner.query('DROP TYPE IF EXISTS "delivery_status"');
    await queryRunner.query('DROP TYPE IF EXISTS "upload_status"');
    await queryRunner.query('DROP TYPE IF EXISTS "file_node_kind"');
    await queryRunner.query('DROP TYPE IF EXISTS "project_status"');
  }
}
