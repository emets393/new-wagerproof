// Authenticated proxy for football_model_record (owner call 2026-08-31).
//
// The raw table on the CFB project is SERVER-ONLY: its depth (edge-bucket and
// per-team splits) must not be readable with the shipped anon key, which
// external consumers (Pick Don) also hold. Signed-in app users get the full
// splits through this function instead — the platform verifies the MAIN-project
// JWT before we run (verify_jwt default), then we query CFB with the service
// key. The overall records stay embedded in football_regression_reports.summary
// as the sanctioned public surface.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const cfbUrl = Deno.env.get('CFB_SUPABASE_URL');
  const cfbKey = Deno.env.get('CFB_SUPABASE_SERVICE_KEY');
  if (!cfbUrl || !cfbKey) {
    return new Response(JSON.stringify({ error: 'CFB credentials not configured' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  let sport = 'cfb';
  try {
    const body = await req.json();
    if (body?.sport === 'nfl' || body?.sport === 'cfb') sport = body.sport;
  } catch { /* default cfb */ }

  const q = `${cfbUrl}/rest/v1/football_model_record` +
    `?sport=eq.${sport}&scope=in.(edge,team)` +
    `&select=season,market,scope,scope_key,wins,losses,pushes,n,roi_units,through_week` +
    `&order=season.desc,scope,market,scope_key&limit=2000`;
  const r = await fetch(q, { headers: { apikey: cfbKey, Authorization: `Bearer ${cfbKey}` } });
  if (!r.ok) {
    return new Response(JSON.stringify({ error: `upstream ${r.status}` }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  const rows = await r.json();
  // Latest season only — the table accretes seasons; the page shows the current one.
  const latest = rows.length ? Math.max(...rows.map((x: { season: number }) => x.season)) : null;
  return new Response(JSON.stringify({
    season: latest,
    rows: rows.filter((x: { season: number }) => x.season === latest),
  }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
