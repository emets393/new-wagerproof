import { supabase } from '@/integrations/supabase/client';

export type EntitlementDuration = 'monthly' | 'yearly' | 'lifetime' | 'custom';

export interface GrantEntitlementParams {
  app_user_id: string;
  entitlement_identifier: string;
  duration?: EntitlementDuration;
  end_time_ms?: number | null;
}

export interface GrantEntitlementResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

/**
 * Convert duration type to RevenueCat API format
 * RevenueCat V1 API accepts enum values like "monthly", "yearly", not "1m", "1y"
 */
export function getDurationString(duration: EntitlementDuration): string | null {
  switch (duration) {
    case 'monthly':
      return 'monthly'; // RevenueCat enum value
    case 'yearly':
      return 'yearly'; // RevenueCat enum value
    case 'lifetime':
      return 'lifetime'; // RevenueCat enum value for no expiration
    case 'custom':
      return null; // Will use end_time_ms instead
    default:
      return null;
  }
}

/**
 * Calculate end_time_ms from a Date object
 */
export function getEndTimeMs(date: Date): number {
  return date.getTime();
}

/**
 * Grant an entitlement to a user via RevenueCat REST API
 */
/**
 * Get raw RevenueCat subscriber data for debugging
 * Returns the full subscriber object from RevenueCat
 */
export async function getRevenueCatRawData(
  app_user_id: string
): Promise<any> {
  try {
    console.log('=== FETCHING RAW REVENUECAT DATA ===');
    console.log('App User ID:', app_user_id);
    
    const { data, error } = await supabase.functions.invoke('sync-revenuecat-user', {
      body: {
        app_user_id,
        entitlement_identifier: 'WagerProof Pro', // Still needed for the function
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch RevenueCat data');
    }

    return data;
  } catch (error: any) {
    console.error('Error fetching raw RevenueCat data:', error);
    throw error;
  }
}

/**
 * Sync RevenueCat data for a specific user to Supabase
 * This fetches the latest customer info from RevenueCat and updates the Supabase profile
 */
export async function syncRevenueCatUser(
  app_user_id: string,
  entitlement_identifier: string
): Promise<GrantEntitlementResponse> {
  try {
    console.log('=== SYNC REVENUECAT USER ===');
    console.log('App User ID:', app_user_id);
    console.log('Entitlement ID:', entitlement_identifier);
    console.log('===========================');
    
    const { data, error } = await supabase.functions.invoke('sync-revenuecat-user', {
      body: {
        app_user_id,
        entitlement_identifier,
      },
    });

    console.log('=== SYNC RESPONSE ===');
    console.log('Data:', JSON.stringify(data, null, 2));
    console.log('Error:', error);
    console.log('====================');

    if (error) {
      console.error('Sync error:', error);
      const errorMessage = error.message || (data as any)?.error || 'Failed to sync RevenueCat data';
      throw new Error(errorMessage);
    }

    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      const errorMessage = (data as any).error || 'Failed to sync RevenueCat data';
      throw new Error(errorMessage);
    }

    return data as GrantEntitlementResponse;
  } catch (error: any) {
    console.error('Error syncing RevenueCat user:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync RevenueCat data',
    };
  }
}

/**
 * Grant an entitlement to a user via RevenueCat REST API
 */
export async function grantEntitlement(
  params: GrantEntitlementParams
): Promise<GrantEntitlementResponse> {
  try {
    const { app_user_id, entitlement_identifier, duration, end_time_ms } = params;

    // Prepare request body
    // We send both duration (for status tracking) and end_time_ms (for RevenueCat API)
    const requestBody: any = {
      app_user_id,
      entitlement_identifier,
      duration, // Include duration so edge function knows what type of subscription to set
    };

    // Calculate end_time_ms based on duration type
    let calculatedEndTimeMs: number | null = null;
    
    if (duration === 'custom' && end_time_ms) {
      // Custom: use the provided end_time_ms
      calculatedEndTimeMs = end_time_ms;
    } else if (duration === 'monthly') {
      // Monthly: current time + 30 days
      const now = Date.now();
      calculatedEndTimeMs = now + (30 * 24 * 60 * 60 * 1000); // 30 days in ms
    } else if (duration === 'yearly') {
      // Yearly: current time + 365 days
      const now = Date.now();
      calculatedEndTimeMs = now + (365 * 24 * 60 * 60 * 1000); // 365 days in ms
    } else if (duration === 'lifetime') {
      // Lifetime: set to year 2100 (99 years from now)
      const now = Date.now();
      calculatedEndTimeMs = now + (99 * 365 * 24 * 60 * 60 * 1000);
    }
    
    // Add end_time_ms to request body if calculated
    if (calculatedEndTimeMs !== null) {
      requestBody.end_time_ms = calculatedEndTimeMs;
    }

    // Call Supabase Edge Function
    console.log('=== GRANT ENTITLEMENT REQUEST ===');
    console.log('App User ID:', app_user_id);
    console.log('Entitlement ID:', entitlement_identifier);
    console.log('Duration:', duration);
    console.log('End Time MS:', calculatedEndTimeMs);
    console.log('Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('================================');
    
    const { data, error } = await supabase.functions.invoke('grant-entitlement', {
      body: requestBody,
    });

    console.log('=== EDGE FUNCTION RESPONSE ===');
    console.log('Data:', JSON.stringify(data, null, 2));
    console.log('Error:', error);
    console.log('=============================');

    if (error) {
      console.error('Edge function error:', error);
      // If error has a message, use it; otherwise try to extract from data
      const errorMessage = error.message || (data as any)?.error || 'Failed to grant entitlement';
      throw new Error(errorMessage);
    }

    // Check if the response indicates failure
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      const errorMessage = (data as any).error || 'Failed to grant entitlement';
      throw new Error(errorMessage);
    }

    return data as GrantEntitlementResponse;
  } catch (error: any) {
    console.error('Error granting entitlement:', error);
    return {
      success: false,
      error: error.message || 'Failed to grant entitlement',
    };
  }
}

