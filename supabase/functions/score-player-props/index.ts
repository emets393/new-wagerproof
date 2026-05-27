// score-player-props
// ==================
// Server-side scorer for the WagerProof Best Picks Report.
//
// Triggered by the MLB Hourly Runner workflow (cfb_automation) at the END
// of each cycle. For each game that mlb_games_ready_for_picks(date) marks
// as "all inputs present", we:
//   1. Call get_mlb_player_props_l10(game_pk) for prop ladders + L10 games.
//   2. Pull batter splits + recent_form for that game's lineups.
//   3. Pull pitcher arsenal/batted_ball/archetype/recent_starts for the SPs.
//   4. Pull the league-percentile benchmarks vs each pitcher hand.
//   5. Run the SAME scoring as src/utils/dailyPropsReport.ts (re-implemented
//      below as pure functions — no React Query, no hooks).
//   6. Pass the resulting picks to snapshot_player_prop_picks RPC, which
//      enforces locking + algo-version guarding.
//
// Single source of truth for picks. Clients just read mlb_player_prop_picks
// — no more client-side compute polluting the table on each page-load.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ────────────────────────────────────────────────────────────────────────
// Algorithm version — must match src/utils/dailyPropsReport.ts
const ALGO_VERSION = 5;

// Tier cutoffs (same as the client-side algo)
function tierOf(score: number): 'elite' | 'strong' | 'lean' | null {
  if (score >= 80) return 'elite';
  if (score >= 70) return 'strong';
  if (score >= 60) return 'lean';
  return null;
}
function emojiFor(t: 'elite' | 'strong' | 'lean'): string {
  return t === 'elite' ? '🔥' : t === 'strong' ? '⭐' : '👍';
}

const MAX_NEGATIVE_ODDS = -180;

const MARKET_LABELS: Record<string, string> = {
  batter_home_runs: 'Home Runs',
  batter_hits: 'Hits',
  batter_total_bases: 'Total Bases',
  batter_rbis: 'RBIs',
  batter_hits_runs_rbis: 'H+R+RBI',
  batter_walks: 'Batter Walks',
  batter_strikeouts: 'Batter K',
  pitcher_strikeouts: 'Pitcher K',
  pitcher_hits_allowed: 'Hits Allowed',
  pitcher_walks: 'Pitcher Walks',
  pitcher_outs: 'Outs',
};
const marketLabel = (m: string) => MARKET_LABELS[m] ?? m;

type Side = 'over' | 'under';
type Split = { over: number; games: number; pct: number | null };
interface PropComputed {
  line: number;
  overOdds: number | null;
  underOdds: number | null;
  l10: Split;
  contextualDayNight: Split | null;
  contextualArchetype: Split | null;
}

// ────────────────────────────────────────────────────────────────────────
// Scoring helpers (ported 1:1 from dailyPropsReport.ts)

function hitSplit(games: { v: number }[], line: number, max?: number): Split {
  const subset = max != null ? games.slice(0, max) : games;
  const n = subset.length;
  const over = subset.filter(g => g.v > line).length;
  return { over, games: n, pct: n > 0 ? Math.round((over / n) * 100) : null };
}

function flipSplit(s: Split | null): Split | null {
  if (!s) return null;
  const newOver = Math.max(0, s.games - s.over);
  return { over: newOver, games: s.games, pct: s.games > 0 ? Math.round((newOver / s.games) * 100) : null };
}

function sideSplits(c: PropComputed, side: Side) {
  if (side === 'over') {
    return { l10: c.l10, dn: c.contextualDayNight, arch: c.contextualArchetype };
  }
  return {
    l10: flipSplit(c.l10) ?? c.l10,
    dn: flipSplit(c.contextualDayNight),
    arch: flipSplit(c.contextualArchetype),
  };
}

function defaultLine(lines: { line: number; over: number | null; under: number | null }[]): number | null {
  if (lines.length === 0) return null;
  const fair = lines.find(l => l.over != null && l.over >= -180);
  if (fair) return fair.line;
  return lines[lines.length - 1].line;
}

