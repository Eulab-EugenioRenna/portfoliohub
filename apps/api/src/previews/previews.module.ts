import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { FileVersionEntity } from '../files/entities/file-version.entity';
import { FilesModule } from '../files/files.module';
import { IdentityModule } from '../identity/identity.module';
import { PreviewAssetEntity } from './entities/preview-asset.entity';
import { PreviewsController } from './previews.controller';
import { PreviewsService } from './previews.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PreviewAssetEntity, FileVersionEntity, FileNodeEntity]),
    CollaborationModule,
    FilesModule,
    IdentityModule,
  ],
  controllers: [PreviewsController],
  providers: [PreviewsService],
  exports: [PreviewsService],
})
export class PreviewsModule {}
