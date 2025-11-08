import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface SyncUserRequest {
  app_user_id: string;
  entitlement_identifier: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // First, create a client with user auth to verify admin status
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      throw new Error('Unauthorized: Invalid or missing user');
    }

    // Verify admin status
    const { data: isAdmin, error: adminError } = await supabaseAuth
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (adminError || !isAdmin) {
      console.error('Admin check error:', adminError, 'isAdmin:', isAdmin);
      throw new Error('Unauthorized: Admin access required');
    }
    
    // Now create a service role client for database updates
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body
    let body: SyncUserRequest;
    try {
      body = await req.json();
      console.log('Sync request for user:', body.app_user_id);
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid request body');
    }

    const { app_user_id, entitlement_identifier } = body;

    if (!app_user_id || !entitlement_identifier) {
      throw new Error('Missing required fields: app_user_id and entitlement_identifier');
    }

    // Get RevenueCat Secret API Key
    const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    if (!revenueCatSecretKey) {
      throw new Error('RevenueCat Secret API Key not configured');
    }

    console.log('Fetching subscriber info from RevenueCat...');
    
    // Fetch the latest subscriber data from RevenueCat
    const getSubscriberUrl = `https://api.revenuecat.com/v1/subscribers/${app_user_id}`;
    const getSubscriberResponse = await fetch(getSubscriberUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${revenueCatSecretKey}`,
      },
    });

    if (!getSubscriberResponse.ok) {
      const errorText = await getSubscriberResponse.text();
      console.error('RevenueCat API error:', getSubscriberResponse.status, errorText);
      
      if (getSubscriberResponse.status === 404) {
        throw new Error('User not found in RevenueCat. They may need to sign in to the app first.');
      }
      
      throw new Error(`RevenueCat API error: ${getSubscriberResponse.status} - ${errorText}`);
    }

    const subscriberData = await getSubscriberResponse.json();
    const subscriber = subscriberData.subscriber;
    
    console.log('=== FULL SUBSCRIBER DATA ===');
    console.log(JSON.stringify(subscriber, null, 2));
    console.log('===========================');
    
    console.log('=== AVAILABLE ENTITLEMENTS ===');
    if (subscriber?.entitlements) {
      console.log('All entitlement keys:', Object.keys(subscriber.entitlements));
      for (const [key, value] of Object.entries(subscriber.entitlements)) {
        console.log(`Entitlement "${key}":`, JSON.stringify(value, null, 2));
      }
    } else {
      console.log('No entitlements found in subscriber data');
    }
    console.log('==============================');
    
    // Check if the entitlement is active
    const entitlement = subscriber?.entitlements?.[entitlement_identifier];
    console.log('Looking for entitlement identifier:', entitlement_identifier);
    console.log('Found entitlement:', JSON.stringify(entitlement, null, 2));
    
    // Determine if entitlement is active
    // Some API responses don't include is_active field, so we need to infer it
    let isActive = false;
    
    if (entitlement) {
      // Check if is_active field exists and use it
      if ('is_active' in entitlement) {
        isActive = entitlement.is_active === true;
        console.log('Using is_active field:', isActive);
      } else {
        // If is_active field doesn't exist, infer from expiration date
        if (entitlement.expires_date) {
          const expiresDate = new Date(entitlement.expires_date);
          const now = new Date();
          isActive = expiresDate > now;
          console.log('Inferred active status from expiration:', isActive, 'Expires:', expiresDate, 'Now:', now);
        } else {
          // No expiration date = lifetime entitlement
          isActive = true;
          console.log('No expiration date found, assuming lifetime/active');
        }
      }
    }
    
    let subscriptionStatus: string | null = null;
    let expiresAt: string | null = null;

    if (isActive && entitlement) {
      // Determine subscription type from product identifier
      const productId = entitlement.product_identifier?.toLowerCase() || '';
      
      console.log('Product ID:', productId);
      
      // Check product identifier
      if (productId.includes('monthly')) {
        subscriptionStatus = 'monthly';
      } else if (productId.includes('yearly') || productId.includes('annual')) {
        subscriptionStatus = 'yearly';
      } else if (productId.includes('lifetime')) {
        subscriptionStatus = 'lifetime';
      } else {
        // For promotional entitlements without clear product ID
        // Check if there's an expiration date
        if (entitlement.expires_date) {
          const expiresDate = new Date(entitlement.expires_date);
          const now = new Date();
          const daysUntilExpiration = (expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          
          console.log('Days until expiration:', daysUntilExpiration);
          
          // Heuristic: if it expires in more than 200 days, probably yearly or lifetime
          if (daysUntilExpiration > 10000) { // ~27 years
            subscriptionStatus = 'lifetime';
          } else if (daysUntilExpiration > 200) {
            subscriptionStatus = 'yearly';
          } else if (daysUntilExpiration > 20) {
            subscriptionStatus = 'monthly';
          } else {
            subscriptionStatus = 'promotional';
          }
        } else {
          // No expiration date = lifetime
          subscriptionStatus = 'lifetime';
        }
      }

      // Get expiration date
      if (entitlement.expires_date) {
        expiresAt = entitlement.expires_date;
        console.log('Expires at:', expiresAt);
      }
      
      console.log('Determined subscription status:', subscriptionStatus, 'isActive:', isActive);
    } else {
      console.log('No active entitlement found');
    }

    // Update Supabase profile
    console.log('=== UPDATING SUPABASE PROFILE ===');
    console.log('User ID:', app_user_id);
    console.log('Update data:', {
      subscription_status: subscriptionStatus,
      subscription_active: isActive,
      subscription_expires_at: expiresAt,
      revenuecat_customer_id: app_user_id,
    });
    
    const { data: updateData, error: updateError, count } = await supabase
      .from('profiles')
      .update({
        subscription_status: subscriptionStatus,
        subscription_active: isActive,
        subscription_expires_at: expiresAt,
        revenuecat_customer_id: app_user_id,
      })
      .eq('user_id', app_user_id)
      .select();

    console.log('Update result - Data:', updateData, 'Error:', updateError, 'Count:', count);

    if (updateError) {
      console.error('!!! ERROR UPDATING SUPABASE !!!');
      console.error('Error details:', JSON.stringify(updateError, null, 2));
      throw new Error(`Failed to update Supabase: ${updateError.message}`);
    }

    if (!updateData || updateData.length === 0) {
      console.error('!!! WARNING: No rows were updated !!!');
      console.error('This might mean the user_id does not exist in profiles table');
      throw new Error(`No profile found for user_id: ${app_user_id}`);
    }

    console.log('Successfully updated', updateData.length, 'profile(s)');
    console.log('Updated profile data:', JSON.stringify(updateData[0], null, 2));
    console.log('================================');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'RevenueCat data synced successfully',
        data: {
          subscription_status: subscriptionStatus,
          subscription_active: isActive,
          subscription_expires_at: expiresAt,
          revenuecat_customer_id: app_user_id,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error syncing RevenueCat data:', error);
    const errorMessage = error?.message || 'Failed to sync RevenueCat data';
    const statusCode = errorMessage?.includes('Unauthorized') ? 401 : errorMessage?.includes('not found') ? 404 : 400;
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error?.stack || undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    );
  }
});

