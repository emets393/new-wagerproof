import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// RevenueCat webhook event types we care about
const SUBSCRIPTION_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TRANSFER',
]);

const REVOCATION_EVENTS = new Set([
  'CANCELLATION',       // Refund/revocation (immediate loss of access)
  'EXPIRATION',         // Subscription expired
  'BILLING_ISSUE',      // Payment failed — still in grace period
]);

// Events we log but don't change subscription_active for
const INFO_ONLY_EVENTS = new Set([
  'SUBSCRIBER_ALIAS',
  'SUBSCRIPTION_PAUSED',
  'UNCANCELLATION',     // User re-enabled auto-renew — still active, no DB change needed
]);

const ENTITLEMENT_IDENTIFIER = Deno.env.get('REVENUECAT_ENTITLEMENT_IDENTIFIER') || 'WagerProof Pro';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  try {
    // Verify Authorization header if a webhook secret is configured.
    // RevenueCat sends this header with every POST when you set the
    // "Authorization header value" in the webhook config.
    const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_HEADER');
    if (expectedAuth) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== expectedAuth) {
        console.error('Invalid or missing Authorization header');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const body = await req.json();
    const event = body?.event;

    if (!event) {
      console.warn('Webhook received with no event payload');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const eventType: string = event.type;
    const appUserId: string | undefined = event.app_user_id;
    console.log(`RevenueCat webhook: ${eventType} for user ${appUserId}`);

    if (!appUserId) {
      console.warn('Webhook event missing app_user_id, skipping');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Info-only events — acknowledge but don't update DB
    if (INFO_ONLY_EVENTS.has(eventType)) {
      console.log(`Info-only event ${eventType}, no DB update needed`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // For subscription and revocation events, fetch fresh subscriber data from
    // RevenueCat API to get the authoritative entitlement state. The webhook
    // payload alone doesn't always include the full picture (e.g., user could
    // have multiple subscriptions, grace periods, etc.).
    const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    if (!revenueCatSecretKey) {
      console.error('REVENUECAT_SECRET_API_KEY not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    const subscriberRes = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: { 'Authorization': `Bearer ${revenueCatSecretKey}` },
      }
    );

    if (!subscriberRes.ok) {
      const errText = await subscriberRes.text();
      console.error(`RevenueCat API error fetching subscriber: ${subscriberRes.status} ${errText}`);
      // Return 500 so RevenueCat retries
      return new Response('Failed to fetch subscriber', { status: 500 });
    }

    const subscriberData = await subscriberRes.json();
    const subscriber = subscriberData.subscriber;
    const entitlement = subscriber?.entitlements?.[ENTITLEMENT_IDENTIFIER];

    // Determine active status
    let isActive = false;
    if (entitlement) {
      if ('is_active' in entitlement) {
        isActive = entitlement.is_active === true;
      } else if (entitlement.expires_date) {
        isActive = new Date(entitlement.expires_date) > new Date();
      } else {
        // No expiration = lifetime
        isActive = true;
      }
    }

    // Determine subscription type
    let subscriptionStatus: string | null = null;
    let expiresAt: string | null = null;

    if (isActive && entitlement) {
      const productId = (entitlement.product_identifier || '').toLowerCase();
      if (productId.includes('monthly')) {
        subscriptionStatus = 'monthly';
      } else if (productId.includes('yearly') || productId.includes('annual')) {
        subscriptionStatus = 'yearly';
      } else if (productId.includes('lifetime')) {
        subscriptionStatus = 'lifetime';
      } else {
        subscriptionStatus = 'active';
      }
      expiresAt = entitlement.expires_date || null;
    }

    // Update Supabase with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let resolvedUserId: string | null = null;

    if (isUuid(appUserId)) {
      const { data: profileByUserId, error: profileByUserIdError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', appUserId)
        .maybeSingle();

      if (profileByUserIdError) {
        console.error('Failed to resolve profile by user_id:', profileByUserIdError.message);
        return new Response('Database lookup failed', { status: 500 });
      }

      resolvedUserId = profileByUserId?.user_id ?? null;
    }

    if (!resolvedUserId) {
      const { data: profileByRevenueCatId, error: profileByRevenueCatIdError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('revenuecat_customer_id', appUserId)
        .maybeSingle();

      if (profileByRevenueCatIdError) {
        console.error('Failed to resolve profile by revenuecat_customer_id:', profileByRevenueCatIdError.message);
        return new Response('Database lookup failed', { status: 500 });
      }

      resolvedUserId = profileByRevenueCatId?.user_id ?? null;
    }

    if (!resolvedUserId) {
      console.error(`No profile found for app_user_id=${appUserId}. Returning 500 so RevenueCat retries.`);
      return new Response('Profile not found', { status: 500 });
    }

    const { data: updatedProfiles, error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_active: isActive,
        subscription_status: subscriptionStatus ?? (isActive ? 'active' : 'inactive'),
        subscription_expires_at: expiresAt,
        // Preserve the real RC identity (the app_user_id RC sent us) rather
        // than normalizing to the Supabase user_id. For stranded users whose
        // alias merge didn't propagate, only the anonymous id resolves in
        // RC's API — erasing it here breaks future event resolution AND
        // breaks server-side RC lookups. Mobile writes originalAppUserId
        // for the same reason; both writers converge on the real identity.
        revenuecat_customer_id: appUserId,
      })
      .eq('user_id', resolvedUserId)
      .select('user_id');

    if (updateError) {
      console.error('Failed to update profile:', updateError.message);
      // Return 500 so RevenueCat retries
      return new Response('Database update failed', { status: 500 });
    }

    if (!updatedProfiles || updatedProfiles.length === 0) {
      console.error(`Profile update matched 0 rows for resolved user ${resolvedUserId}. Returning 500 for retry.`);
      return new Response('No profile rows updated', { status: 500 });
    }

    console.log(`Updated subscription_active=${isActive} for user ${resolvedUserId} (event: ${eventType})`);

    return new Response(
      JSON.stringify({ ok: true, subscription_active: isActive }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
