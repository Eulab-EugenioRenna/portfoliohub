import type { RawBodyRequest } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/billing.dto';

@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('catalog')
  catalog() {
    return this.billing.catalog();
  }

  @Get('workspaces/:workspaceId')
  @UseGuards(SessionGuard)
  status(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.billing.status(workspaceId, principal.userId);
  }

  @Get('workspaces/:workspaceId/storage-usage')
  @UseGuards(SessionGuard)
  storageUsage(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.billing.storageUsage(workspaceId, principal.userId);
  }

  @Post('workspaces/:workspaceId/checkout')
  @UseGuards(SessionGuard, CsrfGuard)
  checkout(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.billing.checkout(workspaceId, principal.userId, dto);
  }

  @Post('workspaces/:workspaceId/portal')
  @UseGuards(SessionGuard, CsrfGuard)
  portal(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.billing.portal(workspaceId, principal.userId);
  }

  @Post('stripe/webhook')
  async stripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: true }> {
    if (!request.rawBody) throw new Error('Raw webhook body non disponibile');
    const event = this.billing.constructStripeEvent(request.rawBody, signature);
    await this.billing.processStripeEvent(event);
    return { received: true };
  }
}
