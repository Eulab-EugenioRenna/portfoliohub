import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../events/events.module';
import { IdentityModule } from '../identity/identity.module';
import { WorkspaceEntity } from './entities/workspace.entity';
import { WorkspaceMembershipEntity } from './entities/workspace-membership.entity';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesRepository } from './workspaces.repository';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity, WorkspaceMembershipEntity]),
    IdentityModule,
    EventsModule,
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesRepository, WorkspacesService],
  exports: [WorkspacesService, WorkspacesRepository],
})
export class WorkspacesModule {}
