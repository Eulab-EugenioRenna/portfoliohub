import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Billing1767200500000 implements MigrationInterface {
  name = 'Billing1767200500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "billing_subscriptions" (
        "id" uuid PRIMARY KEY,
        "workspace_id" uuid NOT NULL UNIQUE REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "stripe_customer_id" varchar(100) UNIQUE,
        "stripe_subscription_id" varchar(100) UNIQUE,
        "stripe_price_id" varchar(100),
        "plan" varchar(40) NOT NULL DEFAULT 'free',
        "billing_interval" varchar(20),
        "status" varchar(40) NOT NULL DEFAULT 'inactive',
        "current_period_start" timestamptz,
        "current_period_end" timestamptz,
        "cancel_at_period_end" boolean NOT NULL DEFAULT false,
        "previous_paid_plan" varchar(40),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "stripe_webhook_events" (
        "event_id" varchar(120) PRIMARY KEY,
        "event_type" varchar(160) NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz,
        "error" text
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "stripe_webhook_events"');
    await queryRunner.query('DROP TABLE IF EXISTS "billing_subscriptions"');
  }
}
