import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SupportTicketConversations1767201000000 implements MigrationInterface {
  name = 'SupportTicketConversations1767201000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "support_ticket_messages" (
        "id" uuid PRIMARY KEY,
        "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
        "author_type" varchar(20) NOT NULL CHECK ("author_type" IN ('user', 'staff')),
        "author_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "author_staff_id" uuid REFERENCES "staff_users"("id") ON DELETE SET NULL,
        "body" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_support_ticket_message_author" CHECK (
          ("author_type" = 'user' AND "author_user_id" IS NOT NULL AND "author_staff_id" IS NULL)
          OR
          ("author_type" = 'staff' AND "author_staff_id" IS NOT NULL AND "author_user_id" IS NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_support_ticket_messages_thread" ON "support_ticket_messages" ("ticket_id", "created_at" ASC)`,
    );
    await queryRunner.query(`
      INSERT INTO "support_ticket_messages" (
        "id", "ticket_id", "author_type", "author_user_id", "body", "created_at"
      )
      SELECT gen_random_uuid(), id, 'user', opened_by_user_id, description, created_at
      FROM support_tickets
      WHERE opened_by_user_id IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "support_ticket_messages"');
  }
}
