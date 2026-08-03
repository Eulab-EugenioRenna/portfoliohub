import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DeliverySharingHub1767201400000 implements MigrationInterface {
  name = 'DeliverySharingHub1767201400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "public_token_wrapped" jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "public_token_wrapped"`,
    );
  }
}
