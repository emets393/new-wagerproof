// Public community-agent analytics. This combines the same all-time leaderboard
// ranking used by the WagerProof apps with the selected day's picks, then
// highlights exact pick overlap among the top 10 public agents.

import {
  asOptString,
  asSport,
  readOnly,
  type Sport,
  type Tool,
  type ToolContext,
} from "../../types.js";

interface LeaderboardRow extends Record<string, unknown> {
  avatar_id: string;
  name: string;
  avatar_emoji: string | null;
  preferred_sports: string[] | null;
  total_picks: number | string | null;
  wins: number | string | null;
  losses: number | string | null;
  pushes: number | string | null;
  win_rate: number | string | null;
  net_units: number | string | null;
  current_streak: number | string | null;
}

interface RankedAgent {
  rank: number;
  agent_id: string;
  name: string;
  emoji: string | null;
  preferred_sports: string[];
  record: string;
  total_picks: number;
  win_rate: number | null;
  net_units: number;
  current_streak: number;
}

interface PickRow extends Record<string, unknown> {
  id: string;
  avatar_id: string;
  game_id: string;
  sport: string;
  matchup: string;
  game_date: string;
  bet_type: string;
  pick_selection: string;
  odds: string | null;
  confidence: number | string | null;
  result: string | null;
  created_at: string;
}

interface FormattedPick {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_rank: number;
  sport: string;
  game_id: string;
  matchup: string;
  game_date: string;
  bet_type: string;
  selection: string;
  odds: string | null;
  confidence: number | null;
  result: string | null;
  created_at: string;
}

const TOP_AGENT_COUNT = 10;
const MAX_DAILY_PICKS = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requestedDate(input: Record<string, unknown>, ctx: ToolContext): string {
  const date = asOptString(input.date) ?? ctx.today();
  if (!DATE_PATTERN.test(date)) {
    throw new Error("date must use YYYY-MM-DD format.");
  }
  return date;
}

function requestedSport(input: Record<string, unknown>): Sport | undefined {
  const raw = asOptString(input.sport);
  const sport = asSport(raw);
  if (raw && !sport) {
    throw new Error("sport must be one of nfl, nba, cfb, ncaab, or mlb.");
  }
  return sport;
}

function formatAgent(row: LeaderboardRow, index: number): RankedAgent {
  const wins = numberValue(row.wins);
  const losses = numberValue(row.losses);
  const pushes = numberValue(row.pushes);
  return {
    rank: index + 1,
    agent_id: String(row.avatar_id),
    name: String(row.name ?? "Agent"),
    emoji: row.avatar_emoji == null ? null : String(row.avatar_emoji),
    preferred_sports: Array.isArray(row.preferred_sports)
      ? row.preferred_sports.map(String)
      : [],
    record: `${wins}-${losses}-${pushes}`,
    total_picks: numberValue(row.total_picks),
    win_rate: nullableNumber(row.win_rate),
    net_units: numberValue(row.net_units),
    current_streak: numberValue(row.current_streak),
  };
}

function formatPick(row: PickRow, agent: RankedAgent): FormattedPick {
  return {
    id: String(row.id),
    agent_id: String(row.avatar_id),
    agent_name: agent.name,
    agent_rank: agent.rank,
    sport: String(row.sport),
    game_id: String(row.game_id),
    matchup: String(row.matchup),
    game_date: String(row.game_date),
    bet_type: String(row.bet_type),
    selection: String(row.pick_selection),
    odds: row.odds == null ? null : String(row.odds),
    confidence: nullableNumber(row.confidence),
    result: row.result == null ? null : String(row.result),
    created_at: String(row.created_at),
  };
}

function overlapKey(pick: FormattedPick): string {
  return [
    pick.game_id,
    pick.bet_type.trim().toLowerCase(),
    pick.selection.trim().toLowerCase(),
  ].join("\u0000");
}

