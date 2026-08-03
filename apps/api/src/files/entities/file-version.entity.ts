import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { WrappedKey } from '../../adapters/contracts';

@Entity({ name: 'file_versions' })
export class FileVersionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'file_node_id' }) fileNodeId!: string;
  @Column({ name: 'version_number', type: 'integer' }) versionNumber!: number;
  @Column({ name: 'object_key', length: 512 }) objectKey!: string;
  @Column({ name: 'size_bytes', type: 'bigint' }) sizeBytes!: string;
  @Column({ length: 64 }) checksum!: string;
  @Column({ name: 'mime_type', length: 255 }) mimeType!: string;
  @Column({ name: 'wrapped_key', type: 'jsonb' }) wrappedKey!: WrappedKey;
  @Column('uuid', { name: 'created_by' }) createdBy!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
