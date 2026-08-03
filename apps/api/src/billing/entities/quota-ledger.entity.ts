import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'quota_ledger' })
export class QuotaLedgerEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column({ name: 'storage_delta_bytes', type: 'bigint' }) storageDeltaBytes!: string;
  @Column({ name: 'traffic_delta_bytes', type: 'bigint' }) trafficDeltaBytes!: string;
  @Column({ length: 80 }) reason!: string;
  @Column({ name: 'reference_id', length: 160 }) referenceId!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
