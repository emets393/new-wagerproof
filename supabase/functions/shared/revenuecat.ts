export const REVENUECAT_ENTITLEMENT_IDENTIFIER =
  Deno.env.get('REVENUECAT_ENTITLEMENT_IDENTIFIER') || 'WagerProof Pro';

export interface RevenueCatEntitlementState {
  entitlementIdentifier: string;
  isActive: boolean;
  subscriptionStatus: string | null;
  expiresAt: string | null;
  productIdentifier: string | null;
}

// Thrown when RC has no subscriber record for the queried app_user_id.
// Distinct from a transient network error: the caller can retry with a
// different id (e.g. a stranded anonymous id) before giving up. Paying users
// whose alias merge didn't propagate hit this case — treating 404 as
// "definitely not pro" locks them out.
export class RevenueCatSubscriberNotFoundError extends Error {
  constructor(appUserId: string) {
    super(`RevenueCat subscriber not found for app_user_id=${appUserId}`);
    this.name = 'RevenueCatSubscriberNotFoundError';
  }
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

  // 404 means no subscriber record under this app_user_id. Throw a typed
  // error so the caller can try alternative ids (e.g. a stranded anonymous
  // customer id) or fall back to the mirror, rather than silently treating
  // the user as not-pro.
  if (response.status === 404) {
    throw new RevenueCatSubscriberNotFoundError(appUserId);
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
