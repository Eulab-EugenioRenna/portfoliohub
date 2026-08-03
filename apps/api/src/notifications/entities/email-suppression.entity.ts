import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'email_suppressions' })
export class EmailSuppressionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ length: 320 }) email!: string;
  @Column({ length: 40 }) scope!: 'product' | 'mass' | 'all';
  @Column({ length: 200 }) reason!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
