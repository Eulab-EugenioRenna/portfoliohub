import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { integrationsConfig } from '../../config/integrations.config';
import type { EmailMessage, EmailProvider } from '../contracts';

@Injectable()
export class LocalEmailAdapter implements EmailProvider {
  constructor(
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  async send(message: EmailMessage): Promise<{ providerId: string }> {
    const directory = join(this.config.localDataPath, 'mailbox');
    await mkdir(directory, { recursive: true });
    await appendFile(
      join(directory, 'messages.jsonl'),
      `${JSON.stringify({ ...message, sentAt: new Date().toISOString() })}\n`,
      'utf8',
    );
    return { providerId: `local:${message.idempotencyKey}` };
  }
}
