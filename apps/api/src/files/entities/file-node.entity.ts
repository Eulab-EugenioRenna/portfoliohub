import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'file_nodes' })
export class FileNodeEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'project_id' }) projectId!: string;
  @Column('uuid', { name: 'parent_id', nullable: true }) parentId!: string | null;
  @Column({ type: 'enum', enumName: 'file_node_kind', enum: ['file', 'folder'] }) kind!:
    | 'file'
    | 'folder';
  @Column({ length: 255 }) name!: string;
  @Column('uuid', { name: 'current_version_id', nullable: true }) currentVersionId!: string | null;
  @Column('uuid', { name: 'created_by' }) createdBy!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @Column({ name: 'trashed_at', type: 'timestamptz', nullable: true }) trashedAt!: Date | null;
  @Column({ name: 'purge_requested_at', type: 'timestamptz', nullable: true })
  purgeRequestedAt!: Date | null;
}
