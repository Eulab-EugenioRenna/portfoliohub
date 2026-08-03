import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'upload_sessions' })
export class UploadSessionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'project_id' }) projectId!: string;
  @Column('uuid', { name: 'parent_id', nullable: true }) parentId!: string | null;
  @Column('uuid', { name: 'file_node_id', nullable: true }) fileNodeId!: string | null;
  @Column({ name: 'file_name', length: 255 }) fileName!: string;
  @Column({ name: 'mime_type', length: 255 }) mimeType!: string;
  @Column({ name: 'expected_size', type: 'bigint' }) expectedSize!: string;
  @Column({ name: 'received_size', type: 'bigint' }) receivedSize!: string;
  @Column({ name: 'temp_path', type: 'text' }) tempPath!: string;
  @Column({
    type: 'enum',
    enumName: 'upload_status',
    enum: ['pending', 'uploading', 'completed', 'failed', 'expired'],
  })
  status!: 'pending' | 'uploading' | 'completed' | 'failed' | 'expired';
  @Column('uuid', { name: 'created_by' }) createdBy!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt!: Date | null;
  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true }) errorCode!:
    | string
    | null;
  @Column({ name: 'source_ip_hash', type: 'char', length: 64, nullable: true })
  sourceIpHash!: string | null;
}
