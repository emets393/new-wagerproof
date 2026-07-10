import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ONE-OFF incident bridge (2026-07, see .claude/docs/03_payments_billing.md):
// iOS <=3.5.6 logs into RevenueCat with the UPPERCASE Supabase uuid, which is a
// separate, entitlement-less RC customer — paying users see the paywall/locked
// Pro surfaces. Until the fixed build clears App Store review, mirror every
// currently-entitled user's access onto their uppercase RC twin as a
// promotional grant with a hard end date. Ghost customers created for non-iOS
// users are harmless and expire with the grant. Delete this function once the
// fixed build has adoption.

const ENTITLEMENT_ID = Deno.env.get('REVENUECAT_ENTITLEMENT_IDENTIFIER') || 'WagerProof Pro';

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const rcKey = Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '';
    if (!supabaseUrl || !serviceKey || !rcKey) {
      return json(500, { error: 'Missing configuration' });
    }

    // Internal-only: same auth contract as enqueue-auto-generation-runs-v3.
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
    const providedSecret = req.headers.get('x-internal-secret') ?? '';
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    if (!((internalSecret && providedSecret === internalSecret) || bearer === serviceKey)) {
      return json(401, { error: 'Unauthorized' });
    }

    let body: { dry_run?: boolean; end_time_ms?: number; limit?: number } = {};
    try { body = await req.json(); } catch { /* empty body = dry run */ }
    const dryRun = body.dry_run !== false; // default SAFE: dry run unless explicitly false
    const endTimeMs = body.end_time_ms ?? Date.UTC(2026, 7, 15); // 2026-08-15T00:00:00Z
    const limit = Math.min(body.limit ?? 1000, 2000);

    const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: profiles, error } = await db
      .from('profiles')
      .select('user_id, subscription_status, subscription_active, subscription_expires_at')
      .eq('subscription_active', true)
      .or('subscription_expires_at.is.null,subscription_expires_at.gt.now()')
      .limit(limit);
    if (error) return json(500, { error: `profiles query failed: ${error.message}` });

    const candidates = (profiles || []).filter((p) => {
      const upper = String(p.user_id).toUpperCase();
      // Skip ids with no letters (upper === lower would hit the REAL customer)
      // and the one user whose store purchase already lives on the uppercase id.
      if (upper === String(p.user_id)) return false;
      if (String(p.user_id) === '6667da14-1a30-41ac-86ea-93b370f0d7f2') return false;
      return true;
    });

    if (dryRun) {
      return json(200, {
        dry_run: true,
        entitlement: ENTITLEMENT_ID,
        end_time: new Date(endTimeMs).toISOString(),
        would_grant: candidates.length,
        by_status: countBy(candidates.map((c) => c.subscription_status ?? 'null')),
        sample: candidates.slice(0, 5).map((c) => ({ ...c, rc_target: String(c.user_id).toUpperCase() })),
      });
    }

    // Live: grant sequentially in small parallel batches — RC v1 tolerates this
    // fine and the function stays well inside the edge wall-clock limit.
    const encodedEnt = encodeURIComponent(ENTITLEMENT_ID);
    const results = { granted: 0, failed: 0, errors: [] as string[] };
    const BATCH = 8;
    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      await Promise.all(batch.map(async (p) => {
        const rcId = String(p.user_id).toUpperCase();
        try {
          const res = await fetch(
            `https://api.revenuecat.com/v1/subscribers/${rcId}/entitlements/${encodedEnt}/promotional`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${rcKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ end_time_ms: endTimeMs }),
            },
          );
          if (res.ok) {
            results.granted++;
          } else {
            results.failed++;
            if (results.errors.length < 10) {
              results.errors.push(`${rcId}: ${res.status} ${(await res.text()).slice(0, 120)}`);
            }
          }
        } catch (e) {
          results.failed++;
          if (results.errors.length < 10) results.errors.push(`${rcId}: ${String(e).slice(0, 120)}`);
        }
      }));
    }

    return json(200, {
      dry_run: false,
      entitlement: ENTITLEMENT_ID,
      end_time: new Date(endTimeMs).toISOString(),
      candidates: candidates.length,
      ...results,
    });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] || 0) + 1;
  return out;
}
