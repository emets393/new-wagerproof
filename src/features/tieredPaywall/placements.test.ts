import { describe, expect, it, vi } from 'vitest';
import type { Offering } from '@revenuecat/purchases-js';
import { checkoutOrigin, resolveWebPlacement } from './placements';
import { verifiedTierPackage } from './billing';

function fixture(offering: Offering | null = null) {
  return {
    getAppUserId: vi.fn(() => 'user-a'),
    setAttributes: vi.fn(async () => {}),
    getCurrentOfferingForPlacement: vi.fn(async () => offering),
  };
}

describe('web placement routing', () => {
  it('syncs attribution before fetching the fixed checkout placement in USD', async () => {
    const client = fixture();
    client.getCurrentOfferingForPlacement.mockImplementation(async () => {
      expect(client.setAttributes).toHaveBeenCalledWith({ tiered_checkout_origin: 'onboarding' });
      return null;
    });
    await resolveWebPlacement(client, 'USER-A', 'onboarding', () => {});
    expect(client.getCurrentOfferingForPlacement).toHaveBeenCalledWith('tiered_web_checkout', { currency: 'USD' });
  });

  it('respects No Offering without using a global/default catalog', async () => {
    expect(await resolveWebPlacement(fixture(), 'user-a', null, () => {})).toBeNull();
  });

  it('does not allow a legacy placement result to buy a tiered product', async () => {
    const offer = await resolveWebPlacement(fixture({ identifier: 'hardPaywall' } as Offering), 'user-a', null, () => {});
    expect(verifiedTierPackage(offer ?? undefined, 'pro', false)).toBeUndefined();
  });

  it('retains the SDK package and its placement attribution through checkout validation', async () => {
    const pkg = { identifier: 'pro_monthly', presentedOfferingContext: { placementIdentifier: 'tiered_web_checkout' },
      webBillingProduct: { identifier: 'wp_tiers_pro_monthly_web', price: { currency: 'USD', amountMicros: 55990000 } } };
    const offering = { identifier: 'wagerproof_tiers_v1', metadata: { tiered_web_ready: true }, availablePackages: [pkg] } as unknown as Offering;
    const resolved = await resolveWebPlacement(fixture(offering), 'user-a', 'tier_upgrade_pro', () => {});
    expect(resolved).toBe(offering);
    expect(verifiedTierPackage(resolved!, 'pro', false)).toBe(pkg);
  });

  it('does not request another account’s offering', async () => {
    const client = fixture();
    await expect(resolveWebPlacement(client, 'user-b', null, () => {})).rejects.toThrow('account changed');
    expect(client.setAttributes).not.toHaveBeenCalled();
    expect(client.getCurrentOfferingForPlacement).not.toHaveBeenCalled();
  });

  it.each(['attributes', 'offerings'])('rejects an account switch during %s', async step => {
    const client = fixture();
    if (step === 'attributes') client.setAttributes.mockImplementation(async () => { client.getAppUserId.mockReturnValue('user-b'); });
    else client.getCurrentOfferingForPlacement.mockImplementation(async () => { client.getAppUserId.mockReturnValue('user-b'); return null; });
    await expect(resolveWebPlacement(client, 'user-a', null, () => {})).rejects.toThrow('account changed');
  });

  it('rejects sign-out even when the SDK retains its previous user ID', async () => {
    const client = fixture();
    let signedIn = true;
    client.setAttributes.mockImplementation(async () => { signedIn = false; });
    await expect(resolveWebPlacement(client, 'user-a', null, () => { if (!signedIn) throw new Error('Signed out'); })).rejects.toThrow('Signed out');
    expect(client.getCurrentOfferingForPlacement).not.toHaveBeenCalled();
  });

  it.each(['attributes', 'offerings'])('propagates %s failures without offering fallback', async step => {
    const client = fixture();
    client[step === 'attributes' ? 'setAttributes' : 'getCurrentOfferingForPlacement'].mockRejectedValue(new Error('Offline'));
    await expect(resolveWebPlacement(client, 'user-a', null, () => {})).rejects.toThrow('Offline');
    if (step === 'attributes') expect(client.getCurrentOfferingForPlacement).not.toHaveBeenCalled();
  });

  it('preserves allowed mobile origins and ignores arbitrary eligibility parameters', () => {
    for (const origin of ['onboarding', 'generic_feature', 'agent_feature', 'tier_upgrade_premium', 'tier_upgrade_pro']) expect(checkoutOrigin(origin)).toBe(origin);
    for (const value of [null, 'tiered_paywall_qa', 'enabled', 'https://example.com']) expect(checkoutOrigin(value)).toBe('tiered_web_checkout');
  });
});
