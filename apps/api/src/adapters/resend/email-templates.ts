import type { EmailMessage } from '../contracts';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface EmailContent {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  body?: string;
  action?: { label: string; url: string };
  note?: string;
}

export function renderEmail(message: EmailMessage, appOrigin: string): RenderedEmail {
  const origin = appOrigin.replace(/\/$/, '');
  const value = (key: string): string => message.variables[key]?.trim() ?? '';
  const url = (path: string): string => absoluteUrl(origin, path);
  const name = value('displayName') || value('clientName');
  const greeting = name ? `Ciao ${name},` : 'Ciao,';
  let content: EmailContent;

  switch (message.template) {
    case 'verify-email':
    case 'auth.verify':
      content = {
        subject: 'Conferma la tua email e attiva PortfolioHub',
        preheader: 'Un ultimo passaggio per accedere al tuo workspace.',
        eyebrow: 'Attivazione account',
        heading: 'Il tuo workspace è pronto.',
        intro: `${greeting} conferma il tuo indirizzo email per attivare l’account e iniziare a usare PortfolioHub.`,
        action: {
          label: 'Verifica email',
          url: url(`/verifica?token=${encodeURIComponent(value('token'))}`),
        },
        note: 'Il link è personale, può essere usato una sola volta e scade dopo 24 ore.',
      };
      break;
    case 'magic-login':
    case 'auth.magic':
      content = {
        subject: 'Il tuo accesso sicuro a PortfolioHub',
        preheader: 'Accedi senza password dal link personale.',
        eyebrow: 'Accesso sicuro',
        heading: 'Entra nel tuo workspace.',
        intro: `${greeting} usa il pulsante qui sotto per accedere in modo sicuro, senza inserire la password.`,
        action: {
          label: 'Accedi a PortfolioHub',
          url: url(`/accedi?magic=${encodeURIComponent(value('token'))}`),
        },
        note: 'Il link scade dopo 15 minuti. Se non hai richiesto tu l’accesso, ignora questa email.',
      };
      break;
    case 'reset-password':
    case 'auth.reset':
      content = {
        subject: 'Reimposta la password di PortfolioHub',
        preheader: 'Crea una nuova password dal link protetto.',
        eyebrow: 'Sicurezza account',
        heading: 'Scegli una nuova password.',
        intro: `${greeting} abbiamo ricevuto una richiesta di reimpostazione della password del tuo account.`,
        action: {
          label: 'Reimposta password',
          url: url(`/reimposta-password?token=${encodeURIComponent(value('token'))}`),
        },
        note: 'Il link scade dopo 30 minuti. Se non hai fatto questa richiesta, non devi fare nulla.',
      };
      break;
    case 'workspace-invite':
    case 'workspace.invite':
      content = {
        subject: 'Invito a collaborare su PortfolioHub',
        preheader: `Hai ricevuto un invito con ruolo ${roleLabel(value('role'))}.`,
        eyebrow: 'Collaborazione',
        heading: 'Un nuovo spazio di lavoro ti aspetta.',
        intro: `${greeting} sei stato invitato a collaborare su PortfolioHub con il ruolo di ${roleLabel(value('role'))}.`,
        action: { label: 'Visualizza invito', url: url(value('inviteUrl')) },
        note: 'L’invito è personale e scade dopo 7 giorni. Accedi con lo stesso indirizzo email a cui è stato inviato.',
      };
      break;
    case 'client-personal-link':
    case 'client.access':
      content = {
        subject: 'Il tuo spazio personale su PortfolioHub',
        preheader: 'Consulta in modo ordinato i lavori condivisi con te.',
        eyebrow: 'Area cliente',
        heading: 'I tuoi lavori, in un unico posto.',
        intro: `${greeting} è stato creato il tuo accesso personale ai lavori e alle consegne condivise con te.`,
        action: { label: 'Apri il mio spazio', url: url(value('url')) },
        note: 'Questo collegamento è personale. Non inoltrarlo ad altre persone.',
      };
      break;
    case 'client-magic-login':
      content = {
        subject: 'Accedi al tuo spazio cliente',
        preheader: 'Il tuo link di accesso personale è pronto.',
        eyebrow: 'Area cliente',
        heading: 'Torna ai lavori condivisi con te.',
        intro: `${greeting} usa questo collegamento per accedere in modo sicuro al tuo spazio cliente.`,
        action: { label: 'Accedi ai miei lavori', url: url(value('url')) },
        note: 'Il link scade dopo 15 minuti e può essere usato una sola volta.',
      };
      break;
    case 'support.ticket.staff_activity':
      content = {
        subject: `Ticket da gestire · ${value('subject') || 'Nuova attività'}`,
        preheader: 'Una conversazione di supporto richiede attenzione.',
        eyebrow: 'Support Desk',
        heading: 'Nuova attività su un ticket.',
        intro: value('subject') || 'È arrivato un nuovo aggiornamento dal workspace.',
        body: value('message'),
        note: 'Apri il Support Desk dal backoffice PortfolioHub per consultare la conversazione completa.',
      };
      break;
    case 'support.ticket.user_reply':
      content = {
        subject: `Il supporto ha risposto · ${value('subject') || 'Il tuo ticket'}`,
        preheader: 'C’è un nuovo messaggio nella tua conversazione di supporto.',
        eyebrow: 'Supporto PortfolioHub',
        heading: 'Hai ricevuto una risposta.',
        intro: value('subject') || 'Il team di supporto ha aggiornato il tuo ticket.',
        body: value('message'),
        action: { label: 'Apri il ticket', url: url(value('actionUrl') || '/ticket') },
        note: 'Puoi rispondere direttamente dalla conversazione nel tuo workspace.',
      };
      break;
    case 'support.ticket.opened_confirmation':
      content = {
        subject: `Richiesta ricevuta · ${value('subject') || 'Ticket aperto'}`,
        preheader: 'Il supporto PortfolioHub ha ricevuto la tua richiesta.',
        eyebrow: 'Supporto PortfolioHub',
        heading: 'Il tuo ticket è aperto.',
        intro: value('subject') || 'Abbiamo ricevuto la tua richiesta.',
        body: value('message'),
        action: { label: 'Apri la conversazione', url: url(value('actionUrl') || '/ticket') },
        note: 'Ti invieremo una nuova email quando il supporto risponde o cambia lo stato.',
      };
      break;
    case 'support.ticket.status_changed':
      content = {
        subject: `Ticket ${value('status') || 'aggiornato'} · ${value('subject') || 'La tua richiesta'}`,
        preheader: 'Lo stato della tua richiesta di supporto è cambiato.',
        eyebrow: 'Supporto PortfolioHub',
        heading: `Ticket ${value('status') || 'aggiornato'}.`,
        intro: value('subject') || 'Il team di supporto ha aggiornato la tua richiesta.',
        body: value('message'),
        action: { label: 'Apri la conversazione', url: url(value('actionUrl') || '/ticket') },
        note: 'Dalla conversazione puoi leggere lo storico completo e rispondere al supporto.',
      };
      break;
    case 'workspace.product':
      content = workspaceMessage('Novità PortfolioHub', 'Aggiornamento prodotto', message, origin);
      break;
    case 'workspace.mass':
      content = workspaceMessage(
        'Comunicazione PortfolioHub',
        'Comunicazione di servizio',
        message,
        origin,
      );
      break;
    case 'account.privacy_export_ready':
      content = {
        subject: 'La tua esportazione dati è pronta',
        preheader: 'Puoi scaricare la copia dei tuoi dati PortfolioHub.',
        eyebrow: 'Privacy e dati',
        heading: 'Esportazione completata.',
        intro: `${greeting} abbiamo preparato la copia dei dati associati al tuo account.`,
        action: { label: 'Vai ai miei dati', url: url('/impostazioni') },
        note: 'Per proteggere i tuoi dati, accedi a PortfolioHub e scarica il file dalla sezione privacy delle impostazioni.',
      };
      break;
    case 'account.deletion_scheduled':
      content = {
        subject: 'Eliminazione dell’account programmata',
        preheader: `Il tuo account verrà eliminato il ${dateLabel(value('scheduledFor'))}.`,
        eyebrow: 'Sicurezza account',
        heading: 'Il periodo di ripensamento è attivo.',
        intro: `${greeting} l’eliminazione del tuo account è programmata per il ${dateLabel(value('scheduledFor'))}.`,
        body: 'Fino a quella data puoi annullare la richiesta dalle impostazioni del tuo account.',
        action: { label: 'Gestisci eliminazione', url: url('/impostazioni') },
        note: 'Se non riconosci questa richiesta, accedi subito e contatta il supporto.',
      };
      break;
    case 'billing.payment_failed':
      content = {
        subject: 'Aggiorna il metodo di pagamento',
        preheader: 'Non siamo riusciti a completare il rinnovo del tuo piano.',
        eyebrow: 'Abbonamento',
        heading: 'Il pagamento richiede attenzione.',
        intro: `${greeting} Stripe non è riuscito a completare il pagamento del tuo abbonamento PortfolioHub.`,
        action: { label: 'Gestisci abbonamento', url: url('/impostazioni') },
        note: 'Aggiorna il metodo di pagamento per evitare limitazioni al termine del periodo previsto.',
      };
      break;
    case 'delivery.ready':
      content = {
        subject: 'Una nuova consegna è pronta',
        preheader: 'I file condivisi con te sono disponibili.',
        eyebrow: 'Nuova consegna',
        heading: 'Il tuo lavoro è pronto.',
        intro: `${greeting} puoi consultare e scaricare la nuova consegna dal collegamento sicuro qui sotto.`,
        action: { label: 'Apri la consegna', url: url(value('url')) },
        note: 'Disponibilità e permessi del collegamento sono definiti da chi ha preparato la consegna.',
      };
      break;
    default:
      content = {
        subject: value('subject') || 'Aggiornamento da PortfolioHub',
        preheader: 'Hai ricevuto una comunicazione da PortfolioHub.',
        eyebrow: 'PortfolioHub',
        heading: value('subject') || 'Un aggiornamento per te.',
        intro: value('message') || 'Accedi a PortfolioHub per consultare tutti i dettagli.',
        action: value('actionUrl')
          ? { label: 'Apri PortfolioHub', url: url(value('actionUrl')) }
          : undefined,
      };
  }

  return {
    subject: content.subject,
    html: renderHtml(content),
    text: renderText(content),
  };
}

