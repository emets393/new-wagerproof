// Nightly grader for saved analysis "systems" (Systems leaderboard).
// Reads saved filters from the main project, replays each unique system against the
// warehouse *_system_rows RPC (the SAME filter engine the analytics pages use), and
// caches record/ROI/last-10/streak in analysis_system_performance + per-save
// since-saved records. See .claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md.
//
// Invoked daily by pg_cron (net.http_post with x-cron-secret) or manually.

import { createClient } from 'npm:@supabase/supabase-js@2';

const MAIN_URL = Deno.env.get('SUPABASE_URL')!;
const MAIN_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WH_URL = Deno.env.get('WAREHOUSE_URL')!;
const WH_KEY = Deno.env.get('WAREHOUSE_SERVICE_KEY')!;
const CRON_SECRET = Deno.env.get('GRADE_CRON_SECRET') ?? '';

type SportCfg = {
  table: string; rowsFn: string; gameKey: string;
  gameLevelTotals: string[]; teamTotals: string[]; sides: string[];
  orderCols: string[];
  dedupe: 'home_only' | 'home_preferred';
};
const SPORTS: Record<string, SportCfg> = {
  nfl: { table: 'nfl_analysis_saved_filters', rowsFn: 'nfl_system_rows', gameKey: 'unique_id',
    gameLevelTotals: ['fg_total', 'h1_total'], teamTotals: ['team_total'],
    sides: ['fg_spread', 'fg_ml', 'h1_spread', 'h1_ml'],
    orderCols: ['game_date', 'kickoff'], dedupe: 'home_only' },
  cfb: { table: 'cfb_analysis_saved_filters', rowsFn: 'cfb_system_rows', gameKey: 'unique_id',
    gameLevelTotals: ['fg_total', 'h1_total'], teamTotals: ['team_total'],
    sides: ['fg_spread', 'fg_ml', 'h1_spread', 'h1_ml'],
    orderCols: ['game_date'], dedupe: 'home_only' },
  mlb: { table: 'mlb_analysis_saved_filters', rowsFn: 'mlb_system_rows', gameKey: 'game_pk',
    gameLevelTotals: ['total', 'f5_total'], teamTotals: [],
    sides: ['ml', 'rl', 'f5_ml', 'f5_rl'],
    orderCols: ['game_date', 'time_et'], dedupe: 'home_preferred' },
};

type Row = {
  game_date: string; season: number; is_home: boolean;
  hit: number | null; bet_profit: number | null; under_profit: number | null;
  opp_hit: number | null; opp_profit: number | null;
  [k: string]: unknown;
};

const canonical = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
};

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Season the leaderboard calls "current": MLB = calendar year; NFL/CFB seasons span
// the new year, so Aug+ belongs to this year's season, Jan-Jul to last year's.
function currentSeason(sport: string): number {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const y = now.getFullYear();
  return sport === 'mlb' ? y : (now.getMonth() + 1 >= 8 ? y : y - 1);
}

// Per-row outcome from the SAVED verdict's perspective. null = push / ungradeable.
function outcome(r: Row, verdict: string): { win: boolean | null; profit: number | null } {
  if (verdict === 'team' || verdict === 'over') {
    return { win: r.hit === null ? null : r.hit === 1, profit: r.hit === null ? null : r.bet_profit };
  }
  if (verdict === 'under') {
    return { win: r.hit === null ? null : r.hit === 0, profit: r.hit === null ? null : r.under_profit };
  }
  // fade: graded by the mirror row's result at the mirror row's price
  return { win: r.opp_hit === null ? null : r.opp_hit === 1, profit: r.opp_hit === null ? null : r.opp_profit };
}

