import { registerAs } from '@nestjs/config';

export const billingConfig = registerAs('billing', () => ({
  provider: (process.env.BILLING_PROVIDER ?? 'local') as 'local' | 'stripe',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  prices: {
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '',
      annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? '',
    },
    unlimited: {
      monthly: process.env.STRIPE_UNLIMITED_MONTHLY_PRICE_ID ?? '',
      annual: process.env.STRIPE_UNLIMITED_ANNUAL_PRICE_ID ?? '',
    },
  },
}));
