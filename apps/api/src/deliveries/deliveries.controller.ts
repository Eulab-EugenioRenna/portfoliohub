import { Readable } from 'node:stream';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import archiver from 'archiver';
import type { Response } from 'express';
import { attachmentDisposition } from '../files/download-metadata';
import { FileEncryptionService } from '../files/file-encryption.service';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { DeliveriesService } from './deliveries.service';
import {
  AccessDeliveryDto,
  CreateDeliveryDto,
  DeliveryApprovalDto,
  DeliveryCommentDto,
} from './dto/deliveries.dto';

@Controller({ path: 'workspaces/:workspaceId/deliveries', version: '1' })
@UseGuards(SessionGuard)
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  list(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.deliveries.list(workspaceId, principal.userId);
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateDeliveryDto,
  ) {
    return this.deliveries.create(workspaceId, principal.userId, dto);
  }

  @Get(':deliveryId/activity')
  activity(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ) {
    return this.deliveries.activity(workspaceId, deliveryId, principal.userId);
  }

  @Delete(':deliveryId')
  @UseGuards(CsrfGuard)
  revoke(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ) {
    return this.deliveries.revoke(workspaceId, deliveryId, principal.userId);
  }

  @Delete(':deliveryId/permanent')
  @UseGuards(CsrfGuard)
  deletePermanently(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ) {
    return this.deliveries.deletePermanently(workspaceId, deliveryId, principal.userId);
  }
}

@Controller({ path: 'public/deliveries', version: '1' })
export class PublicDeliveriesController {
  constructor(
    private readonly deliveries: DeliveriesService,
    private readonly encryption: FileEncryptionService,
  ) {}

  @Get(':token')
  info(@Param('token') token: string) {
    return this.deliveries.publicInfo(token);
  }

  @Post(':token/access')
  access(@Param('token') token: string, @Body() dto: AccessDeliveryDto) {
    return this.deliveries.access(token, dto);
  }

  @Post('files/:nodeId/grant')
  fileGrant(
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Headers('x-delivery-grant') pageGrant: string,
  ) {
    return this.deliveries.issueFileGrant(pageGrant, nodeId);
  }

  @Post('folders/:nodeId/grant')
  archiveGrant(
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Headers('x-delivery-grant') pageGrant: string,
  ) {
    return this.deliveries.issueArchiveGrant(pageGrant, nodeId);
  }

  @Get('folders/archive/content')
  async archive(
    @Headers('x-archive-grant') grant: string,
    @Res() response: Response,
  ): Promise<void> {
    const descriptor = await this.deliveries.authorizeArchive(grant);
    try {
      response.setHeader('Content-Type', 'application/zip');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(descriptor.folderName)}.zip`,
      );
      const archive = archiver('zip', { zlib: { level: 1 } });
      archive.on('error', (error) => response.destroy(error));
      archive.pipe(response);
      for (const entry of descriptor.entries)
        archive.append(
          Readable.from(
            this.encryption.decryptRange({
              objectKey: entry.version.objectKey,
              wrappedKey: entry.version.wrappedKey,
              plaintextSize: Number(entry.version.sizeBytes),
              start: 0,
              end: Number(entry.version.sizeBytes) - 1,
            }),
          ),
          { name: entry.path },
        );
      await archive.finalize();
      const total = descriptor.entries.reduce(
        (sum, entry) => sum + Number(entry.version.sizeBytes),
        0,
      );
      await this.deliveries.completeDownload(
        descriptor.delivery,
        total,
        `zip:${descriptor.reservationId}`,
      );
    } catch (error) {
      await this.deliveries.releaseDownload(
        descriptor.delivery.id,
        descriptor.reservationId,
        descriptor.counted,
      );
      throw error;
    }
  }

  @Get('feedback/list')
  feedback(@Headers('x-delivery-grant') pageGrant: string) {
    return this.deliveries.feedback(pageGrant);
  }

  @Post('feedback/comments')
  comment(@Headers('x-delivery-grant') pageGrant: string, @Body() dto: DeliveryCommentDto) {
    return this.deliveries.comment(pageGrant, dto);
  }

  @Post('feedback/approval')
  approve(@Headers('x-delivery-grant') pageGrant: string, @Body() dto: DeliveryApprovalDto) {
    return this.deliveries.approve(pageGrant, dto);
  }

  @Get('files/download/content')
  async download(
    @Headers('x-file-grant') fileGrant: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const descriptor = await this.deliveries.authorizeDownload(fileGrant);
    const total = Number(descriptor.version.sizeBytes);
    const parsed = this.parseRange(range, total);
    try {
      response.status(parsed.partial ? 206 : 200);
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Content-Type', descriptor.version.mimeType);
      response.setHeader(
        'Content-Disposition',
        attachmentDisposition(descriptor.path.split('/').at(-1) ?? 'file'),
      );
      response.setHeader('Content-Length', String(parsed.end - parsed.start + 1));
      if (parsed.partial)
        response.setHeader('Content-Range', `bytes ${parsed.start}-${parsed.end}/${total}`);
      for await (const chunk of this.encryption.decryptRange({
        objectKey: descriptor.version.objectKey,
        wrappedKey: descriptor.version.wrappedKey,
        plaintextSize: total,
        start: parsed.start,
        end: parsed.end,
      })) {
        if (!response.write(chunk))
          await new Promise<void>((resolve) => response.once('drain', resolve));
      }
      response.end();
      await this.deliveries.completeDownload(
        descriptor.delivery,
        parsed.end - parsed.start + 1,
        `${descriptor.reservationId}:${parsed.start}-${parsed.end}`,
      );
    } catch (error) {
      await this.deliveries.releaseDownload(
        descriptor.delivery.id,
        descriptor.reservationId,
        descriptor.counted,
      );
      throw error;
    }
  }

  private parseRange(
    value: string | undefined,
    total: number,
  ): { start: number; end: number; partial: boolean } {
    const match = value ? /^bytes=(\d+)-(\d*)$/.exec(value) : null;
    if (!match) return { start: 0, end: total - 1, partial: false };
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    return start >= 0 && start <= end
      ? { start, end, partial: true }
      : { start: 0, end: total - 1, partial: false };
  }
}
