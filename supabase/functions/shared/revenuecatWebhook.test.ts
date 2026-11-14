import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./entitlements.ts', () => ({ getVerifiedEntitlementState: vi.fn(), syncEntitlementCache: vi.fn() }));
import { getVerifiedEntitlementState, syncEntitlementCache } from './entitlements';
import { reconcileRevenueCatEvent } from './revenuecatWebhook';
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function db() {
  return { from: () => ({ select: () => ({ eq: (key: string, id: string) => ({ maybeSingle: async () => ({ data: key === 'user_id' && [a, b].includes(id) ? { user_id: id } : null, error: null }) }) }) }) };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVerifiedEntitlementState).mockImplementation(async (_db, user) => ({ source: 'live', tier: user === a ? null : 'pro', isActive: user === b, isTieredCustomer: true, entitlementIdentifier: 'WagerProof Pro', subscriptionStatus: null, expiresAt: null, productIdentifier: null }));
});
describe('billing webhook reconciliation', () => {
  it('reconciles both sides of a transfer without app_user_id', async () => {
    expect(await reconcileRevenueCatEvent(db(), { type: 'TRANSFER', transferred_from: [a, '$RCAnonymousID:old'], transferred_to: [b] })).toEqual({ ok: true, reconciled: 2 });
    expect(getVerifiedEntitlementState).toHaveBeenNthCalledWith(1, expect.anything(), a, a);
    expect(getVerifiedEntitlementState).toHaveBeenNthCalledWith(2, expect.anything(), b, b);
    expect(syncEntitlementCache).toHaveBeenCalledTimes(2);
  });
  it('resolves an anonymous event through authenticated UUID aliases', async () => {
    await reconcileRevenueCatEvent(db(), { type: 'RENEWAL', app_user_id: '$RCAnonymousID:original', aliases: [b] });
    expect(getVerifiedEntitlementState).toHaveBeenCalledWith(expect.anything(), b, '$RCAnonymousID:original');
  });
  it('normalizes uppercase profile lookups while preserving the RevenueCat ID', async () => {
    await reconcileRevenueCatEvent(db(), { type: 'EXPIRATION', app_user_id: b.toUpperCase() });
    expect(getVerifiedEntitlementState).toHaveBeenCalledWith(expect.anything(), b, b.toUpperCase());
  });
  it.each(['CANCELLATION', 'BILLING_ISSUE', 'EXPIRATION', 'PRODUCT_CHANGE', 'UNCANCELLATION'])('%s refreshes the full current state rather than trusting event status', async type => {
    await reconcileRevenueCatEvent(db(), { type, app_user_id: b });
    expect(syncEntitlementCache).toHaveBeenCalledWith(expect.anything(), b, expect.objectContaining({ tier: 'pro' }));
  });
  it('forces retry when only cached access can be established', async () => {
    vi.mocked(getVerifiedEntitlementState).mockResolvedValue({ source: 'cache' } as any);
    await expect(reconcileRevenueCatEvent(db(), { type: 'RENEWAL', app_user_id: b })).rejects.toThrow('retry');
    expect(syncEntitlementCache).not.toHaveBeenCalled();
  });
  it('test events do not modify subscribers', async () => {
    expect(await reconcileRevenueCatEvent(db(), { type: 'TEST' })).toEqual({ ok: true, reconciled: 0 });
    expect(syncEntitlementCache).not.toHaveBeenCalled();
  });
});
