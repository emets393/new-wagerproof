import { supabase, collegeFootballSupabase } from './supabase';

export interface GameSummary {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab';
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

  // Original data object for passing to game sheets
  originalData?: any;
}

export interface ValueAlert {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  awayTeam: string;
  homeTeam: string;
  marketType: string;
  side: string;
  percentage: number;
  game: GameSummary; // Link back to full game details
}

export interface FadeAlert {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab';
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
                over_line: game.total_line,
                home_ml: homeML,
                away_ml: awayML,
            }
          });
        }
      }
    }
  } catch (e) {
    console.error('Error fetching NBA games:', e);
  }

  // 4. Fetch NCAAB Games
  try {
    const { data: ncaabGames } = await collegeFootballSupabase
      .from('v_cbb_input_values')
      .select('*')
      .order('game_date_et', { ascending: true });

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
            originalData: {
                ...game,
                id: gameIdStr,
                game_id: game.game_id,
                training_key: gameIdStr,
                unique_id: gameIdStr,
                home_ml: game.homeMoneyline,
                away_ml: game.awayMoneyline,
                home_spread: game.spread,
                over_line: game.over_under,
            }
          });
        }
      }
    }
  } catch (e) {
    console.error('Error fetching NCAAB games:', e);
  }

  return gameSummaries;
};

export const fetchValueAlerts = async (weekGames: GameSummary[]): Promise<ValueAlert[]> => {
  const alerts: ValueAlert[] = [];
  if (!weekGames || weekGames.length === 0) return alerts;

  const gamesByLeague = new Map<'nfl' | 'cfb' | 'nba' | 'ncaab', GameSummary[]>();
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

  // NFL
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
        const { data: nflPredictions } = await collegeFootballSupabase
          .from('nfl_predictions_epa')
          .select('home_away_spread_cover_prob, ou_result_prob, training_key')
          .eq('run_id', latestRun.run_id)
          .in('training_key', gameIds);

        const predictionMap = new Map((nflPredictions || []).map(p => [p.training_key, p]));

        for (const game of nflGames) {
          const prediction = predictionMap.get(game.gameId);
          if (prediction) {
            // Attach prediction to game's original data if possible
            if (game.originalData) {
                game.originalData.home_away_spread_cover_prob = prediction.home_away_spread_cover_prob;
                game.originalData.ou_result_prob = prediction.ou_result_prob;
            }

            if (prediction.home_away_spread_cover_prob !== null) {
              const isHome = prediction.home_away_spread_cover_prob > 0.5;
              const confidence = Math.round((isHome ? prediction.home_away_spread_cover_prob : 1 - prediction.home_away_spread_cover_prob) * 100);
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
            if (prediction.ou_result_prob !== null) {
              const isOver = prediction.ou_result_prob > 0.5;
              const confidence = Math.round((isOver ? prediction.ou_result_prob : 1 - prediction.ou_result_prob) * 100);
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
        }
      }
    } catch (e) {
      console.error('Error fetching NFL predictions:', e);
    }
  }

  // CFB
  if (cfbGames.length > 0) {
    try {
      const { data: allCfbPredictions } = await collegeFootballSupabase
        .from('cfb_api_predictions')
        .select('*'); // Fetch all fields to hydrate game object

      const cfbPredictionMap = new Map((allCfbPredictions || []).map(p => [p.id, p]));

      for (const game of cfbGames) {
        if (!game.cfbId) continue;
        const prediction = cfbPredictionMap.get(game.cfbId);
        if (prediction) {
           // Hydrate original data with prediction data
           if (game.originalData) {
               // Merge important fields from prediction to originalData
               Object.assign(game.originalData, prediction);
               // Ensure id matches
               game.originalData.id = game.cfbId;
           }
           
          const spreadEdge = prediction.home_spread_diff;
          if (spreadEdge !== null && Math.abs(spreadEdge) > 10) {
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
          
          const totalEdge = prediction.over_line_diff;
          if (totalEdge !== null && Math.abs(totalEdge) > 10) {
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
      }
    } catch (e) {
      console.error('Error fetching CFB predictions:', e);
    }
  }

  // NBA - Only spread fade alerts (no O/U), threshold 9.5
  if (nbaGames.length > 0) {
    try {
      const { data: allNbaPredictions } = await collegeFootballSupabase
        .from('nba_predictions')
        .select('*');

      const nbaPredictionMap = new Map((allNbaPredictions || []).map(p => [String(p.game_id), p]));

      for (const game of nbaGames) {
        if (!game.nbaId) continue;
        const prediction = nbaPredictionMap.get(game.nbaId);
        if (prediction) {
          if (game.originalData) {
              // Merge prediction data
              game.originalData.home_win_prob = prediction.home_win_prob;
              game.originalData.model_fair_total = prediction.model_fair_total;
              game.originalData.model_fair_home_spread = prediction.model_fair_home_spread;
          }

          // Only spread fade alerts for NBA, threshold 9.5
          const spreadEdge = prediction.home_spread_diff;
          if (spreadEdge !== null && Math.abs(spreadEdge) >= 9.5) {
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
          // No O/U fade alerts for NBA
        }
      }
    } catch (e) {
      console.error('Error fetching NBA predictions:', e);
    }
  }

  // NCAAB
  if (ncaabGames.length > 0) {
    try {
      const { data: allNcaabPredictions } = await collegeFootballSupabase
        .from('ncaab_predictions')
        .select('*');

      const ncaabPredictionMap = new Map((allNcaabPredictions || []).map(p => [String(p.game_id), p]));

      for (const game of ncaabGames) {
        if (!game.ncaabId) continue;
        const prediction = ncaabPredictionMap.get(game.ncaabId);
        if (prediction) {
          if (game.originalData) {
             // Merge prediction data
             game.originalData.home_win_prob = prediction.home_win_prob;
             game.originalData.pred_total_points = prediction.pred_total_points;
             game.originalData.model_fair_home_spread = prediction.model_fair_home_spread;
          }
          
          const spreadEdge = prediction.home_spread_diff;
          if (spreadEdge !== null && Math.abs(spreadEdge) > 5) {
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
          const totalEdge = prediction.over_line_diff;
          if (totalEdge !== null && Math.abs(totalEdge) > 5) {
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
      }
    } catch (e) {
      console.error('Error fetching NCAAB predictions:', e);
    }
  }

  return alerts;
};
