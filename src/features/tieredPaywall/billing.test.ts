import { describe, expect, it } from 'vitest';
import type { Offering } from '@revenuecat/purchases-js';
import { verifiedTierPackage } from './billing';
import catalog from './catalog.json';

function offering(overrides: { product?: string; amount?: number; currency?: string; ready?: boolean; offeringID?: string } = {}) {
  return {
    identifier: overrides.offeringID ?? 'wagerproof_tiers_v1',
    metadata: { tiered_web_ready: overrides.ready ?? true },
    availablePackages: [{ identifier: 'premium_yearly', webBillingProduct: {
      identifier: overrides.product ?? 'wp_tiers_premium_yearly_web',
      price: { currency: overrides.currency ?? 'USD', amountMicros: overrides.amount ?? 209_990_000 },
    } }],
  } as unknown as Offering;
}

describe('tiered checkout amount and product safety', () => {
  it('accepts only the dedicated product at the advertised discounted amount', () => {
    expect(verifiedTierPackage(offering(), 'premium', true)?.identifier).toBe('premium_yearly');
  });
  it.each([
    { amount: 299_990_000 }, { amount: 20999 }, { currency: 'EUR' },
    { product: 'existing_legacy_yearly' }, { ready: false }, { offeringID: 'default' },
  ])('rejects a mismatched or unready catalog: %j', overrides => {
    expect(verifiedTierPackage(offering(overrides), 'premium', true)).toBeUndefined();
  });
  it('never substitutes a package when the selected tier or period is missing', () => {
    expect(verifiedTierPackage(offering(), 'standard', true)).toBeUndefined();
    expect(verifiedTierPackage(offering(), 'premium', false)).toBeUndefined();
    expect(verifiedTierPackage(undefined, 'premium', true)).toBeUndefined();
  });
  it('keeps all six web prices at 30 percent off the reference prices, rounded to cents', () => {
    expect(catalog.plans.map(plan => [plan.monthlyCents, plan.yearlyCents])).toEqual([[1999, 19999], [2999, 29999], [7999, 35999]]);
    expect(catalog.plans.map(plan => [plan.webMonthlyCents, plan.webYearlyCents])).toEqual([[1399, 13999], [2099, 20999], [5599, 25199]]);
    for (const plan of catalog.plans) {
      expect(plan.webMonthlyCents).toBe(Math.round(plan.monthlyCents * 0.7));
      expect(plan.webYearlyCents).toBe(Math.round(plan.yearlyCents * 0.7));
    }
  });
});
