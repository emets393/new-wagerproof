import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ONE-OFF repair (2026-08-15, see .claude/docs/03_payments_billing.md):
// the bridge-uppercase-entitlements promotional grants all hard-expired at
// 2026-08-15T00:00:00Z. RC fired EXPIRATION webhooks for the UPPERCASE twins
// and the (since-patched) revenuecat-webhook wrote subscription_active=false
// + revenuecat_customer_id=UPPERCASE onto 88 profiles of users whose REAL
// subscription on the lowercase id is still active. This function finds those
// rows by that exact fingerprint, re-probes RC on the lowercase identity, and
// restores the mirror. Idempotent; delete after the incident is closed.

const ENTITLEMENT_ID = Deno.env.get('REVENUECAT_ENTITLEMENT_IDENTIFIER') || 'WagerProof Pro';

// One-time invocation token for this repair run — the MCP deploy path can't
// set env secrets, so the gate lives in code. Function is corrective-only and
// idempotent; still, delete it once the incident is closed.
const REPAIR_TOKEN = 'e51c5781027e6172b662cbca8c7c23be9a4ac9d4a78dd0ce';

interface RcState {
  isActive: boolean;
  status: string | null;
  expiresAt: string | null;
}

async function probe(appUserId: string, rcKey: string): Promise<RcState | null> {
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${rcKey}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`RC ${res.status} for ${appUserId}: ${(await res.text()).slice(0, 120)}`);

  const data = await res.json();
  const ent = data?.subscriber?.entitlements?.[ENTITLEMENT_ID];
  let isActive = false;
  if (ent) {
    if ('is_active' in ent) isActive = ent.is_active === true;
    else if (ent.expires_date) isActive = new Date(ent.expires_date) > new Date();
    else isActive = true;
  }
  const productId = (ent?.product_identifier || '').toLowerCase();
  const status = !isActive ? null
    : productId.includes('monthly') ? 'monthly'
    : productId.includes('yearly') || productId.includes('annual') ? 'yearly'
    : productId.includes('lifetime') ? 'lifetime'
    : 'active';
  return { isActive, status, expiresAt: isActive ? ent?.expires_date ?? null : null };
}

serve(async (req) => {
  try {
    if (req.headers.get('x-repair-token') !== REPAIR_TOKEN) {
      return json(401, { error: 'Unauthorized' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const rcKey = Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '';
    if (!supabaseUrl || !serviceKey || !rcKey) return json(500, { error: 'Missing configuration' });

    let body: { dry_run?: boolean } = {};
    try { body = await req.json(); } catch { /* empty body = dry run */ }
    const dryRun = body.dry_run !== false; // default SAFE: dry run unless explicitly false

    const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // PostgREST can't compare a column to a transform of another column, so
    // page through ALL inactive rows and fingerprint in JS. ~3.6k rows total.
    const PAGE = 1000;
    const victims: Array<{ user_id: string; revenuecat_customer_id: string; discord_user_id: string | null }> = [];
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await db
        .from('profiles')
        .select('user_id, revenuecat_customer_id, discord_user_id')
        .eq('subscription_active', false)
        .not('revenuecat_customer_id', 'is', null)
        .order('user_id')
        .range(from, from + PAGE - 1);
      if (error) return json(500, { error: `profiles query failed: ${error.message}` });

      // Fingerprint of the incident write: the webhook stamped the UPPERCASE
      // uuid twin as the RC mirror while flipping the flag false.
      for (const r of rows || []) {
        const rc = String(r.revenuecat_customer_id);
        if (rc === String(r.user_id).toUpperCase() && rc !== rc.toLowerCase()) victims.push(r);
      }
      if (!rows || rows.length < PAGE) break;
    }

    const results = {
      candidates: victims.length,
      restored: 0,
      genuinely_lapsed: 0,
      not_in_rc: 0,
      failed: 0,
      errors: [] as string[],
      restored_discord_linked: 0,
    };
    const restoredSample: string[] = [];

    if (dryRun) {
      return json(200, { dry_run: true, ...results, sample: victims.slice(0, 5).map((v) => v.user_id) });
    }

    const BATCH = 8;
    for (let i = 0; i < victims.length; i += BATCH) {
      const batch = victims.slice(i, i + BATCH);
      await Promise.all(batch.map(async (v) => {
        const lower = String(v.user_id).toLowerCase();
        try {
          // Lowercase = canonical identity carrying the real store sub. The
          // uppercase twin only ever held the now-expired bridge grant, so
          // probing it again is pointless.
          const state = await probe(lower, rcKey);
          if (!state) { results.not_in_rc++; return; }
          if (!state.isActive) { results.genuinely_lapsed++; return; }

          const { error: upErr } = await db
            .from('profiles')
            .update({
              subscription_active: true,
              subscription_status: state.status ?? 'active',
              subscription_expires_at: state.expiresAt,
              revenuecat_customer_id: lower,
            })
            .eq('user_id', v.user_id);
          if (upErr) throw new Error(upErr.message);

          results.restored++;
          if (v.discord_user_id) results.restored_discord_linked++;
          if (restoredSample.length < 10) restoredSample.push(lower);
        } catch (e) {
          results.failed++;
          if (results.errors.length < 10) results.errors.push(`${lower}: ${String(e).slice(0, 120)}`);
        }
      }));
    }

    console.log('Uppercase-expiration repair:', JSON.stringify(results));
    return json(200, { dry_run: false, ...results, restored_sample: restoredSample });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
