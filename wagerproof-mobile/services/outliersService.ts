import { supabase, collegeFootballSupabase } from './supabase';

export interface GameSummary {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab' | 'mlb';
  awayTeam: string;
  homeTeam: string;
  gameTime?: string;
  cfbId?: number;
  nbaId?: string;
  ncaabId?: string;
  
  // Betting lines
  awaySpread?: number | null;
  homeSpread?: number | null;
  totalLine?: number | null;
  awayMl?: number | null;
  homeMl?: number | null;

  // Team logos and abbreviations (from database mappings)
  awayTeamLogo?: string | null;
  homeTeamLogo?: string | null;
  awayTeamAbbrev?: string | null;
  homeTeamAbbrev?: string | null;

  // Original data object for passing to game sheets
  originalData?: any;
}

export interface ValueAlert {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab' | 'mlb';
  awayTeam: string;
  homeTeam: string;
  marketType: string;
  side: string;
  percentage: number;
  game: GameSummary; // Link back to full game details
}

export interface FadeAlert {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab' | 'mlb';
  awayTeam: string;
  homeTeam: string;
  pickType: string;
  predictedTeam: string;
  confidence: number;
  game: GameSummary; // Link back to full game details
}

// Helper to get dates
const getDates = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const today = `${year}-${month}-${day}`;

  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  const nextParts = formatter.formatToParts(nextWeek);
  const nextYear = nextParts.find(p => p.type === 'year')?.value;
  const nextMonth = nextParts.find(p => p.type === 'month')?.value;
  const nextDay = nextParts.find(p => p.type === 'day')?.value;
  const weekFromNow = `${nextYear}-${nextMonth}-${nextDay}`;

  return { today, weekFromNow };
};

// Helper to calculate away ML from home ML
const calculateAwayML = (homeML: number | null): number | null => {
  if (homeML === null) return null;
  return homeML > 0 ? -(homeML + 100) : 100 - homeML;
};

