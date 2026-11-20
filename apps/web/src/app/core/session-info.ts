export interface AccountSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface SessionLimitInfo {
  limit: number;
  sessions: AccountSession[];
}

/** Legge il 409 `SESSION_LIMIT_REACHED` restituito da login, magic link e verifica email. */
export function readSessionLimit(error: unknown): SessionLimitInfo | null {
  const response = error as {
    status?: number;
    error?: { code?: string; limit?: number; sessions?: AccountSession[] };
  } | null;
  if (response?.error?.code !== 'SESSION_LIMIT_REACHED') return null;
  const sessions = response.error.sessions ?? [];
  const limit =
    typeof response.error.limit === 'number' && response.error.limit > 0
      ? response.error.limit
      : sessions.length;
  return { limit, sessions };
}

export function sessionLimitMessage(limit: number): string {
  const devices = limit === 1 ? '1 dispositivo' : `${limit} dispositivi`;
  return `Hai raggiunto il limite di ${devices} collegati. Per accedere da questo dispositivo scegli quale sessione chiudere.`;
}

/** Trasforma uno user agent in una descrizione leggibile, es. «Chrome su macOS». */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent?.trim()) return 'Dispositivo non identificato';
  const ua = userAgent;
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? 'iOS'
    : /Android/i.test(ua)
      ? 'Android'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/i.test(ua)
          ? 'macOS'
          : /CrOS/i.test(ua)
            ? 'ChromeOS'
            : /Linux/i.test(ua)
              ? 'Linux'
              : null;
  const browser = /Edg(e|A|iOS)?\//i.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/i.test(ua)
      ? 'Opera'
      : /Firefox\/|FxiOS\//i.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//i.test(ua)
          ? 'Chrome'
          : /Safari\//i.test(ua)
            ? 'Safari'
            : null;
  if (browser && os) return `${browser} su ${os}`;
  if (browser) return browser;
  if (os) return os;
  return ua.length > 60 ? `${ua.slice(0, 57)}…` : ua;
}

/** «adesso», «5 minuti fa», «2 ore fa», «3 giorni fa» o la data per i periodi più lunghi. */
export function describeLastUse(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'non disponibile';
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return minutes === 1 ? '1 minuto fa' : `${minutes} minuti fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 ora fa' : `${hours} ore fa`;
  const days = Math.floor(hours / 24);
  if (days < 14) return days === 1 ? '1 giorno fa' : `${days} giorni fa`;
  return date.toLocaleDateString('it-IT');
}
