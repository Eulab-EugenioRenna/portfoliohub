import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { billingConfig } from '../config/billing.config';
import { integrationsConfig } from '../config/integrations.config';
import { ArubaStorageAdapter } from './aruba/aruba-storage.adapter';
import { EncryptedStorageCacheAdapter } from './cache/encrypted-storage-cache.adapter';
import {
  BACKUP_PROVIDER,
  BILLING_PROVIDER,
  CONTENT_PROVIDER,
  EMAIL_PROVIDER,
  KEY_PROVIDER,
  STORAGE_PROVIDER,
} from './contracts';
import { LocalBackupAdapter } from './local/local-backup.adapter';
import { LocalBillingAdapter } from './local/local-billing.adapter';
import { LocalContentAdapter } from './local/local-content.adapter';
import { LocalEmailAdapter } from './local/local-email.adapter';
import { LocalKeyAdapter } from './local/local-key.adapter';
import { LocalStorageAdapter } from './local/local-storage.adapter';
import { ResendEmailAdapter } from './resend/resend-email.adapter';
import { StripeBillingAdapter } from './stripe/stripe-billing.adapter';

const localAdapters = [
  LocalStorageAdapter,
  LocalKeyAdapter,
  LocalBackupAdapter,
  LocalEmailAdapter,
  LocalContentAdapter,
  LocalBillingAdapter,
];

@Module({
  providers: [
    ...localAdapters,
    ArubaStorageAdapter,
    EncryptedStorageCacheAdapter,
    StripeBillingAdapter,
    ResendEmailAdapter,
    {
      provide: STORAGE_PROVIDER,
      inject: [integrationsConfig.KEY, LocalStorageAdapter, EncryptedStorageCacheAdapter],
      useFactory: (
        config: ConfigType<typeof integrationsConfig>,
        local: LocalStorageAdapter,
        aruba: EncryptedStorageCacheAdapter,
      ) => (config.storageProvider === 'aruba' ? aruba : local),
    },
    { provide: KEY_PROVIDER, useExisting: LocalKeyAdapter },
    { provide: BACKUP_PROVIDER, useExisting: LocalBackupAdapter },
    {
      provide: EMAIL_PROVIDER,
      inject: [integrationsConfig.KEY, LocalEmailAdapter, ResendEmailAdapter],
      useFactory: (
        config: ConfigType<typeof integrationsConfig>,
        local: LocalEmailAdapter,
        resend: ResendEmailAdapter,
      ) => (config.emailProvider === 'resend' ? resend : local),
    },
    { provide: CONTENT_PROVIDER, useExisting: LocalContentAdapter },
    {
      provide: BILLING_PROVIDER,
      inject: [billingConfig.KEY, LocalBillingAdapter, StripeBillingAdapter],
      useFactory: (
        config: ConfigType<typeof billingConfig>,
        local: LocalBillingAdapter,
        stripe: StripeBillingAdapter,
      ) => (config.provider === 'stripe' ? stripe : local),
    },
  ],
  exports: [
    STORAGE_PROVIDER,
    KEY_PROVIDER,
    BACKUP_PROVIDER,
    EMAIL_PROVIDER,
    CONTENT_PROVIDER,
    BILLING_PROVIDER,
  ],
})
export class AdaptersModule {}
