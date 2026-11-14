import { tierRank, type SubscriptionTier } from './subscriptionTiers';
import {
  fetchRevenueCatEntitlementState,
  REVENUECAT_ENTITLEMENT_IDENTIFIER,
  RevenueCatSubscriberNotFoundError,
  type RevenueCatEntitlementState,
} from './revenuecat';

export interface VerifiedRevenueCatEntitlementState extends RevenueCatEntitlementState {
  source: 'live' | 'cache';
}

export async function getIsAdmin(serviceClient: any, userId: string): Promise<boolean> {
  const { data, error } = await serviceClient.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (error) {
    console.warn('[entitlements] admin lookup failed:', error.message);
    return false;
  }
  return data === true;
}

export async function getVerifiedEntitlementState(
  serviceClient: any,
  userId: string,
  additionalCustomerId?: string,
): Promise<VerifiedRevenueCatEntitlementState> {
  // Probe every historical identity before concluding access is lower/expired.
  // A failure on one identity must not hide a valid legacy Pro on another.
  const storedRcId = await getStoredRevenueCatCustomerId(serviceClient, userId);
  const { data: cachedTier, error: cacheError } = await serviceClient.from('subscription_tier_access')
    .select('tier, is_tiered_customer, expires_at').eq('user_id', userId).maybeSingle();
  if (cacheError) throw new Error(`Subscription tier cache unavailable: ${cacheError.message}`);
  const candidates = [...new Set([storedRcId || userId, userId, userId.toUpperCase(), additionalCustomerId].filter((id): id is string => !!id))];
  let best: RevenueCatEntitlementState | null = null;
  let sawTieredCustomer = cachedTier?.is_tiered_customer === true;
  let lookupFailed = false;
  for (const candidateId of candidates) {
    try {
      const state = await fetchRevenueCatEntitlementState(candidateId, REVENUECAT_ENTITLEMENT_IDENTIFIER);
      sawTieredCustomer ||= state.isTieredCustomer;
      if (!best || tierRank(state.tier) > tierRank(best.tier)) best = state;
      if (state.isActive) return { ...state, isTieredCustomer: sawTieredCustomer, source: 'live' };
    } catch (error) {
      if (!(error instanceof RevenueCatSubscriberNotFoundError)) {
        lookupFailed = true;
        console.warn('[entitlements] identity lookup unavailable; checking remaining identities');
      }
    }
  }
  if (lookupFailed) {
    const cached = await getCachedEntitlementState(serviceClient, userId);
    // A coarse profiles mirror must never overrule an observed lower plan.
    // An actual previously verified Pro cache can protect a legacy subscriber.
    if (best && ((sawTieredCustomer && !cachedTier) || (best.tier && tierRank(best.tier) >= tierRank(cached.tier)))) {
      return { ...best, isTieredCustomer: sawTieredCustomer, source: 'cache' };
    }
    return { ...cached, isTieredCustomer: sawTieredCustomer, source: 'cache' };
  }
  return {
    ...(best ?? {
      entitlementIdentifier: REVENUECAT_ENTITLEMENT_IDENTIFIER,
      isActive: false, tier: null, subscriptionStatus: null,
      expiresAt: null, productIdentifier: null,
    }),
    isTieredCustomer: sawTieredCustomer,
    source: 'live',
  };
}

export async function syncEntitlementCache(
  serviceClient: any,
  userId: string,
  entitlement: VerifiedRevenueCatEntitlementState,
): Promise<void> {
  if (entitlement.source !== 'live') return;
  // Atomic, server-only write: sticky RevenueCat cohort + compatibility mirror.
  const { error } = await serviceClient.rpc('sync_subscription_tier_access', {
    p_user_id: userId,
    p_tier: entitlement.tier,
    p_is_tiered_customer: entitlement.isTieredCustomer,
    p_expires_at: entitlement.expiresAt,
    p_subscription_status: entitlement.subscriptionStatus,
    p_revenuecat_customer_id: entitlement.customerId ?? null,
  });
  if (error) throw new Error(`Cannot persist subscription tier: ${error.message}`);
}

export async function resolvePremiumAccess(serviceClient: any, userId: string | null) {
  if (!userId) {
    return {
      isAdmin: false,
      entitlement: null,
      hasPremiumAccess: false,
    };
  }

  const isAdmin = await getIsAdmin(serviceClient, userId);
  if (isAdmin) {
    return {
      isAdmin: true,
      entitlement: null,
      hasPremiumAccess: true,
    };
  }

  const entitlement = await getVerifiedEntitlementState(serviceClient, userId);
  if (entitlement.source === 'live') {
    await syncEntitlementCache(serviceClient, userId, entitlement);
  }

  return {
    isAdmin: false,
    entitlement,
    hasPremiumAccess: entitlement.isActive === true,
  };
}

export async function disableUserAutopilot(serviceClient: any, userId: string): Promise<void> {
  const { error } = await serviceClient
    .from('avatar_profiles')
    .update({
      auto_generate: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('auto_generate', true);

  if (error) {
    console.warn('[entitlements] failed to disable autopilot for user:', userId, error.message);
  }
}

async function getCachedEntitlementState(
  serviceClient: any,
  userId: string,
): Promise<VerifiedRevenueCatEntitlementState> {
  const { data, error } = await serviceClient
    .from('profiles')
    .select('subscription_active, subscription_status, subscription_expires_at, revenuecat_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`RevenueCat lookup failed and cached entitlement could not be loaded: ${error.message}`);
  }

  const { data: tierCache, error: tierError } = await serviceClient
    .from('subscription_tier_access')
    .select('tier, is_tiered_customer, expires_at')
    .eq('user_id', userId).maybeSingle();
  // An unavailable authoritative cache must not promote a new lower tier via
  // profiles. Once rollout starts, deploy this migration before the functions.
  if (tierError) throw new Error(`Subscription tier cache unavailable: ${tierError.message}`);
  const hasMirrorAccess = data?.subscription_active === true || !!data?.revenuecat_customer_id;
  const cacheExpired = tierCache?.is_tiered_customer && tierCache.expires_at
    && Date.parse(tierCache.expires_at) <= Date.now();
  const tier: SubscriptionTier | null = tierCache
    ? cacheExpired ? null : tierCache.tier
    : hasMirrorAccess ? 'pro' : null;
  return {
    entitlementIdentifier: REVENUECAT_ENTITLEMENT_IDENTIFIER,
    isActive: tier === 'pro',
    tier,
    isTieredCustomer: tierCache?.is_tiered_customer === true,
    subscriptionStatus: tier ? data?.subscription_status ?? 'active' : null,
    expiresAt: tierCache?.expires_at ?? data?.subscription_expires_at ?? null,
    productIdentifier: null,
    source: 'cache',
  };
}

async function getStoredRevenueCatCustomerId(
  serviceClient: any,
  userId: string,
): Promise<string | null> {
  const { data, error } = await serviceClient
    .from('profiles')
    .select('revenuecat_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[entitlements] failed to look up stored revenuecat_customer_id:', error.message);
    return null;
  }

  return data?.revenuecat_customer_id ?? null;
}
