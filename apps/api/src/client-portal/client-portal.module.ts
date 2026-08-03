import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { IdentityModule } from '../identity/identity.module';
import { ClientEntity } from '../projects/entities/client.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ClientCsrfGuard } from './client-csrf.guard';
import {
  ClientLinkManagementController,
  PublicClientPortalController,
} from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';
import { ClientSessionGuard } from './client-session.guard';
import { ClientAccessLinkEntity } from './entities/client-access-link.entity';
import { ClientAuthTokenEntity } from './entities/client-auth-token.entity';
import { ClientIdentityEntity } from './entities/client-identity.entity';
import { ClientLinkClaimEntity } from './entities/client-link-claim.entity';
import { ClientSessionEntity } from './entities/client-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientAccessLinkEntity,
      ClientAuthTokenEntity,
      ClientIdentityEntity,
      ClientLinkClaimEntity,
      ClientSessionEntity,
      ClientEntity,
    ]),
    AdaptersModule,
    IdentityModule,
    WorkspacesModule,
    DeliveriesModule,
  ],
  controllers: [ClientLinkManagementController, PublicClientPortalController],
  providers: [ClientPortalService, ClientSessionGuard, ClientCsrfGuard],
})
export class ClientPortalModule {}
