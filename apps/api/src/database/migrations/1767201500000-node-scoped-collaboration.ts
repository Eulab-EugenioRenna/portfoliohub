import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NodeScopedCollaboration1767201500000 implements MigrationInterface {
  name = 'NodeScopedCollaboration1767201500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "workspace_invites" RENAME COLUMN "folder_id" TO "node_id"',
    );
    await queryRunner.query('ALTER TABLE "acl_entries" RENAME COLUMN "folder_id" TO "node_id"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "acl_entries" RENAME COLUMN "node_id" TO "folder_id"');
    await queryRunner.query(
      'ALTER TABLE "workspace_invites" RENAME COLUMN "node_id" TO "folder_id"',
    );
  }
}
