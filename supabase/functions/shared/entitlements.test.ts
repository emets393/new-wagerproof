import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.hoisted(() => { (globalThis as any).Deno = { env: { get: (name: string) => name === 'REVENUECAT_SECRET_API_KEY' ? 'test-key' : undefined } }; });
import { getVerifiedEntitlementState, resolvePremiumAccess } from './entitlements';

function client(profile: Record<string, unknown>, cache: Record<string, unknown> | null = null) {
  const writes: { table: string; value: any }[] = [];
  return {
    writes,
    rpc: async (name: string, value: any) => { if (name !== 'has_role') writes.push({ table: name, value }); return { data: false, error: null }; },
    from(table: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: table === 'profiles' ? profile : cache, error: null }),
        upsert: async (value: any) => { writes.push({ table, value }); return { error: null }; },
        update: (value: any) => ({ eq: async () => { writes.push({ table, value }); return { error: null }; } }),
      };
      return chain;
    },
  };
}
beforeEach(() => vi.restoreAllMocks());
describe('authoritative tier resolver', () => {
  it('checks the uppercase identity before settling on a lower tier', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ subscriber: { entitlements:
      url.endsWith('/ABC') ? { 'WagerProof Pro': { product_identifier: 'legacy_lifetime' } }
        : { 'WagerProof Standard': { product_identifier: 'com.wagerproof.mobile.tiers.standard_monthly' } }
    } }), { status: 200 })));
    const state = await getVerifiedEntitlementState(client({}), 'abc');
    expect(state).toMatchObject({ tier: 'pro', isActive: true, productIdentifier: 'legacy_lifetime' });
  });
  it('does not turn a paid Standard subscription into agent access', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ subscriber: { entitlements: { 'WagerProof Standard': {} } } }), { status: 200 })));
    const db = client({ subscription_active: true });
    const access = await resolvePremiumAccess(db, 'abc');
    expect(access.hasPremiumAccess).toBe(false);
    expect(access.entitlement?.tier).toBe('standard');
    expect(db.writes).toEqual([expect.objectContaining({ table: 'sync_subscription_tier_access', value: expect.objectContaining({ p_tier: 'standard', p_is_tiered_customer: true }) })]);
  });
  it('does not promote a cached lower plan from a legacy paid=true profile during an outage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const state = await getVerifiedEntitlementState(client({ subscription_active: true, revenuecat_customer_id: 'old-id' }, { tier: 'premium', is_tiered_customer: true }), 'abc');
    expect(state).toMatchObject({ source: 'cache', tier: 'premium', isActive: false });
  });
  it('preserves the existing legacy subscription fallback during an outage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const state = await getVerifiedEntitlementState(client({ subscription_active: true }), 'abc');
    expect(state).toMatchObject({ source: 'cache', tier: 'pro', isActive: true, isTieredCustomer: false });
  });
});

describe('partial alias outages', () => {
  it('keeps a verified lower tier when a later identity lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/ABC')) throw new Error('alias offline');
      return new Response(JSON.stringify({ subscriber: { entitlements: { 'WagerProof Standard': {} } } }), { status: 200 });
    }));
    const state = await getVerifiedEntitlementState(client({ subscription_active: true, revenuecat_customer_id: 'abc' }), 'abc');
    expect(state).toMatchObject({ tier: 'standard', isActive: false, source: 'cache' });
  });
});


describe('legacy compatibility and tier expiry', () => {
  it('continues after the stored identity fails and finds canonical legacy Pro', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/stored')) throw new Error('unavailable');
      return Response.json({ subscriber: { entitlements: { 'WagerProof Pro': { product_identifier: 'legacy_monthly' } } } });
    }));
    expect(await getVerifiedEntitlementState(client({ revenuecat_customer_id: 'stored' }), 'abc'))
      .toMatchObject({ tier: 'pro', isActive: true, source: 'live', customerId: 'abc' });
  });
  it('keeps the tiered cohort after RevenueCat removes all entitlement history', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    expect(await getVerifiedEntitlementState(client({}, { tier: 'premium', is_tiered_customer: true }), 'abc'))
      .toMatchObject({ tier: null, isActive: false, isTieredCustomer: true, source: 'live' });
  });
  it('expires cached tiered Pro during an outage without changing legacy fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await getVerifiedEntitlementState(client({ subscription_active: true }, { tier: 'pro', is_tiered_customer: true, expires_at: '2020-01-01' }), 'abc'))
      .toMatchObject({ tier: null, isActive: false, isTieredCustomer: true });
  });
  it('an expired lower plan cannot fall back to coarse profile Pro on alias failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/ABC')) throw new Error('offline');
      return Response.json({ subscriber: { entitlements: { 'WagerProof Standard': { expires_date: '2020-01-01' } } } });
    }));
    expect(await getVerifiedEntitlementState(client({ subscription_active: true }), 'abc'))
      .toMatchObject({ tier: null, isActive: false, isTieredCustomer: true });
  });
});
