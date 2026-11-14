import type { Offering } from '@revenuecat/purchases-js';

export const TIERED_WEB_PLACEMENT = 'tiered_web_checkout';
const origins = ['onboarding', 'generic_feature', 'agent_feature', 'tier_upgrade_premium', 'tier_upgrade_pro'] as const;

// Origin is attribution only. It never grants QA eligibility or selects an offer.
export function checkoutOrigin(value: string | null): string {
  return origins.some(origin => origin === value) ? value! : TIERED_WEB_PLACEMENT;
}

interface PlacementClient {
  getAppUserId(): string;
  setAttributes(attributes: Record<string, string>): Promise<void>;
  getCurrentOfferingForPlacement(id: string, params: { currency: string }): Promise<Offering | null>;
}

export async function resolveWebPlacement(
  client: PlacementClient,
  userID: string,
  origin: string | null,
  assertSession: () => void,
): Promise<Offering | null> {
  const assertIdentity = () => {
    assertSession();
    if (client.getAppUserId() !== userID.trim().toLowerCase()) {
      throw new Error('Your account changed. Please reload your subscription options.');
    }
  };
  assertIdentity();
  // Web attributes sync immediately, unlike the mobile SDK's queued attributes.
  // Do not set tiered_paywall_qa here: that attribute is managed in RevenueCat.
  await client.setAttributes({ tiered_checkout_origin: checkoutOrigin(origin) });
  assertIdentity();
  const offering = await client.getCurrentOfferingForPlacement(TIERED_WEB_PLACEMENT, { currency: 'USD' });
  assertIdentity();
  // Preserve nil and the SDK's original Offering/Package objects for attribution.
  return offering;
}
