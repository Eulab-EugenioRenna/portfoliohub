import { Controller, Get, Param, ParseUUIDPipe, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FileEncryptionService } from '../files/file-encryption.service';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { PreviewsService } from './previews.service';

@Controller({
  path: 'workspaces/:workspaceId/projects/:projectId/files/:nodeId/preview',
  version: '1',
})
@UseGuards(SessionGuard)
export class PreviewsController {
  constructor(
    private readonly previews: PreviewsService,
    private readonly encryption: FileEncryptionService,
  ) {}

  @Get()
  async get(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
  ) {
    return this.previews.get(workspaceId, projectId, nodeId, user.userId);
  }

  @Get('content')
  async content(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Res() response: Response,
  ): Promise<void> {
    const preview = await this.previews.get(workspaceId, projectId, nodeId, user.userId);
    if (!preview?.objectKey || !preview.wrappedKey || !preview.sizeBytes || !preview.mimeType) {
      response.status(404).end();
      return;
    }
    response.setHeader('Content-Type', preview.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');
    for await (const chunk of this.encryption.decryptRange({
      objectKey: preview.objectKey,
      wrappedKey: preview.wrappedKey,
      plaintextSize: Number(preview.sizeBytes),
      start: 0,
      end: Number(preview.sizeBytes) - 1,
    })) {
      if (!response.write(chunk))
        await new Promise<void>((resolve) => response.once('drain', resolve));
    }
    response.end();
  }
}
