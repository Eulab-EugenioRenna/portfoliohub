import { workspaceCreationCapability } from './workspace-plan-policy';

describe('workspace plan policy', () => {
  it('allows the first Free workspace and blocks a second one', () => {
    expect(workspaceCreationCapability([])).toEqual({
      entitlementPlan: 'free',
      owned: 0,
      limit: 1,
      canCreate: true,
    });
    expect(workspaceCreationCapability(['free']).canCreate).toBe(false);
  });

  it('allows up to three owned workspaces with a Pro entitlement', () => {
    expect(workspaceCreationCapability(['pro', 'free']).canCreate).toBe(true);
    expect(workspaceCreationCapability(['pro', 'free', 'free'])).toMatchObject({
      entitlementPlan: 'pro',
      owned: 3,
      limit: 3,
      canCreate: false,
    });
  });

  it('does not impose a workspace count on Unlimited', () => {
    expect(workspaceCreationCapability(['unlimited', 'free', 'pro'])).toMatchObject({
      entitlementPlan: 'unlimited',
      limit: null,
      canCreate: true,
    });
  });
});
