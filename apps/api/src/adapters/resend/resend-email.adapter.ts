import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { integrationsConfig } from '../../config/integrations.config';
import type { EmailMessage, EmailProvider } from '../contracts';

const templateCopy: Record<string, { subject: string; heading: string }> = {
  'auth.verify': {
    subject: 'Verifica il tuo indirizzo email',
    heading: 'Completa la registrazione',
  },
  'auth.magic': { subject: 'Il tuo link di accesso', heading: 'Accedi a PortfolioHub' },
  'auth.reset': { subject: 'Reimposta la password', heading: 'Reimposta la password' },
  'workspace.invite': { subject: 'Sei stato invitato a collaborare', heading: 'Nuovo invito' },
  'delivery.ready': { subject: 'Una nuova consegna è pronta', heading: 'Il tuo lavoro è pronto' },
  'client.access': { subject: 'Il tuo spazio personale', heading: 'Accedi ai tuoi lavori' },
  'support.ticket.staff_activity': {
    subject: 'Nuova attività su un ticket',
    heading: 'Un ticket richiede attenzione',
  },
  'support.ticket.user_reply': {
    subject: 'Hai ricevuto una risposta dal supporto',
    heading: 'Nuova risposta al tuo ticket',
  },
  'billing.payment_failed': {
    subject: 'Problema con il pagamento',
    heading: 'Aggiorna il pagamento',
  },
  'account.deletion_scheduled': {
    subject: 'Eliminazione account programmata',
    heading: 'Account in eliminazione',
  },
};

@Injectable()
export class ResendEmailAdapter implements EmailProvider {
  constructor(
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  async send(message: EmailMessage): Promise<{ providerId: string }> {
    if (!this.config.resendApiKey) throw new ServiceUnavailableException('Resend non configurato');
    const copy = templateCopy[message.template] ?? {
      subject: 'Notifica PortfolioHub',
      heading: 'PortfolioHub',
    };
    const rows = Object.entries(message.variables)
      .map(([key, value]) => `<p><strong>${this.escape(key)}</strong>: ${this.escape(value)}</p>`)
      .join('');
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
        subject: copy.subject,
        reply_to: message.replyTo,
        html: `<main style="font-family:system-ui;max-width:600px;margin:auto"><h1>${copy.heading}</h1>${rows}</main>`,
      }),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(`Resend ha risposto ${response.status}`);
    const payload = (await response.json()) as { id: string };
    return { providerId: payload.id };
  }

  private escape(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character] ?? character,
    );
  }
}
