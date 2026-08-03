import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { CreateWorkspaceDto, TransferOwnershipDto, UpdateWorkspaceDto } from './dto/workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller({ path: 'workspaces', version: '1' })
@UseGuards(SessionGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.workspaces.list(principal.userId);
  }

  @Get('capabilities')
  capabilities(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.workspaces.capabilities(principal.userId);
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(principal.userId, dto);
  }

  @Get(':workspaceId')
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaces.get(workspaceId, principal.userId);
  }

  @Patch(':workspaceId')
  @UseGuards(CsrfGuard)
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(workspaceId, principal.userId, dto);
  }

  @Get(':workspaceId/search')
  search(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('q') query = '',
  ) {
    return this.workspaces.search(workspaceId, principal.userId, query);
  }

  @Patch(':workspaceId/onboarding/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard)
  completeOnboarding(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<void> {
    return this.workspaces.completeOnboarding(workspaceId, principal.userId);
  }

  @Post(':workspaceId/transfer-ownership')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard)
  transferOwnership(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: TransferOwnershipDto,
  ): Promise<void> {
    return this.workspaces.transferOwnership(workspaceId, principal.userId, dto);
  }
}
