import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'billing_subscriptions' })
export class BillingSubscriptionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id', unique: true }) workspaceId!: string;
  @Column({
    name: 'stripe_customer_id',
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  stripeCustomerId!: string | null;
  @Column({
    name: 'stripe_subscription_id',
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  stripeSubscriptionId!: string | null;
  @Column({ name: 'stripe_price_id', type: 'varchar', length: 100, nullable: true }) stripePriceId!:
    | string
    | null;
  @Column({ length: 40 }) plan!: 'free' | 'pro' | 'unlimited';
  @Column({ name: 'billing_interval', type: 'varchar', length: 20, nullable: true })
  billingInterval!: 'monthly' | 'annual' | null;
  @Column({ length: 40 }) status!: string;
  @Column({ name: 'current_period_start', type: 'timestamptz', nullable: true })
  currentPeriodStart!: Date | null;
  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd!: Date | null;
  @Column({ name: 'cancel_at_period_end' }) cancelAtPeriodEnd!: boolean;
  @Column({ name: 'previous_paid_plan', type: 'varchar', length: 40, nullable: true })
  previousPaidPlan!: 'pro' | 'unlimited' | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
