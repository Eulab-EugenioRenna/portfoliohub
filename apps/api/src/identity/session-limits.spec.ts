import { MIN_SESSION_LIMIT, sessionLimitForPlan, sessionLimitForPlans } from './session-limits';

describe('session limits', () => {
  it.each(['free', 'pro', 'unlimited', 'sconosciuto'])(
    '%s ha almeno due sessioni di default',
    (plan) => {
      expect(sessionLimitForPlan(plan, {})).toBeGreaterThanOrEqual(MIN_SESSION_LIMIT);
    },
  );

  it('SESSION_LIMIT_<PIANO> sostituisce solo quel piano e ignora valori sotto il minimo', () => {
    expect(sessionLimitForPlan('pro', { SESSION_LIMIT_PRO: '5' })).toBe(5);
    expect(sessionLimitForPlan('free', { SESSION_LIMIT_PRO: '5' })).toBe(MIN_SESSION_LIMIT);
    expect(sessionLimitForPlan('pro', { SESSION_LIMIT_PRO: '1' })).toBe(MIN_SESSION_LIMIT);
    expect(sessionLimitForPlan('pro', { SESSION_LIMIT_PRO: 'abc' })).toBe(MIN_SESSION_LIMIT);
  });

  it('con più workspace vale il limite più alto; senza workspace il piano free', () => {
    expect(sessionLimitForPlans(['free', 'pro'], { SESSION_LIMIT_PRO: '4' })).toBe(4);
    expect(sessionLimitForPlans([], {})).toBe(MIN_SESSION_LIMIT);
  });
});
