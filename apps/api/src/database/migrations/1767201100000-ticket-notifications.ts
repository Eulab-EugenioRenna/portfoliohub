import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TicketNotifications1767201100000 implements MigrationInterface {
  name = 'TicketNotifications1767201100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "staff_notifications" (
        "id" uuid PRIMARY KEY,
        "staff_user_id" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
        "kind" varchar(100) NOT NULL,
        "title" varchar(180) NOT NULL,
        "body" varchar(1000) NOT NULL,
        "action_url" varchar(1000),
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_staff_notifications_inbox" ON "staff_notifications" ("staff_user_id", "created_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "staff_notifications"');
  }
}
