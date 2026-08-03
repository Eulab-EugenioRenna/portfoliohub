import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { FileVersionEntity } from '../files/entities/file-version.entity';
import { FileEncryptionService } from '../files/file-encryption.service';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { UpdatePortfolioDto } from './dto/portfolio.dto';
import { PortfolioService } from './portfolio.service';

@Controller({ path: 'workspaces/:workspaceId/portfolio', version: '1' })
@UseGuards(SessionGuard)
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly encryption: FileEncryptionService,
  ) {}

  @Get()
  draft(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.portfolio.getDraft(workspaceId, principal.userId);
  }

  @Patch()
  @UseGuards(CsrfGuard)
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.portfolio.update(workspaceId, principal.userId, dto);
  }

  @Post('publish')
  @UseGuards(CsrfGuard)
  publish(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.portfolio.publish(workspaceId, principal.userId);
  }

  @Get('media/:nodeId')
  async media(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const version = await this.portfolio.privateMedia(workspaceId, principal.userId, nodeId);
    await streamMedia(this.encryption, version, range, response);
  }
}

@Controller({ path: 'public/portfolio', version: '1' })
export class PublicPortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly encryption: FileEncryptionService,
  ) {}
  @Get(':slug') site(@Param('slug') slug: string) {
    return this.portfolio.publicSite(slug);
  }

  @Get(':slug/media/:nodeId')
  async media(
    @Param('slug') slug: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const version = await this.portfolio.publicMedia(slug, nodeId);
    await streamMedia(this.encryption, version, range, response);
  }
}

async function streamMedia(
  encryption: FileEncryptionService,
  version: FileVersionEntity,
  range: string | undefined,
  response: Response,
): Promise<void> {
  const total = Number(version.sizeBytes);
  const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
  let start = 0;
  let end = total - 1;
  let partial = false;
  if (match) {
    const candidateStart = Number(match[1]);
    const candidateEnd = Math.min(Number(match[2] || total - 1), total - 1);
    if (candidateStart >= 0 && candidateStart <= candidateEnd && candidateStart < total) {
      start = candidateStart;
      end = candidateEnd;
      partial = true;
    }
  }
  response.status(partial ? 206 : 200);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Type', version.mimeType);
  response.setHeader('Content-Disposition', 'inline');
  response.setHeader('Content-Length', String(end - start + 1));
  if (partial) response.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
  for await (const chunk of encryption.decryptRange({
    objectKey: version.objectKey,
    wrappedKey: version.wrappedKey,
    plaintextSize: total,
    start,
    end,
  })) {
    if (!response.write(chunk))
      await new Promise<void>((resolve) => response.once('drain', resolve));
  }
  response.end();
}
