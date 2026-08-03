import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { PoliciesService } from './policies.service';

@Controller({ path: 'public/policies', version: '1' })
export class PublicPoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get(':kind')
  async latest(@Param('kind') kind: string, @Query('locale') locale = 'it') {
    return (
      (await this.policies.latest(kind, locale)) ?? { kind, locale, status: 'draft-not-published' }
    );
  }
}

@Controller({ path: 'policies', version: '1' })
@UseGuards(SessionGuard)
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get('pending')
  pending(@CurrentUser() principal: AuthenticatedPrincipal, @Query('locale') locale = 'it') {
    return this.policies.pending(principal.userId, locale);
  }

  @Post(':versionId/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard)
  accept(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.policies.accept(principal.userId, versionId, request.ip);
  }
}
