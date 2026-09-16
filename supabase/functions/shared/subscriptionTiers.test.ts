import { describe, it, expect } from 'vitest';
import { resolveRestSubscription } from './subscriptionTiers';
const now = Date.parse('2026-09-16T12:00:00Z');
describe('RevenueCat subscription lifecycle', () => {
  it.each(['monthly', 'yearly', 'weekly', 'lifetime', 'promo', 'intro', 'web_legacy', 'google_legacy'])('preserves legacy %s Pro', product => {
    expect(resolveRestSubscription({ 'WagerProof Pro': { product_identifier: product } }, now)).toMatchObject({ tier: 'pro', isTieredCustomer: false });
  });
  it.each([['Standard', 'standard'], ['Premium', 'premium'], ['Pro', 'pro']])('resolves %s without granting a higher tier', (name, tier) => {
    expect(resolveRestSubscription({ [`WagerProof ${name}`]: { product_identifier: `wp_tiers_${tier}`, expires_date: '2027-01-01' } }, now)).toMatchObject({ tier, isTieredCustomer: true });
  });
  it('overlapping lower and legacy subscriptions retain Pro', () => {
    expect(resolveRestSubscription({ 'WagerProof Standard': {}, 'WagerProof Pro': {} }, now).tier).toBe('pro');
  });
  it('cancellation keeps access until the paid period expires', () => {
    expect(resolveRestSubscription({ 'WagerProof Pro': { expires_date: '2026-09-17' } }, now).tier).toBe('pro');
  });
  it('expiration removes access and preserves tiered history', () => {
    expect(resolveRestSubscription({ 'WagerProof Standard': { expires_date: '2026-09-15' } }, now)).toMatchObject({ tier: null, isTieredCustomer: true });
  });
  it('refund overrides an expiration in the future', () => {
    expect(resolveRestSubscription({ 'WagerProof Pro': { is_active: false, expires_date: '2027-01-01' } }, now).tier).toBeNull();
  });
  it('billing grace protects access until the grace expiration', () => {
    const e = { 'WagerProof Pro': { expires_date: '2026-09-15', product_identifier: 'monthly' } };
    const s = { monthly: { grace_period_expires_date: '2026-09-18' } };
    expect(resolveRestSubscription(e, now, s).tier).toBe('pro');
    expect(resolveRestSubscription(e, Date.parse('2026-09-19'), s).tier).toBeNull();
  });
  it('recognizes tiered subscriptions when the entitlement was removed', () => {
    expect(resolveRestSubscription({}, now, { wp_tiers_pro: {} })).toMatchObject({ tier: null, isTieredCustomer: true });
  });
});
