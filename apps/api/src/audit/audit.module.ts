import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { ActivityEventEntity } from './entities/activity-event.entity';
import { AuditEventEntity } from './entities/audit-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityEventEntity, AuditEventEntity]),
    IdentityModule,
    WorkspacesModule,
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
