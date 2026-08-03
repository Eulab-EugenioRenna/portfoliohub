import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { integrationsConfig } from '../../config/integrations.config';
import type { EmailMessage, EmailProvider } from '../contracts';
import { renderEmail } from './email-templates';

@Injectable()
export class ResendEmailAdapter implements EmailProvider {
  constructor(
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async send(message: EmailMessage): Promise<{ providerId: string }> {
    if (!this.config.resendApiKey) throw new ServiceUnavailableException('Resend non configurato');
    const rendered = renderEmail(message, this.app.origin);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.config.emailFrom,
        to: [message.to],
        subject: rendered.subject,
        reply_to: message.replyTo,
        html: rendered.html,
        text: rendered.text,
      }),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(`Resend ha risposto ${response.status}`);
    const payload = (await response.json()) as { id: string };
    return { providerId: payload.id };
  }
}
