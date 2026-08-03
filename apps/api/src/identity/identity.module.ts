import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { EventsModule } from '../events/events.module';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import { WorkspaceMembershipEntity } from '../workspaces/entities/workspace-membership.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { AuthTokenEntity } from './entities/auth-token.entity';
import { SessionEntity } from './entities/session.entity';
import { UserEntity } from './entities/user.entity';
import { SessionGuard } from './session.guard';
import { SessionsRepository } from './sessions.repository';
import { UsersRepository } from './users.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      SessionEntity,
      AuthTokenEntity,
      WorkspaceEntity,
      WorkspaceMembershipEntity,
    ]),
    BullModule.registerQueue({ name: 'billing-maintenance' }),
    EventsModule,
    AdaptersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersRepository, SessionsRepository, SessionGuard, CsrfGuard],
  exports: [AuthService, UsersRepository, SessionGuard, CsrfGuard],
})
export class IdentityModule {}
