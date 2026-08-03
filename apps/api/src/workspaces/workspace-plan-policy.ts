export type WorkspacePlan = 'free' | 'pro' | 'unlimited';

export const WORKSPACE_PLAN_LIMITS: Record<WorkspacePlan, number | null> = {
  free: 1,
  pro: 3,
  unlimited: null,
};

const PLAN_RANK: Record<WorkspacePlan, number> = {
  free: 0,
  pro: 1,
  unlimited: 2,
};

export function workspaceEntitlementPlan(plans: WorkspacePlan[]): WorkspacePlan {
  return plans.reduce<WorkspacePlan>(
    (highest, plan) => (PLAN_RANK[plan] > PLAN_RANK[highest] ? plan : highest),
    'free',
  );
}

export function workspaceCreationCapability(plans: WorkspacePlan[]) {
  const entitlementPlan = workspaceEntitlementPlan(plans);
  const limit = WORKSPACE_PLAN_LIMITS[entitlementPlan];
  const owned = plans.length;
  return {
    entitlementPlan,
    owned,
    limit,
    canCreate: limit === null || owned < limit,
  };
}
