import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InviteAclProvenance1767201600000 implements MigrationInterface {
  name = 'InviteAclProvenance1767201600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "acl_entries" ADD COLUMN "invite_id" uuid REFERENCES "workspace_invites"("id") ON DELETE CASCADE',
    );
    await queryRunner.query('CREATE INDEX "idx_acl_invite" ON "acl_entries" ("invite_id")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_acl_invite"');
    await queryRunner.query('ALTER TABLE "acl_entries" DROP COLUMN IF EXISTS "invite_id"');
  }
}
