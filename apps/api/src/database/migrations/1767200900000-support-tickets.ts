import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SupportTickets1767200900000 implements MigrationInterface {
  name = 'SupportTickets1767200900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "support_tickets" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "opened_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "subject" varchar(160) NOT NULL,
        "category" varchar(40) NOT NULL,
        "priority" varchar(20) NOT NULL,
        "status" varchar(40) NOT NULL,
        "description" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "resolved_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_support_tickets_workspace" ON "support_tickets" ("workspace_id", "updated_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_support_tickets_status" ON "support_tickets" ("status", "priority", "updated_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "support_tickets"');
  }
}
