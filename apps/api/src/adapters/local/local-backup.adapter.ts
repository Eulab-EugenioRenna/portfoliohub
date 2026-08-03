import { Injectable } from '@nestjs/common';
import type { BackupProvider } from '../contracts';
import { LocalStorageAdapter } from './local-storage.adapter';

@Injectable()
export class LocalBackupAdapter implements BackupProvider {
  constructor(private readonly storage: LocalStorageAdapter) {}

  async copy(sourceKey: string): Promise<string> {
    const backupKey = `backups/${new Date().toISOString().slice(0, 10)}/${sourceKey}`;
    const content = await this.storage.read(sourceKey);
    await this.storage.put(backupKey, content);
    return backupKey;
  }

  async purge(backupKey: string): Promise<void> {
    await this.storage.delete(backupKey);
  }
}