function pctBucket(value: number | null, bench: any, lowerIsBetter = false): 'elite' | 'good' | 'neutral' | 'poor' {
  if (value == null || !bench) return 'neutral';
  if (lowerIsBetter) {
    if (bench.p10 != null && value <= bench.p10) return 'elite';
    if (bench.p25 != null && value <= bench.p25) return 'good';
    if (bench.p75 != null && value >= bench.p75) return 'poor';
    return 'neutral';
  }
  if (bench.p90 != null && value >= bench.p90) return 'elite';
  if (bench.p75 != null && value >= bench.p75) return 'good';
  if (bench.p25 != null && value <= bench.p25) return 'poor';
  return 'neutral';
}

function avgOrNull(values: (number | null | undefined)[]): number | null {
  const real = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (real.length === 0) return null;
  return real.reduce((a, b) => a + b, 0) / real.length;
}

// ────────────────────────────────────────────────────────────────────────
// Batter & pitcher scoring (ported from src/utils/dailyPropsReport.ts —
// shortened in-line; logic is identical except simplified rationale labels).

interface BatterScore {
  score: number; rationale: { label: string; points: number }[];
  computed: PropComputed; l10: Split;
}

function scoreBatter(args: {
  market: string; computed: PropComputed; side: Side; gameIsDay: boolean;
  oppArchetype: string | null; split: any; benchmarks: any;
}): BatterScore | null {
  const { market, computed, side, gameIsDay, oppArchetype, split, benchmarks } = args;
  const odds = side === 'over' ? computed.overOdds : computed.underOdds;
  if (odds == null) return null;
  if (odds < MAX_NEGATIVE_ODDS) return null;

  const { l10, dn, arch } = sideSplits(computed, side);
  if (l10.pct == null || l10.games < 3) return null;

  const dir = side === 'over' ? 1 : -1;
  const sideLabel = side === 'over' ? 'Over' : 'Under';
  let score = 0;
  const rationale: { label: string; points: number }[] = [];

  score += l10.pct * 0.4;
  rationale.push({ label: `L10 ${sideLabel} ${l10.over}/${l10.games} (${l10.pct}%)`, points: l10.pct * 0.4 });
  if (l10.games < 4) { score -= 6; rationale.push({ label: 'Small L10 sample', points: -6 }); }

  if (dn && dn.games >= 5 && dn.pct != null && dn.pct >= l10.pct - 5) {
    const p = 15 * Math.min(1, dn.pct / 100);
    score += p;
    rationale.push({ label: `${gameIsDay ? '☀️ Day' : '🌙 Night'} games ${dn.over}/${dn.games} (${dn.pct}%)`, points: p });
  }
  if (arch && arch.games >= 4 && oppArchetype && arch.pct != null && arch.pct >= l10.pct - 5) {
    const p = 15 * Math.min(1, arch.pct / 100);
    score += p;
    rationale.push({ label: `vs ${oppArchetype} SP ${arch.over}/${arch.games} (${arch.pct}%)`, points: p });
  }

  if (split) {
    const rec = split.recent_form;
    const xwoba = split.xwoba, recX = rec?.xwoba;
    if (xwoba != null && recX != null) {
      const d = (recX - xwoba) * dir;
      if (d >= 0.020) { score += 8; rationale.push({ label: `L10 xwOBA ${dir > 0 ? '+' : ''}${(recX - xwoba).toFixed(3)} vs season`, points: 8 }); }
      else if (d >= 0.010) { score += 4; rationale.push({ label: `L10 xwOBA ${dir > 0 ? '+' : ''}${(recX - xwoba).toFixed(3)} vs season`, points: 4 }); }
      else if (d <= -0.020) { score -= 4; rationale.push({ label: `L10 xwOBA ${(recX - xwoba).toFixed(3)} (wrong way for ${sideLabel})`, points: -4 }); }
    }
    const barrel = split.barrel_pct, recB = rec?.barrel_pct;
    if (barrel != null && recB != null) {
      const d = (recB - barrel) * dir;
      if (d >= 3) { score += 6; rationale.push({ label: `L10 barrel% ${dir > 0 ? '+' : ''}${(recB - barrel).toFixed(1)}pp`, points: 6 }); }
      else if (d <= -3) { score -= 3; rationale.push({ label: `L10 barrel% ${(recB - barrel).toFixed(1)}pp (wrong way)`, points: -3 }); }
    }
    const hard = split.hard_hit_pct, recH = rec?.hard_hit_pct;
    if (hard != null && recH != null && (recH - hard) * dir >= 3) {
      score += 3;
      rationale.push({ label: `L10 hard-hit% ${dir > 0 ? '+' : ''}${(recH - hard).toFixed(1)}pp`, points: 3 });
    }
    const isBatterKMarket = market === 'batter_strikeouts';
    const kDir = isBatterKMarket ? dir : -dir;
    const k = split.k_pct, recK = rec?.k_pct;
    if (k != null && recK != null) {
      const d = (recK - k) * kDir;
      if (d >= 3) { score += 3; rationale.push({ label: `L10 K% ${recK > k ? '+' : ''}${(recK - k).toFixed(1)}pp`, points: 3 }); }
      else if (d <= -3) { score -= 3; rationale.push({ label: `L10 K% ${(recK - k).toFixed(1)}pp (wrong way for ${sideLabel})`, points: -3 }); }
    }
    const xwobaBench = benchmarks?.xwoba;
    const bucket = pctBucket(xwoba, xwobaBench);
    if (side === 'over') {
      if (bucket === 'elite')      { score += 5; rationale.push({ label: 'Elite season xwOBA vs this hand', points: 5 }); }
      else if (bucket === 'good')  { score += 2; rationale.push({ label: 'Above-avg season xwOBA vs this hand', points: 2 }); }
      else if (bucket === 'poor')  { score -= 4; rationale.push({ label: 'Below-avg season xwOBA vs this hand', points: -4 }); }
    } else {
      if (bucket === 'poor')       { score += 5; rationale.push({ label: 'Weak season xwOBA vs this hand (Under signal)', points: 5 }); }
      else if (bucket === 'elite') { score -= 4; rationale.push({ label: 'Elite season xwOBA vs this hand (wrong way for Under)', points: -4 }); }
    }
  }

  let mult = 1;
  if (odds >= 150)      { mult = 1.05; rationale.push({ label: `Plus-money ${sideLabel} (${odds})`, points: 0 }); }
  else if (odds <= -180){ mult = 0.95; rationale.push({ label: `Heavy juice on ${sideLabel} (${odds})`, points: 0 }); }

  return { score: Math.max(0, Math.min(100, score * mult)), rationale, computed, l10 };
}

