import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { DataSource, type Repository } from 'typeorm';
import { BILLING_PROVIDER, type BillingProvider } from '../adapters/contracts';
import { StripeBillingAdapter } from '../adapters/stripe/stripe-billing.adapter';
import { billingConfig } from '../config/billing.config';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import { WORKSPACE_PLAN_LIMITS } from '../workspaces/workspace-plan-policy';
import { WorkspacesService } from '../workspaces/workspaces.service';
import type { CheckoutDto } from './dto/billing.dto';
import { BillingSubscriptionEntity } from './entities/billing-subscription.entity';
import { StripeWebhookEventEntity } from './entities/stripe-webhook-event.entity';
import { QuotaService } from './quota.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(BillingSubscriptionEntity)
    private readonly subscriptions: Repository<BillingSubscriptionEntity>,
    @InjectRepository(StripeWebhookEventEntity)
    private readonly webhookEvents: Repository<StripeWebhookEventEntity>,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
    @Inject(billingConfig.KEY)
    private readonly config: ConfigType<typeof billingConfig>,
    private readonly stripe: StripeBillingAdapter,
    private readonly workspaces: WorkspacesService,
    private readonly quota: QuotaService,
  ) {}

  catalog() {
    return {
      provider: this.configProvider(),
      publishableKey: this.configProvider() === 'stripe' ? this.stripe.publishableKey() : '',
      annualDiscountPercent: 17,
      plans: [
        {
          id: 'free',
          monthly: 0,
          annual: 0,
          storageGb: 50,
          trafficGb: 50,
          projects: 1,
          members: 3,
          maxFileGb: 50,
          workspaces: WORKSPACE_PLAN_LIMITS.free,
        },
        {
          id: 'pro',
          monthly: 24.9,
          annual: 249,
          storageGb: 1024,
          trafficGb: 3072,
          projects: null,
          members: 10,
          maxFileGb: 100,
          workspaces: WORKSPACE_PLAN_LIMITS.pro,
        },
        {
          id: 'unlimited',
          monthly: 159.9,
          annual: 1599,
          storageGb: null,
          trafficGb: null,
          projects: null,
          members: null,
          maxFileGb: 100,
          workspaces: WORKSPACE_PLAN_LIMITS.unlimited,
          fairUse: true,
        },
      ],
    };
  }

  async status(workspaceId: string, userId: string) {
    await this.workspaces.assertRole(workspaceId, userId, ['owner', 'admin']);
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    const subscription = await this.subscriptions.findOneBy({ workspaceId });
    if (workspace.plan === 'free' && workspace.status === 'quota-check-required')
      await this.quota.evaluateFreeWorkspace(workspaceId);
    const refreshed = await this.database
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    return {
      plan: refreshed.plan,
      workspaceStatus: refreshed.status,
      subscription,
      usage: await this.quota.usage(workspaceId),
      commercialUsage: await this.quota.commercialUsage(workspaceId),
    };
  }

  async storageUsage(workspaceId: string, userId: string) {
    await this.workspaces.assertRole(workspaceId, userId, [
      'owner',
      'admin',
      'editor',
      'uploader',
      'viewer',
      'guest',
    ]);
    return this.quota.storageUsage(workspaceId);
  }

  async checkout(
    workspaceId: string,
    userId: string,
    dto: CheckoutDto,
  ): Promise<{ url?: string; clientSecret?: string }> {
    await this.workspaces.assertRole(workspaceId, userId, ['owner']);
    const subscription = await this.subscriptions.findOneBy({ workspaceId });
    const result = await this.provider.checkout({
      workspaceId,
      plan: dto.plan,
      annual: dto.annual,
      customerId: subscription?.stripeCustomerId ?? undefined,
    });
    if (result.customerId && !subscription) {
      const now = new Date();
      await this.subscriptions.save({
        id: randomUUID(),
        workspaceId,
        stripeCustomerId: result.customerId,
        stripeSubscriptionId: null,
        stripePriceId: null,
        plan: 'free',
        billingInterval: null,
        status: 'checkout-pending',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        previousPaidPlan: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { url: result.url, clientSecret: result.clientSecret };
  }

  private configProvider(): 'local' | 'stripe' {
    return this.config.provider === 'stripe' && this.stripe.isConfigured() ? 'stripe' : 'local';
  }

  async portal(workspaceId: string, userId: string): Promise<{ url: string }> {
    await this.workspaces.assertRole(workspaceId, userId, ['owner']);
    const subscription = await this.subscriptions.findOneBy({ workspaceId });
    if (!subscription?.stripeCustomerId)
      throw new NotFoundException('Profilo di fatturazione non disponibile');
    return this.provider.portal(subscription.stripeCustomerId);
  }

  constructStripeEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.constructEvent(payload, signature);
  }

  async processStripeEvent(event: Stripe.Event): Promise<void> {
    const inserted = await this.webhookEvents
      .createQueryBuilder()
      .insert()
      .values({
        eventId: event.id,
        eventType: event.type,
        receivedAt: new Date(),
        processedAt: null,
        error: null,
      })
      .orIgnore()
      .execute();
    if ((inserted.identifiers?.length ?? 0) === 0) return;
    try {
      if (event.type.startsWith('customer.subscription.')) {
        await this.applySubscription(
          event.data.object as Stripe.Subscription,
          event.type === 'customer.subscription.deleted',
        );
      } else if (event.type === 'invoice.payment_failed' || event.type === 'invoice.paid') {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await this.subscriptions.update(
            { stripeCustomerId: customerId },
            {
              status: event.type === 'invoice.paid' ? 'active' : 'past_due',
              updatedAt: new Date(),
            },
          );
        }
      }
      await this.webhookEvents.update(
        { eventId: event.id },
        { processedAt: new Date(), error: null },
      );
    } catch (error) {
      await this.webhookEvents.update(
        { eventId: event.id },
        {
          error: error instanceof Error ? error.message.slice(0, 4000) : String(error),
        },
      );
      throw error;
    }
  }

  async expireTrial(workspaceId: string): Promise<void> {
    const workspace = await this.database
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: workspaceId });
    if (!workspace?.trialEndsAt || workspace.trialEndsAt > new Date()) return;
    const subscription = await this.subscriptions.findOneBy({ workspaceId });
    if (subscription && ['active', 'trialing'].includes(subscription.status)) return;
    await this.database.getRepository(WorkspaceEntity).update(workspaceId, {
      plan: 'free',
      status: 'quota-check-required',
      trialEndsAt: null,
      updatedAt: new Date(),
    });
    await this.quota.evaluateFreeWorkspace(workspaceId);
  }

  async assignManualPlan(workspaceId: string, plan: 'free' | 'pro' | 'unlimited') {
    const now = new Date();
    const result = await this.database.transaction(async (manager) => {
      const workspaceRepository = manager.getRepository(WorkspaceEntity);
      const subscriptionRepository = manager.getRepository(BillingSubscriptionEntity);
      const workspace = await workspaceRepository.findOneBy({
        id: workspaceId,
      });
      if (!workspace) throw new NotFoundException('Workspace non trovato');
      const existing = await subscriptionRepository.findOneBy({ workspaceId });
      if (existing?.stripeSubscriptionId && ['active', 'trialing'].includes(existing.status))
        throw new ConflictException(
          'Il workspace ha un abbonamento Stripe attivo: gestiscilo dal Customer Portal',
        );

      const subscription =
        existing ??
        subscriptionRepository.create({
          id: randomUUID(),
          workspaceId,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          createdAt: now,
        });
      subscription.plan = plan;
      subscription.billingInterval = null;
      subscription.status = 'manual';
      subscription.currentPeriodStart = now;
      subscription.currentPeriodEnd = null;
      subscription.cancelAtPeriodEnd = false;
      subscription.previousPaidPlan = plan === 'free' ? subscription.previousPaidPlan : plan;
      subscription.updatedAt = now;
      await subscriptionRepository.save(subscription);

      workspace.plan = plan;
      workspace.trialEndsAt = null;
      workspace.status = plan === 'free' ? 'quota-check-required' : 'active';
      workspace.updatedAt = now;
      await workspaceRepository.save(workspace);
      return { workspace, subscription };
    });
    if (plan === 'free') await this.quota.evaluateFreeWorkspace(workspaceId);
    return result;
  }

  private async applySubscription(
    subscription: Stripe.Subscription,
    deleted: boolean,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const priceId = subscription.items.data[0]?.price.id;
    const mapped = priceId ? this.stripe.planForPrice(priceId) : null;
    const existing = await this.subscriptions.findOne({
      where: [{ stripeSubscriptionId: subscription.id }, { stripeCustomerId: customerId }],
    });
    const workspaceId = subscription.metadata['workspaceId'] ?? existing?.workspaceId;
    if (!workspaceId) throw new Error('Stripe subscription senza workspaceId');
    const now = new Date();
    const active = !deleted && ['active', 'trialing'].includes(subscription.status) && mapped;
    const plan = active && mapped ? mapped.plan : 'free';
    const periodEndSeconds = (subscription as unknown as { current_period_end?: number })
      .current_period_end;
    const periodStartSeconds = (subscription as unknown as { current_period_start?: number })
      .current_period_start;
    await this.database.transaction(async (manager) => {
      const repository = manager.getRepository(BillingSubscriptionEntity);
      const record =
        existing ?? repository.create({ id: randomUUID(), workspaceId, createdAt: now });
      record.stripeCustomerId = customerId;
      record.stripeSubscriptionId = deleted ? null : subscription.id;
      record.stripePriceId = deleted ? null : (priceId ?? null);
      record.previousPaidPlan =
        existing?.plan === 'pro' || existing?.plan === 'unlimited'
          ? existing.plan
          : (existing?.previousPaidPlan ?? null);
      record.plan = plan;
      record.billingInterval = active && mapped ? mapped.interval : null;
      record.status = deleted ? 'inactive' : subscription.status;
      record.currentPeriodStart = periodStartSeconds ? new Date(periodStartSeconds * 1000) : null;
      record.currentPeriodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000) : null;
      record.cancelAtPeriodEnd = subscription.cancel_at_period_end;
      record.updatedAt = now;
      await repository.save(record);
      const workspace = await manager
        .getRepository(WorkspaceEntity)
        .findOneByOrFail({ id: workspaceId });
      const previousPlan = workspace.plan;
      workspace.plan = plan;
      if (active) workspace.trialEndsAt = null;
      workspace.status =
        plan === 'free' && previousPlan !== 'free' ? 'quota-check-required' : 'active';
      workspace.updatedAt = now;
      await manager.getRepository(WorkspaceEntity).save(workspace);
    });
    if (plan === 'free') await this.quota.evaluateFreeWorkspace(workspaceId);
  }
}
