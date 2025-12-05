import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Linking, SectionList, ScrollView, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { useTheme, Card, ActivityIndicator, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import PagerView from 'react-native-pager-view';
import { useDrawer } from '../_layout';
import { useAuth } from '@/contexts/AuthContext';
import { useWagerBotChatSheet } from '@/contexts/WagerBotChatSheetContext';
import { supabase } from '@/services/supabase';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { EditorPick, GameData } from '@/types/editorsPicks';
import { EditorPickCard } from '@/components/EditorPickCard';
import { GameCardShimmer } from '@/components/GameCardShimmer';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNFLTeamColors, getCFBTeamColors, getNBATeamColors, getNCAABTeamColors } from '@/constants/teamColors';
import { StatsSummary } from '@/components/StatsSummary';
import { useScroll } from '@/contexts/ScrollContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

type Sport = 'all' | 'nfl' | 'cfb' | 'nba' | 'ncaab';

interface SportOption {
  id: Sport;
  label: string;
  available: boolean;
  badge?: string;
  icon: string;
}

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
  const router = useRouter();
  const { open: openDrawer } = useDrawer();
  const { user } = useAuth();
  const { openChatSheet } = useWagerBotChatSheet();
  const { isDark } = useThemeContext();
  const { scrollY, scrollYClamped } = useScroll();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const tabsScrollViewRef = useRef<ScrollView>(null);

  // Animation values
  const scrollOffset = useRef(new Animated.Value(0)).current;
  const scrollPosition = useRef(new Animated.Value(0)).current;
  const absolutePosition = useMemo(() => Animated.add(scrollPosition, scrollOffset), [scrollPosition, scrollOffset]);
  const [tabMeasures, setTabMeasures] = useState<Array<{x: number, width: number}>>(new Array(5).fill({ x: 0, width: 0 }));

  // State
  const [selectedSport, setSelectedSport] = useState<Sport>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [picks, setPicks] = useState<EditorPick[]>([]); // Filtered picks for display (last 7 days + future)
  const [allPicks, setAllPicks] = useState<EditorPick[]>([]); // All picks for stats calculation (no date filter)
  const [gamesData, setGamesData] = useState<Map<string, GameData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sports: SportOption[] = [
    { id: 'all', label: 'All', available: true, icon: 'view-grid' },
    { id: 'nfl', label: 'NFL', available: true, icon: 'football' },
    { id: 'cfb', label: 'CFB', available: true, icon: 'school' },
    { id: 'nba', label: 'NBA', available: true, icon: 'basketball' },
    { id: 'ncaab', label: 'NCAAB', available: true, icon: 'basketball-hoop' },
  ];

  // Calculate header heights (must match feed page calculation)
  const HEADER_TOP_HEIGHT = 56; // Header top section height
  const TABS_HEIGHT = 48; // Sport tabs height
  const TOTAL_HEADER_HEIGHT = insets.top + HEADER_TOP_HEIGHT + TABS_HEIGHT;
  const TOTAL_COLLAPSIBLE_HEIGHT = TOTAL_HEADER_HEIGHT;
  
  // Header slides up completely as user scrolls up (like tab bar slides down)
  const headerTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [0, -TOTAL_COLLAPSIBLE_HEIGHT],
    extrapolate: 'clamp',
  });

  // Header fades out as user scrolls up
  const headerOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Handle scroll event for header and bottom tab bar animation
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

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

        // Store all picks for stats calculation (no date filtering)
        setAllPicks((picksData || []) as EditorPick[]);

        // Filter picks to only show games from last 7 days + future games (for display only)
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
        setAllPicks([]);
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

  const onPageScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { position: scrollPosition, offset: scrollOffset } }],
    { useNativeDriver: false }
  ), []);

  // Handle page change from swipe
  const handlePageSelected = useCallback((e: any) => {
    const page = e.nativeEvent.position;
    setCurrentPage(page);
    const sport = sports[page].id;
    setSelectedSport(sport);
    
    // Scroll tab bar to keep active tab in view
    if (tabMeasures[page] && tabsScrollViewRef.current) {
      const { x, width } = tabMeasures[page];
      const scrollX = x - (SCREEN_WIDTH / 2) + (width / 2);
      tabsScrollViewRef.current.scrollTo({ x: scrollX, animated: true });
    }
  }, [tabMeasures]);

  // Measure tabs
  const onTabMeasure = (index: number, event: any) => {
    const { x, width } = event.nativeEvent.layout;
    setTabMeasures(prev => {
      const newMeasures = [...prev];
      newMeasures[index] = { x, width };
      return newMeasures;
    });
  };

  // Interpolate indicator position and width
  const indicatorLeft = absolutePosition.interpolate({
    inputRange: sports.map((_, i) => i),
    outputRange: tabMeasures.map(m => m.x),
    extrapolate: 'clamp'
  });

  const indicatorWidth = absolutePosition.interpolate({
    inputRange: sports.map((_, i) => i),
    outputRange: tabMeasures.map(m => m.width),
    extrapolate: 'clamp'
  });

  // Handle tab press
  const handleTabPress = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
    setCurrentPage(index);
    setSelectedSport(sports[index].id);
  }, []);

  // Group picks by date
  const groupPicksByDate = useCallback((picksToGroup: EditorPick[]): DateGroup[] => {
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
  }, [gamesData]);

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

  const renderSportPage = (sport: Sport) => {
    // Filter picks for this sport (or show all if 'all') - for display
    const sportPicks = useMemo(() => {
      if (sport === 'all') {
        return picks;
      }
      return picks.filter(pick => pick.game_type === sport);
    }, [picks, sport]);

    // Filter all picks for this sport (or show all if 'all') - for stats (includes historical)
    const allSportPicks = useMemo(() => {
      if (sport === 'all') {
        return allPicks;
      }
      return allPicks.filter(pick => pick.game_type === sport);
    }, [allPicks, sport]);

    const groupedPicks = useMemo(() => groupPicksByDate(sportPicks), [sportPicks, groupPicksByDate]);
    
    if (loading && !refreshing) {
      return (
        <View key={sport} style={styles.pageContainer}>
          <ScrollView 
            contentContainerStyle={[styles.centerContainer, { paddingTop: TOTAL_HEADER_HEIGHT, justifyContent: 'flex-start' }]}
            scrollEnabled={true}
          >
            {[1, 2, 3, 4].map((i) => (
              <GameCardShimmer key={i} />
            ))}
          </ScrollView>
        </View>
      );
    }

    if (error) {
        return (
            <View key={sport} style={styles.pageContainer}>
                <View style={[styles.centerContainer, { paddingTop: TOTAL_HEADER_HEIGHT }]}>
                  <MaterialCommunityIcons name="alert-circle" size={60} color={theme.colors.error} />
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            </View>
        );
    }

    if (sportPicks.length === 0) {
      return (
        <View key={sport} style={styles.pageContainer}>
          <ScrollView 
            contentContainerStyle={[styles.centerContainer, { paddingTop: TOTAL_HEADER_HEIGHT + 40 }]}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={[theme.colors.primary]} 
                progressViewOffset={TOTAL_HEADER_HEIGHT}
              />
            }
          >
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
                    {sport === 'all' ? 'No Picks Available' : `No ${sport.toUpperCase()} Picks`}
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {sport === 'all' 
                      ? 'Check back later for expert picks.' 
                      : 'Check back later for expert picks for this sport.'}
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
                </View>
              </Card.Content>
            </Card>
          </ScrollView>
        </View>
      );
    }

    return (
      <View key={sport} style={styles.pageContainer}>
        <AnimatedSectionList
          sections={groupedPicks}
          renderItem={renderPickCard as any}
          renderSectionHeader={renderSectionHeader as any}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={[
            styles.listContent, 
            { 
              paddingTop: TOTAL_HEADER_HEIGHT,
              paddingBottom: 65 + insets.bottom + 20 
            }
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          ListHeaderComponent={
            <View>
              <StatsSummary picks={allSportPicks} />
            </View>
          }
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={[theme.colors.primary]} 
              progressViewOffset={TOTAL_HEADER_HEIGHT}
            />
          }
          stickySectionHeadersEnabled={false}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Fixed Header with Frosted Glass Effect - Slides away on scroll */}
      <Animated.View
        style={[
          styles.fixedHeaderContainer,
          {
            transform: [{ translateY: headerTranslate }],
            opacity: headerOpacity,
          },
        ]}
      >
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.fixedHeader, { paddingTop: insets.top }]}
        >
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => {
              try {
                openDrawer();
              } catch (error) {
                console.error('Error opening drawer:', error);
              }
            }} 
            style={styles.menuButton}
          >
            <MaterialCommunityIcons name="menu" size={28} color={theme.colors.onSurface} />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={[styles.titleMain, { color: theme.colors.onSurface }]}>Wager</Text>
            <Text style={[styles.titleProof, { color: '#00E676' }]}>Proof</Text>
          </View>
          
          {user && (
            <TouchableOpacity 
              onPress={openChatSheet}
              style={styles.chatButton}
            >
              <MaterialCommunityIcons name="robot" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sports Tabs */}
        <View style={styles.sportsTabsContainer}>
          <ScrollView 
            ref={tabsScrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sportsTabsContent}
          >
            {sports.map((sport, index) => {
              const isSelected = currentPage === index;
              return (
                <TouchableOpacity
                  key={sport.id}
                  style={styles.sportTab}
                  onPress={() => sport.available && handleTabPress(index)}
                  disabled={!sport.available}
                  onLayout={(e) => onTabMeasure(index, e)}
                >
                  <Text style={[
                    styles.sportTabText, 
                    { 
                      color: isSelected ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                      fontWeight: isSelected ? '700' : '500',
                      opacity: sport.available ? 1 : 0.4
                    }
                  ]}>
                    {sport.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            
            {/* Animated Indicator */}
            {tabMeasures.some(m => m.width > 0) && (
              <Animated.View 
                style={[
                  styles.sportIndicator, 
                  { 
                    backgroundColor: '#00E676',
                    left: 0, // Animated via transform
                    width: indicatorWidth,
                    transform: [{ translateX: indicatorLeft }]
                  }
                ]} 
              />
            )}
          </ScrollView>
        </View>
        </BlurView>
      </Animated.View>

      {/* Swipeable Sport Pages */}
      <AnimatedPagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageSelected}
        onPageScroll={onPageScroll}
      >
        {sports.map(sport => renderSportPage(sport.id))}
      </AnimatedPagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pagerView: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  fixedHeader: {
    width: '100%',
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    gap: 16,
  },
  menuButton: {
    padding: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleMain: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  titleProof: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  chatButton: {
    padding: 8,
  },
  sportsTabsContainer: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  sportsTabsContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 24,
  },
  sportTab: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 4,
  },
  sportTabText: {
    fontSize: 16,
  },
  sportIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  listContent: {
    paddingHorizontal: 16,
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
