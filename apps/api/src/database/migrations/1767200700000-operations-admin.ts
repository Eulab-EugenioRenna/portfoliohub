import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OperationsAdmin1767200700000 implements MigrationInterface {
  name = 'OperationsAdmin1767200700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "trial_used_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "workspaces" ADD COLUMN "trial_ends_at" timestamptz`);
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "transactional_email" boolean NOT NULL DEFAULT true,
        "product_email" boolean NOT NULL DEFAULT true,
        "mass_email" boolean NOT NULL DEFAULT false,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_notification_preferences" UNIQUE ("user_id", "workspace_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "kind" varchar(100) NOT NULL,
        "title" varchar(180) NOT NULL,
        "body" varchar(1000) NOT NULL,
        "action_url" varchar(1000),
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user" ON "notifications" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(`
      CREATE TABLE "email_deliveries" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL,
        "recipient" varchar(320) NOT NULL,
        "template" varchar(120) NOT NULL,
        "idempotency_key" varchar(200) NOT NULL UNIQUE,
        "status" varchar(40) NOT NULL,
        "provider_id" varchar(200),
        "failure_reason" varchar(1000),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "sent_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "email_suppressions" (
        "id" uuid PRIMARY KEY,
        "email" varchar(320) NOT NULL,
        "scope" varchar(40) NOT NULL,
        "reason" varchar(200) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_email_suppression" UNIQUE ("email", "scope")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "account_deletion_requests" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "subject_hash" char(64) NOT NULL,
        "requested_at" timestamptz NOT NULL DEFAULT now(),
        "scheduled_for" timestamptz NOT NULL,
        "cancelled_at" timestamptz,
        "completed_at" timestamptz,
        "certificate" jsonb,
        CONSTRAINT "uq_active_deletion" UNIQUE NULLS NOT DISTINCT ("user_id", "completed_at", "cancelled_at")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "privacy_requests" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "kind" varchar(40) NOT NULL,
        "status" varchar(40) NOT NULL,
        "result_key" varchar(500),
        "requested_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "legal_holds" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "reason" varchar(500) NOT NULL,
        "authority_reference" varchar(200),
        "active" boolean NOT NULL DEFAULT true,
        "created_by_staff_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "released_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "abuse_cases" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "status" varchar(40) NOT NULL,
        "reason" varchar(1000) NOT NULL,
        "suspended_at" timestamptz,
        "purge_after" timestamptz,
        "appeal_text" text,
        "appealed_at" timestamptz,
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "staff_users" (
        "id" uuid PRIMARY KEY,
        "email" varchar(320) NOT NULL UNIQUE,
        "display_name" varchar(120) NOT NULL,
        "password_hash" text NOT NULL,
        "role" varchar(40) NOT NULL,
        "status" varchar(40) NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_login_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "staff_sessions" (
        "id" uuid PRIMARY KEY,
        "staff_user_id" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
        "token_hash" char(64) NOT NULL UNIQUE,
        "csrf_token" varchar(160) NOT NULL,
        "ip_address" varchar(64),
        "user_agent" varchar(500),
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "staff_audit_events" (
        "id" uuid PRIMARY KEY,
        "staff_user_id" uuid REFERENCES "staff_users"("id") ON DELETE SET NULL,
        "action" varchar(160) NOT NULL,
        "target_type" varchar(100) NOT NULL,
        "target_id" varchar(160) NOT NULL,
        "reason" varchar(1000) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "support_sessions" (
        "id" uuid PRIMARY KEY,
        "staff_user_id" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "reason" varchar(1000) NOT NULL,
        "mode" varchar(40) NOT NULL DEFAULT 'read_only',
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "support_access_grants" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "reason" varchar(1000) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "staff_action_requests" (
        "id" uuid PRIMARY KEY,
        "requested_by" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
        "approved_by" uuid REFERENCES "staff_users"("id") ON DELETE SET NULL,
        "action" varchar(100) NOT NULL,
        "target_id" varchar(160) NOT NULL,
        "reason" varchar(1000) NOT NULL,
        "status" varchar(40) NOT NULL DEFAULT 'pending',
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "approved_at" timestamptz
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'staff_action_requests',
      'support_access_grants',
      'support_sessions',
      'staff_audit_events',
      'staff_sessions',
      'staff_users',
      'abuse_cases',
      'legal_holds',
      'privacy_requests',
      'account_deletion_requests',
      'email_suppressions',
      'email_deliveries',
      'notifications',
      'notification_preferences',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
    await queryRunner.query('ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "trial_ends_at"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "trial_used_at"');
  }
}
