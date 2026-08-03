import { createHash } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { integrationsConfig } from '../../config/integrations.config';
import type { StorageObject, StorageProvider } from '../contracts';

@Injectable()
export class LocalStorageAdapter implements StorageProvider {
  constructor(
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  async put(key: string, content: Buffer): Promise<StorageObject> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, { flag: 'wx' });
    return { key, size: content.byteLength, checksum: this.checksum(content) };
  }

  async putFile(key: string, sourcePath: string, checksum?: string): Promise<StorageObject> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await copyFile(sourcePath, path, constants.COPYFILE_EXCL);
    const metadata = await stat(path);
    if (checksum) return { key, size: metadata.size, checksum };
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return { key, size: metadata.size, checksum: hash.digest('hex') };
  }

  async read(key: string, range?: { start: number; end: number }): Promise<Buffer> {
    const content = await readFile(this.resolve(key));
    return range ? content.subarray(range.start, range.end + 1) : content;
  }

  async inspect(key: string): Promise<StorageObject | null> {
    try {
      const path = this.resolve(key);
      const metadata = await stat(path);
      const content = await readFile(path);
      return { key, size: metadata.size, checksum: this.checksum(content) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.resolve(key), { force: true })));
  }

  private resolve(key: string): string {
    const safe = normalize(key).replace(/^([/\\]|\.\.(\/|\\|$))+/, '');
    return join(this.config.localDataPath, 'objects', safe);
  }

  private checksum(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
