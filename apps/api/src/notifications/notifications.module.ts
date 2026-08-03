import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { StaffUserEntity } from '../admin/entities/staff-user.entity';
import { UserEntity } from '../identity/entities/user.entity';
import { IdentityModule } from '../identity/identity.module';
import { PlatformModule } from '../platform/platform.module';
import { WorkspaceMembershipEntity } from '../workspaces/entities/workspace-membership.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EmailProcessor } from './email.processor';
import { EmailDeliveryEntity } from './entities/email-delivery.entity';
import { EmailSuppressionEntity } from './entities/email-suppression.entity';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationPreferenceEntity } from './entities/notification-preference.entity';
import { StaffNotificationEntity } from './entities/staff-notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationPreferenceEntity,
      EmailDeliveryEntity,
      EmailSuppressionEntity,
      WorkspaceMembershipEntity,
      UserEntity,
      StaffUserEntity,
      StaffNotificationEntity,
    ]),
    AdaptersModule,
    PlatformModule,
    IdentityModule,
    WorkspacesModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
