// widgetDataBuilder — Extracts widget-specific data payloads from
// raw game card objects. Each builder function returns the data shape
// expected by its corresponding ChatWidget component.

export function buildMatchupData(card: any): Record<string, unknown> {
  return {
    away_team: card.away_team,
    home_team: card.home_team,
    away_abbr: card.away_abbr,
    home_abbr: card.home_abbr,
    game_time: card.game_time,
    game_date: card.game_date,
    home_spread: card.home_spread,
    away_spread: card.away_spread,
    home_ml: card.home_ml,
    away_ml: card.away_ml,
    over_under: card.over_under,
  };
}

export function buildModelProjectionData(card: any): Record<string, unknown> {
  const raw = card.raw_game || {};
  return {
    away_team: card.away_team,
    home_team: card.home_team,
    away_abbr: card.away_abbr,
    home_abbr: card.home_abbr,
    // Model values
    model_fair_spread: raw.model_fair_home_spread ?? raw.model_fair_spread ?? null,
    model_fair_total: raw.model_fair_total ?? raw.ou_fair_total ?? null,
    home_win_prob: raw.home_away_ml_prob ?? raw.ml_home_win_prob ?? raw.home_win_prob ?? null,
    away_win_prob: raw.away_win_prob ?? raw.ml_away_win_prob ?? null,
    // Vegas values
    vegas_spread: card.home_spread,
    vegas_total: card.over_under,
    // Edges
    spread_edge: card.spread_edge,
    total_edge: card.ou_edge,
    // Picks
    spread_pick: card.spread_pick,
    ou_pick: card.ou_pick,
    ml_pick_team: card.ml_pick_team,
    ml_prob: card.ml_prob,
  };
}

export function buildPublicBettingData(card: any): Record<string, unknown> {
  const raw = card.raw_game || {};
  return {
    away_team: card.away_team,
    home_team: card.home_team,
    away_abbr: card.away_abbr,
    home_abbr: card.home_abbr,
    spread_splits_label: raw.spread_splits_label ?? null,
    ml_splits_label: raw.ml_splits_label ?? null,
    total_splits_label: raw.total_splits_label ?? null,
  };
}

export function buildInjuryData(card: any): Record<string, unknown> {
  const raw = card.raw_game || {};
  return {
    away_team: card.away_team,
    home_team: card.home_team,
    away_abbr: card.away_abbr,
    home_abbr: card.home_abbr,
    away_injuries: raw.away_injuries ?? raw.injuries?.away ?? [],
    home_injuries: raw.home_injuries ?? raw.injuries?.home ?? [],
  };
}

export function buildBettingTrendsData(card: any): Record<string, unknown> {
  const raw = card.raw_game || {};
  return {
    away_abbr: card.away_abbr,
    home_abbr: card.home_abbr,
    away_ats_pct: raw.away_ats_pct ?? null,
    home_ats_pct: raw.home_ats_pct ?? null,
    away_over_pct: raw.away_over_pct ?? null,
    home_over_pct: raw.home_over_pct ?? null,
    away_streak: raw.away_win_streak ?? raw.away_ats_streak ?? null,
    home_streak: raw.home_win_streak ?? raw.home_ats_streak ?? null,
  };
}

export function buildWeatherData(card: any): Record<string, unknown> {
  const raw = card.raw_game || {};
  return {
    temperature: raw.temperature ?? raw.temperature_f ?? null,
    wind_speed: raw.wind_speed ?? raw.wind_speed_mph ?? null,
    wind_direction: raw.wind_direction ?? null,
    precipitation: raw.precipitation ?? null,
    sky: raw.sky ?? null,
    dome: raw.dome ?? raw.is_dome ?? false,
  };
}

export function buildPolymarketData(card: any): Record<string, unknown> {
  const poly = card._polymarket || {};
  // Polymarket odds come as integers (e.g. 62 = 62%) — normalize to 0-1
  let awayOdds = poly.away_yes_price ?? null;
  let homeOdds = poly.home_yes_price ?? null;
  if (awayOdds != null && awayOdds > 1) awayOdds = awayOdds / 100;
  if (homeOdds != null && homeOdds > 1) homeOdds = homeOdds / 100;
  return {
    away_team: card.away_team,
    home_team: card.home_team,
    away_abbr: card.away_abbr,
    home_abbr: card.home_abbr,
    away_yes_price: awayOdds,
    home_yes_price: homeOdds,
    volume: null,
  };
}

const BUILDERS: Record<string, (card: any) => Record<string, unknown>> = {
  matchup: buildMatchupData,
  model_projection: buildModelProjectionData,
  polymarket: buildPolymarketData,
  public_betting: buildPublicBettingData,
  injuries: buildInjuryData,
  betting_trends: buildBettingTrendsData,
  weather: buildWeatherData,
};

/** Build widget data for a specific type from a game card */
export function buildWidgetData(
  widgetType: string,
  card: any,
): Record<string, unknown> | null {
  const builder = BUILDERS[widgetType];
  if (!builder) return null;
  return builder(card);
}