export const fetchWeekGames = async (): Promise<GameSummary[]> => {
  const { today, weekFromNow } = getDates();
  const gameSummaries: GameSummary[] = [];

  // 1. Fetch NFL Games
  try {
    const { data: nflGames } = await collegeFootballSupabase
      .from('v_input_values_with_epa')
      .select('*')
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true });

    // Fetch betting lines for moneylines and public betting data
    const { data: bettingLines } = await collegeFootballSupabase
      .from('nfl_betting_lines')
      .select(`
        training_key, home_ml, away_ml, home_spread, over_line, game_time_et,
        home_ml_handle, away_ml_handle, home_ml_bets, away_ml_bets, ml_splits_label,
        home_spread_handle, away_spread_handle, home_spread_bets, away_spread_bets, spread_splits_label,
        over_handle, under_handle, over_bets, under_bets, total_splits_label
      `)
      .order('as_of_ts', { ascending: false });

    // Create a map of most recent betting lines per training_key
    const bettingLinesMap = new Map<string, any>();
    if (bettingLines) {
      for (const line of bettingLines) {
        if (!bettingLinesMap.has(line.training_key)) {
          bettingLinesMap.set(line.training_key, line);
        }
      }
    }

    if (nflGames) {
      for (const game of nflGames) {
        const gameDate = game.game_date;
        if (gameDate >= today && gameDate <= weekFromNow) {
          const bettingLine = bettingLinesMap.get(game.home_away_unique);

          // Use game_time_et from betting lines if available, otherwise construct from game data
          let gameTimeValue: string | undefined;
          if (bettingLine?.game_time_et) {
            gameTimeValue = bettingLine.game_time_et;
          } else if (game.game_date && game.game_time) {
            gameTimeValue = `${game.game_date}T${game.game_time}`;
          }

          gameSummaries.push({
            gameId: game.home_away_unique,
            sport: 'nfl',
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            gameTime: gameTimeValue,
            awaySpread: bettingLine?.home_spread ? -bettingLine.home_spread : (game.home_spread ? -game.home_spread : null),
            homeSpread: bettingLine?.home_spread || game.home_spread,
            totalLine: bettingLine?.over_line || game.ou_vegas_line,
            homeMl: bettingLine?.home_ml || null,
            awayMl: bettingLine?.away_ml || null,
            originalData: {
                ...game,
                id: game.id || game.home_away_unique,
                training_key: game.home_away_unique,
                unique_id: game.unique_id || game.home_away_unique,
                home_spread: bettingLine?.home_spread || game.home_spread,
                over_line: bettingLine?.over_line || game.ou_vegas_line,
                home_ml: bettingLine?.home_ml || null,
                away_ml: bettingLine?.away_ml || null,
                game_time_et: gameTimeValue,
                // Public betting data for PublicBettingBars
                home_ml_handle: bettingLine?.home_ml_handle || null,
                away_ml_handle: bettingLine?.away_ml_handle || null,
                home_ml_bets: bettingLine?.home_ml_bets || null,
                away_ml_bets: bettingLine?.away_ml_bets || null,
                ml_splits_label: bettingLine?.ml_splits_label || null,
                home_spread_handle: bettingLine?.home_spread_handle || null,
                away_spread_handle: bettingLine?.away_spread_handle || null,
                home_spread_bets: bettingLine?.home_spread_bets || null,
                away_spread_bets: bettingLine?.away_spread_bets || null,
                spread_splits_label: bettingLine?.spread_splits_label || null,
                over_handle: bettingLine?.over_handle || null,
                under_handle: bettingLine?.under_handle || null,
                over_bets: bettingLine?.over_bets || null,
                under_bets: bettingLine?.under_bets || null,
                total_splits_label: bettingLine?.total_splits_label || null,
            }
          });
        }
      }
    }
  } catch (e) {
    console.error('Error fetching NFL games:', e);
  }

  // 2. Fetch CFB Games
  try {
    const { data: cfbGames } = await collegeFootballSupabase
      .from('cfb_live_weekly_inputs')
      .select('*');

    if (cfbGames) {
      for (const game of cfbGames) {
        const startTimeString = game.start_date || game.start_time || game.game_datetime || game.datetime || game.date;
        let gameDate: string | null = null;
        
        if (startTimeString) {
          try {
            const utcDate = new Date(startTimeString);
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
            const parts = formatter.formatToParts(utcDate);
            const year = parts.find(p => p.type === 'year')?.value;
            const month = parts.find(p => p.type === 'month')?.value;
            const day = parts.find(p => p.type === 'day')?.value;
            gameDate = `${year}-${month}-${day}`;
          } catch (e) {
            // ignore
          }
        }

        if (gameDate && gameDate >= today && gameDate <= weekFromNow) {
          gameSummaries.push({
            gameId: game.training_key || game.id,
            sport: 'cfb',
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            gameTime: startTimeString,
            cfbId: game.id,
            awaySpread: game.away_spread || (game.api_spread ? -game.api_spread : null),
            homeSpread: game.home_spread || game.api_spread,
            totalLine: game.total_line || game.api_over_line,
            awayMl: game.away_moneyline || game.away_ml,
            homeMl: game.home_moneyline || game.home_ml,
            originalData: {
                ...game,
                id: game.id,
                training_key: game.training_key,
                unique_id: game.unique_id || `${game.away_team}_${game.home_team}_${startTimeString}`,
                game_date: startTimeString, // Important for sorting/display
            }
          });
        }
      }
    }
  } catch (e) {
    console.error('Error fetching CFB games:', e);
  }

  // 3. Fetch NBA Games
  try {
    const { data: nbaGames } = await collegeFootballSupabase
      .from('nba_input_values_view')
      .select('*')
      .order('game_date', { ascending: true });

    if (nbaGames) {
      for (const game of nbaGames) {
        let gameDate = game.game_date; // Default
        if (game.tipoff_time_et) {
          try {
            const utcDate = new Date(game.tipoff_time_et);
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
            const parts = formatter.formatToParts(utcDate);
            const year = parts.find(p => p.type === 'year')?.value;
            const month = parts.find(p => p.type === 'month')?.value;
            const day = parts.find(p => p.type === 'day')?.value;
            gameDate = `${year}-${month}-${day}`;
          } catch (e) {
             // ignore
          }
        }

        if (gameDate && gameDate >= today && gameDate <= weekFromNow) {
          const gameIdStr = game.training_key || game.unique_id || String(game.game_id);
          const homeML = game.home_moneyline;
          const awayML = calculateAwayML(homeML);

          gameSummaries.push({
            gameId: gameIdStr,
            sport: 'nba',
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            gameTime: game.tipoff_time_et || game.game_date,
            nbaId: String(game.game_id),
            awaySpread: game.home_spread ? -game.home_spread : null,
            homeSpread: game.home_spread,
            totalLine: game.total_line,
            homeMl: homeML,
            awayMl: awayML,
            originalData: {
                ...game,
                id: gameIdStr,
                game_id: game.game_id,
                training_key: gameIdStr,
                unique_id: gameIdStr,
                away_abbr: (game.away_abbr && game.away_abbr.trim()) || game.away_team || 'AWAY',
                home_abbr: (game.home_abbr && game.home_abbr.trim()) || game.home_team || 'HOME',
                home_spread: game.home_spread,
                away_spread: game.home_spread ? -game.home_spread : null,
                over_line: game.total_line,
                home_ml: homeML,
                away_ml: awayML,
                game_time: game.tipoff_time_et,
            }
          });
        }
      }
    }
  } catch (e) {
    console.error('Error fetching NBA games:', e);
  }

  // 4. Fetch NCAAB Games (with team mapping for logos/abbreviations)
  try {
    const [{ data: ncaabGames }, { data: teamMappings }] = await Promise.all([
      collegeFootballSupabase
        .from('v_cbb_input_values')
        .select('*')
        .order('game_date_et', { ascending: true }),
      collegeFootballSupabase
        .from('ncaab_team_mapping')
        .select('api_team_id, espn_team_id, team_abbrev'),
    ]);

    // Build team mapping for logos and abbreviations
    const teamMappingMap = new Map<string, { logo: string | null; abbrev: string | null }>();
    if (teamMappings) {
      for (const mapping of teamMappings) {
        const key = String(mapping.api_team_id);
        let logoUrl: string | null = null;
        if (mapping.espn_team_id != null) {
          logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${mapping.espn_team_id}.png`;
        }
        teamMappingMap.set(key, { logo: logoUrl, abbrev: mapping.team_abbrev || null });
      }
    }

    if (ncaabGames) {
      for (const game of ncaabGames) {
        let gameDate = game.game_date_et;
        const dateTimeSource = game.start_utc || game.tipoff_time_et;
        if (dateTimeSource) {
          try {
            const utcDate = new Date(dateTimeSource);
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
            const parts = formatter.formatToParts(utcDate);
            const year = parts.find(p => p.type === 'year')?.value;
            const month = parts.find(p => p.type === 'month')?.value;
            const day = parts.find(p => p.type === 'day')?.value;
            gameDate = `${year}-${month}-${day}`;
          } catch (e) {
            // ignore
          }
        }

        if (gameDate && gameDate >= today && gameDate <= weekFromNow) {
          const gameIdStr = game.training_key || game.unique_id || String(game.game_id);

          // Look up team logos and abbreviations
          const homeMapping = game.home_team_id != null ? teamMappingMap.get(String(game.home_team_id)) : undefined;
          const awayMapping = game.away_team_id != null ? teamMappingMap.get(String(game.away_team_id)) : undefined;

          gameSummaries.push({
            gameId: gameIdStr,
            sport: 'ncaab',
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            gameTime: game.start_utc || game.tipoff_time_et || game.game_date_et,
            ncaabId: String(game.game_id),
            awaySpread: game.spread ? -game.spread : null,
            homeSpread: game.spread,
            totalLine: game.over_under,
            homeMl: game.homeMoneyline,
            awayMl: game.awayMoneyline,
            awayTeamLogo: awayMapping?.logo || null,
            homeTeamLogo: homeMapping?.logo || null,
            awayTeamAbbrev: awayMapping?.abbrev || null,
            homeTeamAbbrev: homeMapping?.abbrev || null,
            originalData: {
                ...game,
                id: gameIdStr,
                game_id: game.game_id,
                training_key: gameIdStr,
                unique_id: gameIdStr,
                home_ml: game.homeMoneyline,
                away_ml: game.awayMoneyline,
                home_spread: game.spread,
                away_spread: game.spread ? -game.spread : null,
                over_line: game.over_under,
                game_date: game.game_date_et,
                game_time: game.start_utc || game.tipoff_time_et,
                home_team_logo: homeMapping?.logo || null,
                away_team_logo: awayMapping?.logo || null,
                home_team_abbrev: homeMapping?.abbrev || null,
                away_team_abbrev: awayMapping?.abbrev || null,
            }
          });
        }
      }
    }
  } catch (e) {
    console.error('Error fetching NCAAB games:', e);
  }

  // --- Hydrate all games with prediction data so bottom sheets show model details ---
  await hydratePredictions(gameSummaries);

  return gameSummaries;
};

/**
 * Fetch prediction data for all sports and merge into each game's originalData.
 * This ensures bottom sheets opened from outlier cards have full model details.
 */
const hydratePredictions = async (games: GameSummary[]) => {
  const nflGames = games.filter(g => g.sport === 'nfl');
  const cfbGames = games.filter(g => g.sport === 'cfb');
  const nbaGames = games.filter(g => g.sport === 'nba');
  const ncaabGames = games.filter(g => g.sport === 'ncaab');

  // NFL predictions
  if (nflGames.length > 0) {
    try {
      const { data: latestRun } = await collegeFootballSupabase
        .from('nfl_predictions_epa')
        .select('run_id')
        .order('run_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRun) {
        const gameIds = nflGames.map(g => g.gameId);
        const { data: predictions } = await collegeFootballSupabase
          .from('nfl_predictions_epa')
          .select('*')
          .eq('run_id', latestRun.run_id)
          .in('training_key', gameIds);

        const predMap = new Map((predictions || []).map(p => [p.training_key, p]));
        for (const game of nflGames) {
          const pred = predMap.get(game.gameId);
          if (pred && game.originalData) {
            game.originalData.home_away_spread_cover_prob = pred.home_away_spread_cover_prob;
            game.originalData.ou_result_prob = pred.ou_result_prob;
            game.originalData.home_away_ml_prob = pred.home_away_ml_prob;
          }
        }
      }
    } catch (e) {
      console.error('Error hydrating NFL predictions:', e);
    }
  }

  // CFB predictions
  if (cfbGames.length > 0) {
    try {
      const { data: predictions } = await collegeFootballSupabase
        .from('cfb_api_predictions')
        .select('*');

      const predMap = new Map((predictions || []).map(p => [p.id, p]));
      for (const game of cfbGames) {
        if (!game.cfbId) continue;
        const pred = predMap.get(game.cfbId);
        if (pred && game.originalData) {
          Object.assign(game.originalData, pred);
          game.originalData.id = game.cfbId;
        }
      }
    } catch (e) {
      console.error('Error hydrating CFB predictions:', e);
    }
  }

  // NBA predictions — match main games page approach: fetch all, keep latest per game by as_of_ts_utc
  if (nbaGames.length > 0) {
    try {
      const gameIds = nbaGames.map(g => Number(g.nbaId));
      const { data: allPredictions } = await collegeFootballSupabase
        .from('nba_predictions')
        .select('game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id, as_of_ts_utc');

      // Keep latest prediction per game_id (by as_of_ts_utc)
      const predMap = new Map<string, any>();
      if (allPredictions) {
        for (const pred of allPredictions) {
          if (!gameIds.includes(pred.game_id)) continue;
          const key = String(pred.game_id);
          const existing = predMap.get(key);
          if (!existing || (pred.as_of_ts_utc && (!existing.as_of_ts_utc || pred.as_of_ts_utc > existing.as_of_ts_utc))) {
            predMap.set(key, pred);
          }
        }
      }

      console.log(`🏀 Outliers NBA hydration: predictions=${allPredictions?.length || 0}, matched=${predMap.size}/${nbaGames.length}`);

      for (const game of nbaGames) {
        if (!game.nbaId) continue;
        const pred = predMap.get(game.nbaId);
        if (pred && game.originalData) {
          game.originalData.home_win_prob = pred.home_win_prob;
          game.originalData.home_away_ml_prob = pred.home_win_prob || null;
          game.originalData.model_fair_total = pred.model_fair_total;
          game.originalData.model_fair_home_spread = pred.model_fair_home_spread;
          game.originalData.home_score_pred = pred.home_score_pred;
          game.originalData.away_score_pred = pred.away_score_pred;
          game.originalData.run_id = pred.run_id;

          // Calculate spread cover prob (matches main games page logic)
          const homeSpread = game.originalData.home_spread;
          if (pred.model_fair_home_spread !== null && homeSpread !== null) {
            const spreadDiff = Math.abs(pred.model_fair_home_spread - homeSpread);
            if (pred.model_fair_home_spread < homeSpread) {
              game.originalData.home_away_spread_cover_prob = 0.5 + Math.min(spreadDiff * 0.05, 0.35);
            } else {
              game.originalData.home_away_spread_cover_prob = 0.5 - Math.min(spreadDiff * 0.05, 0.35);
            }
          } else if (pred.home_win_prob) {
            game.originalData.home_away_spread_cover_prob = pred.home_win_prob;
          }

          // Calculate O/U prob (matches main games page logic)
          const totalLine = game.originalData.over_line;
          if (pred.model_fair_total !== null && totalLine !== null) {
            const totalDiff = pred.model_fair_total - totalLine;
            if (totalDiff > 0) {
              game.originalData.ou_result_prob = 0.5 + Math.min(Math.abs(totalDiff) * 0.02, 0.35);
            } else {
              game.originalData.ou_result_prob = 0.5 - Math.min(Math.abs(totalDiff) * 0.02, 0.35);
            }
          }

          // Calculate diffs for fade alerts
          if (pred.model_fair_home_spread !== null && homeSpread !== null) {
            game.originalData.home_spread_diff = pred.model_fair_home_spread - homeSpread;
          }
          if (pred.model_fair_total !== null && totalLine !== null) {
            game.originalData.over_line_diff = pred.model_fair_total - totalLine;
          }
        }
      }
    } catch (e) {
      console.error('Error hydrating NBA predictions:', e);
    }
  }

  // NCAAB predictions
  if (ncaabGames.length > 0) {
    try {
      const { data: latestRun } = await collegeFootballSupabase
        .from('ncaab_predictions')
        .select('run_id')
        .order('as_of_ts_utc', { ascending: false })
        .limit(1)
        .maybeSingle();

      const gameIds = ncaabGames.map(g => Number(g.ncaabId));
      let predictions: any[] | null = null;
      if (latestRun?.run_id) {
        const { data } = await collegeFootballSupabase
          .from('ncaab_predictions')
          .select('*')
          .eq('run_id', latestRun.run_id)
          .in('game_id', gameIds);
        predictions = data;
      }

      console.log(`🏀 Outliers NCAAB hydration: run_id=${latestRun?.run_id}, gameIds=${gameIds.length}, predictions=${predictions?.length || 0}`);
      const predMap = new Map((predictions || []).map(p => [String(p.game_id), p]));
      let matched = 0;
      for (const game of ncaabGames) {
        if (!game.ncaabId) continue;
        const pred = predMap.get(game.ncaabId);
        if (pred && game.originalData) {
          matched++;
          game.originalData.home_win_prob = pred.home_win_prob;
          game.originalData.home_away_ml_prob = pred.home_win_prob || null;
          game.originalData.pred_total_points = pred.pred_total_points;
          game.originalData.model_fair_home_spread = pred.model_fair_home_spread;
          // NCAAB: use home_win_prob as spread cover proxy (matches main games page)
          game.originalData.home_away_spread_cover_prob = pred.home_away_spread_cover_prob || pred.home_win_prob || null;
          // NCAAB: calculate ou_result_prob from pred_total_points vs vegas line (matches main games page)
          const vegasTotal = pred.vegas_total || game.originalData.over_line;
          game.originalData.ou_result_prob = pred.ou_result_prob ||
            (pred.pred_total_points && vegasTotal
              ? (pred.pred_total_points > vegasTotal ? 0.6 : 0.4)
              : null);
          game.originalData.home_score_pred = pred.home_score_pred;
          game.originalData.away_score_pred = pred.away_score_pred;
          game.originalData.pred_home_margin = pred.pred_home_margin;
          game.originalData.home_spread_diff = pred.home_spread_diff;
          game.originalData.over_line_diff = pred.over_line_diff;
          game.originalData.run_id = pred.run_id;
          // Update vegas lines from predictions if available (more recent)
          if (pred.vegas_home_spread) {
            game.originalData.home_spread = pred.vegas_home_spread;
            game.originalData.away_spread = -pred.vegas_home_spread;
          }
          if (pred.vegas_total) {
            game.originalData.over_line = pred.vegas_total;
          }
          if (pred.vegas_home_moneyline) game.originalData.home_ml = pred.vegas_home_moneyline;
          if (pred.vegas_away_moneyline) game.originalData.away_ml = pred.vegas_away_moneyline;
        }
      }
      console.log(`🏀 Outliers NCAAB hydration matched: ${matched}/${ncaabGames.length} games`);
    } catch (e) {
      console.error('Error hydrating NCAAB predictions:', e);
    }
  }
};

export const fetchValueAlerts = async (weekGames: GameSummary[]): Promise<ValueAlert[]> => {
  const alerts: ValueAlert[] = [];
  if (!weekGames || weekGames.length === 0) return alerts;

  const gamesByLeague = new Map<'nfl' | 'cfb' | 'nba' | 'ncaab' | 'mlb', GameSummary[]>();
  for (const game of weekGames) {
    const existing = gamesByLeague.get(game.sport) || [];
    existing.push(game);
    gamesByLeague.set(game.sport, existing);
  }

  type CachedMarket = {
    game_key: string;
    market_type: 'moneyline' | 'spread' | 'total';
    current_away_odds: number;
    current_home_odds: number;
  };

  const marketsByGameKey = new Map<string, CachedMarket[]>();

  for (const [league, games] of gamesByLeague.entries()) {
    const gameKeys = Array.from(
      new Set(games.map((game) => `${game.sport}_${game.awayTeam}_${game.homeTeam}`))
    );
    if (gameKeys.length === 0) continue;

    try {
      const { data: markets, error } = await supabase
        .from('polymarket_markets')
        .select('game_key, market_type, current_away_odds, current_home_odds')
        .eq('league', league)
        .in('game_key', gameKeys);

      if (error) {
        console.error('Error fetching cached polymarket markets:', error);
        continue;
      }

      for (const market of (markets || []) as CachedMarket[]) {
        const existing = marketsByGameKey.get(market.game_key) || [];
        existing.push(market);
        marketsByGameKey.set(market.game_key, existing);
      }
    } catch (error) {
      console.error('Error loading cached value alert markets:', error);
    }
  }

  for (const game of weekGames) {
    const gameKey = `${game.sport}_${game.awayTeam}_${game.homeTeam}`;
    const markets = marketsByGameKey.get(gameKey);
    if (!markets) continue;

    for (const market of markets) {
      // Skip stale/invalid markets (resolved, no liquidity, or nonsensical odds)
      const awayOdds = market.current_away_odds ?? 0;
      const homeOdds = market.current_home_odds ?? 0;
      if (awayOdds >= 95 || homeOdds >= 95 ||
          awayOdds <= 5 || homeOdds <= 5 ||
          awayOdds + homeOdds < 80) {
        continue;
      }

      // Spread
      if (market.market_type === 'spread') {
        if (market.current_away_odds > 57) {
          alerts.push({
            gameId: game.gameId,
            sport: game.sport,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            marketType: 'Spread',
            side: game.awayTeam,
            percentage: market.current_away_odds,
            game
          });
        }
        if (market.current_home_odds > 57) {
          alerts.push({
            gameId: game.gameId,
            sport: game.sport,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            marketType: 'Spread',
            side: game.homeTeam,
            percentage: market.current_home_odds,
            game
          });
        }
      }

      // Total
      if (market.market_type === 'total') {
        if (market.current_away_odds > 57) {
          alerts.push({
            gameId: game.gameId,
            sport: game.sport,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            marketType: 'Total',
            side: 'Over',
            percentage: market.current_away_odds,
            game
          });
        }
        if (market.current_home_odds > 57) {
          alerts.push({
            gameId: game.gameId,
            sport: game.sport,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            marketType: 'Total',
            side: 'Under',
            percentage: market.current_home_odds,
            game
          });
        }
      }

      // Moneyline
      // Skip if sportsbook odds are -200 or worse (heavy favorite = no value)
      if (market.market_type === 'moneyline') {
        // Away team: check if odds are NOT -200 or worse (i.e., odds > -200 or positive)
        const awayOddsHaveValue = !game.awayMl || game.awayMl > -200;
        if (market.current_away_odds >= 85 && awayOddsHaveValue) {
          alerts.push({
            gameId: game.gameId,
            sport: game.sport,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            marketType: 'Moneyline',
            side: game.awayTeam,
            percentage: market.current_away_odds,
            game
          });
        }
        // Home team: check if odds are NOT -200 or worse (i.e., odds > -200 or positive)
        const homeOddsHaveValue = !game.homeMl || game.homeMl > -200;
        if (market.current_home_odds >= 85 && homeOddsHaveValue) {
          alerts.push({
            gameId: game.gameId,
            sport: game.sport,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
            marketType: 'Moneyline',
            side: game.homeTeam,
            percentage: market.current_home_odds,
            game
          });
        }
      }
    }
  }

  return alerts;
};

export const fetchFadeAlerts = async (weekGames: GameSummary[]): Promise<FadeAlert[]> => {
  const alerts: FadeAlert[] = [];
  if (!weekGames || weekGames.length === 0) return alerts;

  const nflGames = weekGames.filter(g => g.sport === 'nfl');
  const cfbGames = weekGames.filter(g => g.sport === 'cfb');
  const nbaGames = weekGames.filter(g => g.sport === 'nba');
  const ncaabGames = weekGames.filter(g => g.sport === 'ncaab');

  // NFL - predictions already hydrated by fetchWeekGames
  for (const game of nflGames) {
    const data = game.originalData;
    if (!data) continue;

    if (data.home_away_spread_cover_prob !== null && data.home_away_spread_cover_prob !== undefined) {
      const isHome = data.home_away_spread_cover_prob > 0.5;
      const confidence = Math.round((isHome ? data.home_away_spread_cover_prob : 1 - data.home_away_spread_cover_prob) * 100);
      if (confidence >= 80) {
        alerts.push({
          gameId: game.gameId,
          sport: 'nfl',
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          pickType: 'Spread',
          predictedTeam: isHome ? game.homeTeam : game.awayTeam,
          confidence,
          game
        });
      }
    }
    if (data.ou_result_prob !== null && data.ou_result_prob !== undefined) {
      const isOver = data.ou_result_prob > 0.5;
      const confidence = Math.round((isOver ? data.ou_result_prob : 1 - data.ou_result_prob) * 100);
      if (confidence >= 80) {
        alerts.push({
          gameId: game.gameId,
          sport: 'nfl',
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          pickType: 'Total',
          predictedTeam: isOver ? 'Over' : 'Under',
          confidence,
          game
        });
      }
    }
  }

  // CFB - predictions already hydrated by fetchWeekGames
  for (const game of cfbGames) {
    const data = game.originalData;
    if (!data) continue;

    const spreadEdge = data.home_spread_diff;
    if (spreadEdge !== null && spreadEdge !== undefined && Math.abs(spreadEdge) > 10) {
      alerts.push({
        gameId: game.gameId,
        sport: 'cfb',
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        pickType: 'Spread',
        predictedTeam: spreadEdge > 0 ? game.homeTeam : game.awayTeam,
        confidence: Math.round(Math.abs(spreadEdge)),
        game
      });
    }

    const totalEdge = data.over_line_diff;
    if (totalEdge !== null && totalEdge !== undefined && Math.abs(totalEdge) > 10) {
      alerts.push({
        gameId: game.gameId,
        sport: 'cfb',
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        pickType: 'Total',
        predictedTeam: totalEdge > 0 ? 'Over' : 'Under',
        confidence: Math.round(Math.abs(totalEdge)),
        game
      });
    }
  }

  // NBA - Only spread fade alerts (no O/U), threshold 9.5. Predictions already hydrated.
  for (const game of nbaGames) {
    const data = game.originalData;
    if (!data) continue;

    const spreadEdge = data.home_spread_diff;
    if (spreadEdge !== null && spreadEdge !== undefined && Math.abs(spreadEdge) >= 9.5) {
      alerts.push({
        gameId: game.gameId,
        sport: 'nba',
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        pickType: 'Spread',
        predictedTeam: spreadEdge > 0 ? game.homeTeam : game.awayTeam,
        confidence: Math.round(Math.abs(spreadEdge)),
        game
      });
    }
  }

  // NCAAB - predictions already hydrated by fetchWeekGames
  for (const game of ncaabGames) {
    const data = game.originalData;
    if (!data) continue;

    const spreadEdge = data.home_spread_diff;
    if (spreadEdge !== null && spreadEdge !== undefined && Math.abs(spreadEdge) > 5) {
      alerts.push({
        gameId: game.gameId,
        sport: 'ncaab',
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        pickType: 'Spread',
        predictedTeam: spreadEdge > 0 ? game.homeTeam : game.awayTeam,
        confidence: Math.round(Math.abs(spreadEdge)),
        game
      });
    }

    const totalEdge = data.over_line_diff;
    if (totalEdge !== null && totalEdge !== undefined && Math.abs(totalEdge) > 5) {
      alerts.push({
        gameId: game.gameId,
        sport: 'ncaab',
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        pickType: 'Total',
        predictedTeam: totalEdge > 0 ? 'Over' : 'Under',
        confidence: Math.round(Math.abs(totalEdge)),
        game
      });
    }
  }

  return alerts;
};
