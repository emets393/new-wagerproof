import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface GrantEntitlementRequest {
  app_user_id: string;
  entitlement_identifier: string;
  duration?: string | null; // "1m", "1w", "1y", or null for lifetime
  end_time_ms?: number | null; // Optional specific expiration timestamp
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

    // Initialize Supabase clients
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
    let body: GrantEntitlementRequest;
    try {
      body = await req.json();
      console.log('Request body received:', JSON.stringify(body));
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid request body: ' + (parseError.message || 'Failed to parse JSON'));
    }

    const { app_user_id, entitlement_identifier, duration, end_time_ms } = body;

    if (!app_user_id || !entitlement_identifier) {
      console.error('Missing required fields:', { app_user_id, entitlement_identifier });
      throw new Error('Missing required fields: app_user_id and entitlement_identifier');
    }

    // For lifetime entitlements, neither duration nor end_time_ms is required
    // For other entitlements, either duration or end_time_ms should be provided
    // This validation is handled by the frontend, so we allow both to be undefined/null for lifetime

    // Get RevenueCat Secret API Key
    const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    if (!revenueCatSecretKey) {
      throw new Error('RevenueCat Secret API Key not configured');
    }

    // Prepare request body for RevenueCat API V1
    // duration parameter is deprecated - use end_time_ms instead
    const requestBody: any = {};
    
    console.log('Processing duration:', duration, 'end_time_ms:', end_time_ms);
    
    // Add end_time_ms if provided
    if (end_time_ms !== null && end_time_ms !== undefined) {
      console.log('Adding end_time_ms to requestBody:', end_time_ms);
      requestBody.end_time_ms = end_time_ms;
    }
    
    console.log('Final prepared request body:', JSON.stringify(requestBody));

    // First, ensure the subscriber exists in RevenueCat
    // If they don't exist, RevenueCat will create them automatically when we try to grant the entitlement
    // But we can also try to get/create them first to ensure they exist
    
    // Call RevenueCat REST API
    // Note: The promotional endpoint exists in V1 API
    // V2 API keys can sometimes work with V1 endpoints, but if not, you'll need a V1 key
    // URL encode the entitlement identifier to handle spaces
    const encodedEntitlementId = encodeURIComponent(entitlement_identifier);
    
    // Try V1 endpoint first (promotional endpoint is documented for V1)
    // If you have a V2 key, you may need to get a V1 key instead
    let revenueCatUrl = `https://api.revenuecat.com/v1/subscribers/${app_user_id}/entitlements/${encodedEntitlementId}/promotional`;
    
    console.log('Calling RevenueCat API:', revenueCatUrl);
    console.log('Final prepared request body before fetch:', JSON.stringify(requestBody));
    
    // Verify end_time_ms is present
    if (requestBody.end_time_ms) {
      console.log('✓ end_time_ms confirmed in requestBody:', requestBody.end_time_ms);
    } else {
      console.log('✗ WARNING: end_time_ms not in requestBody!');
    }
    
    const revenueCatResponse = await fetch(revenueCatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${revenueCatSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!revenueCatResponse.ok) {
      const errorText = await revenueCatResponse.text();
      console.error('RevenueCat API error:', revenueCatResponse.status, errorText);
      
      // If 404, try to get the subscriber first to create them, then retry
      if (revenueCatResponse.status === 404) {
        try {
          // Try to get the subscriber - this will create them if they don't exist
          const getSubscriberUrl = `https://api.revenuecat.com/v2/subscribers/${app_user_id}`;
          const getSubscriberResponse = await fetch(getSubscriberUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${revenueCatSecretKey}`,
            },
          });
          
          console.log('Get subscriber response:', getSubscriberResponse.status);
          
          // If subscriber was created or exists, retry the entitlement grant
          if (getSubscriberResponse.ok || getSubscriberResponse.status === 201) {
            console.log('Subscriber exists or was created, retrying entitlement grant...');
            const retryResponse = await fetch(revenueCatUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${revenueCatSecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              return new Response(
                JSON.stringify({
                  success: true,
                  message: 'Entitlement granted successfully',
                  data: retryData,
                }),
                {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 200,
                }
              );
            }
          }
        } catch (retryError) {
          console.error('Error during retry:', retryError);
        }
        
        // If retry failed, provide helpful error message
        const errorObj = JSON.parse(errorText || '{}');
        if (errorObj.type === 'resource_missing') {
          throw new Error(`Resource not found. The subscriber (user) may not exist in RevenueCat yet. The user should sign in to the app first to create their RevenueCat subscriber record, or the entitlement identifier "${entitlement_identifier}" may not exist in your RevenueCat project.`);
        }
      }
      
      throw new Error(`RevenueCat API error: ${revenueCatResponse.status} - ${errorText}`);
    }

    const revenueCatData = await revenueCatResponse.json();

    // Sync the updated entitlement to Supabase so it shows in admin panel
    try {
      // Get the updated subscriber info from RevenueCat
      const getSubscriberUrl = `https://api.revenuecat.com/v1/subscribers/${app_user_id}`;
      const getSubscriberResponse = await fetch(getSubscriberUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${revenueCatSecretKey}`,
        },
      });

      if (getSubscriberResponse.ok) {
        const subscriberData = await getSubscriberResponse.json();
        const subscriber = subscriberData.subscriber;
        
        console.log('Subscriber data from RevenueCat:', JSON.stringify(subscriber));
        
        // Check if the entitlement is active
        // RevenueCat API structure: subscriber.entitlements[entitlement_id] = { is_active: bool, expires_date: string, ... }
        const entitlement = subscriber?.entitlements?.[entitlement_identifier];
        console.log('Entitlement for', entitlement_identifier, ':', JSON.stringify(entitlement));
        
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
          // Determine subscription type from product identifier or duration parameter
          const productId = entitlement.product_identifier?.toLowerCase() || '';
          
          // First check product identifier
          if (productId.includes('monthly')) {
            subscriptionStatus = 'monthly';
          } else if (productId.includes('yearly') || productId.includes('annual')) {
            subscriptionStatus = 'yearly';
          } else if (productId.includes('lifetime')) {
            subscriptionStatus = 'lifetime';
          } else {
            // For promotional entitlements, use the duration parameter from the request
            // The frontend now sends: 'monthly', 'yearly', 'lifetime', or 'custom'
            console.log('Checking duration parameter for promotional entitlement:', duration);
            
            if (duration === 'monthly') {
              subscriptionStatus = 'monthly';
            } else if (duration === 'yearly') {
              subscriptionStatus = 'yearly';
            } else if (duration === 'lifetime') {
              subscriptionStatus = 'lifetime';
            } else if (duration === 'custom') {
              subscriptionStatus = 'promotional'; // Admin-granted with custom date
            } else {
              // Fallback for any other value
              subscriptionStatus = 'promotional';
            }
          }

          // Get expiration date
          if (entitlement.expires_date) {
            expiresAt = entitlement.expires_date;
            console.log('Using expires_date from entitlement:', expiresAt);
          } else if (end_time_ms) {
            // Use the end_time_ms we set
            expiresAt = new Date(end_time_ms).toISOString();
            console.log('Calculated expiresAt from end_time_ms:', expiresAt);
          }
          
          console.log('Determined subscription status:', subscriptionStatus, 'expires:', expiresAt, 'isActive:', isActive);
        } else {
          console.log('Entitlement is not active or does not exist');
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
        
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: subscriptionStatus,
            subscription_active: isActive,
            subscription_expires_at: expiresAt,
            revenuecat_customer_id: app_user_id,
          })
          .eq('user_id', app_user_id)
          .select();

        console.log('Update result - Data:', updateData, 'Error:', updateError);

        if (updateError) {
          console.error('!!! ERROR UPDATING SUPABASE !!!');
          console.error('Error details:', JSON.stringify(updateError, null, 2));
          // Don't fail the request if sync fails
        } else if (!updateData || updateData.length === 0) {
          console.error('!!! WARNING: No rows were updated !!!');
          console.error('This might mean the user_id does not exist in profiles table');
        } else {
          console.log('Successfully updated', updateData.length, 'profile(s)');
          console.log('Updated profile data:', JSON.stringify(updateData[0], null, 2));
        }
        console.log('================================');
      }
    } catch (syncError) {
      console.error('Error syncing to Supabase (non-critical):', syncError);
      // Don't fail the request if sync fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Entitlement granted successfully',
        data: revenueCatData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error granting entitlement:', error);
    const errorMessage = error?.message || 'Failed to grant entitlement';
    const statusCode = errorMessage?.includes('Unauthorized') ? 401 : 400;
    
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

