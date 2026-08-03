import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferences1767201200000 implements MigrationInterface {
  name = 'NotificationPreferences1767201200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_preferences"
      ADD COLUMN "in_app_banner" boolean NOT NULL DEFAULT true,
      ADD COLUMN "ticket_updates" boolean NOT NULL DEFAULT true,
      ADD COLUMN "delivery_activity" boolean NOT NULL DEFAULT true,
      ADD COLUMN "workspace_activity" boolean NOT NULL DEFAULT true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_preferences"
      DROP COLUMN "workspace_activity",
      DROP COLUMN "delivery_activity",
      DROP COLUMN "ticket_updates",
      DROP COLUMN "in_app_banner"
    `);
  }
}
