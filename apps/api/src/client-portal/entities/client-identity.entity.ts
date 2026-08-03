import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'client_identities' })
export class ClientIdentityEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ length: 320 }) email!: string;
  @Column({ name: 'display_name', type: 'varchar', length: 120, nullable: true }) displayName!:
    | string
    | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'verified_at', type: 'timestamptz' }) verifiedAt!: Date;
}
