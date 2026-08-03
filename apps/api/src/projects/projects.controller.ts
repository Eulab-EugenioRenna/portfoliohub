import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { CreateClientDto, CreateProjectDto, UpdateProjectDto } from './dto/projects.dto';
import { ProjectsService } from './projects.service';

@Controller({ path: 'workspaces/:workspaceId', version: '1' })
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('projects')
  list(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.projects.list(workspaceId, principal.userId);
  }

  @Post('projects')
  @UseGuards(CsrfGuard)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(workspaceId, principal.userId, dto);
  }

  @Patch('projects/:projectId')
  @UseGuards(CsrfGuard)
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(workspaceId, projectId, principal.userId, dto);
  }

  @Delete('projects/:projectId')
  @UseGuards(CsrfGuard)
  deleteProject(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.deleteProject(workspaceId, projectId, principal.userId);
  }

  @Get('clients')
  clients(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.projects.clientsList(workspaceId, principal.userId);
  }

  @Post('clients')
  @UseGuards(CsrfGuard)
  createClient(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateClientDto,
  ) {
    return this.projects.createClient(workspaceId, principal.userId, dto);
  }

  @Delete('clients/:clientId')
  @UseGuards(CsrfGuard)
  deleteClient(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.projects.deleteClient(workspaceId, clientId, principal.userId);
  }
}
