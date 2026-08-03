import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import Stripe from 'stripe';
import { appConfig } from '../../config/app.config';
import { billingConfig } from '../../config/billing.config';
import type { BillingProvider } from '../contracts';

@Injectable()
export class StripeBillingAdapter implements BillingProvider {
  private client: Stripe | null = null;

  constructor(
    @Inject(billingConfig.KEY) private readonly config: ConfigType<typeof billingConfig>,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.stripeSecretKey && this.config.stripePublishableKey);
  }

  publishableKey(): string {
    return this.isConfigured() ? this.config.stripePublishableKey : '';
  }

  async checkout(input: {
    workspaceId: string;
    plan: 'pro' | 'unlimited';
    annual: boolean;
    customerId?: string;
  }): Promise<{ url?: string; clientSecret?: string; customerId?: string }> {
    const stripe = this.stripe();
    const price = this.price(input.plan, input.annual);
    const customerId =
      input.customerId ??
      (await stripe.customers.create({ metadata: { workspaceId: input.workspaceId } })).id;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: input.workspaceId,
      metadata: { workspaceId: input.workspaceId, requestedPlan: input.plan },
      subscription_data: {
        metadata: { workspaceId: input.workspaceId, requestedPlan: input.plan },
      },
      redirect_on_completion: 'never',
    });
    if (!session.client_secret)
      throw new ServiceUnavailableException('Stripe Checkout incorporato non disponibile');
    return { clientSecret: session.client_secret, customerId };
  }

  async portal(customerId: string): Promise<{ url: string }> {
    const session = await this.stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.app.origin}/impostazioni`,
    });
    return { url: session.url };
  }

  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!this.config.stripeWebhookSecret)
      throw new ServiceUnavailableException('Webhook Stripe non configurato');
    return this.stripe().webhooks.constructEvent(
      payload,
      signature,
      this.config.stripeWebhookSecret,
    );
  }

  planForPrice(
    priceId: string,
  ): { plan: 'pro' | 'unlimited'; interval: 'monthly' | 'annual' } | null {
    for (const plan of ['pro', 'unlimited'] as const) {
      for (const interval of ['monthly', 'annual'] as const) {
        if (this.config.prices[plan][interval] === priceId) return { plan, interval };
      }
    }
    return null;
  }

  private stripe(): Stripe {
    if (!this.config.stripeSecretKey)
      throw new ServiceUnavailableException('Stripe non configurato');
    this.client ??= new Stripe(this.config.stripeSecretKey);
    return this.client;
  }

  private price(plan: 'pro' | 'unlimited', annual: boolean): string {
    const value = this.config.prices[plan][annual ? 'annual' : 'monthly'];
    if (!value) throw new ServiceUnavailableException(`Prezzo Stripe ${plan} non configurato`);
    return value;
  }
}
