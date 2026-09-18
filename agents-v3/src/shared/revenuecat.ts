import { resolveRestSubscription, entitlementID, type SubscriptionTier, type RestEntitlement } from './subscriptionTiers';

export const REVENUECAT_ENTITLEMENT_IDENTIFIER =
  process.env.REVENUECAT_ENTITLEMENT_IDENTIFIER || 'WagerProof Pro';

export interface RevenueCatEntitlementState {
  entitlementIdentifier: string;
  customerId?: string;
  tier: SubscriptionTier | null;
  isTieredCustomer: boolean;
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
  const revenueCatSecretKey = process.env.REVENUECAT_SECRET_API_KEY;
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

  const subscriberData = await response.json() as { subscriber?: { entitlements?: Record<string, RestEntitlement>; subscriptions?: Record<string, RestEntitlement> } };
  const subscriber = subscriberData?.subscriber;
  const resolved = resolveRestSubscription(subscriber?.entitlements, Date.now(), subscriber?.subscriptions);
  // Preserve a configured legacy entitlement alias as Pro as well.
  const legacy = subscriber?.entitlements?.[entitlementIdentifier];
  if (entitlementIdentifier !== 'WagerProof Pro' && legacy) {
    const legacyState = resolveRestSubscription({ 'WagerProof Pro': legacy });
    if (legacyState.tier === 'pro') { resolved.tier = 'pro'; resolved.entitlement = legacy; }
  }
  const entitlement = resolved.entitlement;
  const productIdentifier = entitlement?.product_identifier || null;
  return {
    customerId: appUserId,
    entitlementIdentifier: resolved.tier ? entitlementID(resolved.tier) : entitlementIdentifier,
    // Existing agent endpoints use isActive as Pro, never as any-paid.
    isActive: resolved.tier === 'pro',
    tier: resolved.tier,
    isTieredCustomer: resolved.isTieredCustomer,
    subscriptionStatus: resolved.tier ? deriveSubscriptionStatus(productIdentifier) : null,
    expiresAt: resolved.tier ? entitlement?.expires_date || null : null,
    productIdentifier,
  };
}
