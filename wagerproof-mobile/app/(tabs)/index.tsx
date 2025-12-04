import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl, TextInput, ScrollView, Animated, Image, TouchableOpacity } from 'react-native';
import { useTheme, Chip, ActivityIndicator, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LiveScoreTicker } from '@/components/LiveScoreTicker';
import { NFLGameCard } from '@/components/NFLGameCard';
import { CFBGameCard } from '@/components/CFBGameCard';
import { NBAGameCard } from '@/components/NBAGameCard';
import { NCAABGameCard } from '@/components/NCAABGameCard';
import { GameCardShimmer } from '@/components/GameCardShimmer';
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { useNBAGameSheet } from '@/contexts/NBAGameSheetContext';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { NFLPrediction } from '@/types/nfl';
import { CFBPrediction } from '@/types/cfb';
import { NBAGame } from '@/types/nba';
import { NCAABGame } from '@/types/ncaab';
import { useScroll } from '@/contexts/ScrollContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveScores } from '@/hooks/useLiveScores';

type Sport = 'nfl' | 'cfb' | 'nba' | 'ncaab';
type SortMode = 'time' | 'spread' | 'ou';

interface SportOption {
  id: Sport;
  label: string;
  available: boolean;
  badge?: string;
}

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { scrollY, scrollYClamped } = useScroll();
  const insets = useSafeAreaInsets();
  const { hasLiveGames } = useLiveScores();
  const { openGameSheet } = useNFLGameSheet();
  const { openGameSheet: openCFBGameSheet } = useCFBGameSheet();
  const { openGameSheet: openNBAGameSheet } = useNBAGameSheet();
  const { openGameSheet: openNCAABGameSheet } = useNCAABGameSheet();
  
  // State
  const [selectedSport, setSelectedSport] = useState<Sport>('nfl');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [searchText, setSearchText] = useState('');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [nflGames, setNflGames] = useState<NFLPrediction[]>([]);
  const [cfbGames, setCfbGames] = useState<CFBPrediction[]>([]);
  const [nbaGames, setNbaGames] = useState<NBAGame[]>([]);
  const [ncaabGames, setNcaabGames] = useState<NCAABGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  
  // Animated values for search bar
  const searchBarTranslateY = useRef(new Animated.Value(-72)).current;
  const searchBarOpacity = useRef(new Animated.Value(0)).current;
  const searchBarScale = useRef(new Animated.Value(0.8)).current;
  
  // Timer for auto-hiding search bar
  const searchBarTimer = useRef<number | null>(null);

  // Calculate header and tab bar heights
  const HEADER_HEIGHT = insets.top + 36 + 16; // Safe area + title padding
  const PILLS_HEIGHT = 72;
  const SEARCH_BAR_HEIGHT = 72; // Search bar height
  const TOTAL_COLLAPSIBLE_HEIGHT = HEADER_HEIGHT + PILLS_HEIGHT + (searchBarVisible ? SEARCH_BAR_HEIGHT : 0);
  
  // Header translates up as user scrolls up
  const headerTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [0, -TOTAL_COLLAPSIBLE_HEIGHT],
    extrapolate: 'clamp',
  });

  // Header opacity fades out progressively
  const headerOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Handle scroll event
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const sports: SportOption[] = [
    { id: 'nfl', label: 'NFL', available: true },
    { id: 'cfb', label: 'CFB', available: true },
    { id: 'nba', label: 'NBA', available: true },
    { id: 'ncaab', label: 'NCAAB', available: true },
  ];

  // Show search bar with bounce animation
  const showSearchBar = () => {
    setSearchBarVisible(true);
    
    // Clear any existing timer
    if (searchBarTimer.current) {
      clearTimeout(searchBarTimer.current);
    }
    
    // Animate in with bounce spring - all using native driver
    Animated.parallel([
      Animated.spring(searchBarTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 10,
        stiffness: 100,
      }),
      Animated.spring(searchBarOpacity, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 100,
      }),
      Animated.spring(searchBarScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 100,
      }),
    ]).start();
  };

  // Hide search bar with animation
  const hideSearchBar = () => {
    // Clear timer
    if (searchBarTimer.current) {
      clearTimeout(searchBarTimer.current);
      searchBarTimer.current = null;
    }
    
    // Animate out - all using native driver
    Animated.parallel([
      Animated.timing(searchBarTranslateY, {
        toValue: -72,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(searchBarOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(searchBarScale, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSearchBarVisible(false);
      setSearchText(''); // Clear search text when hiding
    });
  };

  // Toggle search bar
  const toggleSearchBar = () => {
    if (searchBarVisible) {
      hideSearchBar();
    } else {
      showSearchBar();
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchBarTimer.current) {
        clearTimeout(searchBarTimer.current);
      }
    };
  }, []);

  // Fetch NFL data - matches web app approach using v_input_values_with_epa view
  const fetchNFLData = async () => {
    try {
      console.log('🏈 Fetching NFL games from v_input_values_with_epa...');
      
      // Step 1: Fetch ALL games from v_input_values_with_epa (simple query like CFB)
      const { data: nflGames, error: gamesError } = await collegeFootballSupabase
        .from('v_input_values_with_epa')
        .select('*');

      console.log('🏈 NFL query result:', nflGames?.length || 0, 'error:', gamesError?.message || 'none');

      if (gamesError) {
        console.error('Error fetching NFL games from v_input_values_with_epa:', gamesError);
        throw gamesError;
      }
      
      console.log(`🏈 Found ${nflGames?.length || 0} NFL games from view`);
      
      if (!nflGames || nflGames.length === 0) {
        setNflGames([]);
        return;
      }

      // Step 2: Fetch all predictions (no order clause to avoid issues)
      const { data: allPredictions, error: predsError } = await collegeFootballSupabase
        .from('nfl_predictions_epa')
        .select('training_key, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, run_id');

      console.log('🏈 NFL predictions query:', allPredictions?.length || 0, 'error:', predsError?.message || 'none');

      let predictionsMap = new Map();
      
      if (allPredictions && allPredictions.length > 0) {
        // Find the latest run_id and use those predictions
        const runIds = [...new Set(allPredictions.map((p: any) => p.run_id))].sort().reverse();
        const latestRunId = runIds[0];
        console.log('Latest NFL run_id:', latestRunId);
        
        allPredictions.forEach((pred: any) => {
          if (pred.run_id === latestRunId) {
            predictionsMap.set(pred.training_key, pred);
          }
        });
        console.log(`✅ NFL predictions matched: ${predictionsMap.size}`);
      }
      
      // Step 3: Fetch betting lines for moneylines, public splits (no order clause)
      const { data: bettingLines, error: bettingError } = await collegeFootballSupabase
        .from('nfl_betting_lines')
        .select('training_key, home_ml, away_ml, over_line, home_spread, spread_splits_label, ml_splits_label, total_splits_label, as_of_ts, game_date, game_time');

      console.log('🏈 NFL betting lines query:', bettingLines?.length || 0, 'error:', bettingError?.message || 'none');

      let bettingLinesMap = new Map();
      
      if (!bettingError && bettingLines) {
        // Get most recent line per training_key (compare as_of_ts client-side)
        bettingLines.forEach((line: any) => {
          const existing = bettingLinesMap.get(line.training_key);
          if (!existing || (line.as_of_ts && (!existing.as_of_ts || line.as_of_ts > existing.as_of_ts))) {
            bettingLinesMap.set(line.training_key, line);
          }
        });
        console.log(`✅ NFL betting lines matched: ${bettingLinesMap.size}`);
      }

      // Step 4: Fetch weather data from production_weather table
      const { data: weatherData, error: weatherError } = await collegeFootballSupabase
        .from('production_weather')
        .select('*');
      
      let weatherMap = new Map();
      
      if (!weatherError && weatherData) {
        weatherData.forEach((weather: any) => {
          if (weather.training_key) {
            weatherMap.set(weather.training_key, weather);
          }
        });
      }

      // Step 5: Merge games with predictions, betting lines, and weather
      // home_away_unique in v_input_values_with_epa = training_key in nfl_predictions_epa and nfl_betting_lines
      const predictionsWithData: NFLPrediction[] = (nflGames || []).map((game: any) => {
        const matchKey = game.home_away_unique;
        const prediction = predictionsMap.get(matchKey);
        const bettingLine = bettingLinesMap.get(matchKey);
        const weather = weatherMap.get(matchKey);

        return {
          id: game.id || matchKey,
          away_team: game.away_team,
          home_team: game.home_team,
          home_ml: bettingLine?.home_ml || null,
          away_ml: bettingLine?.away_ml || null,
          home_spread: game.home_spread || bettingLine?.home_spread || null,
          away_spread: game.home_spread ? -game.home_spread : (bettingLine?.home_spread ? -bettingLine.home_spread : null),
          over_line: game.over_under || bettingLine?.over_line || null,
          game_date: game.game_date,
          game_time: bettingLine?.game_time || game.game_time || '',
          training_key: matchKey,
          unique_id: game.unique_id || matchKey,
          home_away_ml_prob: prediction?.home_away_ml_prob || null,
          home_away_spread_cover_prob: prediction?.home_away_spread_cover_prob || null,
          ou_result_prob: prediction?.ou_result_prob || null,
          run_id: prediction?.run_id || null,
          // Weather data
          temperature: weather?.temperature || null,
          precipitation: weather?.precipitation_pct || null,
          wind_speed: weather?.wind_speed || null,
          icon: weather?.icon || null,
          // Public betting splits
          spread_splits_label: bettingLine?.spread_splits_label || null,
          total_splits_label: bettingLine?.total_splits_label || null,
          ml_splits_label: bettingLine?.ml_splits_label || null,
        };
      });

      console.log(`📊 NFL: ${predictionsWithData.length} games, ${predictionsMap.size} have predictions`);
      setNflGames(predictionsWithData);
    } catch (err) {
      console.error('Error fetching NFL data:', err);
      setError('Failed to fetch NFL games');
    }
  };

  // Fetch CFB data
  const fetchCFBData = async () => {
    try {
      const { data: preds, error: predsError } = await collegeFootballSupabase
        .from('cfb_live_weekly_inputs')
        .select('*');

      if (predsError) throw predsError;

      const { data: apiPreds, error: apiPredsError } = await collegeFootballSupabase
        .from('cfb_api_predictions')
        .select('*');

      if (apiPredsError) {
        console.error('Error fetching CFB API predictions:', apiPredsError);
      }

      const predictionsWithData: CFBPrediction[] = (preds || []).map((prediction: any) => {
        const apiPred = apiPreds?.find(ap => ap.id === prediction.id);

        return {
          id: prediction.id,
          away_team: prediction.away_team,
          home_team: prediction.home_team,
          home_ml: prediction.home_moneyline || prediction.home_ml,
          away_ml: prediction.away_moneyline || prediction.away_ml,
          home_spread: prediction.api_spread || prediction.home_spread,
          away_spread: prediction.api_spread ? -prediction.api_spread : (prediction.away_spread || null),
          over_line: prediction.api_over_line || prediction.total_line,
          opening_spread: prediction.spread || null,
          opening_total: prediction.total_line || null,
          game_date: prediction.start_time || prediction.start_date || prediction.game_date,
          game_time: prediction.start_time || prediction.start_date || prediction.game_time,
          training_key: prediction.training_key,
          unique_id: prediction.unique_id || `${prediction.away_team}_${prediction.home_team}_${prediction.start_time}`,
          run_id: prediction.run_id || null,
          home_away_ml_prob: prediction.pred_ml_proba || prediction.home_away_ml_prob,
          home_away_spread_cover_prob: prediction.pred_spread_proba || prediction.home_away_spread_cover_prob,
          ou_result_prob: prediction.pred_total_proba || prediction.ou_result_prob,
          temperature: prediction.weather_temp_f || prediction.temperature || null,
          precipitation: prediction.precipitation || null,
          wind_speed: prediction.weather_windspeed_mph || prediction.wind_speed || null,
          icon: prediction.weather_icon_text || prediction.icon || null,
          spread_splits_label: prediction.spread_splits_label || null,
          total_splits_label: prediction.total_splits_label || null,
          ml_splits_label: prediction.ml_splits_label || null,
          conference: prediction.conference || null,
          pred_away_score: apiPred?.pred_away_score ?? prediction.pred_away_score ?? null,
          pred_home_score: apiPred?.pred_home_score ?? prediction.pred_home_score ?? null,
          pred_away_points: apiPred?.pred_away_points ?? apiPred?.away_points ?? null,
          pred_home_points: apiPred?.pred_home_points ?? apiPred?.home_points ?? null,
          pred_spread: apiPred?.pred_spread || apiPred?.run_line_prediction || apiPred?.spread_prediction || null,
          home_spread_diff: apiPred?.home_spread_diff || apiPred?.spread_diff || apiPred?.edge || null,
          pred_total: apiPred?.pred_total || apiPred?.total_prediction || apiPred?.ou_prediction || null,
          total_diff: apiPred?.total_diff || apiPred?.total_edge || null,
          pred_over_line: apiPred?.pred_over_line ?? null,
          over_line_diff: apiPred?.over_line_diff ?? null,
        };
      });

      setCfbGames(predictionsWithData);
    } catch (err) {
      console.error('Error fetching CFB data:', err);
      setError('Failed to fetch CFB games');
    }
  };

  // Helper to calculate away ML from home ML
  const calculateAwayML = (homeML: number | null): number | null => {
    if (homeML === null) return null;
    return homeML > 0 ? -(homeML + 100) : 100 - homeML;
  };

  // Fetch NBA data - matches web app approach (no date filter)
  const fetchNBAData = async () => {
    try {
      console.log('🏀 Fetching NBA games from nba_input_values_view...');
      
      // Fetch ALL games from nba_input_values_view (simple query like CFB)
      const { data: inputValues, error: inputError } = await collegeFootballSupabase
        .from('nba_input_values_view')
        .select('*');

      console.log('🏀 NBA query result:', inputValues?.length || 0, 'error:', inputError?.message || 'none');

      if (inputError) {
        console.error('❌ NBA query error:', inputError);
        throw inputError;
      }
      
      console.log(`🏀 Found ${inputValues?.length || 0} NBA games from view`);
      if (!inputValues || inputValues.length === 0) {
        console.log('⚠️ NBA: No games returned from query');
        setNbaGames([]);
        return;
      }

      // Fetch latest predictions (get all and find latest run_id client-side)
      const { data: allPredictions, error: predError } = await collegeFootballSupabase
        .from('nba_predictions')
        .select('game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id, as_of_ts_utc');
      
      console.log('🏀 NBA predictions query:', allPredictions?.length || 0, 'error:', predError?.message || 'none');

      // Find latest predictions for each game
      let predictionMap = new Map();
      if (allPredictions && allPredictions.length > 0) {
        // Group by game_id and keep the one with latest as_of_ts_utc
        const gameIds = inputValues.map((g: any) => g.game_id);
        allPredictions.forEach((pred: any) => {
          if (gameIds.includes(pred.game_id)) {
            const existing = predictionMap.get(pred.game_id);
            if (!existing || (pred.as_of_ts_utc && (!existing.as_of_ts_utc || pred.as_of_ts_utc > existing.as_of_ts_utc))) {
              predictionMap.set(pred.game_id, pred);
            }
          }
        });
        console.log(`✅ NBA predictions matched: ${predictionMap.size} for ${gameIds.length} games`);
      }

      // Merge input values with predictions
      const games: NBAGame[] = inputValues.map((input: any) => {
        const prediction = predictionMap.get(input.game_id);
        const gameIdStr = String(input.game_id);
        
        // Calculate spread cover probability
        let spreadCoverProb = null;
        if (prediction && prediction.model_fair_home_spread !== null && input.home_spread !== null) {
          const spreadDiff = Math.abs(prediction.model_fair_home_spread - input.home_spread);
          if (prediction.model_fair_home_spread < input.home_spread) {
            spreadCoverProb = 0.5 + Math.min(spreadDiff * 0.05, 0.35);
          } else {
            spreadCoverProb = 0.5 - Math.min(spreadDiff * 0.05, 0.35);
          }
        } else if (prediction?.home_win_prob) {
          spreadCoverProb = prediction.home_win_prob;
        }
        
        // Calculate over/under probability
        let ouProb = null;
        if (prediction && prediction.model_fair_total !== null && input.total_line !== null) {
          const totalDiff = prediction.model_fair_total - input.total_line;
          if (totalDiff > 0) {
            ouProb = 0.5 + Math.min(Math.abs(totalDiff) * 0.02, 0.35);
          } else {
            ouProb = 0.5 - Math.min(Math.abs(totalDiff) * 0.02, 0.35);
          }
        }
        
        return {
          id: gameIdStr,
          game_id: input.game_id,
          away_team: input.away_team,
          home_team: input.home_team,
          home_ml: input.home_moneyline,
          away_ml: calculateAwayML(input.home_moneyline),
          home_spread: input.home_spread,
          away_spread: input.home_spread ? -input.home_spread : null,
          over_line: input.total_line,
          game_date: input.game_date,
          game_time: input.tipoff_time_et,
          training_key: gameIdStr,
          unique_id: gameIdStr,
          home_adj_offense: input.home_adj_offense,
          away_adj_offense: input.away_adj_offense,
          home_adj_defense: input.home_adj_defense,
          away_adj_defense: input.away_adj_defense,
          home_adj_pace: input.home_adj_pace,
          away_adj_pace: input.away_adj_pace,
          home_ats_pct: input.home_ats_pct,
          away_ats_pct: input.away_ats_pct,
          home_over_pct: input.home_over_pct,
          away_over_pct: input.away_over_pct,
          home_away_ml_prob: prediction?.home_win_prob || null,
          home_away_spread_cover_prob: spreadCoverProb,
          ou_result_prob: ouProb,
          run_id: prediction?.run_id || null,
          home_score_pred: prediction?.home_score_pred || null,
          away_score_pred: prediction?.away_score_pred || null,
          model_fair_home_spread: prediction?.model_fair_home_spread || null,
          model_fair_total: prediction?.model_fair_total || null,
        };
      });

      console.log(`📊 NBA: ${games.length} games, ${predictionMap.size} have predictions`);
      setNbaGames(games);
    } catch (err) {
      console.error('Error fetching NBA data:', err);
      setError('Failed to fetch NBA games');
    }
  };

  // Fetch NCAAB data - matches web app approach (no date filter)
  const fetchNCAABData = async () => {
    try {
      console.log('🏀 Fetching NCAAB games from v_cbb_input_values...');
      
      // Fetch ALL games from v_cbb_input_values (simple query like CFB)
      const { data: inputValues, error: inputError } = await collegeFootballSupabase
        .from('v_cbb_input_values')
        .select('*');

      console.log('🏀 NCAAB query result:', inputValues?.length || 0, 'error:', inputError?.message || 'none');

      if (inputError) {
        console.error('❌ NCAAB query error:', inputError);
        throw inputError;
      }
      
      console.log(`🏀 Found ${inputValues?.length || 0} NCAAB games from view`);
      if (!inputValues || inputValues.length === 0) {
        console.log('⚠️ NCAAB: No games returned from query');
        setNcaabGames([]);
        return;
      }

      // Fetch all predictions (no order clause to avoid column issues)
      const { data: allPredictions, error: predError } = await collegeFootballSupabase
        .from('ncaab_predictions')
        .select('*');
      
      console.log('🏀 NCAAB predictions query:', allPredictions?.length || 0, 'error:', predError?.message || 'none');

      let predictionMap = new Map();
      
      if (allPredictions && allPredictions.length > 0) {
        // Group by game_id and keep the one with latest as_of_ts_utc
        const gameIds = inputValues.map((g: any) => g.game_id);
        allPredictions.forEach((pred: any) => {
          if (gameIds.includes(pred.game_id)) {
            const existing = predictionMap.get(pred.game_id);
            if (!existing || (pred.as_of_ts_utc && (!existing.as_of_ts_utc || pred.as_of_ts_utc > existing.as_of_ts_utc))) {
              predictionMap.set(pred.game_id, pred);
            }
          }
        });
        console.log(`✅ NCAAB predictions matched: ${predictionMap.size} for ${gameIds.length} games`);
      }

      // Merge input values with predictions
      const games: NCAABGame[] = inputValues.map((input: any) => {
        const prediction = predictionMap.get(input.game_id);
        const gameIdStr = String(input.game_id);
        
        return {
          id: gameIdStr,
          game_id: input.game_id,
          away_team: input.away_team,
          home_team: input.home_team,
          home_ml: prediction?.vegas_home_moneyline || input.homeMoneyline,
          away_ml: prediction?.vegas_away_moneyline || input.awayMoneyline,
          home_spread: prediction?.vegas_home_spread || input.spread,
          away_spread: prediction?.vegas_home_spread ? -prediction.vegas_home_spread : (input.spread ? -input.spread : null),
          over_line: prediction?.vegas_total || input.over_under,
          game_date: input.game_date_et,
          game_time: input.start_utc || input.tipoff_time_et,
          training_key: gameIdStr,
          unique_id: gameIdStr,
          home_adj_offense: input.home_adj_offense,
          away_adj_offense: input.away_adj_offense,
          home_adj_defense: input.home_adj_defense,
          away_adj_defense: input.away_adj_defense,
          home_adj_pace: input.home_adj_pace,
          away_adj_pace: input.away_adj_pace,
          home_ranking: input.home_ranking,
          away_ranking: input.away_ranking,
          conference_game: input.conference_game,
          neutral_site: input.neutral_site,
          home_away_ml_prob: prediction?.home_win_prob || null,
          home_away_spread_cover_prob: prediction?.home_win_prob || null,
          ou_result_prob: prediction && prediction.pred_total_points && prediction.vegas_total
            ? (prediction.pred_total_points > prediction.vegas_total ? 0.6 : 0.4)
            : null,
          pred_home_margin: prediction?.pred_home_margin || null,
          pred_total_points: prediction?.pred_total_points || null,
          run_id: prediction?.run_id || null,
          home_score_pred: prediction?.home_score_pred || null,
          away_score_pred: prediction?.away_score_pred || null,
          model_fair_home_spread: prediction?.model_fair_home_spread || null,
        };
      });

      console.log(`📊 NCAAB: ${games.length} games, ${predictionMap.size} have predictions`);
      setNcaabGames(games);
    } catch (err) {
      console.error('Error fetching NCAAB data:', err);
      setError('Failed to fetch NCAAB games');
    }
  };

  // Fetch data on mount and when sport changes
  const fetchData = async () => {
    try {
      setError(null);
      setLoading(true);
      
      if (selectedSport === 'nfl') {
        await fetchNFLData();
      } else if (selectedSport === 'cfb') {
        await fetchCFBData();
      } else if (selectedSport === 'nba') {
        await fetchNBAData();
      } else if (selectedSport === 'ncaab') {
        await fetchNCAABData();
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSport]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Get current games based on selected sport
  const currentGames = useMemo(() => {
    if (selectedSport === 'nfl') return nflGames;
    if (selectedSport === 'cfb') return cfbGames;
    if (selectedSport === 'nba') return nbaGames;
    if (selectedSport === 'ncaab') return ncaabGames;
    return [];
  }, [selectedSport, nflGames, cfbGames, nbaGames, ncaabGames]);

  // Filter games by search text (team names and cities)
  const filteredGames = useMemo(() => {
    if (!searchText.trim()) return currentGames;
    
    const search = searchText.toLowerCase();
    return currentGames.filter(game => {
      const homeTeam = game.home_team.toLowerCase();
      const awayTeam = game.away_team.toLowerCase();
      
      // Search in full team names
      return homeTeam.includes(search) || awayTeam.includes(search);
    });
  }, [currentGames, searchText]);

  // Sort games
  const sortedGames = useMemo(() => {
    const games = [...filteredGames];
    
    if (sortMode === 'time') {
      return games.sort((a, b) => {
        const timeA = new Date(a.game_date).getTime();
        const timeB = new Date(b.game_date).getTime();
        return timeA - timeB;
      });
    }
    
    if (sortMode === 'spread') {
      if (selectedSport === 'cfb') {
        return games.sort((a, b) => {
          const edgeA = Math.abs((a as CFBPrediction).home_spread_diff || 0);
          const edgeB = Math.abs((b as CFBPrediction).home_spread_diff || 0);
          return edgeB - edgeA;
        });
      } else {
        // NFL, NBA, NCAAB all use probability-based sorting
        return games.sort((a, b) => {
          const probA = Math.max((a as any).home_away_spread_cover_prob || 0, 1 - ((a as any).home_away_spread_cover_prob || 0));
          const probB = Math.max((b as any).home_away_spread_cover_prob || 0, 1 - ((b as any).home_away_spread_cover_prob || 0));
          return probB - probA;
        });
      }
    }
    
    if (sortMode === 'ou') {
      if (selectedSport === 'cfb') {
        return games.sort((a, b) => {
          const edgeA = Math.abs((a as CFBPrediction).over_line_diff || 0);
          const edgeB = Math.abs((b as CFBPrediction).over_line_diff || 0);
          return edgeB - edgeA;
        });
      } else {
        // NFL, NBA, NCAAB all use probability-based sorting
        return games.sort((a, b) => {
          const probA = Math.max((a as any).ou_result_prob || 0, 1 - ((a as any).ou_result_prob || 0));
          const probB = Math.max((b as any).ou_result_prob || 0, 1 - ((b as any).ou_result_prob || 0));
          return probB - probA;
        });
      }
    }
    
    return games;
  }, [filteredGames, sortMode, selectedSport]);

  const handleGamePress = (game: NFLPrediction) => {
    openGameSheet(game);
  };

  const handleCFBGamePress = (game: CFBPrediction) => {
    openCFBGameSheet(game);
  };

  const handleNBAGamePress = (game: NBAGame) => {
    openNBAGameSheet(game);
  };

  const handleNCAABGamePress = (game: NCAABGame) => {
    openNCAABGameSheet(game);
  };

  const renderGameCard = ({ item }: { item: NFLPrediction | CFBPrediction | NBAGame | NCAABGame }) => {
    if (selectedSport === 'nfl') {
      return <NFLGameCard game={item as NFLPrediction} onPress={() => handleGamePress(item as NFLPrediction)} />;
    }
    if (selectedSport === 'cfb') {
      return <CFBGameCard game={item as CFBPrediction} onPress={() => handleCFBGamePress(item as CFBPrediction)} />;
    }
    if (selectedSport === 'nba') {
      return <NBAGameCard game={item as NBAGame} onPress={() => handleNBAGamePress(item as NBAGame)} />;
    }
    if (selectedSport === 'ncaab') {
      return <NCAABGameCard game={item as NCAABGame} onPress={() => handleNCAABGamePress(item as NCAABGame)} />;
    }
    return null;
  };

  const renderSearchBar = () => {
    if (!searchBarVisible) return null;
    
    // Use dark color with transparency for both light and dark modes
    const iconColor = theme.colors.onSurfaceVariant;
    const searchBgColor = theme.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
    const placeholderColor = theme.dark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';
    
    return (
      <Animated.View 
        style={[
          styles.searchWrapper,
          {
            opacity: searchBarOpacity,
            transform: [
              { translateY: searchBarTranslateY },
              { scale: searchBarScale }
            ],
          }
        ]}
      >
        <View style={[styles.searchContainer, { backgroundColor: searchBgColor }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={iconColor} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.onSurface }]}
            placeholder="Search teams or cities..."
            placeholderTextColor={placeholderColor}
            value={searchText}
            onChangeText={setSearchText}
            autoFocus={true}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={iconColor}
              />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Animated Collapsible Header */}
        <Animated.View
          style={[
            styles.collapsibleHeader,
          {
            transform: [{ translateY: headerTranslate }],
            opacity: headerOpacity,
            paddingTop: insets.top,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        {/* Header with Title and Inline Live Ticker */}
        <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
          <View style={styles.headerTop}>
            <View style={styles.titleContainer}>
              <Image
                source={theme.dark 
                  ? require('@/assets/wagerproofGreenDark.png')
                  : require('@/assets/wagerproofGreenLight.png')
                }
                style={styles.logo}
                resizeMode="contain"
              />
              {!hasLiveGames && (
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Feed</Text>
              )}
            </View>
            {hasLiveGames && (
              <View style={styles.inlineTickerContainer}>
                <LiveScoreTicker onNavigateToScoreboard={() => {
                  router.push('/(modals)/scoreboard');
                }} />
              </View>
            )}
          </View>
        </View>

        {/* Sport Pills with Sort Dropdown */}
        <View style={[styles.pillsWrapper, { backgroundColor: theme.colors.background }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContent}
          >
            {/* Search Icon Button */}
            <TouchableOpacity 
              style={[styles.sortButton, { 
                backgroundColor: searchBarVisible ? theme.colors.primary : theme.colors.surfaceVariant 
              }]}
              onPress={toggleSearchBar}
            >
              <MaterialCommunityIcons 
                name="magnify" 
                size={20} 
                color={searchBarVisible ? '#FFFFFF' : theme.colors.primary} 
              />
            </TouchableOpacity>

            {/* Sort Dropdown */}
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              contentStyle={{ marginTop: 48 }}
              anchor={
                <TouchableOpacity 
                  style={[styles.sortButton, { backgroundColor: theme.colors.surfaceVariant }]}
                  onPress={() => setSortMenuVisible(!sortMenuVisible)}
                >
                  <MaterialCommunityIcons 
                    name={sortMode === 'time' ? 'clock-outline' : sortMode === 'spread' ? 'chart-line' : 'numeric'} 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                  <MaterialCommunityIcons name="chevron-down" size={16} color={theme.colors.onSurfaceVariant} />
                </TouchableOpacity>
              }
              anchorPosition="bottom"
            >
              <Menu.Item
                onPress={() => {
                  setSortMode('time');
                  setSortMenuVisible(false);
                }}
                title="Time"
                leadingIcon="clock-outline"
                style={styles.menuItem}
                trailingIcon=""
              />
              <Menu.Item
                onPress={() => {
                  setSortMode('spread');
                  setSortMenuVisible(false);
                }}
                title="Spread"
                leadingIcon="chart-line"
                style={styles.menuItem}
                trailingIcon=""
              />
              <Menu.Item
                onPress={() => {
                  setSortMode('ou');
                  setSortMenuVisible(false);
                }}
                title="O/U"
                leadingIcon="numeric"
                style={styles.menuItem}
                trailingIcon=""
              />
            </Menu>

            {sports.map((sport) => (
              <Chip
                key={sport.id}
                selected={selectedSport === sport.id}
                showSelectedCheck={false}
                onPress={() => sport.available && setSelectedSport(sport.id)}
                disabled={!sport.available}
                style={[
                  styles.sportChip,
                  selectedSport === sport.id && { backgroundColor: theme.colors.primary },
                  !sport.available && { opacity: 0.4 }
                ]}
                textStyle={[
                  styles.sportChipText,
                  selectedSport === sport.id && { color: '#FFFFFF' }
                ]}
              >
                {sport.label}
              </Chip>
            ))}
          </ScrollView>
        </View>

        {/* Search Bar - Part of collapsible header */}
        {renderSearchBar()}
        
        {/* Bottom gradient fade to transparent */}
        <LinearGradient
          colors={[
            theme.colors.background,
            theme.dark ? 'rgba(28, 28, 30, 0)' : 'rgba(246, 246, 246, 0)'
          ]}
          style={styles.headerGradient}
          pointerEvents="none"
        />
      </Animated.View>

      {/* Games List */}
      {loading ? (
        <Animated.FlatList
          data={Array(5).fill(null)}
          renderItem={() => <GameCardShimmer />}
          keyExtractor={(_, index) => `shimmer-${index}`}
          contentContainerStyle={[
            styles.listContent,
            { 
              paddingTop: TOTAL_COLLAPSIBLE_HEIGHT + 40,
              paddingBottom: 65 + insets.bottom + 20 
            }
          ]}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      ) : error ? (
        <View style={[styles.centerContainer, { marginTop: TOTAL_COLLAPSIBLE_HEIGHT + 29 }]}>
          <MaterialCommunityIcons name="alert-circle" size={60} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      ) : sortedGames.length === 0 ? (
        <View style={[styles.centerContainer, { marginTop: TOTAL_COLLAPSIBLE_HEIGHT + 29 }]}>
          <MaterialCommunityIcons name="calendar-blank" size={60} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            {searchText ? 'No games match your search' : 'No games available'}
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          data={sortedGames}
          renderItem={renderGameCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { 
              paddingTop: TOTAL_COLLAPSIBLE_HEIGHT + 40,
              paddingBottom: 65 + insets.bottom + 20 
            }
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={true}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              progressViewOffset={TOTAL_COLLAPSIBLE_HEIGHT}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  collapsibleHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  headerGradient: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    height: 20,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTop: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  inlineTickerContainer: {
    flex: 1,
    marginLeft: 12,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 72,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderRadius: 16,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
    height: 40,
    textAlignVertical: 'center',
  },
  pillsWrapper: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pillsContent: {
    gap: 8,
    alignItems: 'center',
    paddingRight: 8,
  },
  sportChip: {
    borderRadius: 20,
  },
  sportChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  menuItem: {
    maxHeight: 48,
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
});
