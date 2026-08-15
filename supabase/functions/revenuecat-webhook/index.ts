import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// NOTE: this webhook deliberately does NOT send conversions to Meta.
// RevenueCat's own Facebook integration (configured in the RC dashboard) is the
// single source of truth for Subscribe/StartTrial. Adding a second server-side
// sender here would double-count every subscription — the two have no shared
// `event_id`, so Meta cannot deduplicate them.
// See .claude/docs/18_meta_attribution.md.

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

interface EntitlementProbe {
  appUserId: string;
  isActive: boolean;
  entitlement: any | null;
}

// Fetch one RC identity's entitlement state. Returns null on 404 (identity
// doesn't exist in RC — caller tries the next candidate); throws on any other
// failure so the webhook 500s and RC retries instead of writing a wrong state.
async function probeIdentity(appUserId: string, secretKey: string): Promise<EntitlementProbe | null> {
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { 'Authorization': `Bearer ${secretKey}` } }
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`RevenueCat API error for ${appUserId}: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const entitlement = data?.subscriber?.entitlements?.[ENTITLEMENT_IDENTIFIER] ?? null;

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

  return { appUserId, isActive, entitlement };
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

    const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    if (!revenueCatSecretKey) {
      console.error('REVENUECAT_SECRET_API_KEY not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    // Update Supabase with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Resolve the profile FIRST so we know every RC identity this user can
    // hold before deciding they lost access.
    let resolvedUserId: string | null = null;
    let storedRcId: string | null = null;

    if (isUuid(appUserId)) {
      const { data: profileByUserId, error: profileByUserIdError } = await supabase
        .from('profiles')
        .select('user_id, revenuecat_customer_id')
        .eq('user_id', appUserId)
        .maybeSingle();

      if (profileByUserIdError) {
        console.error('Failed to resolve profile by user_id:', profileByUserIdError.message);
        return new Response('Database lookup failed', { status: 500 });
      }

      resolvedUserId = profileByUserId?.user_id ?? null;
      storedRcId = profileByUserId?.revenuecat_customer_id ?? null;
    }

    if (!resolvedUserId) {
      const { data: profileByRevenueCatId, error: profileByRevenueCatIdError } = await supabase
        .from('profiles')
        .select('user_id, revenuecat_customer_id')
        .eq('revenuecat_customer_id', appUserId)
        .maybeSingle();

      if (profileByRevenueCatIdError) {
        console.error('Failed to resolve profile by revenuecat_customer_id:', profileByRevenueCatIdError.message);
        return new Response('Database lookup failed', { status: 500 });
      }

      resolvedUserId = profileByRevenueCatId?.user_id ?? null;
      storedRcId = profileByRevenueCatId?.revenuecat_customer_id ?? null;
    }

    if (!resolvedUserId) {
      console.error(`No profile found for app_user_id=${appUserId}. Returning 500 so RevenueCat retries.`);
      return new Response('Profile not found', { status: 500 });
    }

    // A user's subscription can live under several RC identities (canonical
    // lowercase uuid, an $RCAnonymousID mirror, or the UPPERCASE uuid twin
    // from the iOS <=3.5.6 case incident — see 03_payments_billing.md).
    // The event identity alone is NOT authoritative: on 2026-08-15 a wave of
    // EXPIRATION events for uppercase twins (lapsed bridge grants) marked 88
    // users with live lowercase subscriptions as unsubscribed. Probe every
    // identity and take the first ACTIVE one before ever writing false.
    const candidates = [...new Set([
      appUserId,
      resolvedUserId,
      resolvedUserId.toUpperCase(),
      ...(storedRcId ? [storedRcId] : []),
    ])];

    let winner: EntitlementProbe | null = null;
    let firstResolved: EntitlementProbe | null = null;

    for (const candidateId of candidates) {
      const probe = await probeIdentity(candidateId, revenueCatSecretKey);
      if (!probe) continue; // 404 — identity unknown to RC
      if (probe.isActive) {
        winner = probe;
        break;
      }
      firstResolved = firstResolved ?? probe;
    }

    // No identity is active; fall back to the first identity RC knows about
    // (usually the event's own) so status/expiry reflect the real lapsed state.
    if (!winner) winner = firstResolved;

    const isActive = winner?.isActive === true;
    const entitlement = winner?.entitlement ?? null;

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

    // Mirror the RC identity that actually carries the entitlement when one is
    // active; otherwise preserve the event identity — for stranded users whose
    // alias merge didn't propagate, only the anonymous id resolves in RC's API,
    // and erasing it breaks future event resolution AND server-side lookups.
    const mirrorRcId = isActive && winner ? winner.appUserId : appUserId;

    const { data: updatedProfiles, error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_active: isActive,
        subscription_status: subscriptionStatus ?? (isActive ? 'active' : 'inactive'),
        subscription_expires_at: expiresAt,
        revenuecat_customer_id: mirrorRcId,
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

    const via = winner && winner.appUserId !== appUserId ? ` (resolved via ${winner.appUserId})` : '';
    console.log(`Updated subscription_active=${isActive} for user ${resolvedUserId} (event: ${eventType})${via}`);

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
