import { CustomerInfo } from '@revenuecat/purchases-js';
import { supabase } from '@/integrations/supabase/client';
import { ENTITLEMENT_IDENTIFIER, getActiveSubscriptionType } from '@/services/revenuecatWeb';
import debug from '@/utils/debug';

/**
 * Sync RevenueCat customer info to Supabase profiles table
 * This enables fast local checks without always calling RevenueCat API
 */
export async function syncRevenueCatToSupabase(
  userId: string,
  customerInfo: CustomerInfo
): Promise<void> {
  try {
    debug.log('Syncing RevenueCat data to Supabase for user:', userId);

    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER];
    const isActive = !!entitlement;
    
    let subscriptionStatus: string | null = null;
    let expiresAt: string | null = null;

    if (isActive && entitlement) {
      // Get subscription type
      const subType = getActiveSubscriptionType(customerInfo);
      subscriptionStatus = subType;

      // Get expiration date if available
      if (entitlement.expirationDate) {
        expiresAt = entitlement.expirationDate;
      }

      debug.log('Active subscription:', {
        status: subscriptionStatus,
        expiresAt,
      });
    } else {
      debug.log('No active subscription');
    }

    // Update Supabase profile
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: subscriptionStatus,
        subscription_active: isActive,
        subscription_expires_at: expiresAt,
        revenuecat_customer_id: customerInfo.originalAppUserId,
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

