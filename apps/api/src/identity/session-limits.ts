// Unico punto in cui si decide quante sessioni attive può avere un utente.
// Il valore commerciale per piano è di Eugenio: qui sta solo il default tecnico (minimo 2).
export const MIN_SESSION_LIMIT = 2;

export const DEFAULT_SESSION_LIMITS: Record<string, number> = {
  free: 2,
  pro: 2,
  unlimited: 2,
};

/**
 * Limite per un piano. `SESSION_LIMIT_<PIANO>` (es. SESSION_LIMIT_PRO=3) sostituisce il default
 * del singolo piano; valori non interi o sotto il minimo vengono ignorati.
 */
export function sessionLimitForPlan(plan: string, env: NodeJS.ProcessEnv = process.env): number {
  const override = Number(env[`SESSION_LIMIT_${plan.toUpperCase()}`]);
  if (Number.isInteger(override) && override >= MIN_SESSION_LIMIT) return override;
  return Math.max(DEFAULT_SESSION_LIMITS[plan] ?? MIN_SESSION_LIMIT, MIN_SESSION_LIMIT);
}

/** Un utente con più workspace ottiene il limite più alto tra i suoi piani attivi. */
export function sessionLimitForPlans(
  plans: string[],
  env: NodeJS.ProcessEnv = process.env,
): number {
  if (plans.length === 0) return sessionLimitForPlan('free', env);
  return Math.max(...plans.map((plan) => sessionLimitForPlan(plan, env)));
}