interface PitcherScore extends BatterScore {}

function scorePitcher(args: {
  market: string; computed: PropComputed; side: Side; gameIsDay: boolean;
  opposingLineupSplits: any[]; pitcherBattedBall: any; benchmarks: any;
  recentStarts: any[];
}): PitcherScore | null {
  const { market, computed, side, gameIsDay, opposingLineupSplits, pitcherBattedBall, benchmarks, recentStarts } = args;
  const odds = side === 'over' ? computed.overOdds : computed.underOdds;
  if (odds == null) return null;
  if (odds < MAX_NEGATIVE_ODDS) return null;

  const { l10, dn } = sideSplits(computed, side);
  if (l10.pct == null || l10.games < 3) return null;

  const dir = side === 'over' ? 1 : -1;
  const sideLabel = side === 'over' ? 'Over' : 'Under';
  let score = 0;
  const rationale: { label: string; points: number }[] = [];

  score += l10.pct * 0.4;
  rationale.push({ label: `L10 ${sideLabel} ${l10.over}/${l10.games} (${l10.pct}%)`, points: l10.pct * 0.4 });

  if (dn && dn.games >= 4 && dn.pct != null && dn.pct >= l10.pct - 5) {
    const p = 10 * Math.min(1, dn.pct / 100);
    score += p;
    rationale.push({ label: `${gameIsDay ? '☀️ Day' : '🌙 Night'} starts ${dn.over}/${dn.games} (${dn.pct}%)`, points: p });
  }

  if (pitcherBattedBall?.k_pct != null && benchmarks?.k_pct) {
    const o = pitcherBattedBall;
    if (market === 'pitcher_strikeouts') {
      const elite = side === 'over' ? o.k_pct >= benchmarks.k_pct.p75 : o.k_pct <= benchmarks.k_pct.p25;
      const good = side === 'over' ? o.k_pct >= benchmarks.k_pct.p50 : o.k_pct <= benchmarks.k_pct.p50;
      const wrong = side === 'over' ? o.k_pct <= benchmarks.k_pct.p25 : o.k_pct >= benchmarks.k_pct.p75;
      if (elite)      { score += 15; rationale.push({ label: `Season K% ${o.k_pct.toFixed(1)}% (great for ${sideLabel})`, points: 15 }); }
      else if (good)  { score += 8;  rationale.push({ label: `Season K% ${o.k_pct.toFixed(1)}% (favors ${sideLabel})`, points: 8 }); }
      else if (wrong) { score -= 4;  rationale.push({ label: `Season K% ${o.k_pct.toFixed(1)}% (against ${sideLabel})`, points: -4 }); }
    } else if (o.xwoba_allowed != null) {
      if (dir > 0) {
        if (o.xwoba_allowed >= 0.350)      { score += 8; rationale.push({ label: `Weak season xwOBA-A (${o.xwoba_allowed.toFixed(3)})`, points: 8 }); }
        else if (o.xwoba_allowed <= 0.300) { score -= 4; rationale.push({ label: `Strong season xwOBA-A (${o.xwoba_allowed.toFixed(3)})`, points: -4 }); }
      } else {
        if (o.xwoba_allowed <= 0.300)      { score += 8; rationale.push({ label: `Strong season xwOBA-A (${o.xwoba_allowed.toFixed(3)}) — Under signal`, points: 8 }); }
        else if (o.xwoba_allowed >= 0.350) { score -= 4; rationale.push({ label: `Weak season xwOBA-A (${o.xwoba_allowed.toFixed(3)}) — wrong way for Under`, points: -4 }); }
      }
    }
  }

  // L3 form
  if (recentStarts.length >= 2 && pitcherBattedBall) {
    const o = pitcherBattedBall;
    const l3K = avgOrNull(recentStarts.map(s => s.k_pct));
    const l3X = avgOrNull(recentStarts.map(s => s.xwoba_allowed));
    const l3Ip = avgOrNull(recentStarts.map(s => s.ip_official));
    if (l3K != null && o.k_pct != null) {
      const d = (l3K - o.k_pct) * dir;
      if (d >= 3)        { score += 5; rationale.push({ label: `L3 K% ${(l3K - o.k_pct > 0 ? '+' : '')}${(l3K - o.k_pct).toFixed(1)}pp vs season`, points: 5 }); }
      else if (d >= 1.5) { score += 3; rationale.push({ label: `L3 K% ${(l3K - o.k_pct > 0 ? '+' : '')}${(l3K - o.k_pct).toFixed(1)}pp vs season`, points: 3 }); }
      else if (d <= -3)  { score -= 3; rationale.push({ label: `L3 K% ${(l3K - o.k_pct).toFixed(1)}pp (wrong way for ${sideLabel})`, points: -3 }); }
    }
    if (l3X != null && o.xwoba_allowed != null) {
      const xwobaDir = market === 'pitcher_strikeouts' ? -1 : dir;
      const d = (l3X - o.xwoba_allowed) * xwobaDir;
      if (d >= 0.020)        { score += 5; rationale.push({ label: `L3 xwOBA-A ${(l3X - o.xwoba_allowed > 0 ? '+' : '')}${(l3X - o.xwoba_allowed).toFixed(3)} vs season`, points: 5 }); }
      else if (d >= 0.010)   { score += 3; rationale.push({ label: `L3 xwOBA-A ${(l3X - o.xwoba_allowed > 0 ? '+' : '')}${(l3X - o.xwoba_allowed).toFixed(3)} vs season`, points: 3 }); }
      else if (d <= -0.020)  { score -= 3; rationale.push({ label: `L3 xwOBA-A ${(l3X - o.xwoba_allowed).toFixed(3)} (wrong way for ${sideLabel})`, points: -3 }); }
    }
    if (l3Ip != null && market === 'pitcher_strikeouts' && side === 'over') {
      if (l3Ip >= 6)        { score += 5; rationale.push({ label: `L3 avg ${l3Ip.toFixed(1)} IP per start (deep workload)`, points: 5 }); }
      else if (l3Ip >= 5.3) { score += 3; rationale.push({ label: `L3 avg ${l3Ip.toFixed(1)} IP per start`, points: 3 }); }
      else if (l3Ip < 4.5)  { score -= 3; rationale.push({ label: `L3 avg ${l3Ip.toFixed(1)} IP (short outings)`, points: -3 }); }
    }
  }

  // Opp lineup K% (only matters for pitcher_strikeouts)
  if (market === 'pitcher_strikeouts') {
    const seasonKs = opposingLineupSplits.map(s => s.k_pct).filter((v: any) => v != null && Number.isFinite(v));
    if (seasonKs.length >= 4 && benchmarks?.k_pct) {
      const avgK = seasonKs.reduce((a: number, b: number) => a + b, 0) / seasonKs.length;
      const vulnerable = side === 'over' ? avgK >= benchmarks.k_pct.p75 : avgK <= benchmarks.k_pct.p25;
      const above = side === 'over' ? avgK >= benchmarks.k_pct.p50 : avgK <= benchmarks.k_pct.p50;
      const tough = side === 'over' ? avgK <= benchmarks.k_pct.p25 : avgK >= benchmarks.k_pct.p75;
      if (vulnerable) { score += 10; rationale.push({ label: `Opp lineup avg K% ${avgK.toFixed(1)}% (favors ${sideLabel})`, points: 10 }); }
      else if (above) { score += 5;  rationale.push({ label: `Opp lineup avg K% ${avgK.toFixed(1)}% (slight ${sideLabel} lean)`, points: 5 }); }
      else if (tough) { score -= 5;  rationale.push({ label: `Opp lineup avg K% ${avgK.toFixed(1)}% (against ${sideLabel})`, points: -5 }); }
    }
  }

  let mult = 1;
  if (odds >= 150)      { mult = 1.05; rationale.push({ label: `Plus-money ${sideLabel} (${odds})`, points: 0 }); }
  else if (odds <= -180){ mult = 0.95; rationale.push({ label: `Heavy juice on ${sideLabel} (${odds})`, points: 0 }); }

  return { score: Math.max(0, Math.min(100, score * mult)), rationale, computed, l10 };
}

