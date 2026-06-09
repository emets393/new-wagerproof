// gameCardNormalizer — Maps sport-specific game data to a compact
// ChatGameCardData shape for inline chat rendering. Each sport has
// its own normalization function due to differing field schemas.

interface ChatGameCardData {
  sport: string;
  game_id: string;
  away_team: string;
  home_team: string;
  away_abbr: string;
  home_abbr: string;
  game_date: string;
  game_time: string;
  home_spread: number | null;
  away_spread: number | null;
  home_ml: number | null;
  away_ml: number | null;
  over_under: number | null;
  spread_pick: string | null;
  spread_confidence: number | null;
  spread_edge: number | null;
  ou_pick: "over" | "under" | null;
  ou_edge: number | null;
  ml_pick_team: string | null;
  ml_prob: number | null;
  raw_game: Record<string, unknown>;
}

/** NBA — uses nba_input_values_view + nba_predictions */
export function normalizeNBA(game: any, prediction: any): ChatGameCardData {
  const homeSpread = game.home_spread as number | null;
  const awaySpread = homeSpread != null ? -homeSpread : null;
  // Prefer the explicit away_moneyline column from nba_input_values_view;
  // fall back to the complement formula only if the DB value is missing.
  const homeML = game.home_moneyline as number | null;
  const awayML: number | null = (game.away_moneyline as number | null)
    ?? (homeML != null ? (homeML > 0 ? -(homeML + 100) : 100 - homeML) : null);

  let spreadPick: string | null = null;
  let spreadEdge: number | null = null;
  let ouPick: "over" | "under" | null = null;
  let ouEdge: number | null = null;
  let mlPickTeam: string | null = null;
  let mlProb: number | null = null;

  if (prediction) {
    // Spread pick: model fair spread vs vegas spread
    if (prediction.model_fair_home_spread != null && homeSpread != null) {
      spreadEdge = Math.round((prediction.model_fair_home_spread - homeSpread) * 100) / 100;
      spreadPick = spreadEdge < 0
        ? `${game.home_abbr || game.home_team} ${homeSpread > 0 ? "+" : ""}${homeSpread}`
        : `${game.away_abbr || game.away_team} ${awaySpread != null ? (awaySpread > 0 ? "+" : "") + awaySpread : ""}`;
      spreadEdge = Math.abs(spreadEdge);
    }
    // O/U pick
    if (prediction.model_fair_total != null && game.total_line != null) {
      const totalEdge = prediction.model_fair_total - game.total_line;
      ouPick = totalEdge > 0 ? "over" : "under";
      ouEdge = Math.round(Math.abs(totalEdge) * 10) / 10;
    }
    // ML pick
    if (prediction.home_win_prob != null) {
      mlProb = Math.round(Math.max(prediction.home_win_prob, prediction.away_win_prob || 0) * 100);
      mlPickTeam = prediction.home_win_prob >= 0.5
        ? (game.home_abbr || game.home_team)
        : (game.away_abbr || game.away_team);
    }
  }

  return {
    sport: "nba",
    game_id: String(game.game_id || ""),
    away_team: game.away_team || "",
    home_team: game.home_team || "",
    away_abbr: game.away_abbr || "",
    home_abbr: game.home_abbr || "",
    game_date: game.game_date || "",
    game_time: game.tipoff_time_et || "",
    home_spread: homeSpread,
    away_spread: awaySpread,
    home_ml: homeML,
    away_ml: awayML,
    over_under: game.total_line,
    spread_pick: spreadPick,
    spread_confidence: null,
    spread_edge: spreadEdge,
    ou_pick: ouPick,
    ou_edge: ouEdge,
    ml_pick_team: mlPickTeam,
    ml_prob: mlProb,
    raw_game: {
      // Fields the NBAGameBottomSheet needs
      id: game.game_id,
      game_id: game.game_id,
      away_team: game.away_team,
      home_team: game.home_team,
      away_abbr: game.away_abbr,
      home_abbr: game.home_abbr,
      home_ml: homeML,
      away_ml: awayML,
      home_spread: homeSpread,
      away_spread: awaySpread,
      over_line: game.total_line,
      game_date: game.game_date,
      game_time: game.tipoff_time_et,
      training_key: game.training_key,
      unique_id: game.unique_id,
      home_away_ml_prob: prediction?.home_win_prob ?? null,
      home_away_spread_cover_prob: prediction?.home_away_spread_cover_prob ?? null,
      ou_result_prob: prediction?.ou_result_prob ?? null,
      model_fair_home_spread: prediction?.model_fair_home_spread ?? null,
      model_fair_total: prediction?.model_fair_total ?? null,
      home_score_pred: prediction?.home_score_pred ?? null,
      away_score_pred: prediction?.away_score_pred ?? null,
      run_id: prediction?.run_id ?? null,
      // Betting trends for widget rendering
      away_ats_pct: game.away_ats_pct ?? null,
      home_ats_pct: game.home_ats_pct ?? null,
      away_over_pct: game.away_over_pct ?? null,
      home_over_pct: game.home_over_pct ?? null,
      away_win_streak: game.away_win_streak ?? null,
      home_win_streak: game.home_win_streak ?? null,
    },
  };
}

