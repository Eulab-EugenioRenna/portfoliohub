import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuthorizationService } from '../collaboration/authorization.service';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { FileVersionEntity } from '../files/entities/file-version.entity';
import { FileEncryptionService } from '../files/file-encryption.service';
import { PreviewAssetEntity } from './entities/preview-asset.entity';
import type { PreviewKind } from './preview-kind';

const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;

@Injectable()
export class PreviewsService {
  constructor(
    @InjectRepository(PreviewAssetEntity) private readonly previews: Repository<PreviewAssetEntity>,
    @InjectRepository(FileVersionEntity) private readonly versions: Repository<FileVersionEntity>,
    @InjectRepository(FileNodeEntity) private readonly nodes: Repository<FileNodeEntity>,
    private readonly encryption: FileEncryptionService,
    private readonly authorization: AuthorizationService,
  ) {}

  async enqueue(versionId: string, kind: PreviewKind): Promise<PreviewAssetEntity> {
    const existing = await this.previews.findOneBy({ fileVersionId: versionId, kind });
    return (
      existing ??
      this.previews.save(
        this.previews.create({
          id: randomUUID(),
          fileVersionId: versionId,
          kind,
          status: 'queued',
          objectKey: null,
          mimeType: null,
          sizeBytes: null,
          wrappedKey: null,
          checksum: null,
          failureCode: null,
          attempts: 0,
          createdAt: new Date(),
          completedAt: null,
        }),
      )
    );
  }

  async get(
    workspaceId: string,
    projectId: string,
    nodeId: string,
    userId: string,
  ): Promise<PreviewAssetEntity | null> {
    const node = await this.nodes.findOneBy({ id: nodeId, workspaceId, projectId });
    if (!node?.currentVersionId) throw new NotFoundException('File non trovato');
    await this.authorization.assert({
      workspaceId,
      projectId,
      nodeId: node.id,
      userId,
      permission: 'file.read',
    });
    return this.previews.findOneBy({ fileVersionId: node.currentVersionId });
  }

  async process(previewId: string): Promise<void> {
    const preview = await this.previews.findOneBy({ id: previewId });
    if (!preview || preview.status === 'ready') return;
    const version = await this.versions.findOneByOrFail({ id: preview.fileVersionId });
    preview.status = 'processing';
    preview.attempts += 1;
    await this.previews.save(preview);
    const directory = await mkdtemp(join(tmpdir(), 'ph-preview-'));
    const input = join(directory, 'input');
    const output = join(directory, preview.kind === 'archive' ? 'listing.json' : 'preview.jpg');
    try {
      const writer = createWriteStream(input);
      for await (const chunk of this.encryption.decryptRange({
        objectKey: version.objectKey,
        wrappedKey: version.wrappedKey,
        plaintextSize: Number(version.sizeBytes),
        start: 0,
        end: Number(version.sizeBytes) - 1,
      })) {
        if (!writer.write(chunk))
          await new Promise<void>((resolve) => writer.once('drain', resolve));
      }
      writer.end();
      await new Promise<void>((resolve, reject) => {
        writer.once('finish', resolve);
        writer.once('error', reject);
      });
      const mimeType = await this.render(preview.kind, version.mimeType, input, output, directory);
      const content = await readFile(output);
      if (content.length > MAX_PREVIEW_BYTES) throw new Error('PREVIEW_TOO_LARGE');
      const objectKey = `previews/${version.fileNodeId}/${version.id}/${preview.kind}.phub`;
      const encrypted = await this.encryption.encryptAndStore(output, objectKey);
      Object.assign(preview, {
        status: 'ready',
        objectKey,
        mimeType,
        sizeBytes: String(content.length),
        wrappedKey: encrypted.wrappedKey,
        checksum: encrypted.checksum,
        failureCode: null,
        completedAt: new Date(),
      });
      await this.previews.save(preview);
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 100) : 'PREVIEW_FAILED';
      await this.previews.update(preview.id, {
        status: code.includes('ENOENT') ? 'unsupported' : 'failed',
        failureCode: code,
        completedAt: new Date(),
      });
      if (!code.includes('ENOENT')) throw error;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async render(
    kind: PreviewKind,
    sourceMimeType: string,
    input: string,
    output: string,
    directory: string,
  ): Promise<string> {
    if (kind === 'archive') {
      const listing = await this.run('unzip', ['-Z1', input]);
      await writeFile(
        output,
        JSON.stringify({ entries: listing.split('\n').filter(Boolean).slice(0, 5000) }),
      );
      return 'application/json';
    }
    if (kind === 'image')
      await this.run('magick', [
        input,
        '-auto-orient',
        '-thumbnail',
        '1600x1600>',
        '-strip',
        '-quality',
        '82',
        output,
      ]);
    if (kind === 'media')
      await this.run('ffmpeg', [
        '-y',
        '-ss',
        '00:00:01',
        '-i',
        input,
        '-frames:v',
        '1',
        '-vf',
        'scale=1600:-2:force_original_aspect_ratio=decrease',
        output,
      ]);
    if (kind === 'document') {
      if (sourceMimeType === 'application/pdf')
        await this.run('pdftoppm', [
          '-f',
          '1',
          '-singlefile',
          '-jpeg',
          '-scale-to',
          '1600',
          input,
          output.replace(/\.jpg$/, ''),
        ]);
      else {
        await this.run('libreoffice', [
          '--headless',
          '--convert-to',
          'pdf',
          '--outdir',
          directory,
          input,
        ]);
        const pdf = join(directory, `${basename(input)}.pdf`);
        await this.run('pdftoppm', [
          '-f',
          '1',
          '-singlefile',
          '-jpeg',
          '-scale-to',
          '1600',
          pdf,
          output.replace(/\.jpg$/, ''),
        ]);
      }
    }
    return 'image/jpeg';
  }

  private run(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('nice', ['-n', '10', command, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5 * 60 * 1000,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.once('error', reject);
      child.once('close', (code) =>
        code === 0
          ? resolve(stdout)
          : reject(new Error(`${command.toUpperCase()}_${code}:${stderr.slice(-300)}`)),
      );
    });
  }
}
