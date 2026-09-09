// Hourly Polymarket cache refresh (pg_cron `update-polymarket-cache-hourly`).
// Reads this week's games from the SAME slate tables the apps read, pulls just
// the moneyline / spread / total markets for those games from gamma-api, then
// writes price histories into `polymarket_markets` keyed exactly the way the
// clients look them up. See README.md next to this file.
import { createClient, type SupabaseClient as SupabaseJsClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  buildGameKey,
  computeWindow,
  eventInWindow,
  isMainGameTitle,
  legacyNflNames,
  matchGameToEvent,
  mergeMarketsIntoEvents,
  pickMarkets,
  type Game,
  type League,
  type MarketType,
  type RefreshWindow,
  type SlimEvent,
} from './lib.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';
const FETCH_HEADERS = { Accept: 'application/json', 'User-Agent': 'WagerProof-PolymarketCache/2.0' };

// Sports-data project (CFB Supabase) — anon key, read-only views.
const CFB_SUPABASE_URL = 'https://jpxnjuwglavsjbgbasnl.supabase.co';
const CFB_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo';

// gamma-api primary tag per league (confirmed against /sports on 2026-09-09).
const TAG_IDS: Record<League, string> = { nfl: '450', cfb: '100351', ncaab: '102114', nba: '745', mlb: '100381' };

// gamma-api's own market-type labels. Period/prop types (first_half_spreads,
// baseball_team_inning2_winner, …) never reach us, which is the whole point.
const SPORTS_MARKET_TYPES = ['moneyline', 'spreads', 'totals'];

// CFB last: it has the biggest slate, so if anything is going to run long it
// should not take NFL/MLB down with it.
const LEAGUE_ORDER: League[] = ['nfl', 'mlb', 'nba', 'ncaab', 'cfb'];

const PAGE_SIZE = 100; // gamma-api caps `limit` at 100 regardless of what is asked
const MAX_PAGES = 25;
const HISTORY_BATCH = 15;

// deno-lint-ignore no-explicit-any
type SupabaseClient = SupabaseJsClient<any, 'public', any>;

interface LeagueStats {
  games: number;
  events: number;
  matched: number;
  unmatched: string[];
  markets: number;
}

