import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { integrationsConfig } from '../../config/integrations.config';
import type { KeyProvider, WrappedKey } from '../contracts';

@Injectable()
export class LocalKeyAdapter implements KeyProvider {
  private readonly masterKey: Buffer;

  constructor(
    @Inject(integrationsConfig.KEY)
    config: ConfigType<typeof integrationsConfig>,
  ) {
    this.masterKey = Buffer.from(config.localMasterKey, 'base64');
    if (this.masterKey.length !== 32) throw new Error('LOCAL_MASTER_KEY must decode to 32 bytes');
  }

  async wrap(key: Buffer): Promise<WrappedKey> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(key), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      provider: 'local-aes-256-gcm',
    };
  }

  async unwrap(key: WrappedKey): Promise<Buffer> {
    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, Buffer.from(key.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(key.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(key.ciphertext, 'base64')),
      decipher.final(),
    ]);
  }
}
