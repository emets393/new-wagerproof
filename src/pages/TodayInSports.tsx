import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TodayInSportsCompletionHeader } from '@/components/TodayInSportsCompletionHeader';
import { TodayGameSummaryCard } from '@/components/TodayGameSummaryCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, Flame, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';
import { FreemiumUpgradeBanner } from '@/components/FreemiumUpgradeBanner';
import { TailingAvatarList } from '@/components/TailingAvatarList';
import Dither from '@/components/Dither';
import { useTheme } from '@/contexts/ThemeContext';
import debug from '@/utils/debug';

interface GameSummary {
  gameId: string;
  sport: 'nfl' | 'cfb';
  awayTeam: string;
  homeTeam: string;
  awayLogo?: string;
  homeLogo?: string;
  gameTime?: string;
  awaySpread?: number;
  homeSpread?: number;
  totalLine?: number;
  awayMl?: number;
  homeMl?: number;
  tailCount?: number;
}

interface ValueAlert {
  gameId: string;
  sport: 'nfl' | 'cfb';
  awayTeam: string;
  homeTeam: string;
  marketType: string;
  side: string;
  percentage: number;
}

interface FadeAlert {
  gameId: string;
  sport: 'nfl' | 'cfb';
  awayTeam: string;
  homeTeam: string;
  pickType: string;
  predictedTeam: string;
  confidence: number;
}

interface TopTailedGame extends GameSummary {
  tails: Array<{
    pickType: string;
    teamSelection: string;
    count: number;
    users: Array<{ user_id: string; display_name?: string; email?: string }>;
  }>;
}

