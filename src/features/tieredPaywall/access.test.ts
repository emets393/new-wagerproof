import { describe, it, expect } from 'vitest';
import { tierTitle } from './access';
import { includesTier, resolveSubscriptionTier, isTieredCustomer, tierRestricted, resolveRestSubscription } from '../../../supabase/functions/shared/subscriptionTiers';

describe('cumulative subscription access and legacy preservation', () => {
  it('renames the display tiers without changing entitlement resolution', () => {
    expect(['standard', 'premium', 'pro'].map(tier => tierTitle(tier as 'standard' | 'premium' | 'pro')))
      .toEqual(['Premium', 'Premium Plus', 'Pro']);
    expect(resolveSubscriptionTier(['WagerProof Standard'])).toBe('standard');
    expect(resolveSubscriptionTier(['WagerProof Premium'])).toBe('premium');
  });
  it('keeps every existing Pro entitlement at the highest tier, including alongside a new lower plan', () => {
    expect(resolveSubscriptionTier(['WagerProof Pro'])).toBe('pro');
    expect(resolveSubscriptionTier(['WagerProof Standard', 'WagerProof Pro'])).toBe('pro');
    expect(resolveSubscriptionTier(['WagerProof Premium', 'WagerProof Pro'])).toBe('pro');
  });
  it.each(['monthly', 'yearly', 'lifetime', 'promotional'])('does not enroll a legacy %s product', product => {
    expect(isTieredCustomer(['WagerProof Pro'], [product])).toBe(false);
  });
  it('enrolls only explicit new catalog customers, including an expired lower entitlement', () => {
    expect(isTieredCustomer(['WagerProof Standard'])).toBe(true);
    expect(isTieredCustomer(['WagerProof Pro'], ['wp_tiers_pro_yearly_web'])).toBe(true);
    expect(isTieredCustomer([], ['com.wagerproof.mobile.tiers.premium_monthly'])).toBe(true);
    expect(isTieredCustomer([], [])).toBe(false);
  });
  it('gives Standard game research, Premium tools, and Pro agents', () => {
    expect(includesTier('standard', 'standard')).toBe(true);
    expect(includesTier('standard', 'premium')).toBe(false);
    expect(includesTier('premium', 'standard')).toBe(true);
    expect(includesTier('premium', 'premium')).toBe(true);
    expect(includesTier('premium', 'pro')).toBe(false);
    expect(includesTier('pro', 'premium')).toBe(true);
  });
  it('leaves legacy free previews alone but restricts an expired tiered customer', () => {
    expect(tierRestricted(null, false, 'pro')).toBe(false);
    expect(tierRestricted(null, true, 'standard')).toBe(true);
    expect(tierRestricted('pro', false, 'pro')).toBe(false);
  });
  it('handles renewal expiry, lifetime, and explicit RevenueCat active state', () => {
    const now = Date.parse('2026-09-14T00:00:00Z');
    const expired = { expires_date: '2026-09-13T00:00:00Z' };
    expect(resolveRestSubscription({ 'WagerProof Pro': expired, 'WagerProof Standard': {} }, now).tier).toBe('standard');
    expect(resolveRestSubscription({ 'WagerProof Pro': {} }, now).tier).toBe('pro');
    expect(resolveRestSubscription({ 'WagerProof Premium': { is_active: true, ...expired } }, now).tier).toBe('premium');
    expect(resolveRestSubscription({ 'WagerProof Pro': { is_active: false } }, now).tier).toBeNull();
    expect(resolveRestSubscription({ 'WagerProof Standard': expired }, now)).toMatchObject({ tier: null, isTieredCustomer: true });
  });
});
