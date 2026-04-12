// Backfill function to repair profiles whose revenuecat_customer_id column
// holds an anonymous RC id (`$RCAnonymousID:...`) instead of the canonical
// Supabase user uuid. This was introduced by an earlier mobile build that
// wrote `customerInfo.originalAppUserId` into the column — originalAppUserId
// is the ID that MADE the purchase, which for anonymous-before-login flows
// is the RC anonymous id, not the Supabase user id.
//
// For each affected profile we:
//   1. Fetch the RC subscriber by the Supabase user_id (NOT by the anonymous
//      id stored in the column). RC aliases mean the aliased subscriber
//      should resolve under the Supabase id if the alias merge worked.
//   2. If RC returns an active `WagerProof Pro` entitlement → the user is
//      genuinely paying; we update the profile mirror with the correct data
//      and most importantly overwrite revenuecat_customer_id with the
//      Supabase user_id so future webhook `.eq('user_id', appUserId)` writes
//      will match again.
//   3. If RC returns 404 or no entitlement → we also fetch by the anonymous
//      id. If the anonymous id DOES have an active entitlement, the purchase
//      is stranded because the alias merge failed. We record these for
//      manual RC-dashboard "Transfer to another app user id" repair.
//   4. Dry-run mode is supported via `{ dry_run: true }` in the POST body.
//      Default is dry-run so a missed auth doesn't mutate data by surprise.
//
// Auth: accepts either a valid admin JWT (has_role('admin') RPC) OR a
// shared secret passed via the `X-Backfill-Secret` header matching the
// INTERNAL_FUNCTION_SECRET env var. The shared-secret path is for CLI
// invocation from the repo (which doesn't have a user JWT).
//
// Usage (from repo root):
//   curl -X POST https://<project>.supabase.co/functions/v1/backfill-anonymous-rc-ids \
//     -H "X-Backfill-Secret: $INTERNAL_FUNCTION_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"dry_run": true, "limit": 500}'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ENTITLEMENT_IDENTIFIER = 'WagerProof Pro';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-backfill-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BackfillRequest {
  dry_run?: boolean;
  limit?: number;
  // If set, only process this specific Supabase user id. Useful for
  // targeted repairs during incident triage.
  only_user_id?: string;
}

interface ProfileRow {
  user_id: string;
  subscription_active: boolean | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  revenuecat_customer_id: string | null;
}

interface PerUserResult {
  user_id: string;
  prior_rc_id: string | null;
  prior_subscription_active: boolean | null;
  rc_lookup_status: 'found' | '404' | 'error';
  rc_has_active_entitlement: boolean;
  rc_subscription_type: string | null;
  rc_expires_at: string | null;
  anon_lookup_status?: 'found' | '404' | 'error';
  anon_has_active_entitlement?: boolean;
  action:
    | 'healed'
    | 'stranded'
    | 'cleared_stale_anon_id'
    | 'skipped_mirror_mismatch'
    | 'skipped_dry_run'
    | 'error';
  error?: string;
}

async function fetchRcSubscriber(
  appUserId: string,
  secretKey: string
): Promise<{ status: 'found'; subscriber: any } | { status: '404' } | { status: 'error'; error: string }> {
  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (res.status === 404) {
      return { status: '404' };
    }
    if (!res.ok) {
      return { status: 'error', error: `RC API ${res.status}: ${await res.text()}` };
    }
    const body = await res.json();
    return { status: 'found', subscriber: body?.subscriber ?? null };
  } catch (err: any) {
    return { status: 'error', error: err?.message ?? String(err) };
  }
}

