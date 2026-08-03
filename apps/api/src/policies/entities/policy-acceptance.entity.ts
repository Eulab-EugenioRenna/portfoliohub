import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'policy_acceptances' })
export class PolicyAcceptanceEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('uuid', { name: 'policy_version_id' }) policyVersionId!: string;
  @Column({ name: 'accepted_at', type: 'timestamptz' }) acceptedAt!: Date;
  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true }) ipAddress!:
    | string
    | null;
}
