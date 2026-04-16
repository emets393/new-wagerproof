export const REVENUECAT_ENTITLEMENT_IDENTIFIER =
  Deno.env.get('REVENUECAT_ENTITLEMENT_IDENTIFIER') || 'WagerProof Pro';

export interface RevenueCatEntitlementState {
  entitlementIdentifier: string;
  isActive: boolean;
  subscriptionStatus: string | null;
  expiresAt: string | null;
  productIdentifier: string | null;
}

function deriveSubscriptionStatus(productIdentifier: string | null): string | null {
  const normalized = (productIdentifier || '').toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('monthly')) return 'monthly';
  if (normalized.includes('yearly') || normalized.includes('annual')) return 'yearly';
  if (normalized.includes('lifetime')) return 'lifetime';
  return 'active';
}

export async function fetchRevenueCatEntitlementState(
  appUserId: string,
  entitlementIdentifier: string = REVENUECAT_ENTITLEMENT_IDENTIFIER,
): Promise<RevenueCatEntitlementState> {
  const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!revenueCatSecretKey) {
    throw new Error('REVENUECAT_SECRET_API_KEY not configured');
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${revenueCatSecretKey}`,
      },
    },
  );

  if (response.status === 404) {
    return {
      entitlementIdentifier,
      isActive: false,
      subscriptionStatus: null,
      expiresAt: null,
      productIdentifier: null,
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RevenueCat API error: ${response.status} - ${errorText}`);
  }

  const subscriberData = await response.json();
  const subscriber = subscriberData?.subscriber;
  const entitlement = subscriber?.entitlements?.[entitlementIdentifier];

  let isActive = false;
  if (entitlement) {
    if ('is_active' in entitlement) {
      isActive = entitlement.is_active === true;
    } else if (entitlement.expires_date) {
      isActive = new Date(entitlement.expires_date) > new Date();
    } else {
      isActive = true;
    }
  }

  const productIdentifier = entitlement?.product_identifier || null;

  return {
    entitlementIdentifier,
    isActive,
    subscriptionStatus: isActive ? deriveSubscriptionStatus(productIdentifier) : null,
    expiresAt: isActive ? entitlement?.expires_date || null : null,
    productIdentifier,
  };
}
