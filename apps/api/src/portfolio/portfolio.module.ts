import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { IdentityModule } from '../identity/identity.module';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PortfolioSiteEntity } from './entities/portfolio-site.entity';
import { PortfolioController, PublicPortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortfolioSiteEntity, WorkspaceEntity]),
    IdentityModule,
    FilesModule,
    WorkspacesModule,
  ],
  controllers: [PortfolioController, PublicPortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
