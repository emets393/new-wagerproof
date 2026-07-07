// One-time game fetch + slate projection. fetchGamesForSport already returns
// fully-enriched formatted games (the same shape V2 stuffs whole), so V3 fetches
// once per preferred sport, caches in ctx.games, and the slate + deep tools are
// pure PROJECTIONS — no per-tool DB query, and archived_game_data stays the
// exact V2-formatted game.

import { fetchGamesForSport } from "../../shared/agentGameHelpers";
import { getDateTimeInET } from "../../shared/dateUtils";
import type { AgentGenContext, FormattedGame, Sport } from "./context";
import type { LensName, SteeringProfile } from "../deriveSteeringProfile";

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
  // Week runs: never offer a game that has already kicked off (+10 min buffer)
  // — a week-long parlay must be built from the REMAINING games of the football
  // week. Dry runs skip this (dryrun football is 2025-dated; the filter would
  // drop everything). See .claude/docs/agents/16_PARLAY_AGENTS.md.
  const notStartedCutoff = ctx.window === "week" && !ctx.dryRun
    ? getDateTimeInET(new Date(Date.now() + 10 * 60 * 1000))
    : null;
  let startedDropped = 0;
  for (const sport of ctx.steering.preferredSports as Sport[]) {
    try {
      // V3 reads the same production football sources as the rest of the app.
      // NFL/CFB test slates should be seeded into those production-shaped tables
      // with upcoming dates instead of routing generation through dry-run tables.
      const { formattedGames } = await fetchGamesForSport(ctx.cfb, ctx.main, sport, ctx.targetDate);
      let n = 0;
      let pastDropped = 0;
      for (const fg of formattedGames as FormattedGame[]) {
        const id = String((fg as Record<string, unknown>).game_id ?? "");
        if (!id) continue;
        // Production runs must never be offered past games. Dry runs keep past
        // games testable if a fixture set is intentionally backdated.
        // See .claude/docs/agents/16_PARLAY_AGENTS.md (not-started rule).
        if (!ctx.dryRun) {
          const gd = String((fg as Record<string, unknown>).game_date ?? "");
          if (gd && gd < ctx.targetDate) { pastDropped++; continue; }
        }
        if (notStartedCutoff) {
          const gd = String((fg as Record<string, unknown>).game_date ?? "");
          const gt = String((fg as Record<string, unknown>).game_time ?? "00:00:00");
          if (gd && `${gd}T${gt}` <= notStartedCutoff) { startedDropped++; continue; }
        }
        ctx.games.set(id, { sport, fg });
        ctx.slateGameIds.add(id);
        n++;
      }
      if (pastDropped > 0) {
        console.log(`[v3] loadGames ${sport}: dropped ${pastDropped} past-dated game(s) (prod run)`);
      }
      bySport.push({ sport, count: n });
    } catch (e) {
      console.error(`[v3] loadGames ${sport} failed:`, e instanceof Error ? e.message : e);
      bySport.push({ sport, count: 0 });
    }
  }
  if (startedDropped > 0) {
    console.log(`[v3] loadGames: dropped ${startedDropped} already-started game(s) (week window)`);
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
    // Week windows: even one remaining game is a usable slate (runV3Generation
    // also skips the weak-slate early-out for week runs).
    weak: rows.length < (ctx.window === "week" ? 1 : MIN_GAMES(steering.preferredSports as Sport[])),
    sport_groups: [...groups.entries()].map(([sport, count]) => ({ sport, count })),
    lens_manifest: lenses.map((l) => ({ lens: l.lens, priority: l.priority })),
    games: rows,
    truncated,
  };
}

/** Serialize the slate for the seed message WITHOUT ever dropping a game — the
 *  agent must see EVERY game_id (verbatim) to be able to bet it. The generic
 *  compactDeepFetch caps every array to 12, which would hide all but the first 12
 *  games; on a multi-sport slate (NFL loaded first, MLB last) that drops whole
 *  sports, so the agent guesses ids and they all miss as not_in_slate. So the
 *  slate gets its own compaction: keep ALL rows, shed per-game DETAIL until under
 *  budget (the detail is re-fetchable via the data tools; the ids are not). */
export function compactSlate(slate: SlateResult, targetChars = 16000): string {
  const rows = slate.games as unknown as Record<string, unknown>[];
  const wrap = (games: unknown[]) => JSON.stringify({ ...slate, games });
  // Tier 1: full detail.
  let s = wrap(rows);
  if (s.length <= targetChars) return s;
  // Tier 2: drop lens detail (re-fetchable via the data tools).
  const noLens = rows.map(({ lenses: _lenses, ...rest }) => rest);
  s = wrap(noLens);
  if (s.length <= targetChars) return s;
  // Tier 3: + collapse vegas to a one-line summary.
  const lean = rows.map((r) => {
    const v = (r.vegas ?? {}) as Record<string, unknown>;
    return {
      game_id: r.game_id, sport: r.sport, matchup: r.matchup, game_datetime: r.game_datetime,
      vegas: { spread: v.spread_summary ?? null, ml: v.ml_summary ?? null, total: v.total ?? null },
      model_pick: r.model_pick,
    };
  });
  s = wrap(lean);
  if (s.length <= targetChars) return s;
  // Tier 4 (last resort): identity only — still EVERY game, never drop one.
  return wrap(rows.map((r) => ({ game_id: r.game_id, sport: r.sport, matchup: r.matchup, model_pick: r.model_pick })));
}
