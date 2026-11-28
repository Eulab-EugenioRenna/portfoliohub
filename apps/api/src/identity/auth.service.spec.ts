import { createHmac } from 'node:crypto';
import argon2 from 'argon2';
import { AuthService } from './auth.service';
import { SessionEntity } from './entities/session.entity';
import { UserEntity } from './entities/user.entity';
import { AuthTokenEntity } from './entities/auth-token.entity';

// Stateful repository doubles exercise the public auth methods and transaction rollback.
function fixture(plan = 'free') {
  const user = {
    id: 'user-1',
    email: 'a@example.test',
    displayName: 'A',
    status: 'active',
    passwordHash: 'hash',
  };
  let sessions: any[] = [];
  let tokens: any[] = [];
  const hash = (token: string) => createHmac('sha256', 'test').update(token).digest('hex');
  const active = () => sessions.filter((s) => !s.revokedAt && s.expiresAt > new Date());
  const sessionRepo = {
    create: (value: any) => value,
    save: jest.fn(async (value: any) => {
      if (!sessions.includes(value)) sessions.push(value);
      return value;
    }),
    update: jest.fn(async (where: any, patch: any) => {
      for (const s of sessions)
        if (s.id === where.id && s.userId === where.userId && !s.revokedAt) Object.assign(s, patch);
    }),
    createQueryBuilder: () => {
      const q: any = {};
      for (const key of ['where', 'andWhere', 'orderBy']) q[key] = () => q;
      q.getMany = async () => active();
      return q;
    },
  };
  const tokenRepo = {
    save: async (value: any) => value,
    createQueryBuilder: () => {
      let tokenHash: string;
      let purpose: string;
      const q: any = {};
      for (const key of ['addSelect', 'setLock']) q[key] = () => q;
      q.where = (_: string, p: any) => {
        tokenHash = p.hash;
        return q;
      };
      q.andWhere = (_: string, p: any) => {
        if (p?.purpose) purpose = p.purpose;
        return q;
      };
      q.getOne = async () =>
        tokens.find(
          (t) =>
            t.tokenHash === tokenHash &&
            t.purpose === purpose &&
            !t.consumedAt &&
            t.expiresAt > new Date(),
        );
      return q;
    },
  };
  const manager = {
    query: jest.fn(async (sql: string) =>
      sql.includes('pg_advisory') ? [] : [{ unlimited: plan === 'unlimited', plan }],
    ),
    getRepository: (entity: any) =>
      entity === SessionEntity
        ? sessionRepo
        : entity === UserEntity
          ? { findOneByOrFail: async () => user, save: async (v: any) => v }
          : tokenRepo,
  };
  const database = {
    transaction: async (_: string, action: any) => {
      const snapshot = structuredClone({ sessions, tokens, user });
      try {
        return await action(manager);
      } catch (e) {
        sessions = snapshot.sessions;
        tokens = snapshot.tokens;
        Object.assign(user, snapshot.user);
        throw e;
      }
    },
  };
  const service = new AuthService(
    database as never,
    { findByEmailWithPassword: async () => user, findById: async () => user } as never,
    {
      findActiveByTokenHash: async (h: string) => active().find((s) => s.tokenHash === h),
      save: sessionRepo.save,
      revoke: async (id: string, userId: string) =>
        sessionRepo.update({ id, userId }, { revokedAt: new Date() }),
    } as never,
    {} as never,
    tokenRepo as never,
    { sessionPepper: 'test' } as never,
    {} as never,
    {} as never,
  );
  return {
    service,
    sessions: () => sessions,
    token: (purpose: string) => {
      const raw = 'a'.repeat(43);
      tokens.push({
        tokenHash: hash(raw),
        purpose,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60000),
        consumedAt: null,
      });
      return raw;
    },
    consumed: () => tokens[0]?.consumedAt,
  };
}

const login = (f: ReturnType<typeof fixture>, revokeSessionId?: string) =>
  f.service.login(
    { email: 'a@example.test', password: 'password', revokeSessionId },
    { userAgent: 'browser' },
  );

describe('multi-device sessions', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-20T00:00:00Z') });
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it.each(['free', 'pro', 'unlimited'])(
    '%s keeps two sessions authenticated over 18 minutes and replaces only the chosen session',
    async (plan) => {
      const f = fixture(plan);
      const first = await login(f);
      const second = await login(f);
      for (let minute = 0; minute < 3; minute++) {
        jest.advanceTimersByTime(6 * 60000);
        const principals = await Promise.all([
          f.service.authenticate(first.token),
          f.service.authenticate(second.token),
        ]);
        expect(principals.map((p) => p.sessionId)).toEqual([
          first.principal.sessionId,
          second.principal.sessionId,
        ]);
        expect(f.sessions().every((s) => s.lastSeenAt.getTime() === Date.now())).toBe(true);
      }
      await expect(login(f)).rejects.toMatchObject({
        response: {
          code: 'SESSION_LIMIT_REACHED',
          limit: 2,
          sessions: expect.arrayContaining([
            expect.objectContaining({
              id: first.principal.sessionId,
              userAgent: 'browser',
              ipAddress: null,
            }),
            expect.objectContaining({ id: second.principal.sessionId }),
          ]),
        },
      });
      await expect(login(f, 'another-users-session')).rejects.toMatchObject({ status: 409 });
      const replacement = await login(f, first.principal.sessionId);
      await expect(f.service.authenticate(first.token)).rejects.toMatchObject({ status: 401 });
      await expect(f.service.authenticate(second.token)).resolves.toMatchObject(second.principal);
      await expect(f.service.authenticate(replacement.token)).resolves.toMatchObject(
        replacement.principal,
      );
    },
  );
  it.each(['magic-login', 'verify-email'])(
    '%s preserves the token after 409 and retries with the selected session',
    async (purpose) => {
      const f = fixture();
      const first = await login(f);
      const second = await login(f);
      const token = f.token(purpose);
      const consume = (revokeSessionId?: string) =>
        purpose === 'magic-login'
          ? f.service.consumeMagicLink({ token, revokeSessionId } as never, {})
          : f.service.verifyEmail({ token, revokeSessionId } as never, {});
      await expect(consume()).rejects.toMatchObject({
        status: 409,
        response: { code: 'SESSION_LIMIT_REACHED', limit: 2 },
      });
      expect(f.consumed()).toBeNull();
      const third = await consume(second.principal.sessionId);
      expect(f.consumed()).toBeInstanceOf(Date);
      await expect(f.service.authenticate(first.token)).resolves.toMatchObject(first.principal);
      await expect(f.service.authenticate(second.token)).rejects.toMatchObject({ status: 401 });
      await expect(f.service.authenticate(third.token)).resolves.toMatchObject(third.principal);
      await expect(consume()).rejects.toMatchObject({ status: 400 });
    },
  );
});
