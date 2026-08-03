import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { FilesController, UploadsController } from './files.controller';
import { FilesCoreModule } from './files-core.module';

@Module({
  imports: [FilesCoreModule, IdentityModule],
  controllers: [FilesController, UploadsController],
  exports: [FilesCoreModule],
})
export class FilesModule {}