/** MLB — uses mlb_games_today */
export function normalizeMLB(game: any): ChatGameCardData {
  const homeSpread = game.home_spread as number | null;
  const awaySpread = game.away_spread as number | null;
  const homeML = game.home_ml as number | null;
  const awayML = game.away_ml as number | null;

  let ouPick: "over" | "under" | null = null;
  let ouEdge: number | null = null;
  let mlPickTeam: string | null = null;
  let mlProb: number | null = null;

  if (game.ou_direction) {
    ouPick = game.ou_direction === "OVER" ? "over" : "under";
  }
  if (game.ou_edge != null) {
    ouEdge = Math.round(Math.abs(game.ou_edge) * 10) / 10;
  }
  if (game.ml_home_win_prob != null) {
    const homeProb = game.ml_home_win_prob;
    const awayProb = game.ml_away_win_prob ?? (1 - homeProb);
    mlProb = Math.round(Math.max(homeProb, awayProb) * 100);
    mlPickTeam = homeProb >= 0.5
      ? (game.home_team_abbr || game.home_team_name || "")
      : (game.away_team_abbr || game.away_team_name || "");
  }

  return {
    sport: "mlb",
    game_id: String(game.game_pk || ""),
    away_team: game.away_team_name || "",
    home_team: game.home_team_name || "",
    away_abbr: game.away_team_abbr || game.away_team_name?.slice(0, 3)?.toUpperCase() || "",
    home_abbr: game.home_team_abbr || game.home_team_name?.slice(0, 3)?.toUpperCase() || "",
    game_date: game.official_date || "",
    game_time: game.game_time_et || "",
    home_spread: homeSpread,
    away_spread: awaySpread,
    home_ml: homeML,
    away_ml: awayML,
    over_under: game.total_line,
    spread_pick: null, // MLB doesn't emphasize spread picks
    spread_confidence: null,
    spread_edge: null,
    ou_pick: ouPick,
    ou_edge: ouEdge,
    ml_pick_team: mlPickTeam,
    ml_prob: mlProb,
    raw_game: { ...game },
  };
}

/** NFL — uses nfl_predictions_epa */
export function normalizeNFL(game: any): ChatGameCardData {
  const homeSpread = game.home_spread as number | null;
  const awaySpread = homeSpread != null ? -homeSpread : null;

  let spreadPick: string | null = null;
  let spreadConfidence: number | null = null;
  let ouPick: "over" | "under" | null = null;
  let mlPickTeam: string | null = null;
  let mlProb: number | null = null;

  if (game.pred_spread_pick) {
    spreadPick = `${game.pred_spread_pick}`;
    spreadConfidence = game.pred_spread_pick_confidence ?? null;
  }
  if (game.pred_ou_pick) {
    ouPick = game.pred_ou_pick.toLowerCase().includes("over") ? "over" : "under";
  }
  if (game.pred_ml_pick) {
    mlPickTeam = game.pred_ml_pick;
    mlProb = game.pred_ml_pick_confidence ? Math.round(game.pred_ml_pick_confidence * 100) : null;
  }

  return {
    sport: "nfl",
    game_id: String(game.game_id || game.id || ""),
    away_team: game.away_team || "",
    home_team: game.home_team || "",
    away_abbr: game.away_abbr || game.away_team || "",
    home_abbr: game.home_abbr || game.home_team || "",
    game_date: game.game_date || game.commence_time || "",
    game_time: game.game_time || "",
    home_spread: homeSpread,
    away_spread: awaySpread,
    home_ml: game.home_ml ?? null,
    away_ml: game.away_ml ?? null,
    over_under: game.total_line ?? game.over_line ?? null,
    spread_pick: spreadPick,
    spread_confidence: spreadConfidence,
    spread_edge: game.fair_spread != null && homeSpread != null
      ? Math.round(Math.abs(game.fair_spread - homeSpread) * 10) / 10
      : null,
    ou_pick: ouPick,
    ou_edge: game.fair_total != null && (game.total_line ?? game.over_line) != null
      ? Math.round(Math.abs(game.fair_total - (game.total_line ?? game.over_line)) * 10) / 10
      : null,
    ml_pick_team: mlPickTeam,
    ml_prob: mlProb,
    raw_game: { ...game },
  };
}

/** CFB — same structure as NFL */
export function normalizeCFB(game: any): ChatGameCardData {
  const card = normalizeNFL(game);
  card.sport = "cfb";
  return card;
}

/** NCAAB — similar to NBA but with different field names */
export function normalizeNCAAB(game: any, prediction: any): ChatGameCardData {
  const card = normalizeNBA(game, prediction);
  card.sport = "ncaab";
  return card;
}
