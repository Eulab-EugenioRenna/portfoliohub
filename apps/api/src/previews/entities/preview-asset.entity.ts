import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { WrappedKey } from '../../adapters/contracts';

@Entity({ name: 'preview_assets' })
export class PreviewAssetEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'file_version_id' }) fileVersionId!: string;
  @Column({ length: 40 }) kind!: 'image' | 'document' | 'media' | 'archive';
  @Column({ length: 40 }) status!: 'queued' | 'processing' | 'ready' | 'failed' | 'unsupported';
  @Column({ name: 'object_key', type: 'varchar', length: 512, nullable: true }) objectKey!:
    | string
    | null;
  @Column({ name: 'mime_type', type: 'varchar', length: 255, nullable: true }) mimeType!:
    | string
    | null;
  @Column({ name: 'size_bytes', type: 'bigint', nullable: true }) sizeBytes!: string | null;
  @Column({ name: 'wrapped_key', type: 'jsonb', nullable: true }) wrappedKey!: WrappedKey | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) checksum!: string | null;
  @Column({ name: 'failure_code', type: 'varchar', length: 100, nullable: true }) failureCode!:
    | string
    | null;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt!: Date | null;
}