function workspaceMessage(
  fallbackSubject: string,
  eyebrow: string,
  message: EmailMessage,
  origin: string,
): EmailContent {
  const subject = message.variables.subject?.trim() || fallbackSubject;
  const actionUrl = message.variables.actionUrl?.trim();
  return {
    subject,
    preheader: message.variables.message?.trim() || subject,
    eyebrow,
    heading: subject,
    intro: message.variables.message?.trim() || 'Accedi a PortfolioHub per maggiori dettagli.',
    action: actionUrl
      ? { label: 'Apri PortfolioHub', url: absoluteUrl(origin, actionUrl) }
      : undefined,
  };
}

function renderHtml(content: EmailContent): string {
  const action = content.action
    ? `<tr><td style="padding:8px 40px 32px"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;background:#175cd3;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;padding:14px 22px;border-radius:10px">${escapeHtml(content.action.label)}</a></td></tr><tr><td style="padding:0 40px 28px"><p style="margin:0;color:#667085;font:12px/19px Arial,sans-serif">Se il pulsante non funziona, copia questo indirizzo nel browser:<br><a href="${escapeHtml(content.action.url)}" style="color:#175cd3;word-break:break-all">${escapeHtml(content.action.url)}</a></p></td></tr>`
    : '';
  const body = content.body
    ? `<p style="margin:18px 0 0;color:#344054;font:15px/24px Arial,sans-serif;white-space:pre-line">${escapeHtml(content.body)}</p>`
    : '';
  const note = content.note
    ? `<tr><td style="padding:0 40px 36px"><div style="border-left:3px solid #84adff;background:#f5f8ff;padding:14px 16px;color:#475467;font:13px/20px Arial,sans-serif">${escapeHtml(content.note)}</div></td></tr>`
    : '';

  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(content.subject)}</title></head><body style="margin:0;background:#f2f4f7;padding:24px 12px"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #e4e7ec;border-radius:18px;overflow:hidden"><tr><td style="padding:28px 40px;border-bottom:1px solid #eaecf0"><span style="display:inline-block;width:36px;height:36px;border-radius:10px;background:#175cd3;color:#ffffff;text-align:center;font:700 18px/36px Georgia,serif">P</span><strong style="margin-left:12px;color:#101828;font:700 17px/36px Georgia,serif;vertical-align:top">PortfolioHub</strong></td></tr><tr><td style="padding:36px 40px 20px"><p style="margin:0 0 12px;color:#175cd3;font:700 11px/16px Arial,sans-serif;letter-spacing:1.4px;text-transform:uppercase">${escapeHtml(content.eyebrow)}</p><h1 style="margin:0;color:#101828;font:700 32px/39px Georgia,serif;letter-spacing:-.6px">${escapeHtml(content.heading)}</h1><p style="margin:18px 0 0;color:#344054;font:15px/25px Arial,sans-serif">${escapeHtml(content.intro)}</p>${body}</td></tr>${action}${note}<tr><td style="padding:24px 40px;background:#101828;color:#98a2b3;font:12px/19px Arial,sans-serif">PortfolioHub · Collaborazione e consegna file<br><span>Messaggio transazionale relativo al tuo account o workspace.</span></td></tr></table></td></tr></table></body></html>`;
}

function renderText(content: EmailContent): string {
  return [
    'PORTFOLIOHUB',
    content.eyebrow.toUpperCase(),
    '',
    content.heading,
    '',
    content.intro,
    content.body,
    content.action ? `${content.action.label}: ${content.action.url}` : undefined,
    content.note,
    '',
    'PortfolioHub · Collaborazione e consegna file',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function absoluteUrl(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path) return origin;
  return `${origin}${path.startsWith('/') || path.startsWith('#') ? '' : '/'}${path}`;
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    editor: 'Editor',
    uploader: 'Uploader',
    viewer: 'Viewer',
    guest: 'Guest',
  };
  return labels[role] ?? role ?? 'collaboratore';
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'data indicata nelle impostazioni';
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  }).format(date);
}

function escapeHtml(value: string): string {
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