export default function TodayInSports() {
  const { isFreemiumUser } = useFreemiumAccess();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Get today's date in Eastern Time - MATCH NFL/CFB format
  const getTodayET = () => {
    // Create a date in Eastern Time
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    
    return `${year}-${month}-${day}`;
  };

  const today = getTodayET();
  
  // Get date 7 days from now to show this week's games
  const getWeekFromNowET = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    // Add 7 days
    now.setDate(now.getDate() + 7);
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    
    return `${year}-${month}-${day}`;
  };

  const weekFromNow = getWeekFromNowET();

  // Fetch ALL games for the week (used for High Tailing It section)
  const { data: weekGames, isLoading: weekGamesLoading } = useQuery({
    queryKey: ['week-games-all'],
    queryFn: async () => {
      const gameSummaries: GameSummary[] = [];
      let nflGamesData: any[] = [];
      let cfbGamesData: any[] = [];

      console.log('========================================');
      console.log('🔥 THIS WEEK IN SPORTS - DEBUG START 🔥');
      console.log('========================================');
      console.log('📅 TODAY DATE (ET):', today);
      console.log('📅 WEEK FROM NOW (ET):', weekFromNow);
      console.log('📅 Showing games from', today, 'to', weekFromNow);
      console.log('========================================');

      // Fetch NFL games - use v_input_values_with_epa view (same as NFL page)
      try {
        debug.log('📊 Querying v_input_values_with_epa for NFL games...');
        const { data: nflGames, error: nflError } = await collegeFootballSupabase
          .from('v_input_values_with_epa')
          .select('*')
          .order('game_date', { ascending: true })
          .order('game_time', { ascending: true });

        debug.log('NFL games query result:', { count: nflGames?.length || 0, error: nflError });
        
        if (nflError) {
          debug.error('NFL games error details:', nflError);
        }

        if (!nflError && nflGames) {
          nflGamesData = nflGames;
          console.log('========================================');
          console.log('🏈 NFL GAMES DATA');
          console.log('========================================');
          console.log('Total NFL games fetched:', nflGames.length);
          console.log('First NFL game sample:', nflGames[0]);
          
          // Log all unique dates we have
          const uniqueDates = [...new Set(nflGames.map(g => g.game_date).filter(Boolean))];
          console.log('NFL UNIQUE DATES IN DATABASE:', uniqueDates);
          console.log('DATE RANGE:', today, 'to', weekFromNow);
          console.log('========================================');
          
          let nflMatchCount = 0;
          for (const game of nflGames) {
            // game_date is in format "YYYY-MM-DD" - check if it's within this week
            const gameDate = game.game_date;
            const isThisWeek = gameDate >= today && gameDate <= weekFromNow;
            
            console.log(`${isThisWeek ? '✅ THIS WEEK' : '❌ NOT THIS WEEK'} - ${game.away_team} @ ${game.home_team}`);
            console.log(`   game_date: "${gameDate}" | range: "${today}" to "${weekFromNow}"`);
            
            // Only add games within the next 7 days
            if (isThisWeek) {
              nflMatchCount++;
              // Combine game_date and game_time to create a full datetime string
              // game_date is "YYYY-MM-DD", game_time is "HH:MM:SS"
              const gameTimeValue = (game.game_date && game.game_time) 
                ? `${game.game_date}T${game.game_time}` 
                : undefined;
              
              gameSummaries.push({
                gameId: game.home_away_unique, // Must match training_key used in GameTailSection
                sport: 'nfl',
                awayTeam: game.away_team,
                homeTeam: game.home_team,
                gameTime: gameTimeValue,
                awaySpread: game.away_spread,
                homeSpread: game.home_spread,
                totalLine: game.ou_vegas_line,
                awayMl: null,
                homeMl: null,
              });
            }
          }
          
          console.log('========================================');
          console.log(`🏈 NFL GAMES MATCHED FOR THIS WEEK: ${nflMatchCount} / ${nflGames.length}`);
          console.log('========================================');
        } else if (nflError) {
          debug.error('Error fetching NFL games:', nflError);
        }
      } catch (error) {
        debug.error('Exception fetching NFL games:', error);
      }

      // Fetch CFB games - use cfb_live_weekly_inputs (same as CFB page)
      try {
        debug.log('📊 Querying cfb_live_weekly_inputs for CFB games...');
        const { data: cfbGames, error: cfbError } = await collegeFootballSupabase
          .from('cfb_live_weekly_inputs')
          .select('*');

        debug.log('CFB games query result:', { count: cfbGames?.length || 0, error: cfbError });
        
        if (cfbError) {
          debug.error('CFB games error details:', cfbError);
        }

        if (!cfbError && cfbGames) {
          cfbGamesData = cfbGames;
          console.log('========================================');
          console.log('🏈 CFB GAMES DATA');
          console.log('========================================');
          console.log('Total CFB games fetched:', cfbGames.length);
          console.log('First CFB game sample:', cfbGames[0]);
          
          // Log specific games mentioned by user
          const kentGame = cfbGames.find((g: any) => 
            (g.away_team?.includes('Kent') && g.home_team?.includes('Akron')) ||
            (g.home_team?.includes('Kent') && g.away_team?.includes('Akron'))
          );
          const ohioGame = cfbGames.find((g: any) => 
            (g.away_team?.includes('Ohio') && g.home_team?.includes('Western Michigan')) ||
            (g.home_team?.includes('Ohio') && g.away_team?.includes('Western Michigan'))
          );
          
          if (kentGame) {
            console.log('🔥 FOUND KENT STATE GAME:', JSON.stringify(kentGame, null, 2));
          } else {
            console.log('❌ KENT STATE GAME NOT FOUND');
          }
          
          if (ohioGame) {
            console.log('🔥 FOUND OHIO GAME:', JSON.stringify(ohioGame, null, 2));
          } else {
            console.log('❌ OHIO GAME NOT FOUND');
          }
          
          console.log('========================================');
          
          let cfbMatchCount = 0;
          for (const game of cfbGames) {
            // CFB uses start_date or start_time which is a datetime - convert to date for comparison
            const startTimeString = game.start_date || game.start_time || game.game_datetime || game.datetime || game.date;
            let gameDate: string | null = null;
            
            if (startTimeString) {
              try {
                // Parse the datetime and get the date in ET
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
                console.error('Error parsing CFB date:', e);
              }
            }
            
            const isThisWeek = gameDate && gameDate >= today && gameDate <= weekFromNow;
            
            console.log(`${isThisWeek ? '✅ THIS WEEK' : '❌ NOT THIS WEEK'} - ${game.away_team} @ ${game.home_team}`);
            console.log(`   start_time: "${startTimeString}" | gameDate: "${gameDate}" | range: "${today}" to "${weekFromNow}"`);
            
            // Only add games within the next 7 days
            if (isThisWeek) {
              cfbMatchCount++;
              const gameTimeValue = game.start_date || game.start_time || game.game_datetime || game.datetime;
              const gameId = game.training_key || game.id;
              
              console.log(`   🎯 ADDING CFB GAME: ${game.away_team} @ ${game.home_team}`);
              console.log(`      Raw data:`, {
                training_key: game.training_key,
                id: game.id,
                has_training_key: !!game.training_key,
                has_id: !!game.id
              });
              console.log(`      Final gameId: "${gameId}"`);
              console.log(`      gameTime value: "${gameTimeValue}"`);
              
              if (!gameId) {
                console.error(`      ❌ WARNING: No gameId for CFB game ${game.away_team} @ ${game.home_team}`);
              }
              
              gameSummaries.push({
                gameId: gameId, // Must match training_key || id used in GameTailSection
                sport: 'cfb',
                awayTeam: game.away_team,
                homeTeam: game.home_team,
                gameTime: gameTimeValue,
                awaySpread: game.away_spread || (game.api_spread ? -game.api_spread : null),
                homeSpread: game.home_spread || game.api_spread,
                totalLine: game.total_line || game.api_over_line,
              });
            }
          }
          
          console.log('========================================');
          console.log(`🏈 CFB GAMES MATCHED FOR THIS WEEK: ${cfbMatchCount} / ${cfbGames.length}`);
          console.log('========================================');
        } else if (cfbError) {
          debug.error('Error fetching CFB games:', cfbError);
        }
      } catch (error) {
        debug.error('Exception fetching CFB games:', error);
      }

      console.log('========================================');
      console.log('🎯 FINAL RESULTS');
      console.log('========================================');
      console.log('✅ Total games this week:', gameSummaries.length);
      console.log('🏈 NFL games:', gameSummaries.filter(g => g.sport === 'nfl').length);
      console.log('🏈 CFB games:', gameSummaries.filter(g => g.sport === 'cfb').length);
      
      // Log ALL CFB games with their gameTimes
      const cfbGamesInSummary = gameSummaries.filter(g => g.sport === 'cfb');
      console.log('\n🏈 ALL CFB GAMES IN WEEK SUMMARY:');
      cfbGamesInSummary.forEach((game, idx) => {
        console.log(`  ${idx + 1}. ${game.awayTeam} @ ${game.homeTeam}`);
        console.log(`     gameTime: "${game.gameTime}"`);
        console.log(`     gameId: "${game.gameId}"`);
      });
      
      console.log('========================================');
      
      // Note: Removed fallback logic - if no games found, we show empty state

      // Fetch tail counts for all week games
      if (gameSummaries.length > 0) {
        const gameIds = gameSummaries.map(g => g.gameId).filter(Boolean);
        console.log('========================================');
        console.log('🎯 FETCHING TAIL COUNTS');
        console.log('========================================');
        console.log('Game IDs we\'re looking for:', gameIds);
        console.log('Total game IDs:', gameIds.length);
        console.log('NFL game IDs:', gameSummaries.filter(g => g.sport === 'nfl').map(g => g.gameId));
        console.log('CFB game IDs:', gameSummaries.filter(g => g.sport === 'cfb').map(g => g.gameId));
        
        // Check what CFB gameIds we generated
        const cfbGamesInList = gameSummaries.filter(g => g.sport === 'cfb');
        console.log('CFB games and their gameIds:', cfbGamesInList.map(g => ({
          away: g.awayTeam,
          home: g.homeTeam,
          gameId: g.gameId
        })));
        
        // Query for ANY game_tails that might be CFB (not matching NFL format)
        const { data: allTails } = await supabase
          .from('game_tails')
          .select('game_unique_id')
          .limit(100);
        
        // Filter for potential CFB games (numeric IDs or containing "State", "Ohio", etc)
        const potentialCfbTails = allTails?.filter(t => 
          /^\d+$/.test(t.game_unique_id) || // All numeric
          t.game_unique_id.includes('State') ||
          t.game_unique_id.includes('Akron') ||
          t.game_unique_id.includes('Ohio') ||
          t.game_unique_id.includes('Western') ||
          t.game_unique_id.includes('Michigan')
        );
        console.log('Potential CFB tails found (numeric or team names):', potentialCfbTails);
        
        const { data: tailsData } = await supabase
          .from('game_tails')
          .select('game_unique_id')
          .in('game_unique_id', gameIds);

        console.log('Tails data from database (matching our gameIds):', tailsData);
        
        if (tailsData) {
          const tailCounts = tailsData.reduce((acc, tail) => {
            acc[tail.game_unique_id] = (acc[tail.game_unique_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          console.log('Tail counts by game:', tailCounts);
          
          gameSummaries.forEach(game => {
            game.tailCount = tailCounts[game.gameId] || 0;
            if (game.sport === 'cfb') {
              console.log(`CFB Game: ${game.awayTeam} @ ${game.homeTeam}`);
              console.log(`  gameId: "${game.gameId}"`);
              console.log(`  tailCount: ${game.tailCount}`);
            }
          });
        }
        console.log('========================================');
      }

      // Sort by tail count, then by time
      return gameSummaries.sort((a, b) => {
        if (a.tailCount !== b.tailCount) {
          return (b.tailCount || 0) - (a.tailCount || 0);
        }
        return (a.gameTime || '').localeCompare(b.gameTime || '');
      });
    },
  });

  // Filter to get ONLY today's games
  const todayGames = weekGames?.filter(game => {
    console.log('🔍 FILTERING GAME:', {
      sport: game.sport,
      away: game.awayTeam,
      home: game.homeTeam,
      gameTime: game.gameTime,
      gameId: game.gameId
    });
    
    // For games with gameTime, extract the date
    if (game.gameTime) {
      try {
        const utcDate = new Date(game.gameTime);
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
        
        const gameDate = `${year}-${month}-${day}`;
        const isToday = gameDate === today;
        
        console.log(`   📅 gameTime: "${game.gameTime}" -> gameDate: "${gameDate}" | today: "${today}" | match: ${isToday}`);
        
        return isToday;
      } catch (e) {
        console.error('Error parsing game time:', e, game);
        return false;
      }
    }
    
    console.log('   ❌ No gameTime field');
    return false;
  });
  
  console.log('========================================');
  console.log('📊 TODAY\'S GAMES FILTER RESULTS');
  console.log('========================================');
  console.log('Total week games:', weekGames?.length || 0);
  console.log('Today\'s games:', todayGames?.length || 0);
  console.log('Today\'s date:', today);
  console.log('========================================');

  // Fetch value alerts (Polymarket >57%) - ONLY for TODAY's games
  const { data: valueAlerts, isLoading: valueAlertsLoading } = useQuery({
    queryKey: ['value-alerts', today, todayGames?.length],
    queryFn: async () => {
      const alerts: ValueAlert[] = [];

      if (!todayGames || todayGames.length === 0) {
        debug.log('No games available for value alerts');
        return alerts;
      }

      debug.log('Checking value alerts for', todayGames.length, 'games');

      for (const game of todayGames) {
        try {
          const gameKey = `${game.sport}_${game.awayTeam}_${game.homeTeam}`;
          const { data: markets } = await supabase
            .from('polymarket_markets')
            .select('*')
            .eq('game_key', gameKey);

          if (markets) {
            for (const market of markets) {
              // Check spread
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
                  });
                }
              }

              // Check total
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
                  });
                }
              }

              // Check moneyline
              if (market.market_type === 'moneyline') {
                if (market.current_away_odds >= 85) {
                  alerts.push({
                    gameId: game.gameId,
                    sport: game.sport,
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    marketType: 'Moneyline',
                    side: game.awayTeam,
                    percentage: market.current_away_odds,
                  });
                }
                if (market.current_home_odds >= 85) {
                  alerts.push({
                    gameId: game.gameId,
                    sport: game.sport,
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    marketType: 'Moneyline',
                    side: game.homeTeam,
                    percentage: market.current_home_odds,
                  });
                }
              }
            }
          }
        } catch (error) {
          debug.error('Error fetching Polymarket data:', error);
        }
      }

      return alerts;
    },
    enabled: !isFreemiumUser && !!todayGames,
  });

  // Fetch fade alerts (80%+ model confidence) - ONLY for TODAY's games
  const { data: fadeAlerts, isLoading: fadeAlertsLoading } = useQuery({
    queryKey: ['fade-alerts', today, todayGames?.length],
    queryFn: async () => {
      const alerts: FadeAlert[] = [];

      if (!todayGames || todayGames.length === 0) {
        debug.log('No games available for fade alerts');
        return alerts;
      }

      debug.log('Checking fade alerts for', todayGames.length, 'games');

      for (const game of todayGames) {
        try {
          if (game.sport === 'nfl') {
            // Fetch from nfl_predictions_epa (same as NFL page)
            const { data: latestRun } = await collegeFootballSupabase
              .from('nfl_predictions_epa')
              .select('run_id')
              .order('run_id', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestRun) {
              const { data: prediction } = await collegeFootballSupabase
                .from('nfl_predictions_epa')
                .select('home_away_spread_cover_prob, ou_result_prob, training_key')
                .eq('run_id', latestRun.run_id)
                .eq('training_key', game.gameId)
                .maybeSingle();

              if (prediction) {
                // Check spread
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
                    });
                  }
                }

                // Check total
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
                    });
                  }
                }
              }
            }
          } else if (game.sport === 'cfb') {
            // Fetch from cfb_api_predictions
            const { data: prediction } = await collegeFootballSupabase
              .from('cfb_api_predictions')
              .select('pred_spread_proba, pred_total_proba, training_key')
              .eq('training_key', game.gameId)
              .maybeSingle();

            if (prediction) {
              // Check spread
              if (prediction.pred_spread_proba !== null) {
                const isHome = prediction.pred_spread_proba > 0.5;
                const confidence = Math.round((isHome ? prediction.pred_spread_proba : 1 - prediction.pred_spread_proba) * 100);
                
                if (confidence >= 80) {
                  alerts.push({
                    gameId: game.gameId,
                    sport: 'cfb',
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    pickType: 'Spread',
                    predictedTeam: isHome ? game.homeTeam : game.awayTeam,
                    confidence,
                  });
                }
              }

              // Check total
              if (prediction.pred_total_proba !== null) {
                const isOver = prediction.pred_total_proba > 0.5;
                const confidence = Math.round((isOver ? prediction.pred_total_proba : 1 - prediction.pred_total_proba) * 100);
                
                if (confidence >= 80) {
                  alerts.push({
                    gameId: game.gameId,
                    sport: 'cfb',
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    pickType: 'Total',
                    predictedTeam: isOver ? 'Over' : 'Under',
                    confidence,
                  });
                }
              }
            }
          }
          // Similar logic for CFB if needed
        } catch (error) {
          debug.error('Error fetching prediction data:', error);
        }
      }

      return alerts;
    },
    enabled: !isFreemiumUser && !!todayGames,
  });

  // Fetch all games with tails - for ALL games this WEEK
  const { data: allTailedGames, isLoading: allTailedLoading } = useQuery({
    queryKey: ['all-tailed-games', today, weekGames?.length],
    queryFn: async () => {
      if (!weekGames || weekGames.length === 0) {
        debug.log('No games available for tailed games');
        return [];
      }

      debug.log('Fetching all games with tails for', weekGames.length, 'games');

      const gameIds = weekGames.map(g => g.gameId).filter(Boolean); // Remove any undefined/null
      
      console.log('========================================');
      console.log('🎯 FETCHING ALL GAMES WITH TAILS');
      console.log('========================================');
      console.log('Total gameIds:', gameIds.length);
      
      // Split by sport for debugging
      const nflGameIds = weekGames.filter(g => g.sport === 'nfl').map(g => g.gameId).filter(Boolean);
      const cfbGameIds = weekGames.filter(g => g.sport === 'cfb').map(g => g.gameId).filter(Boolean);
      
      console.log('NFL game IDs:', nflGameIds);
      console.log('CFB game IDs:', cfbGameIds);
      console.log('');
      
      // First, query ALL tails to see what exists in the database
      const { data: allTails, error: allTailsError } = await supabase
        .from('game_tails')
        .select('game_unique_id, sport');
      
      console.log('ALL TAILS in database:', {
        total: allTails?.length || 0,
        error: allTailsError,
        nflCount: allTails?.filter(t => t.sport === 'nfl').length || 0,
        cfbCount: allTails?.filter(t => t.sport === 'cfb').length || 0,
      });
      
      // Show unique CFB game IDs in database
      const cfbTailsInDb = allTails?.filter(t => t.sport === 'cfb') || [];
      const uniqueCfbGameIds = [...new Set(cfbTailsInDb.map(t => t.game_unique_id))];
      console.log('Unique CFB game IDs in database:', uniqueCfbGameIds);
      console.log('CFB game IDs we\'re looking for:', cfbGameIds);
      console.log('');
      
      // Now get tails for this week's games
      // Query tails for both NFL and CFB games separately to ensure we get all matches
      const { data: tailsData, error: tailsError } = await supabase
        .from('game_tails')
        .select(`
          game_unique_id,
          pick_type,
          team_selection,
          user_id,
          sport
        `)
        .in('game_unique_id', gameIds)
        .or(`sport.eq.nfl,sport.eq.cfb`); // Explicitly include both sports

      console.log('Tails query result:', { 
        count: tailsData?.length || 0, 
        error: tailsError,
        nflTails: tailsData?.filter(t => t.sport === 'nfl').length || 0,
        cfbTails: tailsData?.filter(t => t.sport === 'cfb').length || 0,
        sample: tailsData?.[0],
        allGameIds: gameIds,
        nflGameIds: nflGameIds,
        cfbGameIds: cfbGameIds
      });
      
      // Debug: Show which gameIds have tails
      if (tailsData && tailsData.length > 0) {
        const tailedGameIds = [...new Set(tailsData.map(t => t.game_unique_id))];
        const tailedNflIds = [...new Set(tailsData.filter(t => t.sport === 'nfl').map(t => t.game_unique_id))];
        const tailedCfbIds = [...new Set(tailsData.filter(t => t.sport === 'cfb').map(t => t.game_unique_id))];
        
        console.log('Game IDs with tails:', {
          total: tailedGameIds.length,
          nfl: tailedNflIds,
          cfb: tailedCfbIds
        });
        
        // Check for CFB gameIds that have tails but aren't in our weekGames
        const missingCfbIds = tailedCfbIds.filter(id => !cfbGameIds.includes(id));
        if (missingCfbIds.length > 0) {
          console.log('⚠️ CFB gameIds with tails not in weekGames:', missingCfbIds);
        }
      }

      // If we found some tails but not all CFB tails, try a broader query
      let finalTailsData = tailsData || [];
      
      if (tailsData && tailsData.length > 0) {
        console.log('✅ Found', tailsData.length, 'tails for week games');
        
        // Debug: Show CFB game IDs from weekGames vs tails
        const cfbGamesFromWeek = weekGames.filter(g => g.sport === 'cfb');
        const cfbTailGameIds = [...new Set(tailsData.filter(t => t.sport === 'cfb').map(t => t.game_unique_id))];
        
        console.log('🏈 CFB GAMEIDS COMPARISON:');
        console.log('CFB games in weekGames:', cfbGamesFromWeek.map(g => ({ 
          away: g.awayTeam, 
          home: g.homeTeam, 
          gameId: g.gameId,
          gameIdType: typeof g.gameId
        })));
        console.log('CFB game IDs with tails in database:', cfbTailGameIds);
        
        // Check which CFB tail gameIds are NOT in weekGames
        const weekGameIds = weekGames.map(g => String(g.gameId)); // Convert to strings for comparison
        const missingCfbGames = cfbTailGameIds.filter(id => !weekGameIds.includes(String(id)));
        if (missingCfbGames.length > 0) {
          console.log('⚠️ CFB games with tails NOT found in weekGames:', missingCfbGames);
          
          // Try to find these games by querying all CFB tails and matching them
          const { data: allCfbTails } = await supabase
            .from('game_tails')
            .select(`
              game_unique_id,
              pick_type,
              team_selection,
              user_id,
              sport
            `)
            .eq('sport', 'cfb')
            .in('game_unique_id', missingCfbGames);
          
          if (allCfbTails && allCfbTails.length > 0) {
            console.log(`✅ Found ${allCfbTails.length} additional CFB tails for missing gameIds`);
            // Merge with existing tails
            finalTailsData = [...(tailsData || []), ...allCfbTails];
          }
        }
        
        // Check if we're missing CFB tails
        const foundCfbTails = tailsData.filter(t => t.sport === 'cfb').length;
        const allCfbTailsCount = cfbTailsInDb.length;
        
        if (foundCfbTails < allCfbTailsCount) {
          console.log(`⚠️ Missing some CFB tails: found ${foundCfbTails}, expected up to ${allCfbTailsCount}`);
          console.log('This suggests gameId mismatch between CFB page and Today in Sports');
        }
      } else {
        console.log('❌ No tails found for week games');
        
        // If no matches found but tails exist, there's definitely a gameId mismatch
        if (allTails && allTails.length > 0) {
          console.log('⚠️ WARNING: Tails exist in database but none match our gameIds');
          console.log('This is a gameId format mismatch issue');
          
          // Try querying all CFB tails as fallback
          const { data: allCfbTails } = await supabase
            .from('game_tails')
            .select(`
              game_unique_id,
              pick_type,
              team_selection,
              user_id,
              sport
            `)
            .eq('sport', 'cfb');
          
          if (allCfbTails && allCfbTails.length > 0) {
            console.log(`✅ Found ${allCfbTails.length} CFB tails as fallback`);
            finalTailsData = allCfbTails;
          } else {
            return [];
          }
        } else {
          return [];
        }
      }

      // Group by game (use finalTailsData which includes any fallback queries)
      const gameGroups = finalTailsData.reduce((acc, tail) => {
        if (!acc[tail.game_unique_id]) {
          acc[tail.game_unique_id] = [];
        }
        acc[tail.game_unique_id].push(tail);
        return acc;
      }, {} as Record<string, any[]>);

      // Get user data (use finalTailsData)
      const userIds = [...new Set(finalTailsData.map(t => t.user_id))];
      const { data: usersData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const userMap = new Map(usersData?.map(u => [u.user_id, u.display_name]) || []);

      // Process ALL games with tails (sorted by tail count, then by time)
      console.log('Game groups:', Object.keys(gameGroups));
      console.log('Game group counts:', Object.entries(gameGroups).map(([id, tails]) => ({ 
        id, 
        count: tails.length,
        sport: tails[0]?.sport 
      })));
      
      const gamesWithTails = Object.entries(gameGroups)
        .sort(([, a], [, b]) => {
          // First sort by tail count (descending)
          if (b.length !== a.length) {
            return b.length - a.length;
          }
          // Then sort by game time
          const gameA = weekGames.find(g => g.gameId === a[0]?.game_unique_id);
          const gameB = weekGames.find(g => g.gameId === b[0]?.game_unique_id);
          const timeA = gameA?.gameTime || '';
          const timeB = gameB?.gameTime || '';
          return timeA.localeCompare(timeB);
        })
        .slice(0, 5) // Limit to top 5 games
        .map(([gameId, tails]) => {
          // Try multiple matching strategies for gameId
          let game = weekGames.find(g => g.gameId === gameId);
          
          // If not found, try string comparison
          if (!game) {
            game = weekGames.find(g => String(g.gameId) === String(gameId));
          }
          
          // If still not found, try case-insensitive string comparison
          if (!game) {
            game = weekGames.find(g => String(g.gameId).toLowerCase() === String(gameId).toLowerCase());
          }
          
          if (!game) {
            console.log(`⚠️ Could not find game for gameId: ${gameId} (sport: ${tails[0]?.sport})`);
            console.log(`   Available gameIds:`, weekGames.map(g => ({ 
              id: g.gameId, 
              type: typeof g.gameId, 
              sport: g.sport,
              teams: `${g.awayTeam} @ ${g.homeTeam}`
            })));
            
            // For CFB games, try to fetch game info from database if we have tails but no game match
            if (tails[0]?.sport === 'cfb' && tails.length > 0) {
              console.log(`   Attempting to fetch CFB game info for gameId: ${gameId}`);
              // We'll skip this game for now since we don't have game details
              // In a production system, you might want to fetch game details from the database
            }
            return null;
          }

          console.log(`✅ Processing game: ${game.awayTeam} @ ${game.homeTeam} (${game.sport}) with ${tails.length} tails`);

          // Group tails by pick type and team selection (same as GameTailSection)
          const pickGroups = tails.reduce((acc, tail) => {
            const key = `${tail.team_selection}_${tail.pick_type}`;
            if (!acc[key]) {
              acc[key] = {
                pickType: tail.pick_type,
                teamSelection: tail.team_selection,
                count: 0,
                users: [],
              };
            }
            acc[key].count++;
            acc[key].users.push({
              user_id: tail.user_id,
              display_name: userMap.get(tail.user_id),
            });
            return acc;
          }, {} as Record<string, any>);

          console.log(`   Pick groups:`, Object.keys(pickGroups));

          return {
            ...game,
            tails: Object.values(pickGroups),
            tailCount: tails.length,
          } as TopTailedGame;
        })
        .filter(Boolean) as TopTailedGame[];
      
      // Log final results by sport
      const nflGames = gamesWithTails.filter(g => g.sport === 'nfl');
      const cfbGames = gamesWithTails.filter(g => g.sport === 'cfb');
      console.log(`Final results: ${nflGames.length} NFL games, ${cfbGames.length} CFB games`);

      console.log(`🎉 Returning ${gamesWithTails.length} games with tails`);
      console.log('========================================');
      
      return gamesWithTails;
    },
    enabled: !isFreemiumUser && !!weekGames,
  });

  return (
    <div className="w-full -mx-4 md:mx-auto md:container">
      <Dither isDark={isDark} />
      
      {/* AI Completion Header - Always visible */}
      <TodayInSportsCompletionHeader />

      {/* Freemium Paywall */}
      {isFreemiumUser ? (
        <Card className="mx-4 mb-6 md:mx-0 p-8 text-center border-white/20" style={{
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        }}>
          <Lock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-bold text-white mb-2">Premium Feature</h3>
          <p className="text-gray-400 mb-6">
            Upgrade to access today's games, value alerts, model predictions, and top tailed games.
          </p>
          <FreemiumUpgradeBanner />
        </Card>
      ) : (
        <>
          {/* Today's Games Section */}
          <Card className="mx-0 mb-6 border-white/20 rounded-none md:rounded-lg md:mx-0" style={{
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}>
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 text-white">
                <Target className="h-5 w-5" />
                Today's Games
              </CardTitle>
              <CardDescription className="text-white/70">
                Games happening today across NFL and College Football
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              {weekGamesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-40" />
                  ))}
                </div>
              ) : todayGames && todayGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todayGames.map((game) => (
                    <TodayGameSummaryCard key={game.gameId} {...game} />
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">No games scheduled for today</p>
              )}
            </CardContent>
          </Card>

          {/* Value Summary Section */}
          <Card className="mx-0 mb-6 border-white/20 rounded-none md:rounded-lg md:mx-0" style={{
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}>
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 text-white">
                <TrendingUp className="h-5 w-5" />
                Value Summary
              </CardTitle>
              <CardDescription className="text-white/70">
                Polymarket alerts and high-confidence model predictions
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6 space-y-6">
              {/* Polymarket Value Alerts */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Polymarket Value Alerts</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Markets where Polymarket odds show &gt;57% on spread/total (line mismatch) or ≥85% on moneyline (strong consensus)
                </p>
                {valueAlertsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : valueAlerts && valueAlerts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {valueAlerts.map((alert, idx) => (
                      <div 
                        key={idx}
                        className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 hover:border-green-500/40 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white mb-1 break-words">
                              {alert.awayTeam} @ {alert.homeTeam}
                            </p>
                            <p className="text-xs text-gray-400">
                              {alert.sport.toUpperCase()}
                            </p>
                          </div>
                          <Badge className="bg-green-500 text-white shrink-0 ml-2">
                            {alert.percentage.toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-300 mt-2 pt-2 border-t border-green-500/20">
                          <span className="font-semibold">{alert.marketType}</span>: {alert.side}
                          <p className="text-gray-400 mt-1">
                            {alert.marketType === 'Moneyline' 
                              ? `Strong ${alert.percentage.toFixed(0)}% consensus on ${alert.side}`
                              : `${alert.percentage.toFixed(0)}% suggests line hasn't adjusted to market`
                            }
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-4">No value alerts detected for today's games</p>
                )}
              </div>

              {/* Model Prediction Fade Alerts */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Model Prediction Fade Alerts</h3>
                <p className="text-sm text-gray-400 mb-4">
                  High-confidence model predictions (≥80%) suggesting strong edges against the spread or total
                </p>
                {fadeAlertsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : fadeAlerts && fadeAlerts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fadeAlerts.map((alert, idx) => (
                      <div 
                        key={idx}
                        className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white mb-1 break-words">
                              {alert.awayTeam} @ {alert.homeTeam}
                            </p>
                            <p className="text-xs text-gray-400">
                              {alert.sport.toUpperCase()}
                            </p>
                          </div>
                          <Badge className="bg-purple-500 text-white shrink-0 ml-2">
                            {alert.confidence}%
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-300 mt-2 pt-2 border-t border-purple-500/20">
                          <span className="font-semibold">{alert.pickType}</span>: {alert.predictedTeam}
                          <p className="text-gray-400 mt-1">
                            Model has {alert.confidence}% confidence - strong edge indicator
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-4">No high-confidence predictions (≥80%) for today's games</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* High Tailing It Section */}
          <Card className="mx-0 mb-6 border-white/20 rounded-none md:rounded-lg md:mx-0" style={{
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}>
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 text-white">
                <Flame className="h-5 w-5 text-orange-500" />
                High Tailing It
              </CardTitle>
              <CardDescription className="text-white/70">
                Top 5 most tailed games this week
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              {allTailedLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : allTailedGames && allTailedGames.length > 0 ? (
                <div className="space-y-4">
                  {allTailedGames.map((game, idx) => (
                    <div 
                      key={game.gameId}
                      className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-orange-500 text-white shrink-0">
                              {game.tailCount || 0} tails
                            </Badge>
                            <p className="text-sm font-semibold text-white break-words">
                              {game.awayTeam} @ {game.homeTeam}
                            </p>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {game.sport.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Tailed Picks Breakdown - Same format as GameTailSection */}
                      <div className="space-y-2">
                        {game.tails.map((tail, tidx) => {
                          // Format pick type label (same as GameTailSection)
                          const pickTypeLabels = {
                            moneyline: 'ML',
                            spread: 'Spread',
                            over_under: 'O/U',
                          };
                          const pickTypeLabel = pickTypeLabels[tail.pickType as keyof typeof pickTypeLabels] || tail.pickType;
                          
                          // Format team/side label (same as GameTailSection)
                          const getDisplayLabel = (teamSelection: 'home' | 'away', pickType: string) => {
                            if (pickType === 'over_under') {
                              return teamSelection === 'home' ? 'Over' : 'Under';
                            }
                            return teamSelection === 'home' ? game.homeTeam : game.awayTeam;
                          };
                          const sideLabel = getDisplayLabel(tail.teamSelection as 'home' | 'away', tail.pickType);
                          
                          return (
                            <div key={tidx} className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {sideLabel} {tail.pickType !== 'over_under' && pickTypeLabel}
                              </Badge>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <TailingAvatarList users={tail.users} size="sm" maxVisible={999} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">No tailed games yet this week</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