function buildSharedPicks(picks: FormattedPick[], topAgentCount: number) {
  const groups = new Map<string, FormattedPick[]>();
  for (const pick of picks) {
    const key = overlapKey(pick);
    const group = groups.get(key) ?? [];
    group.push(pick);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      // A malformed duplicate row must not inflate consensus. The database
      // normally enforces one pick per agent/game/bet type.
      const byAgent = new Map<string, FormattedPick>();
      for (const pick of group) byAgent.set(pick.agent_id, pick);
      const unique = [...byAgent.values()].sort((a, b) => a.agent_rank - b.agent_rank);
      const first = unique[0];
      return {
        sport: first.sport,
        game_id: first.game_id,
        matchup: first.matchup,
        game_date: first.game_date,
        bet_type: first.bet_type,
        selection: first.selection,
        agent_count: unique.length,
        share_of_top_agents:
          Math.round((unique.length / Math.max(topAgentCount, 1)) * 1000) / 1000,
        agents: unique.map((pick) => ({
          rank: pick.agent_rank,
          agent_id: pick.agent_id,
          name: pick.agent_name,
          odds: pick.odds,
          confidence: pick.confidence,
        })),
      };
    })
    .filter((group) => group.agent_count >= 2)
    .sort((a, b) => {
      if (b.agent_count !== a.agent_count) return b.agent_count - a.agent_count;
      const aBestRank = a.agents[0]?.rank ?? Number.MAX_SAFE_INTEGER;
      const bBestRank = b.agents[0]?.rank ?? Number.MAX_SAFE_INTEGER;
      if (aBestRank !== bBestRank) return aBestRank - bBestRank;
      return `${a.game_id}:${a.bet_type}:${a.selection}`.localeCompare(
        `${b.game_id}:${b.bet_type}:${b.selection}`,
      );
    });
}

export const getTopCommunityAgentPicks: Tool = {
  name: "get_top_community_agent_picks",
  title: "Get top community agents' picks",
  scope: "global",
  description:
    "Get the overall top 10 public WagerProof community agents and their picks for " +
    "one day, plus exact picks shared by two or more of those agents. Rankings use " +
    "the public all-time leaderboard (net units, then win rate and current streak). " +
    "Use this for questions about what today's top agents are picking or have in common.",
  annotations: readOnly("Get top community agents' picks"),
  inputSchema: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "Game date in YYYY-MM-DD format (defaults to today in US Eastern Time).",
      },
      sport: {
        type: "string",
        enum: ["nfl", "nba", "cfb", "ncaab", "mlb"],
        description: "Optional sport filter for both the leaderboard and picks.",
      },
    },
    additionalProperties: false,
  },
  async execute(input, ctx) {
    const date = requestedDate(input, ctx);
    const sport = requestedSport(input);

    const { data: leaderboardData, error: leaderboardError } = await ctx.main.rpc<
      LeaderboardRow[]
    >("get_leaderboard_v2", {
      p_limit: TOP_AGENT_COUNT,
      p_sport: sport ?? null,
      p_sort_mode: "overall",
      p_timeframe: "all_time",
      p_exclude_under_10_picks: false,
      p_viewer_user_id: null,
    });
    if (leaderboardError) {
      throw new Error(`leaderboard query failed: ${leaderboardError.message}`);
    }

    const topAgents = (leaderboardData ?? []).map(formatAgent);
    if (topAgents.length === 0) {
      return {
        date,
        timezone: "America/New_York",
        sport: sport ?? null,
        ranking_basis: "all-time net units, then win rate and current streak",
        top_agent_count: 0,
        top_agents_with_picks: 0,
        pick_count: 0,
        shared_pick_count: 0,
        top_agents: [],
        shared_picks: [],
        picks: [],
        message: "No public agents qualified for the leaderboard.",
      };
    }

    const agentById = new Map(topAgents.map((agent) => [agent.agent_id, agent]));
    let picksQuery = ctx.main
      .from<PickRow>("avatar_picks")
      .select(
        "id, avatar_id, game_id, sport, matchup, game_date, bet_type, " +
          "pick_selection, odds, confidence, result, created_at",
      )
      .in("avatar_id", topAgents.map((agent) => agent.agent_id))
      .eq("game_date", date)
      .order("created_at", { ascending: false })
      .limit(MAX_DAILY_PICKS);
    if (sport) picksQuery = picksQuery.eq("sport", sport);

    const { data: pickData, error: picksError } = await picksQuery;
    if (picksError) throw new Error(`top-agent picks query failed: ${picksError.message}`);

    const picks = (pickData ?? [])
      .map((row) => {
        const agent = agentById.get(String(row.avatar_id));
        return agent ? formatPick(row, agent) : null;
      })
      .filter((pick): pick is FormattedPick => pick !== null);
    const sharedPicks = buildSharedPicks(picks, topAgents.length);
    const agentsWithPicks = new Set(picks.map((pick) => pick.agent_id));

    return {
      date,
      timezone: "America/New_York",
      sport: sport ?? null,
      ranking_basis: "all-time net units, then win rate and current streak",
      overlap_definition:
        "same game_id, bet_type, and case-insensitive trimmed selection",
      top_agent_count: topAgents.length,
      top_agents_with_picks: agentsWithPicks.size,
      pick_count: picks.length,
      shared_pick_count: sharedPicks.length,
      top_agents: topAgents,
      shared_picks: sharedPicks,
      picks,
    };
  },
};

export const communityAnalyticsTools: Tool[] = [getTopCommunityAgentPicks];