interface TokenJob {
  tokenId: string;
  marketType: MarketType;
  question: string;
  league: League;
  targets: Array<{ gameKey: string; away_team: string; home_team: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = new Date();
  const body = await req.json().catch(() => ({}));
  // dry_run: fetch + match + report, but never write. Handy for checking a slate.
  const dryRun = body?.dry_run === true;

  try {
    const main = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const sports = createClient(CFB_SUPABASE_URL, CFB_SUPABASE_ANON_KEY);
    const window = computeWindow(startedAt);

    const games = await loadGames(sports, startedAt, window);
    const stats = {} as Record<League, LeagueStats>;
    const errors: string[] = [];
    let updated = 0;

    for (const league of LEAGUE_ORDER) {
      const leagueGames = games[league];
      if (leagueGames.length === 0) {
        console.log(`⏭️ ${league.toUpperCase()}: no games in window, skipping`);
        continue;
      }

      const events = await fetchLeagueEvents(league, window);
      console.log(`📋 ${league.toUpperCase()}: ${events.length} game events for ${leagueGames.length} slate games`);

      if (!dryRun) await cacheEvents(main, league, events, errors);

      const jobs = new Map<string, TokenJob>();
      const leagueStats: LeagueStats = { games: leagueGames.length, events: events.length, matched: 0, unmatched: [], markets: 0 };

      for (const game of leagueGames) {
        const event = matchGameToEvent(events, game);
        if (!event) {
          leagueStats.unmatched.push(`${game.away_team} @ ${game.home_team}`);
          continue;
        }
        leagueStats.matched++;

        const picks = pickMarkets(event);
        const targets = [{ gameKey: buildGameKey(league, game.away_team, game.home_team), away_team: game.away_team, home_team: game.home_team }];
        if (league === 'nfl') {
          const legacy = legacyNflNames(game);
          if (legacy) targets.push({ gameKey: buildGameKey('nfl', legacy.away_team, legacy.home_team), ...legacy });
        }

        for (const marketType of ['moneyline', 'spread', 'total'] as MarketType[]) {
          const pick = picks[marketType];
          if (!pick) continue;
          // One CLOB fetch per token even when it lands under two keys.
          const job = jobs.get(pick.tokenId) ?? { tokenId: pick.tokenId, marketType, question: pick.question, league, targets: [] };
          job.targets.push(...targets);
          jobs.set(pick.tokenId, job);
        }
      }

      const refreshedKeys = new Set<string>();
      const jobList = [...jobs.values()];
      for (let i = 0; i < jobList.length; i += HISTORY_BATCH) {
        const batch = jobList.slice(i, i + HISTORY_BATCH);
        const results = await Promise.all(batch.map((job) => refreshToken(main, job, startedAt, dryRun)));
        results.forEach((ok, idx) => {
          if (!ok.ok) {
            errors.push(`${batch[idx].targets[0]?.gameKey}-${batch[idx].marketType}: ${ok.reason}`);
            return;
          }
          updated += batch[idx].targets.length;
          leagueStats.markets += batch[idx].targets.length;
          for (const t of batch[idx].targets) refreshedKeys.add(t.gameKey);
        });
      }

      if (!dryRun) await dropStaleRows(main, refreshedKeys, startedAt, errors);
      stats[league] = leagueStats;
      console.log(`✅ ${league.toUpperCase()}: matched ${leagueStats.matched}/${leagueStats.games}, ${leagueStats.markets} market rows`);
    }

    const durationMs = Date.now() - startedAt.getTime();
    console.log(`🏁 Done in ${durationMs}ms — ${updated} rows${dryRun ? ' (dry run)' : ''}, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ success: true, dryRun, updated, durationMs, stats, errors: errors.length ? errors : undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ---------------------------------------------------------------------------
// Slate games
// ---------------------------------------------------------------------------

async function loadGames(sports: SupabaseClient, now: Date, w: RefreshWindow): Promise<Record<League, Game[]>> {
  const out: Record<League, Game[]> = { nfl: [], cfb: [], ncaab: [], nba: [], mlb: [] };
  const today = now.toISOString().slice(0, 10);
  const weekOut = w.gameStartMax.toISOString().slice(0, 10);

  // NFL + CFB: the slate feeds are what web/iOS/Android render, so their team
  // strings are the ones the clients put in the cache key. Do NOT switch these
  // back to nfl_betting_lines / cfb_live_weekly_inputs — the short names there
  // are why every NFL lookup missed in Sept 2026, and the CFB table is dead.
  const [nfl, cfb, ncaab, nba, mlb] = await Promise.all([
    sports.from('nfl_slate_feed').select('away_team, home_team, away_ab, home_ab, kickoff')
      .gte('kickoff', w.gameStartMin.toISOString()).lte('kickoff', w.gameStartMax.toISOString()),
    sports.from('cfb_slate_feed').select('away_team, home_team, kickoff')
      .gte('kickoff', w.gameStartMin.toISOString()).lte('kickoff', w.gameStartMax.toISOString()),
    sports.from('v_cbb_input_values').select('away_team, home_team, game_date_et')
      .gte('game_date_et', today).lte('game_date_et', weekOut),
    sports.from('nba_input_values_view').select('away_team, home_team, game_date')
      .gte('game_date', today).lte('game_date', weekOut),
    sports.from('mlb_games_today').select('away_team_name, home_team_name, official_date')
      .gte('official_date', today).lte('official_date', weekOut),
  ]);

  const push = (league: League, rows: Array<Record<string, unknown>> | null, error: { message: string } | null, away = 'away_team', home = 'home_team') => {
    if (error) {
      console.error(`Error fetching ${league.toUpperCase()} games:`, error.message);
      return;
    }
    const seen = new Set<string>();
    for (const row of rows ?? []) {
      const awayTeam = String(row[away] ?? '').trim();
      const homeTeam = String(row[home] ?? '').trim();
      if (!awayTeam || !homeTeam) continue;
      const dedupe = `${awayTeam}|${homeTeam}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out[league].push({
        league,
        away_team: awayTeam,
        home_team: homeTeam,
        away_ab: (row.away_ab as string | null | undefined) ?? null,
        home_ab: (row.home_ab as string | null | undefined) ?? null,
      });
    }
  };

  push('nfl', nfl.data, nfl.error);
  push('cfb', cfb.data, cfb.error);
  push('ncaab', ncaab.data, ncaab.error);
  push('nba', nba.data, nba.error);
  push('mlb', mlb.data, mlb.error, 'away_team_name', 'home_team_name');

  console.log(`📊 Slate: NFL ${out.nfl.length}, CFB ${out.cfb.length}, NCAAB ${out.ncaab.length}, NBA ${out.nba.length}, MLB ${out.mlb.length}`);
  return out;
}

// ---------------------------------------------------------------------------
// Polymarket markets -> slim events
// ---------------------------------------------------------------------------

/**
 * /markets filtered by tag + market type + end-date window, paged, folded into
 * per-event buckets as each page lands so a page's raw JSON is garbage before
 * the next one arrives. Peak memory is one page (~500 KB), not a league.
 */
async function fetchLeagueEvents(league: League, w: RefreshWindow): Promise<SlimEvent[]> {
  const base =
    `${GAMMA_API}/markets?tag_id=${TAG_IDS[league]}&closed=false&active=true&limit=${PAGE_SIZE}` +
    `&end_date_min=${encodeURIComponent(w.marketEndMin.toISOString())}` +
    `&end_date_max=${encodeURIComponent(w.marketEndMax.toISOString())}`;
  const events = new Map<string, SlimEvent>();

  await Promise.all(
    SPORTS_MARKET_TYPES.map(async (type) => {
      for (let page = 0; page < MAX_PAGES; page++) {
        const url = `${base}&sports_market_types=${type}&offset=${page * PAGE_SIZE}`;
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (!res.ok) {
          console.error(`❌ ${league.toUpperCase()} ${type} page ${page + 1}: HTTP ${res.status}`);
          break;
        }
        const rows = await res.json();
        const list = Array.isArray(rows) ? rows : [];
        mergeMarketsIntoEvents(list, events);
        if (list.length < PAGE_SIZE) break;
      }
    }),
  );

  return [...events.values()].filter((e) => isMainGameTitle(e.title) && eventInWindow(e, w));
}

async function cacheEvents(main: SupabaseClient, league: League, events: SlimEvent[], errors: string[]) {
  const { error } = await main.from('polymarket_events').upsert(
    { league, tag_id: TAG_IDS[league], events, event_count: events.length, last_updated: new Date().toISOString() },
    { onConflict: 'league' },
  );
  if (error) errors.push(`events:${league}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Price histories -> polymarket_markets
// ---------------------------------------------------------------------------

async function refreshToken(
  main: SupabaseClient,
  job: TokenJob,
  runStartedAt: Date,
  dryRun: boolean,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${CLOB_API}/prices-history?market=${job.tokenId}&interval=max&fidelity=60`, { headers: FETCH_HEADERS });
    if (!res.ok) return { ok: false, reason: `clob HTTP ${res.status}` };
    const history: Array<{ t: number; p: number }> = (await res.json()).history ?? [];
    if (history.length === 0) return { ok: false, reason: 'empty price history' };

    const latest = history[history.length - 1];
    const currentAwayOdds = Math.round(latest.p * 100);
    if (dryRun) return { ok: true };

    const rows = job.targets.map((t) => ({
      game_key: t.gameKey,
      league: job.league,
      away_team: t.away_team,
      home_team: t.home_team,
      market_type: job.marketType,
      price_history: history,
      current_away_odds: currentAwayOdds,
      current_home_odds: 100 - currentAwayOdds,
      token_id: job.tokenId,
      question: job.question,
      last_updated: runStartedAt.toISOString(),
    }));
    const { error } = await main.from('polymarket_markets').upsert(rows, { onConflict: 'game_key,market_type' });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/**
 * Keys carry no date, so a rematch reuses last season's key and any market we
 * did not refresh this run is left over from that older game (e.g. a resolved
 * 100/0 spread). Once a key has fresh rows, everything older on it goes.
 */
async function dropStaleRows(main: SupabaseClient, keys: Set<string>, runStartedAt: Date, errors: string[]) {
  const list = [...keys];
  for (let i = 0; i < list.length; i += 100) {
    const { error } = await main
      .from('polymarket_markets')
      .delete()
      .in('game_key', list.slice(i, i + 100))
      .lt('last_updated', runStartedAt.toISOString());
    if (error) errors.push(`stale-cleanup: ${error.message}`);
  }
}
