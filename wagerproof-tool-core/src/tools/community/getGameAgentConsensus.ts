// Per-game consensus across ALL public WagerProof agents: how many have a pick
// on each game, the most-backed selection, and how strongly they agree. This is
// the MCP face of the `get_game_agent_consensus` RPC that feeds the /games feed
// cards — see .claude/docs/18_agent_consensus.md.
//
// Differs from get_top_community_agent_picks, which only looks at the top 10
// leaderboard agents and lists their individual picks.

import {
  asOptString,
  asSport,
  readOnly,
  type Sport,
  type Tool,
  type ToolContext,
} from "../../types.js";

/** Columns the deployed RPC returns (verified against prod 2026-11-13). */
interface ConsensusRow extends Record<string, unknown> {
  game_id: string;
  game_date: string;
  agents: number | string | null;
  side: string | null;
  side_agents: number | string | null;
  market_agents: number | string | null;
  market_label: string | null;
  agreement: number | string | null;
  flagged: boolean | null;
  runner_up_side: string | null;
  runner_up_agents: number | string | null;
  slate_rank: number | string | null;
  slate_games: number | string | null;
  avatars: unknown;
}

type Verdict = "consensus" | "lean" | "split" | "too_few";

interface Teams {
  away: string;
  home: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Mirrors src/features/games/consensusCopy.ts so an assistant describes a game
// the same way the app's card does. `flagged` itself is always the server's call.
const LEAN_SHARE = 0.55;
const MIN_MEANINGFUL_MARKET = 3;

// Where each sport's feed keeps the id → teams mapping on the CFB project. The
// picks live in Main and the feeds in CFB, so there is no SQL join — same
// client-side merge-by-game_id the apps do.
const FEEDS: Record<Sport, { table: string; id: string; away: string; home: string }> = {
  nfl: { table: "nfl_slate_feed", id: "game_id", away: "away_team", home: "home_team" },
  cfb: { table: "cfb_slate_feed", id: "game_id", away: "away_team", home: "home_team" },
  nba: { table: "nba_input_values_view", id: "game_id", away: "away_team", home: "home_team" },
  ncaab: { table: "v_cbb_input_values", id: "game_id", away: "away_team", home: "home_team" },
  mlb: { table: "mlb_games_today", id: "game_pk", away: "away_team_name", home: "home_team_name" },
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Tuesday→Monday block containing `anchor` — one football week (CFB plays
 *  Tue–Sat, NFL Thu–Mon), so a Thursday game stays in scope on Sunday. */
function footballWeek(anchor: string): string[] {
  const dow = new Date(`${anchor}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const tuesday = addDays(anchor, -((dow + 5) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(tuesday, i));
}

function etDate(iso: unknown): string | null {
  if (typeof iso !== "string" || iso.length === 0) return null;
  if (DATE_PATTERN.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** NFL/CFB with no explicit date: the current slate week. Anchored on the
 *  LATEST date in the loaded slate, because cfb_slate_feed hides played games
 *  and the earliest remaining kickoff would be a moving target. */
async function currentFootballWeek(ctx: ToolContext, sport: "nfl" | "cfb"): Promise<string[]> {
  const table = FEEDS[sport].table;
  const dateCol = sport === "nfl" ? "gameday" : "kickoff";
  try {
    const { data: anchor } = await ctx.cfb
      .from(table)
      .select("season, week")
      .order("season", { ascending: false })
      .order("week", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anchor) {
      const { data } = await ctx.cfb
        .from(table)
        .select(dateCol)
        .eq("season", anchor.season)
        .eq("week", anchor.week);
      const dates = (data ?? [])
        .map((row) => etDate(row[dateCol]))
        .filter((d): d is string => d !== null)
        .sort();
      if (dates.length > 0) return footballWeek(dates[dates.length - 1]);
    }
  } catch {
    // Fall through — an unreadable slate must not take the tool down.
  }
  return footballWeek(ctx.today());
}

/** Best-effort id → teams lookup. A miss just leaves `matchup` null: picks can
 *  exist before (or after) the feed row does. */
async function resolveTeams(
  ctx: ToolContext,
  sport: Sport,
  gameIds: string[],
): Promise<Map<string, Teams>> {
  const out = new Map<string, Teams>();
  if (gameIds.length === 0) return out;
  const feed = FEEDS[sport];
  try {
    const { data } = await ctx.cfb
      .from(feed.table)
      .select(`${feed.id}, ${feed.away}, ${feed.home}`)
      .in(feed.id, gameIds);
    for (const row of data ?? []) {
      const away = row[feed.away];
      const home = row[feed.home];
      if (away == null || home == null) continue;
      out.set(String(row[feed.id]), { away: String(away), home: String(home) });
    }
  } catch {
    // Matchup labels are a nicety; the consensus rows stand on their own.
  }
  return out;
}

/** Feeds drop games once they are played (and NCAAB/NBA views are today-forward),
 *  so yesterday's rows come back unlabelled. The picks themselves carry a matchup
 *  string. Only resolves on a service-role `main` — avatar_picks RLS shows anon
 *  nothing — which is what hosts pass for global tools. */
async function resolveMatchupsFromPicks(
  ctx: ToolContext,
  sport: Sport,
  dates: string[],
  gameIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (gameIds.length === 0) return out;
  try {
    const { data } = await ctx.main
      .from("avatar_picks")
      .select("game_id, matchup")
      .eq("sport", sport)
      .in("game_date", dates)
      .in("game_id", gameIds)
      .limit(1000);
    for (const row of data ?? []) {
      const matchup = typeof row.matchup === "string" ? row.matchup.trim() : "";
      if (matchup && !out.has(String(row.game_id))) out.set(String(row.game_id), matchup);
    }
  } catch {
    // Same as above: a missing label never fails the call.
  }
  return out;
}

function verdictFor(marketAgents: number, agreement: number | null, flagged: boolean): Verdict {
  if (marketAgents < MIN_MEANINGFUL_MARKET) return "too_few";
  if (flagged) return "consensus";
  return (agreement ?? 0) >= LEAN_SHARE ? "lean" : "split";
}

/** The RPC's `avatars` is sprite data for the app's face stack (max 4, leading
 *  side only). An assistant only needs the names. */
function sampleNames(avatars: unknown): string[] {
  if (!Array.isArray(avatars)) return [];
  return avatars
    .map((a) => (a && typeof a === "object" ? (a as Record<string, unknown>).name : null))
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

export const getGameAgentConsensus: Tool = {
  name: "get_game_agent_consensus",
  title: "Get agent consensus by game",
  scope: "global",
  description:
    "For each game on a league's slate, get how many public WagerProof AI agents have " +
    "a pick on it, the single most-backed selection, and how strongly the agents who " +
    "bet that market agree. Counts ALL public agents, not just the top 10. Use this " +
    "for questions like 'which game are the agents on hardest tonight' or 'how many " +
    "agents are on this game, and which side'. `agents` is everyone with any pick on " +
    "the game; `side_agents` of `market_agents` is the share on the leading selection " +
    "within its own market (e.g. the spread). Selections are exact strings, so two " +
    "lines on the same team (+2.5 and +3.5) count as different selections — check " +
    "`runner_up_side` before calling a market split. `verdict` is consensus, lean, " +
    "split, or too_few (fewer than 3 agents in the market — do not quote a percentage). " +
    "This describes what AI agents picked; it is not betting advice.",
  annotations: readOnly("Get agent consensus by game"),
  inputSchema: {
    type: "object",
    properties: {
      sport: {
        type: "string",
        enum: ["nfl", "nba", "cfb", "ncaab", "mlb"],
        description: "The league to get agent consensus for.",
      },
      date: {
        type: "string",
        description:
          "Game date in YYYY-MM-DD (US Eastern Time). Defaults to today for NBA, " +
          "NCAAB and MLB, and to the whole current week for NFL and CFB.",
      },
    },
    required: ["sport"],
    additionalProperties: false,
  },
  async execute(input, ctx) {
    const sport = asSport(input.sport);
    if (!sport) {
      throw new Error("sport must be one of nfl, nba, cfb, ncaab, or mlb.");
    }
    const explicitDate = asOptString(input.date);
    if (explicitDate && !DATE_PATTERN.test(explicitDate)) {
      throw new Error("date must use YYYY-MM-DD format.");
    }

    const dates = explicitDate
      ? [explicitDate]
      : sport === "nfl" || sport === "cfb"
        ? await currentFootballWeek(ctx, sport)
        : [ctx.today()];

    // SECURITY DEFINER + granted to anon: avatar_picks is RLS-gated, so this RPC
    // is the only way to count across agents without a service-role read.
    const { data, error } = await ctx.main.rpc<ConsensusRow[]>("get_game_agent_consensus", {
      p_sport: sport,
      p_game_dates: dates,
    });
    if (error) throw new Error(`agent consensus query failed: ${error.message}`);

    const rows = data ?? [];
    const gameIds = rows.map((r) => String(r.game_id));
    const teams = await resolveTeams(ctx, sport, gameIds);
    const pickMatchups = await resolveMatchupsFromPicks(
      ctx,
      sport,
      dates,
      gameIds.filter((id) => !teams.has(id)),
    );

    const games = rows.map((row) => {
      const gameId = String(row.game_id);
      const t = teams.get(gameId) ?? null;
      const marketAgents = num(row.market_agents);
      const sideAgents = num(row.side_agents);
      const agreement = nullableNum(row.agreement);
      const flagged = row.flagged === true;
      // `threshold` is deliberately dropped: it is one of two gates behind
      // `flagged`, and quoting it lets a game read as "18 ≥ 13 but not flagged".
      return {
        game_id: gameId,
        game_date: String(row.game_date),
        matchup: t ? `${t.away} @ ${t.home}` : (pickMatchups.get(gameId) ?? null),
        away_team: t?.away ?? null,
        home_team: t?.home ?? null,
        agents: num(row.agents),
        market_label: row.market_label ?? null,
        side: row.side ?? null,
        side_agents: sideAgents,
        market_agents: marketAgents,
        agreement,
        runner_up_side: row.runner_up_side ?? null,
        runner_up_agents: nullableNum(row.runner_up_agents),
        verdict: verdictFor(marketAgents, agreement, flagged),
        flagged,
        slate_rank: nullableNum(row.slate_rank),
        slate_games: nullableNum(row.slate_games),
        side_agent_names_sample: sampleNames(row.avatars),
      };
    });

    return {
      sport,
      dates,
      timezone: "America/New_York",
      game_count: games.length,
      consensus_game_count: games.filter((g) => g.flagged).length,
      definitions: {
        agents: "public agents with any pick on the game, across every market",
        agreement: "side_agents / market_agents — the share within the leading selection's market",
        flagged: "the app's CONSENSUS badge: many agents on one selection AND strong agreement",
        slate_rank: "rank among that date's games with at least 3 agents in the market; null below that",
        side_agent_names_sample: "up to 4 agents on the leading selection, not the full list",
      },
      games,
      ...(games.length === 0
        ? { message: `No public agent picks found for ${sport.toUpperCase()} on ${dates.join(", ")}.` }
        : {}),
    };
  },
};
