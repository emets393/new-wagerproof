import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Linking, SectionList } from 'react-native';
import { useTheme, Card, ActivityIndicator, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { supabase } from '@/services/supabase';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { EditorPick, GameData } from '@/types/editorsPicks';
import { EditorPickCard } from '@/components/EditorPickCard';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNFLTeamColors, getCFBTeamColors, getNBATeamColors, getNCAABTeamColors } from '@/constants/teamColors';
import { SportFilter } from '@/components/SportFilter';
import { StatsSummary } from '@/components/StatsSummary';

// Helper to get NBA team logo
const getNBATeamLogo = async (teamName: string): Promise<string> => {
  if (!teamName) return '';

  const espnLogoMap: { [key: string]: string } = {
    'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
    'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
    'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
    'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
    'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
    'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
    'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
    'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
    'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
    'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'Los Angeles Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'LA Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
    'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
    'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
    'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
    'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
    'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
    'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
    'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
    'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
    'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
    'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
    'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
  };

  // Try exact match
  if (espnLogoMap[teamName]) {
    return espnLogoMap[teamName];
  }

  // Try case-insensitive match
  const lowerTeamName = teamName.toLowerCase();
  const matchedKey = Object.keys(espnLogoMap).find(key => key.toLowerCase() === lowerTeamName);
  if (matchedKey) {
    return espnLogoMap[matchedKey];
  }

  // Try partial match
  for (const [key, url] of Object.entries(espnLogoMap)) {
    if (teamName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(teamName.toLowerCase())) {
      return url;
    }
  }

  return '';
};

// Cache for NCAAB team mappings
let ncaabTeamMappingsCache: Map<number, { espn_team_url: string; team_abbrev: string | null }> | null = null;

