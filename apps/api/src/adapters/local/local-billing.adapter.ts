import { Injectable } from '@nestjs/common';
import type { BillingProvider } from '../contracts';

@Injectable()
export class LocalBillingAdapter implements BillingProvider {
  async checkout(input: {
    workspaceId: string;
    plan: 'pro' | 'unlimited';
    annual: boolean;
    customerId?: string;
  }): Promise<{ url?: string; clientSecret?: string; customerId?: string }> {
    const query = new URLSearchParams({
      workspace: input.workspaceId,
      plan: input.plan,
      annual: String(input.annual),
    });
    return {
      url: `/billing/local-checkout?${query.toString()}`,
      customerId: input.customerId ?? `local:${input.workspaceId}`,
    };
  }

  async portal(workspaceId: string): Promise<{ url: string }> {
    return { url: `/billing/local-portal?workspace=${encodeURIComponent(workspaceId)}` };
  }
}
