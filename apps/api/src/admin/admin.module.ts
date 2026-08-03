import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { BillingModule } from '../billing/billing.module';
import { EventsModule } from '../events/events.module';
import { IdentityModule } from '../identity/identity.module';
import { LegalHoldEntity } from '../lifecycle/entities/legal-hold.entity';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformModule } from '../platform/platform.module';
import { SupportModule } from '../support/support.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthController } from './admin-auth.controller';
import { StaffActionRequestEntity } from './entities/staff-action-request.entity';
import { StaffAuditEventEntity } from './entities/staff-audit-event.entity';
import { StaffSessionEntity } from './entities/staff-session.entity';
import { StaffUserEntity } from './entities/staff-user.entity';
import { SupportAccessGrantEntity } from './entities/support-access-grant.entity';
import { SupportSessionEntity } from './entities/support-session.entity';
import { StaffAuthService } from './staff-auth.service';
import { StaffCsrfGuard } from './staff-csrf.guard';
import { StaffSessionGuard } from './staff-session.guard';
import { SupportConsentController } from './support-consent.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffUserEntity,
      StaffSessionEntity,
      StaffAuditEventEntity,
      SupportSessionEntity,
      SupportAccessGrantEntity,
      StaffActionRequestEntity,
      LegalHoldEntity,
    ]),
    LifecycleModule,
    IdentityModule,
    AdaptersModule,
    BillingModule,
    EventsModule,
    PlatformModule,
    SupportModule,
    NotificationsModule,
  ],
  controllers: [AdminAuthController, AdminController, SupportConsentController],
  providers: [StaffAuthService, StaffSessionGuard, StaffCsrfGuard, AdminService],
})
export class AdminModule {}
