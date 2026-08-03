import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { FileVersionEntity } from '../files/entities/file-version.entity';
import { UserEntity } from '../identity/entities/user.entity';
import { IdentityModule } from '../identity/identity.module';
import { PlatformModule } from '../platform/platform.module';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import { AbuseCaseEntity } from './entities/abuse-case.entity';
import { AccountDeletionRequestEntity } from './entities/account-deletion-request.entity';
import { LegalHoldEntity } from './entities/legal-hold.entity';
import { PrivacyRequestEntity } from './entities/privacy-request.entity';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';
import { MaintenanceProcessor } from './maintenance.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountDeletionRequestEntity,
      PrivacyRequestEntity,
      LegalHoldEntity,
      AbuseCaseEntity,
      UserEntity,
      WorkspaceEntity,
      FileVersionEntity,
    ]),
    AdaptersModule,
    IdentityModule,
    PlatformModule,
  ],
  controllers: [LifecycleController],
  providers: [LifecycleService, MaintenanceProcessor],
  exports: [LifecycleService],
})
export class LifecycleModule {}