// ────────────────────────────────────────────────────────────────────────
// Entry point

interface Pick {
  game_pk: number; player_id: number; player_name: string; team_name: string | null;
  game_label: string; game_time: string | null; is_day: boolean;
  market: string; market_label: string; kind: 'batter' | 'pitcher';
  tier: string; score: number; side: Side; line: number;
  over_odds: number | null; under_odds: number | null;
  l10_over: number; l10_games: number; l10_pct: number | null;
  rationale: { label: string; points: number }[];
}

function cors(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Today in ET (we score the slate that starts later today).
    const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const season = Number(todayEt.slice(0, 4));

    // 1. Which games are ready?
    const { data: readyRows, error: readyErr } = await supabase.rpc('mlb_games_ready_for_picks', {
      p_report_date: todayEt,
    });
    if (readyErr) throw readyErr;
    const readyGamePks: number[] = (readyRows ?? []).map((r: any) => Number(r.game_pk));
    if (readyGamePks.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'no ready games', date: todayEt }), { headers: cors() });
    }

    // 2. Pull game context + benchmarks once for the whole slate.
    const { data: scheduleRows } = await supabase
      .from('mlb_schedule')
      .select('game_pk, official_date, game_time_et, home_team_id, home_team_name, away_team_id, away_team_name, home_sp_id, home_sp_hand, away_sp_id, away_sp_hand')
      .in('game_pk', readyGamePks);
    const games = (scheduleRows ?? []) as any[];

    // Pitcher batted-ball + archetype
    const pitcherIds = [...new Set(games.flatMap(g => [g.away_sp_id, g.home_sp_id]))];
    const { data: battedBall } = await supabase
      .from('mlb_pitcher_batted_ball')
      .select('pitcher_id, k_pct, bb_pct, xwoba_allowed, woba_allowed, barrel_pct, hr_per_fb_pct, gb_pct, fb_pct')
      .eq('season', season).eq('vs_batter_hand', 'A').in('pitcher_id', pitcherIds);
    const battedBallById = new Map<number, any>(
      (battedBall ?? []).map((r: any) => [Number(r.pitcher_id), r]),
    );
    const { data: archetypeRows } = await supabase
      .from('v_mlb_pitcher_archetypes')
      .select('pitcher_id, archetype').eq('season', season).in('pitcher_id', pitcherIds);
    const archetypeById = new Map<number, string>(
      (archetypeRows ?? []).map((r: any) => [Number(r.pitcher_id), r.archetype]),
    );

    // Pitcher last-3 starts
    const today = todayEt;
    const { data: pitcherLogs } = await supabase
      .from('mlb_pitcher_logs')
      .select('pitcher_id, game_pk, official_date, ip_official, strikeouts, walks, hits_allowed, xfip, xera_est, xwoba_allowed, k_pct, bb_pct, games_started')
      .in('pitcher_id', pitcherIds).eq('season', season).gt('games_started', 0)
      .lt('official_date', today).order('official_date', { ascending: false });
    const recentStartsByPitcher = new Map<number, any[]>();
    for (const r of pitcherLogs ?? []) {
      const pid = Number((r as any).pitcher_id);
      const list = recentStartsByPitcher.get(pid) ?? [];
      if (list.length < 3) { list.push(r); recentStartsByPitcher.set(pid, list); }
    }

    // Lineups (for season splits later)
    const { data: lineupRows } = await supabase
      .from('mlb_game_lineups').select('game_pk, team_id, player_id, batting_order, position, bat_side')
      .in('game_pk', readyGamePks);
    const lineups = (lineupRows ?? []) as any[];
    const batterIds = [...new Set(lineups.map(r => Number(r.player_id)).filter(Boolean))];

    // Batter season splits + recent_form vs both hands
    const splitsVsHand: Record<'R' | 'L', Map<number, any>> = { R: new Map(), L: new Map() };
    for (const hand of ['R', 'L'] as const) {
      if (batterIds.length === 0) continue;
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.from('v_mlb_batter_platoon_summary').select('*').eq('season', season).eq('vs_pitcher_hand', hand).in('batter_id', batterIds),
        supabase.from('mlb_batter_recent_form').select('*').eq('season', season).eq('vs_pitcher_hand', hand).eq('window_games', 10).in('batter_id', batterIds),
      ]);
      const recent = new Map<number, any>((r ?? []).map((x: any) => [Number(x.batter_id), x]));
      const map = new Map<number, any>();
      for (const row of s ?? []) {
        map.set(Number((row as any).batter_id), { ...(row as any), recent_form: recent.get(Number((row as any).batter_id)) ?? null });
      }
      splitsVsHand[hand] = map;
    }

    // League benchmarks per hand
    const { data: benchR } = await supabase.from('v_mlb_league_batting_benchmarks').select('*').eq('season', season).eq('vs_pitcher_hand', 'R').maybeSingle();
    const { data: benchL } = await supabase.from('v_mlb_league_batting_benchmarks').select('*').eq('season', season).eq('vs_pitcher_hand', 'L').maybeSingle();
    const buildBench = (row: any): Record<string, any> => {
      if (!row) return {};
      const out: Record<string, any> = {};
      for (const key of ['xwoba', 'iso', 'slg', 'ops', 'avg', 'obp', 'woba', 'k_pct', 'bb_pct', 'barrel_pct', 'hard_hit_pct', 'avg_exit_velo', 'pull_air_pct', 'hr_per_fb_pct']) {
        out[key] = {
          p10: row[`${key}_p10`], p25: row[`${key}_p25`], p50: row[`${key}_p50`],
          p75: row[`${key}_p75`], p90: row[`${key}_p90`],
        };
      }
      return out;
    };
    const benchmarksR = buildBench(benchR);
    const benchmarksL = buildBench(benchL);

    // 3. For each ready game, fetch props ladder + run scoring.
    const picks: Pick[] = [];
    for (const game of games) {
      const { data: propsRows, error: propsErr } = await supabase.rpc('get_mlb_player_props_l10', {
        p_game_pk: Number(game.game_pk),
      });
      if (propsErr) { console.warn('props_rpc_error', game.game_pk, propsErr.message); continue; }
      const rows = (propsRows ?? []) as any[];

      const awayLineup = lineups.filter(r => r.game_pk === game.game_pk && r.team_id === game.away_team_id);
      const homeLineup = lineups.filter(r => r.game_pk === game.game_pk && r.team_id === game.home_team_id);
      const awaySplits = (game.home_sp_hand === 'L' ? splitsVsHand.L : splitsVsHand.R); // away batters vs home SP
      const homeSplits = (game.away_sp_hand === 'L' ? splitsVsHand.L : splitsVsHand.R); // home batters vs away SP

      for (const row of rows) {
        const lines = row.lines ?? [];
        if (!Array.isArray(lines) || lines.length === 0) continue;
        const line = defaultLine(lines.map((l: any) => ({ line: Number(l.line), over: l.over != null ? Number(l.over) : null, under: l.under != null ? Number(l.under) : null })));
        if (line == null) continue;
        const entry = lines.find((l: any) => Number(l.line) === line) ?? lines[0];
        const games_jsonb = (row.games ?? []) as any[];
        const gamesForLine = games_jsonb.map((g: any) => ({ v: Number(g.v), d: Number(g.d) === 1 ? 1 : 0, a: g.a, dt: g.dt ?? null }));

        const l10 = hitSplit(gamesForLine, line, 10);
        const dnFlag = row.game_is_day ? 1 : 0;
        const dn = gamesForLine.filter(g => g.d === dnFlag).length > 0 ? hitSplit(gamesForLine.filter(g => g.d === dnFlag), line) : null;
        let arch: Split | null = null;
        if (!row.is_pitcher && row.opp_archetype_today) {
          const sub = gamesForLine.filter(g => g.a === row.opp_archetype_today);
          if (sub.length >= 3) arch = hitSplit(sub, line);
        }
        const computed: PropComputed = {
          line, overOdds: entry.over != null ? Number(entry.over) : null, underOdds: entry.under != null ? Number(entry.under) : null,
          l10, contextualDayNight: dn, contextualArchetype: arch,
        };

        // Score Over and Under sides; emit whichever wins (if any tier).
        if (!row.is_pitcher) {
          const isHome = homeLineup.some(r => r.player_id === row.player_id);
          const isAway = awayLineup.some(r => r.player_id === row.player_id);
          if (!isHome && !isAway) continue;
          const teamName = isAway ? game.away_team_name : game.home_team_name;
          const splitsMap = isAway ? awaySplits : homeSplits;
          const split = splitsMap.get(Number(row.player_id));
          const benchmarks = (isAway ? game.home_sp_hand : game.away_sp_hand) === 'L' ? benchmarksL : benchmarksR;

          const over = scoreBatter({ market: row.market, computed, side: 'over', gameIsDay: !!row.game_is_day, oppArchetype: row.opp_archetype_today, split, benchmarks });
          const under = scoreBatter({ market: row.market, computed, side: 'under', gameIsDay: !!row.game_is_day, oppArchetype: row.opp_archetype_today, split, benchmarks });
          const best = over && (!under || over.score >= under.score) ? { r: over, side: 'over' as const } : under ? { r: under, side: 'under' as const } : null;
          if (!best) continue;
          const tier = tierOf(best.r.score);
          if (!tier) continue;
          picks.push({
            game_pk: Number(game.game_pk), player_id: Number(row.player_id), player_name: row.player_name, team_name: teamName,
            game_label: `${game.away_team_name} @ ${game.home_team_name}`, game_time: game.game_time_et,
            is_day: !!row.game_is_day, market: row.market, market_label: marketLabel(row.market), kind: 'batter',
            tier, score: Math.round(best.r.score), side: best.side,
            line, over_odds: computed.overOdds, under_odds: computed.underOdds,
            l10_over: best.r.l10.over, l10_games: best.r.l10.games, l10_pct: best.r.l10.pct,
            rationale: best.r.rationale,
          });
        } else {
          const isAwayPitcher = Number(row.player_id) === Number(game.away_sp_id);
          const isHomePitcher = Number(row.player_id) === Number(game.home_sp_id);
          if (!isAwayPitcher && !isHomePitcher) continue;
          const pitcherHand = isAwayPitcher ? game.away_sp_hand : game.home_sp_hand;
          const benchmarks = pitcherHand === 'L' ? benchmarksL : benchmarksR;
          const teamName = isAwayPitcher ? game.away_team_name : game.home_team_name;
          const opposingLineup = isAwayPitcher ? homeLineup : awayLineup;
          const opposingSplitsMap = pitcherHand === 'L' ? splitsVsHand.L : splitsVsHand.R;
          const opposingLineupSplits = opposingLineup.map(r => opposingSplitsMap.get(Number(r.player_id))).filter(Boolean);
          const pitcherBattedBall = battedBallById.get(Number(row.player_id)) ?? null;
          const recentStarts = recentStartsByPitcher.get(Number(row.player_id)) ?? [];

          const over = scorePitcher({ market: row.market, computed, side: 'over', gameIsDay: !!row.game_is_day, opposingLineupSplits, pitcherBattedBall, benchmarks, recentStarts });
          const under = scorePitcher({ market: row.market, computed, side: 'under', gameIsDay: !!row.game_is_day, opposingLineupSplits, pitcherBattedBall, benchmarks, recentStarts });
          const best = over && (!under || over.score >= under.score) ? { r: over, side: 'over' as const } : under ? { r: under, side: 'under' as const } : null;
          if (!best) continue;
          const tier = tierOf(best.r.score);
          if (!tier) continue;
          picks.push({
            game_pk: Number(game.game_pk), player_id: Number(row.player_id), player_name: row.player_name, team_name: teamName,
            game_label: `${game.away_team_name} @ ${game.home_team_name}`, game_time: game.game_time_et,
            is_day: !!row.game_is_day, market: row.market, market_label: marketLabel(row.market), kind: 'pitcher',
            tier, score: Math.round(best.r.score), side: best.side,
            line, over_odds: computed.overOdds, under_odds: computed.underOdds,
            l10_over: best.r.l10.over, l10_games: best.r.l10.games, l10_pct: best.r.l10.pct,
            rationale: best.r.rationale,
          });
        }
      }
    }

    // 4. Snapshot to DB
    if (picks.length === 0) {
      return new Response(JSON.stringify({ ok: true, date: todayEt, ready_games: readyGamePks.length, picks: 0 }), { headers: cors() });
    }
    const { data: snap, error: snapErr } = await supabase.rpc('snapshot_player_prop_picks', {
      p_report_date: todayEt, p_picks: picks, p_algo_version: ALGO_VERSION,
    });
    if (snapErr) throw snapErr;

    return new Response(JSON.stringify({
      ok: true, date: todayEt, algo_version: ALGO_VERSION,
      ready_games: readyGamePks.length, picks_scored: picks.length,
      snapshot: snap,
    }), { headers: cors() });
  } catch (err) {
    console.error('score-player-props error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: cors() });
  }
});
