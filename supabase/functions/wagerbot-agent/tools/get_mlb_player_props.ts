// get_mlb_player_props — chat visibility into the live MLB player-props
// feature (the Props tab). Mirrors the iOS data path
// (MLBPlayerPropsService.swift): `mlb_games_today` for the slate + the
// `get_mlb_player_props_l10(p_game_pk)` RPC for each game's prop ladders and
// season game logs, both on the CFB Supabase. The tool computes L10 hit rates
// per alternate line and ranks lines by (hit rate − implied probability), so
// the model gets ready-made edges instead of raw ladders.

import type { ToolDefinition } from "./registry.ts";

const MARKET_LABELS: Record<string, string> = {
  batter_home_runs: "HR",
  batter_hits: "Hits",
  batter_total_bases: "Total Bases",
  batter_rbis: "RBIs",
  batter_hits_runs_rbis: "H+R+RBI",
  batter_walks: "Walks (batter)",
  batter_strikeouts: "Ks (batter)",
  pitcher_strikeouts: "Pitcher Ks",
  pitcher_hits_allowed: "Hits Allowed",
  pitcher_walks: "Walks (pitcher)",
  pitcher_outs: "Pitcher Outs",
};

function impliedProb(american: number | null | undefined): number | null {
  if (american == null || !Number.isFinite(american) || american === 0) return null;
  return american < 0 ? -american / (-american + 100) : 100 / (american + 100);
}

interface LineEntry { line: number; over: number | null; under: number | null }
interface GameEntry { v: number; d: number; a: string | null; dt: string | null }
interface PropRow {
  player_id: number;
  player_name: string;
  is_pitcher: boolean;
  market: string;
  opp_archetype_today: string | null;
  lines: LineEntry[];
  games: GameEntry[];
}

export const tool: ToolDefinition = {
  name: "get_mlb_player_props",
  description:
    "MLB player props (strikeouts, hits, total bases, HRs, outs, etc.) for today's slate — the same " +
    "data behind the app's Props tab. Returns the best prop edges: each alternate line's L10 hit rate " +
    "vs the odds-implied probability, ranked by edge. Call this for ANY player-prop question. " +
    "Optionally filter by player/team name or market.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional player or team name filter (substring match), e.g. 'Skenes' or 'Orioles'.",
      },
      market: {
        type: "string",
        enum: Object.keys(MARKET_LABELS),
        description: "Optional market filter, e.g. pitcher_strikeouts.",
      },
      limit: { type: "number", description: "Max edges to return (default 20, max 40)." },
    },
  },
  async execute(input: { query?: string; market?: string; limit?: number }, ctx) {
    const cfb = ctx.cfbSupabase;
    const { data: games, error } = await cfb.from("mlb_games_today").select();
    if (error) throw new Error(`mlb_games_today: ${error.message}`);
    const slate = Array.isArray(games) ? games : [];
    if (slate.length === 0) return { props: [], note: "No MLB games today." };

    const q = (input?.query || "").trim().toLowerCase();
    const marketFilter = (input?.market || "").trim();
    const limit = Math.min(Math.max(Number(input?.limit) || 20, 1), 40);

    // Per-game matchup labels keyed by game_pk.
    const matchupByPk = new Map<number, { matchup: string; teams: string }>();
    for (const g of slate) {
      const pk = Number(g.game_pk);
      if (!Number.isFinite(pk)) continue;
      const away = String(g.away_team_name ?? g.away_team ?? "Away");
      const home = String(g.home_team_name ?? g.home_team ?? "Home");
      matchupByPk.set(pk, { matchup: `${away} @ ${home}`, teams: `${away} ${home}`.toLowerCase() });
    }

    // Team filter narrows which games we fetch; player filter applies later.
    let pks = [...matchupByPk.keys()];
    if (q) {
      const teamPks = pks.filter((pk) => matchupByPk.get(pk)!.teams.includes(q));
      if (teamPks.length > 0) pks = teamPks;
    }

    const propsPerGame = await Promise.all(pks.map(async (pk) => {
      const { data } = await cfb.rpc("get_mlb_player_props_l10", { p_game_pk: pk });
      return { pk, rows: (Array.isArray(data) ? data : []) as PropRow[] };
    }));

    type Edge = {
      player: string; market: string; line: number;
      side: "over" | "under"; odds: number;
      l10_hit_rate: number; implied: number; edge: number;
      sample: number; matchup: string; opp_archetype: string | null;
    };
    const edges: Edge[] = [];

    for (const { pk, rows } of propsPerGame) {
      const matchup = matchupByPk.get(pk)?.matchup ?? "";
      for (const row of rows) {
        if (marketFilter && row.market !== marketFilter) continue;
        if (q && !row.player_name?.toLowerCase().includes(q) && !matchupByPk.get(pk)!.teams.includes(q)) continue;
        const log = Array.isArray(row.games) ? row.games : [];
        const l10 = log.slice(-10);
        if (l10.length < 5) continue; // too thin to trust a hit rate
        for (const entry of (Array.isArray(row.lines) ? row.lines : [])) {
          const line = Number(entry.line);
          if (!Number.isFinite(line)) continue;
          // Pushes (v === line on whole-number lines) drop out of the sample.
          const overs = l10.filter((g) => g.v > line).length;
          const unders = l10.filter((g) => g.v < line).length;
          const decided = overs + unders;
          if (decided === 0) continue;
          for (const side of ["over", "under"] as const) {
            const odds = side === "over" ? entry.over : entry.under;
            const implied = impliedProb(odds);
            if (implied == null) continue;
            const hit = (side === "over" ? overs : unders) / decided;
            edges.push({
              player: row.player_name,
              market: MARKET_LABELS[row.market] ?? row.market,
              line, side, odds: odds!,
              l10_hit_rate: Math.round(hit * 100),
              implied: Math.round(implied * 100),
              edge: Math.round((hit - implied) * 100),
              sample: decided,
              matchup,
              opp_archetype: row.opp_archetype_today ?? null,
            });
          }
        }
      }
    }

    // Best positive edges first; one line per (player, market, side) to avoid
    // the same ladder dominating the list.
    edges.sort((a, b) => b.edge - a.edge);
    const seen = new Set<string>();
    const top = edges.filter((e) => {
      const key = `${e.player}|${e.market}|${e.side}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);

    return {
      props: top,
      note:
        "edge = L10 hit rate minus odds-implied probability (percentage points). " +
        "L10 hit rates are streaky small samples — treat edges under ~10 as noise and " +
        "cross-check the pitcher matchup. For deeper splits include the matching game card — " +
        "its Player Props widget carries the full per-matchup list.",
    };
  },
};
