import { CustomerInfo } from '@revenuecat/purchases-js';
import { supabase } from '@/integrations/supabase/client';
import { ENTITLEMENT_IDENTIFIER, getActiveSubscriptionType } from '@/services/revenuecatWeb';
import debug from '@/utils/debug';

/**
 * Sync RevenueCat Web Billing customer info to Supabase profiles.
 *
 * IMPORTANT: Web Billing looks up only the lowercase Supabase UUID. Store
 * purchases often live on a different RC identity ($RCAnonymousID or the
 * UPPERCASE twin). Never write subscription_active=false or overwrite
 * revenuecat_customer_id from a negative Web SDK result — that poisons the
 * mirror mobile/webhooks maintain and locks entitled users out of the site.
 */
export async function syncRevenueCatToSupabase(
  userId: string,
  customerInfo: CustomerInfo
): Promise<void> {
  try {
    debug.log('Syncing RevenueCat data to Supabase for user:', userId);

    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER];
    const isActive = !!entitlement;

    if (!isActive) {
      // Negative Web lookup is not authoritative for cross-platform buyers.
      debug.log('Skipping Supabase mirror write — Web SDK found no entitlement');
      return;
    }

    const subscriptionStatus = getActiveSubscriptionType(customerInfo);
    const expiresAt = entitlement.expirationDate ?? null;

    // Prefer the real RC identity when the Web SDK exposes it; otherwise keep
    // whatever mobile/webhook already stored (don't force the UUID).
    const rcAppUserId =
      (customerInfo as { originalAppUserId?: string; appUserId?: string }).originalAppUserId ||
      (customerInfo as { originalAppUserId?: string; appUserId?: string }).appUserId ||
      userId;

    debug.log('Active subscription:', {
      status: subscriptionStatus,
      expiresAt,
      rcAppUserId,
    });

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: subscriptionStatus,
        subscription_active: true,
        subscription_expires_at: expiresAt,
        revenuecat_customer_id: rcAppUserId,
      })
      .eq('user_id', userId);

    if (error) {
      debug.error('Error updating Supabase profile:', error);
      throw error;
    }

    debug.log('Successfully synced RevenueCat data to Supabase');
  } catch (error) {
    debug.error('Error syncing RevenueCat to Supabase:', error);
    // Don't throw - allow app to continue even if sync fails
  }
}

/**
 * Check if user has active subscription in Supabase (fallback/fast check)
 */
export async function checkSupabaseSubscription(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_active')
      .eq('user_id', userId)
      .single();

    if (error) {
      debug.error('Error checking Supabase subscription:', error);
      return false;
    }

    return data?.subscription_active ?? false;
  } catch (error) {
    debug.error('Error checking Supabase subscription:', error);
    return false;
  }
}

/**
 * Server-side multi-id RevenueCat resolve (lowercase / uppercase twin / stored
 * mirror id). Also rewrites profiles.subscription_active when live RC confirms.
 */
export async function resolveServerEntitlement(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('resolve-my-entitlement', {
      body: {},
    });

    if (error) {
      debug.error('resolve-my-entitlement invoke error:', error);
      return false;
    }

    const hasAccess = data?.hasPremiumAccess === true || data?.isAdmin === true;
    debug.log('Server entitlement resolve:', {
      hasAccess,
      source: data?.source,
    });
    return hasAccess;
  } catch (error) {
    debug.error('resolve-my-entitlement failed:', error);
    return false;
  }
}