function extractEntitlementState(subscriber: any): {
  isActive: boolean;
  subscriptionType: string | null;
  expiresAt: string | null;
} {
  const entitlement = subscriber?.entitlements?.[ENTITLEMENT_IDENTIFIER];
  if (!entitlement) return { isActive: false, subscriptionType: null, expiresAt: null };

  // RC's v1 subscriber endpoint includes expires_date on entitlements; a
  // future (or null, for lifetime) expires_date means active.
  let isActive = false;
  if ('is_active' in entitlement) {
    isActive = entitlement.is_active === true;
  } else if (entitlement.expires_date) {
    isActive = new Date(entitlement.expires_date) > new Date();
  } else {
    // No expiration = lifetime
    isActive = true;
  }

  let subscriptionType: string | null = null;
  if (isActive) {
    const productId = (entitlement.product_identifier ?? '').toLowerCase();
    if (productId.includes('monthly')) subscriptionType = 'monthly';
    else if (productId.includes('yearly') || productId.includes('annual')) subscriptionType = 'yearly';
    else if (productId.includes('lifetime')) subscriptionType = 'lifetime';
    else subscriptionType = 'active';
  }

  return {
    isActive,
    subscriptionType,
    expiresAt: entitlement.expires_date ?? null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    const internalSecret = Deno.env.get('BACKFILL_FUNCTION_SECRET');

    if (!revenueCatSecretKey) {
      return new Response(
        JSON.stringify({ error: 'REVENUECAT_SECRET_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth: either admin JWT or shared-secret header
    const backfillSecret = req.headers.get('x-backfill-secret');
    let authorized = false;

    if (internalSecret && backfillSecret === internalSecret) {
      authorized = true;
    } else {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (user) {
          const { data: isAdmin } = await supabaseAuth.rpc('has_role', {
            _user_id: user.id,
            _role: 'admin',
          });
          if (isAdmin) authorized = true;
        }
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Provide either admin JWT or X-Backfill-Secret header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    let body: BackfillRequest = {};
    try {
      if (req.headers.get('content-type')?.includes('application/json')) {
        body = await req.json();
      }
    } catch {
      // empty body = defaults
    }
    const dryRun = body.dry_run !== false; // default TRUE — safer
    const limit = Math.min(body.limit ?? 100, 500);
    const onlyUserId = body.only_user_id ?? null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find target profiles
    let query = supabase
      .from('profiles')
      .select('user_id, subscription_active, subscription_status, subscription_expires_at, revenuecat_customer_id')
      .like('revenuecat_customer_id', '$RCAnonymousID%');

    if (onlyUserId) {
      query = query.eq('user_id', onlyUserId);
    }

    query = query.limit(limit);

    const { data: profiles, error: selectError } = await query;
    if (selectError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch target profiles: ${selectError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: PerUserResult[] = [];
    let healedCount = 0;
    let strandedCount = 0;
    let clearedStaleCount = 0;
    let skippedMismatchCount = 0;
    let errorCount = 0;

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      const perUser: PerUserResult = {
        user_id: profile.user_id,
        prior_rc_id: profile.revenuecat_customer_id,
        prior_subscription_active: profile.subscription_active,
        rc_lookup_status: 'error',
        rc_has_active_entitlement: false,
        rc_subscription_type: null,
        rc_expires_at: null,
        action: 'error',
      };

      // 1. Look up by Supabase user id (where the entitlement SHOULD be if
      // the anonymous→identified alias merge worked).
      const rcResult = await fetchRcSubscriber(profile.user_id, revenueCatSecretKey);

      if (rcResult.status === 'found') {
        perUser.rc_lookup_status = 'found';
        const state = extractEntitlementState(rcResult.subscriber);
        perUser.rc_has_active_entitlement = state.isActive;
        perUser.rc_subscription_type = state.subscriptionType;
        perUser.rc_expires_at = state.expiresAt;

        if (state.isActive) {
          // HEALED: RC has the entitlement under the Supabase user id. Just
          // need to correct the mirror column so future webhook updates
          // match again.
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_active: true,
                subscription_status: state.subscriptionType,
                subscription_expires_at: state.expiresAt,
                revenuecat_customer_id: profile.user_id,
              })
              .eq('user_id', profile.user_id);
            if (updateError) {
              perUser.action = 'error';
              perUser.error = `Update failed: ${updateError.message}`;
              errorCount++;
            } else {
              perUser.action = 'healed';
              healedCount++;
            }
          } else {
            perUser.action = 'skipped_dry_run';
            healedCount++;
          }
          results.push(perUser);
          continue;
        }
      } else if (rcResult.status === '404') {
        perUser.rc_lookup_status = '404';
      } else {
        perUser.rc_lookup_status = 'error';
        perUser.error = rcResult.error;
      }

      // 2. Fallback: look up by the anonymous id stored in the column. If it
      // has an active entitlement, the purchase is stranded on the anonymous
      // id and needs manual RC-dashboard transfer.
      if (profile.revenuecat_customer_id) {
        const anonResult = await fetchRcSubscriber(
          profile.revenuecat_customer_id,
          revenueCatSecretKey
        );
        if (anonResult.status === 'found') {
          perUser.anon_lookup_status = 'found';
          const state = extractEntitlementState(anonResult.subscriber);
          perUser.anon_has_active_entitlement = state.isActive;
          if (state.isActive) {
            perUser.action = 'stranded';
            strandedCount++;
            results.push(perUser);
            continue;
          }
        } else {
          perUser.anon_lookup_status = anonResult.status === '404' ? '404' : 'error';
        }
      }

      // 3. No active entitlement anywhere. Two sub-cases:
      //
      //   (a) Mirror already says not-active (subscription_active=false or
      //       null). The anonymous id in the column is vestigial from a
      //       paywall interaction that never led to a real purchase. Safe to
      //       null it out so the SQL fail-open doesn't keep granting RLS
      //       access forever.
      //
      //   (b) Mirror says active but RC has no active entitlement. This is
      //       almost always an admin-granted / manually-flipped row, or a
      //       promotional entitlement that the RC v1 endpoint is not
      //       returning, or a refund-but-keep-access judgment call. DO NOT
      //       touch. Flag for manual review.
      if (profile.subscription_active === true) {
        perUser.action = 'skipped_mirror_mismatch';
        skippedMismatchCount++;
        results.push(perUser);
        continue;
      }

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ revenuecat_customer_id: null })
          .eq('user_id', profile.user_id);
        if (updateError) {
          perUser.action = 'error';
          perUser.error = `Clear failed: ${updateError.message}`;
          errorCount++;
        } else {
          perUser.action = 'cleared_stale_anon_id';
          clearedStaleCount++;
        }
      } else {
        perUser.action = 'skipped_dry_run';
        clearedStaleCount++;
      }
      results.push(perUser);
    }

    return new Response(
      JSON.stringify(
        {
          ok: true,
          dry_run: dryRun,
          scanned: results.length,
          summary: {
            healed: healedCount,
            stranded: strandedCount,
            cleared_stale_anon_id: clearedStaleCount,
            skipped_mirror_mismatch: skippedMismatchCount,
            errors: errorCount,
          },
          results,
        },
        null,
        2
      ),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Backfill handler error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