// Helper to get NCAAB team logo
const getNCAABTeamLogo = async (teamId: number | null | undefined): Promise<string> => {
  if (teamId === null || teamId === undefined) {
    return '';
  }

  // Fetch mappings if not cached
  if (!ncaabTeamMappingsCache) {
    try {
      const { data, error } = await collegeFootballSupabase
        .from('ncaab_team_mapping')
        .select('api_team_id, espn_team_id, team_abbrev');

      if (!error && data) {
        const newCache = new Map<number, { espn_team_url: string; team_abbrev: string | null }>();
        data.forEach((team: any) => {
          if (team.api_team_id !== null && team.api_team_id !== undefined) {
            const numericId = typeof team.api_team_id === 'string' ? parseInt(team.api_team_id, 10) : team.api_team_id;
            
            let logoUrl = '';
            if (team.espn_team_id !== null && team.espn_team_id !== undefined) {
              const espnTeamId = typeof team.espn_team_id === 'string' ? parseInt(team.espn_team_id, 10) : team.espn_team_id;
              logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnTeamId}.png`;
            }
            
            newCache.set(numericId, {
              espn_team_url: logoUrl,
              team_abbrev: team.team_abbrev || null
            });
          }
        });
        ncaabTeamMappingsCache = newCache;
      }
    } catch (error) {
      console.error('Error fetching NCAAB team mappings:', error);
      return '';
    }
  }

  const numericId = typeof teamId === 'string' ? parseInt(teamId, 10) : teamId;
  
  if (ncaabTeamMappingsCache?.has(numericId)) {
    const mapping = ncaabTeamMappingsCache.get(numericId);
    if (mapping?.espn_team_url && mapping.espn_team_url.trim() !== '') {
      return mapping.espn_team_url;
    }
  }

  return '';
};

// Helper function to get NFL team logo
const getNFLTeamLogo = (teamName: string): string => {
  const logoMap: { [key: string]: string } = {
    'Arizona': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
    'Atlanta': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
    'Baltimore': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
    'Buffalo': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
    'Carolina': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
    'Chicago': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
    'Cincinnati': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
    'Cleveland': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
    'Dallas': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
    'Denver': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
    'Detroit': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
    'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
    'Houston': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
    'Indianapolis': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
    'Jacksonville': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
    'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
    'Las Vegas': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
    'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
    'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
    'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
    'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
    'Miami': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
    'Minnesota': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
    'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
    'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
    'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
    'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
    'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
    'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
    'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
    'Seattle': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
    'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
    'Tennessee': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
    'Washington': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
  };
  return logoMap[teamName] || '';
};

interface DateGroup {
  title: string;
  dateObj: Date;
  data: EditorPick[];
}

export default function PicksScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const [picks, setPicks] = useState<EditorPick[]>([]);
  const [gamesData, setGamesData] = useState<Map<string, GameData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const fetchPicks = async () => {
    try {
      setError(null);

      // Fetch only published editor picks
      const { data: picksData, error: picksError } = await supabase
        .from('editors_picks')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (picksError) throw picksError;

      // Filter picks to only show games from last 7 days + future games
      // Note: We'll do strict filtering after fetching game data to verify dates
      // But for now, let's process everything returned

      // Fetch game data for all picks
      if (picksData && picksData.length > 0) {
        const gameDataMap = new Map<string, GameData>();

        const nflGameIds = picksData.filter((p: EditorPick) => p.game_type === 'nfl').map((p: EditorPick) => p.game_id);
        const cfbGameIds = picksData.filter((p: EditorPick) => p.game_type === 'cfb').map((p: EditorPick) => p.game_id);
        const nbaGameIds = picksData.filter((p: EditorPick) => p.game_type === 'nba').map((p: EditorPick) => p.game_id);
        const ncaabGameIds = picksData.filter((p: EditorPick) => p.game_type === 'ncaab').map((p: EditorPick) => p.game_id);

        // Fetch CFB team mappings for logos
        const { data: cfbTeamMappings } = await collegeFootballSupabase
          .from('cfb_team_mapping')
          .select('api, logo_light');

        // Helper function to get CFB team logo
        const getCFBTeamLogo = (teamName: string): string => {
          if (!cfbTeamMappings || cfbTeamMappings.length === 0) return '';
          
          let mapping = cfbTeamMappings.find(m => m.api === teamName);
          
          if (!mapping) {
            const lowerTeamName = teamName.toLowerCase();
            mapping = cfbTeamMappings.find(m => m.api && m.api.toLowerCase() === lowerTeamName);
          }
          
          if (!mapping) {
            const lowerTeamName = teamName.toLowerCase();
            mapping = cfbTeamMappings.find(m => {
              if (!m.api) return false;
              const lowerApi = m.api.toLowerCase();
              return lowerTeamName.includes(lowerApi) || lowerApi.includes(lowerTeamName);
            });
          }
          
          return mapping?.logo_light || '';
        };

        // Fetch NFL games
        if (nflGameIds.length > 0) {
          const { data: bettingLines, error: linesError } = await collegeFootballSupabase
                .from('nfl_betting_lines')
                .select('*')
            .in('training_key', nflGameIds);

          if (!linesError && bettingLines) {
            bettingLines.forEach((line: any) => {
              let formattedDate = line.game_date;
              if (line.game_date) {
                try {
                  const [year, month, day] = line.game_date.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    formattedDate = date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    });
                  } catch (error) {
                    console.error('Error formatting NFL date:', error);
                  }
                }
                
                // Format NFL time
              let formattedTime = '';
              if (line.game_time_et) {
                try {
                  const timeEt = line.game_time_et;
                  if (timeEt.includes(' ')) {
                    const [datePart, timePart] = timeEt.split(' ');
                    const timeStr = timePart.split('+')[0].split('-')[0];
                    const [hoursStr, minutesStr] = timeStr.split(':');
                    const hours = parseInt(hoursStr, 10);
                    const minutes = parseInt(minutesStr || '0', 10);
                    
                    if (!isNaN(hours) && !isNaN(minutes) && datePart) {
                      const estHours = hours + 5;
                      let finalHours = estHours;
                      
                      if (finalHours >= 24) {
                        finalHours = finalHours % 24;
                      }
                      
                      const [year, month, day] = datePart.split('-').map(Number);
                      const date = new Date(year, month - 1, day, finalHours, minutes);
                      
                      if (!isNaN(date.getTime())) {
                        formattedTime = date.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    }) + ' EST';
                      }
                    }
                  }
                } catch (error) {
                  console.error('Error converting game_time_et:', error);
                }
              }
              
              if (!formattedTime && line.game_time) {
                formattedTime = line.game_time;
              }

              gameDataMap.set(line.training_key, {
                away_team: line.away_team,
                home_team: line.home_team,
                away_logo: getNFLTeamLogo(line.away_team),
                home_logo: getNFLTeamLogo(line.home_team),
                  game_date: formattedDate,
                  game_time: formattedTime,
                raw_game_date: line.game_date,
                away_spread: line.away_spread,
                home_spread: line.home_spread,
                over_line: line.over_line,
                away_ml: line.away_ml,
                home_ml: line.home_ml,
                away_team_colors: getNFLTeamColors(line.away_team),
                home_team_colors: getNFLTeamColors(line.home_team),
              });
            });
          }
        }

        // Fetch CFB games
        if (cfbGameIds.length > 0) {
          const numericIds = cfbGameIds.map(id => {
            const parsed = parseInt(id);
            return isNaN(parsed) ? id : parsed;
          });
          
          const { data: cfbGames, error: cfbError } = await collegeFootballSupabase
                .from('cfb_live_weekly_inputs')
                .select('*')
            .in('id', numericIds);

          if (!cfbError && cfbGames) {
            cfbGames.forEach((game: any) => {
              const startTimeString = game.start_time || game.start_date || game.game_datetime || game.datetime;
              
                let formattedDate = 'TBD';
                let formattedTime = 'TBD';
                
                if (startTimeString) {
                  try {
                    const utcDate = new Date(startTimeString);
                    
                    const estMonth = utcDate.toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      month: 'short'
                    }).toUpperCase();
                    const estDay = utcDate.toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      day: 'numeric'
                    });
                    const estYear = utcDate.toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      year: 'numeric'
                    });
                    formattedDate = `${estMonth} ${estDay}, ${estYear}`;
                    
                    formattedTime = utcDate.toLocaleTimeString('en-US', {
                      timeZone: 'America/New_York',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    }) + ' EST';
                  } catch (error) {
                    console.error('Error formatting CFB date/time:', error);
                  }
                }

              gameDataMap.set(String(game.id), {
                away_team: game.away_team,
                home_team: game.home_team,
                away_logo: getCFBTeamLogo(game.away_team),
                home_logo: getCFBTeamLogo(game.home_team),
                  game_date: formattedDate,
                  game_time: formattedTime,
                raw_game_date: startTimeString,
                away_spread: game.api_spread ? -game.api_spread : null,
                home_spread: game.api_spread,
                over_line: game.api_over_line,
                away_ml: game.away_moneyline || game.away_ml,
                home_ml: game.home_moneyline || game.home_ml,
                opening_spread: game.spread ?? null,
                away_team_colors: getCFBTeamColors(game.away_team),
                home_team_colors: getCFBTeamColors(game.home_team),
              });
                });
              }
            }

        // Fetch NBA games
        if (nbaGameIds.length > 0) {
          const { data: nbaGames, error: nbaError } = await collegeFootballSupabase
            .from('nba_input_values_view')
            .select('*')
            .in('game_id', nbaGameIds);

          if (!nbaError && nbaGames) {
            await Promise.all(nbaGames.map(async (game: any) => {
              let formattedDate = 'TBD';
              let formattedTime = 'TBD';
              
              if (game.game_date) {
                try {
                  const [year, month, day] = game.game_date.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  formattedDate = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                } catch (error) {
                  console.error('Error formatting NBA date:', error);
                }
              }
              
              if (game.tipoff_time_et) {
                try {
                  let date: Date;
                  if (game.tipoff_time_et.includes('T') || (game.tipoff_time_et.includes(' ') && game.tipoff_time_et.length > 10)) {
                    date = new Date(game.tipoff_time_et);
                  } else {
                    const [hours, minutes] = game.tipoff_time_et.split(':').map(Number);
                    if (game.game_date && !isNaN(hours) && !isNaN(minutes)) {
                      const [year, month, day] = game.game_date.split('-').map(Number);
                      date = new Date(year, month - 1, day, hours, minutes);
                    } else {
                      date = new Date();
                    }
                  }
                  
                  formattedTime = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) + ' EST';
                } catch (error) {
                  console.error('Error formatting NBA time:', error);
                }
              }
              
              // Calculate away moneyline from home moneyline
              const homeML = game.home_moneyline;
              let awayML = null;
              if (homeML) {
                awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
              }
              
              const [awayLogo, homeLogo] = await Promise.all([
                getNBATeamLogo(game.away_team),
                getNBATeamLogo(game.home_team)
              ]);
              
              gameDataMap.set(String(game.game_id), {
                away_team: game.away_team,
                home_team: game.home_team,
                away_logo: awayLogo,
                home_logo: homeLogo,
                game_date: formattedDate,
                game_time: formattedTime,
                raw_game_date: game.game_date,
                away_spread: game.home_spread ? -game.home_spread : null,
                home_spread: game.home_spread,
                over_line: game.total_line,
                away_ml: awayML,
                home_ml: homeML,
                away_team_colors: getNBATeamColors(game.away_team),
                home_team_colors: getNBATeamColors(game.home_team),
              });
            }));
          }
        }

        // Fetch NCAAB games
        if (ncaabGameIds.length > 0) {
          const { data: ncaabGames, error: ncaabError } = await collegeFootballSupabase
            .from('v_cbb_input_values')
            .select('*')
            .in('game_id', ncaabGameIds);

          // Fetch NCAAB predictions for betting lines
          const { data: latestRun } = await collegeFootballSupabase
            .from('ncaab_predictions')
            .select('run_id, as_of_ts_utc')
            .order('as_of_ts_utc', { ascending: false })
            .limit(1)
            .maybeSingle();

          let predictionsMap = new Map();
          if (latestRun && ncaabGames) {
            const gameIds = ncaabGames.map((g: any) => g.game_id);
            const { data: predictions } = await collegeFootballSupabase
              .from('ncaab_predictions')
              .select('game_id, vegas_home_spread, vegas_total, vegas_home_moneyline, vegas_away_moneyline')
              .eq('run_id', latestRun.run_id)
              .in('game_id', gameIds);
            
            predictions?.forEach((pred: any) => {
              predictionsMap.set(pred.game_id, pred);
            });
          }

          if (!ncaabError && ncaabGames) {
            await Promise.all(ncaabGames.map(async (game: any) => {
              const prediction = predictionsMap.get(game.game_id);
              
              const vegasHomeSpread = prediction?.vegas_home_spread ?? game.spread ?? null;
              const vegasTotal = prediction?.vegas_total ?? game.over_under ?? null;
              const homeML = game.homeMoneyline ?? prediction?.vegas_home_moneyline ?? null;
              const awayML = game.awayMoneyline ?? prediction?.vegas_away_moneyline ?? null;
              
              let formattedDate = 'TBD';
              let formattedTime = 'TBD';
              
              if (game.game_date_et) {
                try {
                  const [year, month, day] = game.game_date_et.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  formattedDate = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                } catch (error) {
                  console.error('Error formatting NCAAB date:', error);
                }
              }
              
              const timeSource = game.start_utc || game.tipoff_time_et;
              if (timeSource) {
                try {
                  let date: Date;
                  if (timeSource.includes('T') || (timeSource.includes(' ') && timeSource.length > 10)) {
                    date = new Date(timeSource);
                  } else {
                    const [hours, minutes] = timeSource.split(':').map(Number);
                    if (game.game_date_et && !isNaN(hours) && !isNaN(minutes)) {
                      const [year, month, day] = game.game_date_et.split('-').map(Number);
                      date = new Date(year, month - 1, day, hours, minutes);
                    } else {
                      date = new Date();
                    }
                  }
                  
                  formattedTime = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) + ' EST';
                } catch (error) {
                  console.error('Error formatting NCAAB time:', error);
                }
              }
              
              const [awayLogo, homeLogo] = await Promise.all([
                getNCAABTeamLogo(game.away_team_id),
                getNCAABTeamLogo(game.home_team_id)
              ]);
              
              gameDataMap.set(String(game.game_id), {
                away_team: game.away_team,
                home_team: game.home_team,
                away_logo: awayLogo,
                home_logo: homeLogo,
                game_date: formattedDate,
                game_time: formattedTime,
                raw_game_date: game.game_date_et || game.start_utc,
                away_spread: vegasHomeSpread !== null ? -vegasHomeSpread : null,
                home_spread: vegasHomeSpread,
                over_line: vegasTotal,
                away_ml: awayML,
                home_ml: homeML,
                away_team_colors: getNCAABTeamColors(game.away_team),
                home_team_colors: getNCAABTeamColors(game.home_team),
              });
            }));
          }
        }

        // Fallback: For picks without game data in live tables, use archived_game_data
        for (const pick of picksData as EditorPick[]) {
          const pickGameId = String(pick.game_id);
          if (!gameDataMap.has(pickGameId) && pick.archived_game_data) {
            const archived = pick.archived_game_data;
            
            gameDataMap.set(pickGameId, {
              away_team: archived.awayTeam || archived.away_team || 'Unknown',
              home_team: archived.homeTeam || archived.home_team || 'Unknown',
              away_logo: archived.awayLogo || archived.away_logo || '',
              home_logo: archived.homeLogo || archived.home_logo || '',
              game_date: archived.gameDate || archived.game_date || 'TBD',
              game_time: archived.gameTime || archived.game_time || '',
              raw_game_date: archived.rawGameDate || archived.raw_game_date || archived.gameDate || archived.game_date,
              away_spread: archived.awaySpread ?? archived.away_spread ?? null,
              home_spread: archived.homeSpread ?? archived.home_spread ?? null,
              over_line: archived.overLine ?? archived.over_line ?? null,
              away_ml: archived.awayMl ?? archived.away_ml ?? null,
              home_ml: archived.homeMl ?? archived.home_ml ?? null,
              away_team_colors: archived.awayTeamColors || archived.away_team_colors || { primary: '#6B7280', secondary: '#9CA3AF' },
              home_team_colors: archived.homeTeamColors || archived.home_team_colors || { primary: '#6B7280', secondary: '#9CA3AF' },
            });
          }
        }

        setGamesData(gameDataMap);

        // Filter picks to only show games from last 7 days + future games
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);

        const validPicks = (picksData as EditorPick[]).filter((pick: EditorPick) => {
          const gameData = gameDataMap.get(pick.game_id);
          
          // If no game data or no date, show the pick
          if (!gameData || !gameData.raw_game_date) {
            return true;
          }
          
          try {
            const gameDate = new Date(gameData.raw_game_date);
            const gameDateOnly = new Date(gameDate);
            gameDateOnly.setHours(0, 0, 0, 0);
            
            const daysDiff = Math.floor((today.getTime() - gameDateOnly.getTime()) / (1000 * 60 * 60 * 24));
            
            // Show all future games (daysDiff < 0) and games from the last 7 days (daysDiff <= 7)
            return daysDiff <= 7;
          } catch (error) {
            return true;
          }
        });

        setPicks(validPicks);
      } else {
        setPicks([]);
      }
    } catch (err) {
      console.error('Error fetching picks:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPicks();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPicks();
  };

  const handleOpenTikTok = () => {
    Linking.openURL('https://www.tiktok.com/@wagerproof');
  };

  // Memoize filtered picks based on selected sport
  const filteredPicks = useMemo(() => {
    if (!selectedSport) return picks;
    return picks.filter(pick => pick.game_type === selectedSport);
  }, [picks, selectedSport]);

  // Group filtered picks by date
  const groupPicksByDate = (picksToGroup: EditorPick[]): DateGroup[] => {
    const groups = new Map<string, { dateObj: Date, picks: EditorPick[] }>();
    const noDatePicks: EditorPick[] = [];

    picksToGroup.forEach(pick => {
      const gameData = gamesData.get(pick.game_id);
      
      if (!gameData || !gameData.raw_game_date) {
        noDatePicks.push(pick);
        return;
      }

      try {
        const dateStr = gameData.raw_game_date;
        let dateObj: Date;
        
        if (dateStr.includes('T')) {
          dateObj = new Date(dateStr);
        } else {
          const [year, month, day] = dateStr.split('-').map(Number);
          dateObj = new Date(year, month - 1, day);
        }
        
        const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        
        if (!groups.has(key)) {
          groups.set(key, { dateObj, picks: [] });
        }
        
        groups.get(key)?.picks.push(pick);
      } catch (e) {
        noDatePicks.push(pick);
      }
    });

    const sortedGroups: DateGroup[] = Array.from(groups.entries()).map(([_, value]) => {
      const dayName = value.dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      const monthName = value.dateObj.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = value.dateObj.getDate();
      const title = `${dayName}, ${monthName} ${dayNum}`;
      
      return {
        title,
        dateObj: value.dateObj,
        data: value.picks
      };
    });

    // Sort groups by date (newest first)
    sortedGroups.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    // Add "No Date" group at the end if needed
    if (noDatePicks.length > 0) {
      sortedGroups.push({
        title: 'Date Not Found',
        dateObj: new Date(0),
        data: noDatePicks
      });
    }

    return sortedGroups;
  };

  const groupedPicks = groupPicksByDate(filteredPicks);

  const renderSectionHeader = ({ section }: { section: DateGroup }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
      <View style={styles.sectionHeaderLine} />
      <Text style={[styles.sectionHeaderText, { color: theme.colors.onSurfaceVariant }]}>
        {section.title}
      </Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  );

  const renderPickCard = ({ item }: { item: EditorPick }) => {
    const gameData = gamesData.get(item.game_id);
    if (!gameData) return null;

    return (
      <EditorPickCard
        pick={item}
        gameData={gameData}
      />
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
          Loading picks...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Frosted Glass Header */}
      <BlurView
        intensity={80}
        tint={theme.dark ? 'dark' : 'light'}
        style={[styles.headerBlur, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="star" size={32} color={isDark ? '#FFD700' : '#FFD700'} style={styles.starIcon} />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Editor's Picks
          </Text>
        </View>
      </BlurView>

      {error ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="alert-circle" size={60} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      ) : picks.length === 0 ? (
        <View style={styles.centerContainer}>
          <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.emptyContent}>
                <MaterialCommunityIcons 
                  name="creation" 
                  size={80} 
                  color={isDark ? '#FFD700' : '#FFB81C'} 
                  style={styles.sparkleIcon}
                />
                <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                  Fresh Picks Coming Soon!
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  We're preparing our latest expert picks for you. In the meantime, get daily betting insights and analysis from our main channel!
                </Text>
                <Button 
                  mode="contained" 
                  onPress={handleOpenTikTok}
                  style={styles.tiktokButton}
                  contentStyle={styles.tiktokButtonContent}
                  labelStyle={styles.tiktokButtonLabel}
                  buttonColor="#E91E63"
                  icon={() => <MaterialCommunityIcons name="music-note" size={20} color="white" />}
                >
                  Follow @wagerproof on TikTok
                </Button>
                <Text style={[styles.emptyFooter, { color: theme.colors.onSurfaceVariant }]}>
                  Daily picks • Analysis • Expert insights
                </Text>
              </View>
            </Card.Content>
          </Card>
        </View>
      ) : (
        <SectionList
          sections={groupedPicks}
          renderItem={renderPickCard}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent, 
            { 
              paddingBottom: 65 + insets.bottom + 20 
            }
          ]}
          ListHeaderComponent={
            <View style={{ paddingTop: insets.top + 80, marginBottom: 16 }}>
              <StatsSummary picks={filteredPicks} />
              <SportFilter selectedSport={selectedSport} onSportChange={setSelectedSport} />
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} progressViewOffset={insets.top + 80} />
          }
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyCard: {
    margin: 16,
    borderRadius: 12,
    elevation: 4,
  },
  emptyContent: {
    padding: 24,
    alignItems: 'center',
  },
  sparkleIcon: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  tiktokButton: {
    marginBottom: 16,
    borderRadius: 24,
  },
  tiktokButtonContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tiktokButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyFooter: {
    fontSize: 14,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 12,
  },
});
