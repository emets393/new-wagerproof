import {
  fetchRevenueCatEntitlementState,
  REVENUECAT_ENTITLEMENT_IDENTIFIER,
  type RevenueCatEntitlementState,
} from './revenuecat.ts';

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
): Promise<VerifiedRevenueCatEntitlementState> {
  try {
    return {
      ...(await fetchRevenueCatEntitlementState(userId, REVENUECAT_ENTITLEMENT_IDENTIFIER)),
      source: 'live',
    };
  } catch (error) {
    console.warn('[entitlements] live RevenueCat lookup failed, using cache fallback:', error);
    return await getCachedEntitlementState(serviceClient, userId);
  }
}

export async function syncEntitlementCache(
  serviceClient: any,
  userId: string,
  entitlement: Pick<VerifiedRevenueCatEntitlementState, 'isActive' | 'subscriptionStatus' | 'expiresAt'>,
): Promise<void> {
  const { error } = await serviceClient
    .from('profiles')
    .update({
      subscription_active: entitlement.isActive,
      subscription_status: entitlement.subscriptionStatus,
      subscription_expires_at: entitlement.expiresAt,
    })
    .eq('user_id', userId);

  if (error) {
    console.warn('[entitlements] failed to sync entitlement cache:', error.message);
  }
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

  const hasMirrorAccess = data?.subscription_active === true || !!data?.revenuecat_customer_id;
  return {
    entitlementIdentifier: REVENUECAT_ENTITLEMENT_IDENTIFIER,
    isActive: hasMirrorAccess,
    subscriptionStatus: hasMirrorAccess ? data?.subscription_status ?? 'active' : null,
    expiresAt: hasMirrorAccess ? data?.subscription_expires_at ?? null : null,
    productIdentifier: null,
    source: 'cache',
  };
}
