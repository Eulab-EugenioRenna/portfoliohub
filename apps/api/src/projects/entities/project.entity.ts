import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'projects' })
export class ProjectEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'client_id', nullable: true }) clientId!: string | null;
  @Column({ length: 180 }) name!: string;
  @Column({
    type: 'enum',
    enumName: 'project_status',
    enum: ['active', 'archived', 'trashed'],
    default: 'active',
  })
  status!: 'active' | 'archived' | 'trashed';
  @Column('uuid', { name: 'created_by' }) createdBy!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @Column({ name: 'trashed_at', type: 'timestamptz', nullable: true }) trashedAt!: Date | null;
}
