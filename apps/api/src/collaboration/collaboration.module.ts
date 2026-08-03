import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { IdentityModule } from '../identity/identity.module';
import { ProjectEntity } from '../projects/entities/project.entity';
import { WorkspaceMembershipEntity } from '../workspaces/entities/workspace-membership.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuthorizationService } from './authorization.service';
import { CollaborationController, PublicCollaborationController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';
import { AclEntryEntity } from './entities/acl-entry.entity';
import { WorkspaceInviteEntity } from './entities/workspace-invite.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceInviteEntity,
      AclEntryEntity,
      WorkspaceMembershipEntity,
      ProjectEntity,
      FileNodeEntity,
    ]),
    AdaptersModule,
    AuditModule,
    EventsModule,
    IdentityModule,
    WorkspacesModule,
  ],
  controllers: [CollaborationController, PublicCollaborationController],
  providers: [CollaborationService, AuthorizationService],
  exports: [AuthorizationService],
})
export class CollaborationModule {}
