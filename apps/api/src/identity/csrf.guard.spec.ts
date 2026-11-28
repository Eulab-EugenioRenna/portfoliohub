import { ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SessionTokenDto } from './dto/auth.dto';
import { CsrfGuard } from './csrf.guard';

const context = (method: string, cookie?: string, header?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        cookies: { ph_csrf: cookie },
        header: (name: string) => (name === 'x-csrf-token' ? header : undefined),
      }),
    }),
  }) as never;

describe('CsrfGuard: ogni device ha il proprio cookie ph_csrf, nessuno stato condiviso', () => {
  const guard = new CsrfGuard();
  it('accetta indipendentemente due device con token CSRF diversi', () => {
    expect(guard.canActivate(context('POST', 'csrf-device-a', 'csrf-device-a'))).toBe(true);
    expect(guard.canActivate(context('POST', 'csrf-device-b', 'csrf-device-b'))).toBe(true);
    // il token di A resta valido dopo che B ha fatto login: il guard non memorizza nulla
    expect(guard.canActivate(context('DELETE', 'csrf-device-a', 'csrf-device-a'))).toBe(true);
  });
  it('rifiuta cookie e header diversi o mancanti, lascia passare le letture', () => {
    expect(() => guard.canActivate(context('POST', 'a', 'b'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context('POST', undefined, 'b'))).toThrow(ForbiddenException);
    expect(guard.canActivate(context('GET'))).toBe(true);
  });
});

describe('SessionTokenDto', () => {
  const token = 'a'.repeat(43);
  it('accetta revokeSessionId opzionale UUID e rifiuta valori non UUID', async () => {
    expect(await validate(plainToInstance(SessionTokenDto, { token }))).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(SessionTokenDto, {
          token,
          revokeSessionId: '6f1d3f0e-8c1e-4d6b-9d7e-2a5c7d1f9b10',
        }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(SessionTokenDto, { token, revokeSessionId: 'x' })),
    ).not.toHaveLength(0);
  });
});
