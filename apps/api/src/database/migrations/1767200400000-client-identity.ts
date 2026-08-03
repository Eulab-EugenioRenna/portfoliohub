import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientIdentity1767200400000 implements MigrationInterface {
  name = 'ClientIdentity1767200400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "client_identities" (
        "id" uuid PRIMARY KEY,
        "email" varchar(320) NOT NULL,
        "display_name" varchar(120),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "verified_at" timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_client_identity_email" ON "client_identities" (lower("email"))`,
    );
    await queryRunner.query(`
      CREATE TABLE "client_access_links" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "token_hash" char(64) NOT NULL UNIQUE,
        "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "revoked_at" timestamptz,
        CONSTRAINT "uq_client_active_link" UNIQUE NULLS NOT DISTINCT ("client_id", "revoked_at")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "client_link_claims" (
        "id" uuid PRIMARY KEY,
        "identity_id" uuid NOT NULL REFERENCES "client_identities"("id") ON DELETE CASCADE,
        "access_link_id" uuid NOT NULL REFERENCES "client_access_links"("id") ON DELETE CASCADE,
        "claimed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_client_link_claim" UNIQUE ("access_link_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "client_auth_tokens" (
        "id" uuid PRIMARY KEY,
        "email" varchar(320) NOT NULL,
        "token_hash" char(64) NOT NULL UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "client_sessions" (
        "id" uuid PRIMARY KEY,
        "identity_id" uuid NOT NULL REFERENCES "client_identities"("id") ON DELETE CASCADE,
        "token_hash" char(64) NOT NULL UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "client_sessions"');
    await queryRunner.query('DROP TABLE IF EXISTS "client_auth_tokens"');
    await queryRunner.query('DROP TABLE IF EXISTS "client_link_claims"');
    await queryRunner.query('DROP TABLE IF EXISTS "client_access_links"');
    await queryRunner.query('DROP TABLE IF EXISTS "client_identities"');
  }
}
