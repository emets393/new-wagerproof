// One-time game fetch + slate projection. fetchGamesForSport already returns
// fully-enriched formatted games (the same shape V2 stuffs whole), so V3 fetches
// once per preferred sport, caches in ctx.games, and the slate + deep tools are
// pure PROJECTIONS — no per-tool DB query, and archived_game_data stays the
// exact V2-formatted game.

import { fetchGamesForSport } from "../../shared/agentGameHelpers.ts";
import type { AgentGenContext, FormattedGame, Sport } from "./context.ts";
import type { LensName, SteeringProfile } from "../deriveSteeringProfile.ts";

const SLATE_ROW_CAP = 60; // single-page-with-trim (plan §2.3); report truncation

/** Lens → the formatted-game group it projects, and which sports carry it. */
const LENS_GROUP: Partial<Record<LensName, { group: string; sports: Sport[] }>> = {
  model_edge: { group: "model_predictions", sports: ["nfl", "cfb", "mlb"] },
  market: { group: "vegas_lines", sports: ["nfl", "cfb", "nba", "ncaab", "mlb"] },
  polymarket: { group: "polymarket", sports: ["nfl", "cfb", "nba", "ncaab", "mlb"] },
  public: { group: "public_betting", sports: ["nfl", "cfb"] },
  weather: { group: "weather", sports: ["nfl", "cfb", "mlb"] },
  ratings: { group: "team_stats", sports: ["nba", "ncaab"] },
  form: { group: "trends", sports: ["nba"] },
  ats_trends: { group: "trends", sports: ["nba", "ncaab"] },
  situational: { group: "situational_trends", sports: ["nba", "ncaab"] },
  rankings_context: { group: "team_stats", sports: ["ncaab"] },
  injuries: { group: "injuries", sports: ["nba"] },
  pitchers: { group: "starting_pitchers", sports: ["mlb"] },
  perfect_storm: { group: "perfect_storm", sports: ["mlb"] },
  statcast: { group: "signals", sports: ["mlb"] },
  line_move: { group: "line_movement", sports: ["nfl", "cfb"] },
};

export interface SlateRow {
  game_id: string;
  sport: Sport;
  matchup: string;
  game_datetime: string;
  vegas: unknown; // summary for the preferred bet type (full vegas_lines is compact enough)
  model_pick: { selection: string | null; note: string } | null;
  lenses: Record<string, unknown>;
}

export interface SlateResult {
  count: number;
  weak: boolean;
  sport_groups: { sport: Sport; count: number }[];
  lens_manifest: { lens: string; priority: number }[];
  games: SlateRow[];
  truncated: { dropped_count: number; by: "tipoff" | null };
}

const MIN_GAMES = (sports: Sport[]) => (sports.length === 1 && sports[0] === "mlb" ? 1 : 3);

/** Fetch + cache all games for the agent's preferred sports. Mutates ctx.games. */
export async function loadGames(ctx: AgentGenContext): Promise<{ total: number; bySport: { sport: Sport; count: number }[] }> {
  const bySport: { sport: Sport; count: number }[] = [];
  for (const sport of ctx.steering.preferredSports as Sport[]) {
    try {
      // V3 reads the 2026 dryrun staging tables (nfl_dryrun_games /
      // cfb_dryrun_games) — the production data contract — via the additive
      // `source: 'dryrun'` param. NFL/CFB switch tables; other sports ignore it
      // and read their legacy table. V2 omits this arg → stays on legacy.
      const { formattedGames } = await fetchGamesForSport(ctx.cfb, ctx.main, sport, ctx.targetDate, 'dryrun');
      let n = 0;
      for (const fg of formattedGames as FormattedGame[]) {
        const id = String((fg as Record<string, unknown>).game_id ?? "");
        if (!id) continue;
        ctx.games.set(id, { sport, fg });
        ctx.slateGameIds.add(id);
        n++;
      }
      bySport.push({ sport, count: n });
    } catch (e) {
      console.error(`[v3] loadGames ${sport} failed:`, e instanceof Error ? e.message : e);
      bySport.push({ sport, count: 0 });
    }
  }
  return { total: ctx.games.size, bySport };
}

/** The lenses to attach, chosen by steering: top ~4 by priority + all force lenses. */
function selectedLenses(steering: SteeringProfile): { lens: LensName; priority: number }[] {
  const entries = Object.entries(steering.lensVotes) as [LensName, number][];
  const force = entries.filter(([l]) => steering.forceLenses.includes(l));
  const rest = entries
    .filter(([l]) => !steering.forceLenses.includes(l))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const merged = [...force, ...rest];
  const seen = new Set<string>();
  return merged
    .filter(([l]) => (seen.has(l) ? false : (seen.add(l), true)))
    .map(([lens, priority]) => ({ lens, priority }));
}

function modelPick(sport: Sport, fg: FormattedGame): SlateRow["model_pick"] {
  const mp = fg.model_predictions as Record<string, unknown> | undefined;
  if (mp && typeof mp === "object") {
    if (mp.predicted_team) return { selection: String(mp.predicted_team), note: "model lean" };
    if (mp.ou_direction) return { selection: String(mp.ou_direction), note: "O/U lean" };
  }
  return null;
}

/** Build the compact, lensed slate from the cached games (host pre-executes). */
export function buildSlate(ctx: AgentGenContext): SlateResult {
  const steering = ctx.steering;
  const lenses = selectedLenses(steering);
  const lensGroups = lenses
    .map((l) => ({ ...l, def: LENS_GROUP[l.lens] }))
    .filter((l) => l.def);

  let rows: SlateRow[] = [];
  for (const [game_id, { sport, fg }] of ctx.games) {
    const lensObj: Record<string, unknown> = {};
    for (const l of lensGroups) {
      if (!l.def!.sports.includes(sport)) continue;
      const val = fg[l.def!.group];
      if (val != null) lensObj[l.lens] = val;
    }
    rows.push({
      game_id,
      sport,
      matchup: String(fg.matchup ?? `${fg.away_team} @ ${fg.home_team}`),
      game_datetime: `${fg.game_date ?? ctx.targetDate}T${fg.game_time ?? "00:00:00"}`,
      vegas: fg.vegas_lines ?? null,
      model_pick: modelPick(sport, fg),
      lenses: lensObj,
    });
  }

  let truncated = { dropped_count: 0, by: null as "tipoff" | null };
  if (rows.length > SLATE_ROW_CAP) {
    rows.sort((a, b) => a.game_datetime.localeCompare(b.game_datetime));
    truncated = { dropped_count: rows.length - SLATE_ROW_CAP, by: "tipoff" };
    rows = rows.slice(0, SLATE_ROW_CAP);
  }

  const groups = new Map<Sport, number>();
  for (const r of rows) groups.set(r.sport, (groups.get(r.sport) ?? 0) + 1);

  return {
    count: rows.length,
    weak: rows.length < MIN_GAMES(steering.preferredSports as Sport[]),
    sport_groups: [...groups.entries()].map(([sport, count]) => ({ sport, count })),
    lens_manifest: lenses.map((l) => ({ lens: l.lens, priority: l.priority })),
    games: rows,
    truncated,
  };
}
