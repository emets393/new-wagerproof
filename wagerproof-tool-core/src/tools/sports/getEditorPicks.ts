// get_editor_picks — published editor/expert analyses with graded results.
// Ported from chat get_editor_picks.ts. Per the connector's analytics framing,
// staking (`units`) is intentionally omitted from the output — we surface the
// editorial analysis and its graded outcome, not a wager size.

import { readOnly, asOptString, asSport, type Tool } from "../../types.js";

const RESULTS = ["won", "lost", "push", "pending"] as const;

export const getEditorPicks: Tool = {
  name: "get_editor_picks",
  title: "Get editor analyses",
  scope: "global",
  annotations: readOnly("Get editor analyses"),
  description:
    "Get WagerProof's published editor/expert analyses, each with the editor's " +
    "reasoning and its graded result (won/lost/push/pending). Returns up to 20 of " +
    "the most recent published analyses. Use only when the user explicitly asks " +
    "about editor or expert analyses — use get_sport_predictions for model output.",
  inputSchema: {
    type: "object",
    properties: {
      sport: {
        type: "string",
        enum: ["nfl", "nba", "cfb", "ncaab", "mlb"],
        description: "Optional league filter.",
      },
      result: {
        type: "string",
        enum: ["won", "lost", "push", "pending"],
        description: "Optional graded-result filter.",
      },
    },
    additionalProperties: false,
  },
  async execute(input, ctx) {
    const sport = asSport(input.sport);
    const result = asOptString(input.result);
    if (result && !(RESULTS as readonly string[]).includes(result)) {
      throw new Error("Invalid `result` — must be won, lost, push, or pending.");
    }

    let query = ctx.main
      .from("editors_picks")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(20);
    if (sport) query = query.eq("game_type", sport);
    if (result) query = query.eq("result", result);

    const { data: picks, error } = await query;
    if (error) throw new Error(`Editor picks query failed: ${error.message}`);
    if (!picks || picks.length === 0) {
      return { picks: [], message: "No editor analyses found matching your criteria" };
    }

    const formatted = picks.map((pick) => ({
      id: pick.id,
      game_type: pick.game_type,
      game_id: pick.game_id,
      bet_type: pick.selected_bet_type || pick.bet_type,
      selection: pick.pick_value,
      best_price: pick.best_price,
      sportsbook: pick.sportsbook,
      analysis: pick.editors_notes,
      result: pick.result,
      is_free: pick.is_free_pick,
      created_at: pick.created_at,
      game_info:
        pick.archived_game_data && typeof pick.archived_game_data === "object"
          ? {
              away_team: (pick.archived_game_data as Record<string, unknown>).awayTeam,
              home_team: (pick.archived_game_data as Record<string, unknown>).homeTeam,
              game_date: (pick.archived_game_data as Record<string, unknown>).gameDate,
            }
          : null,
    }));

    return { picks: formatted, count: formatted.length };
  },
};
