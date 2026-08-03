import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module';
import { PolicyAcceptanceEntity } from './entities/policy-acceptance.entity';
import { PolicyVersionEntity } from './entities/policy-version.entity';
import { PoliciesController, PublicPoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PolicyVersionEntity, PolicyAcceptanceEntity]),
    IdentityModule,
  ],
  controllers: [PoliciesController, PublicPoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
