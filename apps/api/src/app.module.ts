import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AdaptersModule } from './adapters/adapters.module';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { appConfig } from './config/app.config';
import { billingConfig } from './config/billing.config';
import { databaseConfig } from './config/database.config';
import { integrationsConfig } from './config/integrations.config';
import { validationSchema } from './config/validation.schema';
import { Foundation1767200000000 } from './database/migrations/1767200000000-foundation';
import { IdentityWorkspaces1767200100000 } from './database/migrations/1767200100000-identity-workspaces';
import { ProjectsFilesDeliveries1767200200000 } from './database/migrations/1767200200000-projects-files-deliveries';
import { CollaborationAudit1767200300000 } from './database/migrations/1767200300000-collaboration-audit';
import { ClientIdentity1767200400000 } from './database/migrations/1767200400000-client-identity';
import { Billing1767200500000 } from './database/migrations/1767200500000-billing';
import { PortfolioPolicy1767200600000 } from './database/migrations/1767200600000-portfolio-policy';
import { OperationsAdmin1767200700000 } from './database/migrations/1767200700000-operations-admin';
import { PreviewsFeedback1767200800000 } from './database/migrations/1767200800000-previews-feedback';
import { SupportTickets1767200900000 } from './database/migrations/1767200900000-support-tickets';
import { SupportTicketConversations1767201000000 } from './database/migrations/1767201000000-support-ticket-conversations';
import { TicketNotifications1767201100000 } from './database/migrations/1767201100000-ticket-notifications';
import { NotificationPreferences1767201200000 } from './database/migrations/1767201200000-notification-preferences';
import { StoragePerformance1767201300000 } from './database/migrations/1767201300000-storage-performance';
import { DeliverySharingHub1767201400000 } from './database/migrations/1767201400000-delivery-sharing-hub';
import { NodeScopedCollaboration1767201500000 } from './database/migrations/1767201500000-node-scoped-collaboration';
import { InviteAclProvenance1767201600000 } from './database/migrations/1767201600000-invite-acl-provenance';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { EventsModule } from './events/events.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlatformModule } from './platform/platform.module';
import { PoliciesModule } from './policies/policies.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { PreviewsModule } from './previews/previews.module';
import { ProjectsModule } from './projects/projects.module';
import { SupportModule } from './support/support.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, integrationsConfig, billingConfig],
      validationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('app.environment') === 'production' ? 'info' : 'debug',
          redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
          genReqId: (request, response) => {
            const id = request.headers['x-correlation-id'];
            const requestId = typeof id === 'string' ? id : crypto.randomUUID();
            response.setHeader('x-correlation-id', requestId);
            return requestId;
          },
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('database.url'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        migrationsTableName: 'schema_migrations',
        migrations: [
          Foundation1767200000000,
          IdentityWorkspaces1767200100000,
          ProjectsFilesDeliveries1767200200000,
          CollaborationAudit1767200300000,
          ClientIdentity1767200400000,
          Billing1767200500000,
          PortfolioPolicy1767200600000,
          OperationsAdmin1767200700000,
          PreviewsFeedback1767200800000,
          SupportTickets1767200900000,
          SupportTicketConversations1767201000000,
          TicketNotifications1767201100000,
          NotificationPreferences1767201200000,
          StoragePerformance1767201300000,
          DeliverySharingHub1767201400000,
          NodeScopedCollaboration1767201500000,
          InviteAclProvenance1767201600000,
        ],
        logging:
          config.get<string>('app.environment') === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
    PlatformModule,
    EventsModule,
    AdaptersModule,
    HealthModule,
    IdentityModule,
    WorkspacesModule,
    ProjectsModule,
    FilesModule,
    DeliveriesModule,
    CollaborationModule,
    AuditModule,
    ClientPortalModule,
    PortfolioModule,
    PoliciesModule,
    NotificationsModule,
    LifecycleModule,
    AdminModule,
    PreviewsModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
