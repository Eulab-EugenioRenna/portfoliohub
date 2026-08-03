import type { EmailMessage } from '../contracts';
import { renderEmail } from './email-templates';

const origin = 'https://portfoliohub.eulab.cloud';

function message(template: string, variables: Record<string, string>): EmailMessage {
  return {
    idempotencyKey: `test:${template}`,
    to: 'mario@example.test',
    template,
    locale: 'it',
    variables,
  };
}

describe('PortfolioHub email templates', () => {
  it('renders email verification as a branded message with an absolute action link', () => {
    const rendered = renderEmail(
      message('verify-email', { displayName: 'Mario Rossi', token: 'token-di-prova' }),
      origin,
    );

    expect(rendered.subject).toContain('Conferma');
    expect(rendered.html).toContain(
      'href="https://portfoliohub.eulab.cloud/verifica?token=token-di-prova"',
    );
    expect(rendered.html).toContain('Verifica email');
    expect(rendered.html).not.toContain('<strong>token</strong>');
    expect(rendered.text).toContain(
      'https://portfoliohub.eulab.cloud/verifica?token=token-di-prova',
    );
  });

  it.each([
    ['magic-login', { displayName: 'Mario', token: 'magic-token' }],
    ['reset-password', { displayName: 'Mario', token: 'reset-token' }],
    ['workspace-invite', { inviteUrl: '/collab/invite-token', role: 'editor' }],
    ['client-personal-link', { clientName: 'Studio Alfa', url: '/cliente/client-token' }],
    ['client-magic-login', { token: 'client-magic', url: '/cliente/accesso?magic=client-magic' }],
    [
      'support.ticket.staff_activity',
      { subject: 'Upload bloccato', message: 'Il caricamento non procede.', actionUrl: '#tickets' },
    ],
    [
      'support.ticket.user_reply',
      { subject: 'Upload bloccato', message: 'Abbiamo risposto.', actionUrl: '/ticket' },
    ],
    [
      'workspace.product',
      {
        subject: 'Novità PortfolioHub',
        message: 'È disponibile una nuova funzione.',
        actionUrl: '/',
      },
    ],
    [
      'workspace.mass',
      {
        subject: 'Comunicazione importante',
        message: 'Aggiornamento del servizio.',
        actionUrl: '',
      },
    ],
    ['account.privacy_export_ready', { displayName: 'Mario', requestId: 'request-id' }],
    [
      'account.deletion_scheduled',
      { displayName: 'Mario', scheduledFor: '2026-09-02T10:00:00.000Z', day: '7' },
    ],
  ])('has dedicated, non-technical copy for %s', (template, variables) => {
    const rendered = renderEmail(message(template, variables), origin);

    expect(rendered.subject).not.toBe('Notifica PortfolioHub');
    expect(rendered.html).toContain('PortfolioHub');
    expect(rendered.html).not.toContain('<strong>token</strong>');
    expect(rendered.html).not.toContain('<strong>actionUrl</strong>');
    expect(rendered.text.length).toBeGreaterThan(40);
  });
});
