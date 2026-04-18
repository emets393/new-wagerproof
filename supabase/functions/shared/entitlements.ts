import {
  fetchRevenueCatEntitlementState,
  REVENUECAT_ENTITLEMENT_IDENTIFIER,
  RevenueCatSubscriberNotFoundError,
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
  // Prefer the stored real RC identity (written by mobile's
  // applyCustomerInfoState as originalAppUserId, and by the webhook as the
  // event's app_user_id). For most users this equals userId. For users
  // stranded under an anonymous RC id it's the anon id — the only identity
  // RC's API will resolve. Fall back to userId if the mirror hasn't been
  // populated yet (brand-new account before any sync/webhook).
  const storedRcId = await getStoredRevenueCatCustomerId(serviceClient, userId);
  const primaryRcId = storedRcId || userId;

  try {
    return {
      ...(await fetchRevenueCatEntitlementState(primaryRcId, REVENUECAT_ENTITLEMENT_IDENTIFIER)),
      source: 'live',
    };
  } catch (error) {
    // If the stored id 404s but it's different from userId, retry with
    // userId — covers brief windows where mirror is stale or wrong.
    if (error instanceof RevenueCatSubscriberNotFoundError && primaryRcId !== userId) {
      try {
        const fallbackState = await fetchRevenueCatEntitlementState(
          userId,
          REVENUECAT_ENTITLEMENT_IDENTIFIER,
        );
        return { ...fallbackState, source: 'live' };
      } catch (retryError) {
        if (retryError instanceof RevenueCatSubscriberNotFoundError) {
          // Neither identity resolves — user is genuinely unknown to RC.
          return {
            entitlementIdentifier: REVENUECAT_ENTITLEMENT_IDENTIFIER,
            isActive: false,
            subscriptionStatus: null,
            expiresAt: null,
            productIdentifier: null,
            source: 'live',
          };
        }
        console.warn('[entitlements] retry with userId failed, using cache fallback:', retryError);
        return await getCachedEntitlementState(serviceClient, userId);
      }
    }
    if (error instanceof RevenueCatSubscriberNotFoundError) {
      // Primary id was userId and RC doesn't know them — genuinely unknown.
      return {
        entitlementIdentifier: REVENUECAT_ENTITLEMENT_IDENTIFIER,
        isActive: false,
        subscriptionStatus: null,
        expiresAt: null,
        productIdentifier: null,
        source: 'live',
      };
    }
    // Transient/network error: fall open to lenient cache to avoid denying
    // paying users during RC outages.
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
