export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
export const KEY_PROVIDER = Symbol('KEY_PROVIDER');
export const BACKUP_PROVIDER = Symbol('BACKUP_PROVIDER');
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export const CONTENT_PROVIDER = Symbol('CONTENT_PROVIDER');
export const BILLING_PROVIDER = Symbol('BILLING_PROVIDER');

export interface StorageObject {
  key: string;
  size: number;
  checksum: string;
}

export interface StorageProvider {
  put(key: string, content: Buffer): Promise<StorageObject>;
  putFile(key: string, sourcePath: string, checksum?: string): Promise<StorageObject>;
  read(key: string, range?: { start: number; end: number }): Promise<Buffer>;
  inspect(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
}

export interface WrappedKey {
  ciphertext: string;
  iv: string;
  tag: string;
  provider: string;
}

export interface KeyProvider {
  wrap(key: Buffer): Promise<WrappedKey>;
  unwrap(key: WrappedKey): Promise<Buffer>;
}

export interface BackupProvider {
  copy(sourceKey: string): Promise<string>;
  purge(backupKey: string): Promise<void>;
}

export interface EmailMessage {
  idempotencyKey: string;
  to: string;
  template: string;
  locale: 'it' | 'en';
  variables: Record<string, string>;
  replyTo?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ providerId: string }>;
}

export interface ContentProvider {
  getDocument(key: string, locale: 'it' | 'en'): Promise<Record<string, unknown> | null>;
}

export interface BillingProvider {
  checkout(input: {
    workspaceId: string;
    plan: 'pro' | 'unlimited';
    annual: boolean;
    customerId?: string;
  }): Promise<{ url?: string; clientSecret?: string; customerId?: string }>;
  portal(customerOrWorkspaceId: string): Promise<{ url: string }>;
}
