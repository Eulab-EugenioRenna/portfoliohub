import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'client_link_claims' })
export class ClientLinkClaimEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'identity_id' }) identityId!: string;
  @Column('uuid', { name: 'access_link_id' }) accessLinkId!: string;
  @Column({ name: 'claimed_at', type: 'timestamptz' }) claimedAt!: Date;
}
