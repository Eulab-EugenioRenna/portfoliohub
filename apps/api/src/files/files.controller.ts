import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  Body,
  Controller,
  Delete,
  Get,
  Head,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import archiver from 'archiver';
import type { Request, Response } from 'express';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { attachmentDisposition } from './download-metadata';
import { BeginUploadDto, CreateFolderDto, NodeTargetDto, UpdateNodeDto } from './dto/files.dto';
import { FilesService } from './files.service';

@Controller({ path: 'workspaces/:workspaceId/projects/:projectId/files', version: '1' })
@UseGuards(SessionGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  list(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.files.list(workspaceId, projectId, principal.userId, parentId);
  }

  @Get('trash')
  trashList(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.files.listTrash(workspaceId, projectId, principal.userId);
  }

  @Delete('trash')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(CsrfGuard)
  emptyTrash(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.files.emptyTrash(workspaceId, projectId, principal.userId);
  }

  @Post('folders')
  @UseGuards(CsrfGuard)
  createFolder(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.files.createFolder(workspaceId, projectId, principal.userId, dto);
  }

  @Patch(':nodeId')
  @UseGuards(CsrfGuard)
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Body() dto: UpdateNodeDto,
  ) {
    return this.files.updateNode(workspaceId, projectId, nodeId, principal.userId, dto);
  }

  @Delete(':nodeId')
  @UseGuards(CsrfGuard)
  async trash(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
  ) {
    await this.files.trashNode(workspaceId, projectId, nodeId, principal.userId);
    return { ok: true };
  }

  @Post(':nodeId/restore')
  @UseGuards(CsrfGuard)
  async restore(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
  ) {
    await this.files.restoreNode(workspaceId, projectId, nodeId, principal.userId);
    return { ok: true };
  }

  @Delete(':nodeId/permanent')
  @UseGuards(CsrfGuard)
  async permanentlyDelete(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
  ) {
    await this.files.permanentlyDeleteNode(workspaceId, projectId, nodeId, principal.userId);
    return { ok: true };
  }

  @Post(':nodeId/copy')
  @UseGuards(CsrfGuard)
  copy(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Body() dto: NodeTargetDto,
  ) {
    return this.files.copyNode(workspaceId, projectId, nodeId, principal.userId, dto.parentId);
  }

  @Get(':nodeId/archive')
  async archive(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Res() response: Response,
  ): Promise<void> {
    const entries = await this.files.archiveEntries(
      workspaceId,
      projectId,
      nodeId,
      principal.userId,
    );
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''cartella-${nodeId}.zip`,
    );
    const archive = archiver('zip', { zlib: { level: 1 } });
    archive.on('error', (error) => response.destroy(error));
    archive.pipe(response);
    for (const entry of entries) {
      archive.append(
        Readable.from(
          this.files.streamVersion(entry.version, 0, Number(entry.version.sizeBytes) - 1),
        ),
        { name: entry.path },
      );
    }
    await archive.finalize();
    await this.files.recordDownload(
      workspaceId,
      entries.reduce((total, entry) => total + Number(entry.version.sizeBytes), 0),
      randomUUID(),
    );
  }

  @Post('uploads')
  @UseGuards(CsrfGuard)
  beginUpload(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BeginUploadDto,
    @Req() request: Request,
  ) {
    return this.files.beginUpload(workspaceId, projectId, principal.userId, dto, request.ip);
  }

  @Get(':nodeId/download')
  async download(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { node, version } = await this.files.currentVersion(
      workspaceId,
      projectId,
      nodeId,
      principal.userId,
    );
    const total = Number(version.sizeBytes);
    const parsed = this.parseRange(range, total);
    response.status(parsed.partial ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', version.mimeType);
    response.setHeader('Content-Disposition', attachmentDisposition(node.name));
    response.setHeader('Content-Length', String(parsed.end - parsed.start + 1));
    if (parsed.partial)
      response.setHeader('Content-Range', `bytes ${parsed.start}-${parsed.end}/${total}`);
    for await (const chunk of this.files.streamVersion(version, parsed.start, parsed.end)) {
      if (!response.write(chunk))
        await new Promise<void>((resolve) => response.once('drain', resolve));
    }
    response.end();
    await this.files.recordDownload(workspaceId, parsed.end - parsed.start + 1, randomUUID());
  }

  private parseRange(
    value: string | undefined,
    total: number,
  ): { start: number; end: number; partial: boolean } {
    if (!value) return { start: 0, end: total - 1, partial: false };
    const match = /^bytes=(\d+)-(\d*)$/.exec(value);
    if (!match) return { start: 0, end: total - 1, partial: false };
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (!Number.isSafeInteger(start) || start < 0 || start > end)
      return { start: 0, end: total - 1, partial: false };
    return { start, end, partial: true };
  }
}

@Controller({ path: 'uploads', version: '1' })
@UseGuards(SessionGuard, CsrfGuard)
export class UploadsController {
  constructor(private readonly files: FilesService) {}

  @Head(':uploadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async inspect(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const upload = await this.files.inspectUpload(uploadId, principal.userId);
    response.setHeader('Upload-Offset', upload.receivedSize);
    response.setHeader('Upload-Length', upload.expectedSize);
    response.setHeader('Upload-Expires', upload.expiresAt.toUTCString());
    response.setHeader('Upload-Status', upload.status);
    if (upload.fileNodeId) response.setHeader('Upload-File-Node-Id', upload.fileNodeId);
  }

  @Patch(':uploadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async append(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @Headers('upload-offset') offsetValue: string,
    @Headers('content-length') lengthValue: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const offset = await this.files.appendUpload(
      uploadId,
      principal.userId,
      Number(offsetValue),
      Number(lengthValue),
      request,
    );
    response.setHeader('Upload-Offset', String(offset));
  }
}
