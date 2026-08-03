import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'acl_entries' })
export class AclEntryEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('uuid', { name: 'project_id', nullable: true }) projectId!: string | null;
  @Column('uuid', { name: 'node_id', nullable: true }) nodeId!: string | null;
  @Column('uuid', { name: 'invite_id', nullable: true }) inviteId!: string | null;
  @Column({ length: 80 }) permission!: string;
  @Column({ type: 'enum', enumName: 'acl_effect', enum: ['allow', 'deny'] }) effect!:
    | 'allow'
    | 'deny';
  @Column('uuid', { name: 'created_by' }) createdBy!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
