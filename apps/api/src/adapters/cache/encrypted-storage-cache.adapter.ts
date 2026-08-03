import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  copyFile,
  link,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { integrationsConfig } from '../../config/integrations.config';
import { ArubaStorageAdapter } from '../aruba/aruba-storage.adapter';
import type { StorageObject, StorageProvider } from '../contracts';

@Injectable()
export class EncryptedStorageCacheAdapter implements StorageProvider {
  private eviction: Promise<void> | null = null;

  constructor(
    private readonly origin: ArubaStorageAdapter,
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  async put(key: string, content: Buffer): Promise<StorageObject> {
    const object = await this.origin.put(key, content);
    await this.storeBuffer(key, content);
    return object;
  }

  async putFile(key: string, sourcePath: string, checksum?: string): Promise<StorageObject> {
    const object = await this.origin.putFile(key, sourcePath, checksum);
    await this.storeFile(key, sourcePath);
    return object;
  }

  async read(key: string, range?: { start: number; end: number }): Promise<Buffer> {
    if (this.enabled()) {
      const cached = await this.readCached(key, range);
      if (cached) return cached;
    }
    return this.origin.read(key, range);
  }

  inspect(key: string): Promise<StorageObject | null> {
    return this.origin.inspect(key);
  }

  async delete(key: string): Promise<void> {
    await this.origin.delete(key);
    await rm(this.path(key), { force: true });
  }

  async deleteMany(keys: string[]): Promise<void> {
    await this.origin.deleteMany(keys);
    await Promise.all(keys.map((key) => rm(this.path(key), { force: true })));
  }

  private async readCached(
    key: string,
    range?: { start: number; end: number },
  ): Promise<Buffer | null> {
    const path = this.path(key);
    try {
      const handle = await open(path, 'r');
      try {
        const metadata = await handle.stat();
        const start = range?.start ?? 0;
        const end = range?.end ?? metadata.size - 1;
        if (start < 0 || end < start || end >= metadata.size) return null;
        const buffer = Buffer.allocUnsafe(end - start + 1);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
        if (bytesRead !== buffer.length) return null;
        const now = new Date();
        void utimes(path, now, now).catch(() => undefined);
        return buffer;
      } finally {
        await handle.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private async storeBuffer(key: string, content: Buffer): Promise<void> {
    if (!this.enabled() || content.byteLength > this.config.storageCacheMaxBytes) return;
    const target = this.path(key);
    await mkdir(this.directory(), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, content, { flag: 'wx' });
    await this.commit(temporary, target);
  }

  private async storeFile(key: string, sourcePath: string): Promise<void> {
    if (!this.enabled()) return;
    const metadata = await stat(sourcePath);
    if (metadata.size > this.config.storageCacheMaxBytes) return;
    const target = this.path(key);
    await mkdir(this.directory(), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await link(sourcePath, temporary);
    } catch (error) {
      if (!['EXDEV', 'EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? ''))
        throw error;
      await copyFile(sourcePath, temporary, constants.COPYFILE_EXCL);
    }
    await this.commit(temporary, target);
  }

  private async commit(temporary: string, target: string): Promise<void> {
    try {
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    this.eviction ??= this.evict().finally(() => {
      this.eviction = null;
    });
    await this.eviction;
  }

  private async evict(): Promise<void> {
    const directory = this.directory();
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.bin'))
        .map(async (entry) => {
          const path = join(directory, entry.name);
          const metadata = await stat(path);
          return { path, size: metadata.size, lastUsed: metadata.mtimeMs };
        }),
    );
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files.sort((left, right) => left.lastUsed - right.lastUsed)) {
      if (total <= this.config.storageCacheMaxBytes) break;
      await rm(file.path, { force: true });
      total -= file.size;
    }
  }

  private path(key: string): string {
    return join(this.directory(), `${createHash('sha256').update(key).digest('hex')}.bin`);
  }

  private directory(): string {
    return join(this.config.localDataPath, 'encrypted-cache');
  }

  private enabled(): boolean {
    return this.config.storageCacheMaxBytes > 0;
  }
}