function agg(rows: Row[], verdict: string) {
  let wins = 0, losses = 0, pushes = 0, profitSum = 0, profitN = 0;
  for (const r of rows) {
    const o = outcome(r, verdict);
    if (o.win === null) { pushes++; continue; }
    o.win ? wins++ : losses++;
    if (o.profit !== null && o.profit !== undefined) { profitSum += Number(o.profit); profitN++; }
  }
  const n = wins + losses;
  return {
    n, wins, losses, pushes,
    hit_pct: n ? Math.round((wins / n) * 1000) / 10 : null,
    roi: profitN ? Math.round((profitSum / profitN) * 1000) / 10 : null,
    units: profitN ? Math.round(profitSum * 10) / 10 : null,
  };
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const main = createClient(MAIN_URL, MAIN_KEY);
  const summary: Record<string, unknown> = {};

  for (const [sport, cfg] of Object.entries(SPORTS)) {
    const { data: saves, error } = await main.from(cfg.table)
      .select('id, name, verdict, bet_type, rpc_bet_type, rpc_filters, created_at')
      .not('verdict', 'is', null).not('rpc_bet_type', 'is', null).not('rpc_filters', 'is', null);
    if (error) { summary[sport] = { error: error.message }; continue; }

    let graded = 0, skipped = 0;
    const byHash = new Map<string, typeof saves>();
    const hashMeta = new Map<string, { bt: string; verdict: string; filters: unknown }>();
    for (const s of saves ?? []) {
      const isTotal = cfg.gameLevelTotals.includes(s.rpc_bet_type) || cfg.teamTotals.includes(s.rpc_bet_type);
      const validVerdict = isTotal ? ['over', 'under'].includes(s.verdict) : ['team', 'fade'].includes(s.verdict);
      if (!validVerdict || !(cfg.sides.includes(s.rpc_bet_type) || isTotal)) { skipped++; continue; }
      const h = await sha256hex(`${sport}|${s.rpc_bet_type}|${s.verdict}|${canonical(s.rpc_filters)}`);
      if (!byHash.has(h)) { byHash.set(h, []); hashMeta.set(h, { bt: s.rpc_bet_type, verdict: s.verdict, filters: s.rpc_filters }); }
      byHash.get(h)!.push(s);
    }

    for (const [hash, group] of byHash) {
      const meta = hashMeta.get(hash)!;
      const sel = ['game_date', 'season', 'is_home', cfg.gameKey, 'hit', 'bet_profit', 'under_profit', 'opp_hit', 'opp_profit', ...cfg.orderCols];
      const order = cfg.orderCols.map((c) => `${c}.desc`).join(',');
      const resp = await fetch(
        `${WH_URL}/rest/v1/rpc/${cfg.rowsFn}?select=${[...new Set(sel)].join(',')}&order=${order}&limit=25000`,
        { method: 'POST', headers: { apikey: WH_KEY, Authorization: `Bearer ${WH_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_bet_type: meta.bt, p_filters: meta.filters }) },
      );
      if (!resp.ok) { skipped += group.length; continue; }
      let rows: Row[] = await resp.json();

      // one bet per GAME on game-level totals — mirror the page's dedupe exactly
      if (cfg.gameLevelTotals.includes(meta.bt)) {
        if (cfg.dedupe === 'home_only') rows = rows.filter((r) => r.is_home);
        else {
          const homes = new Set(rows.filter((r) => r.is_home).map((r) => String(r[cfg.gameKey])));
          rows = rows.filter((r) => r.is_home || !homes.has(String(r[cfg.gameKey])));
        }
      }

      const season = currentSeason(sport);
      const gradedRows = rows.filter((r) => outcome(r, meta.verdict).win !== null);
      const last10rows = gradedRows.slice(0, 10);
      let streakLen = 0; let streakKind: 'win' | 'loss' | null = null;
      for (const r of gradedRows) {
        const w = outcome(r, meta.verdict).win!;
        if (streakKind === null) { streakKind = w ? 'win' : 'loss'; streakLen = 1; }
        else if ((streakKind === 'win') === w) streakLen++;
        else break;
      }
      const cache = {
        sport, filters_hash: hash, rpc_bet_type: meta.bt, verdict: meta.verdict,
        rpc_filters: meta.filters,
        all_time: agg(rows, meta.verdict),
        current_season: agg(rows.filter((r) => r.season === season), meta.verdict),
        season_label: season,
        last10: { n: last10rows.length,
          wins: last10rows.filter((r) => outcome(r, meta.verdict).win).length,
          results: last10rows.map((r) => (outcome(r, meta.verdict).win ? 1 : 0)) },
        streak: streakKind ? { kind: streakKind, len: streakLen } : null,
        graded_at: new Date().toISOString(),
      };
      const up = await main.from('analysis_system_performance').upsert(cache, { onConflict: 'sport,filters_hash' });
      if (up.error) { skipped += group.length; continue; }

      for (const s of group) {
        const savedDate = String(s.created_at).slice(0, 10);
        const since = agg(rows.filter((r) => r.game_date >= savedDate), s.verdict);
        await main.from(cfg.table).update({ filters_hash: hash, since_saved: since, graded_at: new Date().toISOString() })
          .eq('id', s.id);
        graded++;
      }
    }
    summary[sport] = { saves: (saves ?? []).length, systems: byHash.size, graded, skipped };
  }
  return new Response(JSON.stringify({ ok: true, summary }), { headers: { 'Content-Type': 'application/json' } });
});
