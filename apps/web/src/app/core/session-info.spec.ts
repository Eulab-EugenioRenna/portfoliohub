import { describeLastUse, describeUserAgent, readSessionLimit } from './session-info';

describe('session-info', () => {
  it('describes common user agents in a readable way', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome su macOS');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari su iOS');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0',
      ),
    ).toBe('Edge su Windows');
    expect(describeUserAgent(null)).toBe('Dispositivo non identificato');
  });

  it('describes the last use relative to now', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    expect(describeLastUse('2026-11-20T11:59:30Z', now)).toBe('adesso');
    expect(describeLastUse('2026-11-20T11:55:00Z', now)).toBe('5 minuti fa');
    expect(describeLastUse('2026-11-20T09:00:00Z', now)).toBe('3 ore fa');
    expect(describeLastUse('2026-11-18T12:00:00Z', now)).toBe('2 giorni fa');
  });

  it('reads the SESSION_LIMIT_REACHED payload only', () => {
    const sessions = [
      { id: 's1', userAgent: null, ipAddress: null, createdAt: '', lastSeenAt: '' },
    ];
    expect(
      readSessionLimit({
        status: 409,
        error: { code: 'SESSION_LIMIT_REACHED', limit: 2, sessions },
      }),
    ).toEqual({ limit: 2, sessions });
    expect(readSessionLimit({ status: 409, error: { code: 'OTHER' } })).toBeNull();
    expect(readSessionLimit(null)).toBeNull();
  });
});
