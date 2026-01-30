import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, TextInput, ScrollView, Animated, TouchableOpacity, FlatList, Dimensions, Alert } from 'react-native';
import { useTheme, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { NFLGameCard } from '@/components/NFLGameCard';
import { CFBGameCard } from '@/components/CFBGameCard';
import { NBAGameCard } from '@/components/NBAGameCard';
import { NCAABGameCard } from '@/components/NCAABGameCard';
import { GameCardShimmer } from '@/components/GameCardShimmer';
import { LockedGameCard } from '@/components/LockedGameCard';
import { BettingTrendsBanner } from '@/components/nba/BettingTrendsBanner';
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { useNBAGameSheet } from '@/contexts/NBAGameSheetContext';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';
import { useAuth } from '@/contexts/AuthContext';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { NFLPrediction } from '@/types/nfl';
import { CFBPrediction } from '@/types/cfb';
import { NBAGame } from '@/types/nba';
import { NCAABGame } from '@/types/ncaab';
import { useScroll } from '@/contexts/ScrollContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawer } from '../_layout';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useProAccess } from '@/hooks/useProAccess';

type Sport = 'nfl' | 'cfb' | 'nba' | 'ncaab' | 'mlb';
type SortMode = 'time' | 'spread' | 'ou';

interface SportOption {
  id: Sport;
  label: string;
  available: boolean;
  badge?: string;
  icon: string;
}

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { open: openDrawer } = useDrawer();
  const { scrollY, scrollYClamped } = useScroll();
  const insets = useSafeAreaInsets();
  const { openGameSheet } = useNFLGameSheet();
  const { openGameSheet: openCFBGameSheet } = useCFBGameSheet();
  const { openGameSheet: openNBAGameSheet } = useNBAGameSheet();
  const { openGameSheet: openNCAABGameSheet } = useNCAABGameSheet();
  const { user } = useAuth();
  const { isDark } = useThemeContext();
  const { isPro, isLoading: isProLoading } = useProAccess();
  const tabsScrollViewRef = useRef<ScrollView>(null);

  // WagerBot suggestion system
  const {
    testModeEnabled,
    isDetached,
    onSportChange,
    dismissSuggestion,
    triggerTestSuggestion,
    openManualMenu,
    onFeedMount,
    onFeedUnmount,
    onPageChange,
    setPolymarketData,
  } = useWagerBotSuggestion();
  
  // State
  const [selectedSport, setSelectedSport] = useState<Sport>('nba');
  
  // Cached data state - keeps data for each sport separately
  const [cachedData, setCachedData] = useState<{
    nfl: { games: NFLPrediction[], lastFetch: number | null };
    cfb: { games: CFBPrediction[], lastFetch: number | null };
    nba: { games: NBAGame[], lastFetch: number | null };
    ncaab: { games: NCAABGame[], lastFetch: number | null };
    mlb: { games: never[], lastFetch: number | null };
  }>({
    nfl: { games: [], lastFetch: null },
    cfb: { games: [], lastFetch: null },
    nba: { games: [], lastFetch: null },
    ncaab: { games: [], lastFetch: null },
    mlb: { games: [], lastFetch: null },
  });
  
  // Per-sport state
  const [sortModes, setSortModes] = useState<Record<Sport, SortMode>>({
    nfl: 'time',
    cfb: 'time',
    nba: 'time',
    ncaab: 'time',
    mlb: 'time',
  });
  const [searchTexts, setSearchTexts] = useState<Record<Sport, string>>({
    nfl: '',
    cfb: '',
    nba: '',
    ncaab: '',
    mlb: '',
  });
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [loading, setLoading] = useState<Record<Sport, boolean>>({
    nfl: true,
    cfb: false,
    nba: false,
    ncaab: false,
  });
  const [refreshing, setRefreshing] = useState<Record<Sport, boolean>>({
    nfl: false,
    cfb: false,
    nba: false,
    ncaab: false,
  });
  const [error, setError] = useState<Record<Sport, string | null>>({
    nfl: null,
    cfb: null,
    nba: null,
    ncaab: null,
  });
  
  // Calculate header heights (must match tab bar calculation)
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

  // Handle scroll event
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const sports: SportOption[] = [
    { id: 'nba', label: 'NBA', available: true, icon: 'basketball' },
    { id: 'ncaab', label: 'NCAAB', available: true, icon: 'basketball-hoop' },
    { id: 'nfl', label: 'NFL', available: true, icon: 'football' },
    { id: 'cfb', label: 'CFB', available: true, icon: 'school' },
    { id: 'mlb', label: 'MLB', available: false, icon: 'baseball' },
  ];

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
        setCachedData(prev => ({ ...prev, nfl: { games: [], lastFetch: Date.now() } }));
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
        .select('training_key, home_ml, away_ml, over_line, home_spread, spread_splits_label, ml_splits_label, total_splits_label, as_of_ts, game_date, game_time, home_ml_handle, away_ml_handle, home_ml_bets, away_ml_bets, home_spread_handle, away_spread_handle, home_spread_bets, away_spread_bets, over_handle, under_handle, over_bets, under_bets');

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

        // Debug: Log betting line data for first few games
        if (bettingLine && game.home_team) {
          console.log(`🎰 Betting data for ${game.away_team} @ ${game.home_team}:`, {
            home_ml_bets: bettingLine.home_ml_bets,
            away_ml_bets: bettingLine.away_ml_bets,
            home_spread_bets: bettingLine.home_spread_bets,
            over_bets: bettingLine.over_bets,
            ml_splits_label: bettingLine.ml_splits_label,
          });
        }

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
          // Public betting splits (labels)
          spread_splits_label: bettingLine?.spread_splits_label || null,
          total_splits_label: bettingLine?.total_splits_label || null,
          ml_splits_label: bettingLine?.ml_splits_label || null,
          // Public betting data - Moneyline
          home_ml_handle: bettingLine?.home_ml_handle || null,
          away_ml_handle: bettingLine?.away_ml_handle || null,
          home_ml_bets: bettingLine?.home_ml_bets || null,
          away_ml_bets: bettingLine?.away_ml_bets || null,
          // Public betting data - Spread
          home_spread_handle: bettingLine?.home_spread_handle || null,
          away_spread_handle: bettingLine?.away_spread_handle || null,
          home_spread_bets: bettingLine?.home_spread_bets || null,
          away_spread_bets: bettingLine?.away_spread_bets || null,
          // Public betting data - Total
          over_handle: bettingLine?.over_handle || null,
          under_handle: bettingLine?.under_handle || null,
          over_bets: bettingLine?.over_bets || null,
          under_bets: bettingLine?.under_bets || null,
        };
      });

      console.log(`📊 NFL: ${predictionsWithData.length} games, ${predictionsMap.size} have predictions`);
      
      // Update cached data
      setCachedData(prev => ({
        ...prev,
        nfl: { games: predictionsWithData, lastFetch: Date.now() }
      }));
    } catch (err) {
      console.error('Error fetching NFL data:', err);
      setError(prev => ({ ...prev, nfl: 'Failed to fetch NFL games' }));
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

      setCachedData(prev => ({
        ...prev,
        cfb: { games: predictionsWithData, lastFetch: Date.now() }
      }));
    } catch (err) {
      console.error('Error fetching CFB data:', err);
      setError(prev => ({ ...prev, cfb: 'Failed to fetch CFB games' }));
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
        setCachedData(prev => ({ ...prev, nba: { games: [], lastFetch: Date.now() } }));
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
          away_abbr: (input.away_abbr && input.away_abbr.trim()) || input.away_team || 'AWAY',
          home_abbr: (input.home_abbr && input.home_abbr.trim()) || input.home_team || 'HOME',
          home_ml: input.home_moneyline,
          away_ml: calculateAwayML(input.home_moneyline),
          home_spread: input.home_spread,
          away_spread: input.home_spread ? -input.home_spread : null,
          over_line: input.total_line,
          game_date: input.game_date,
          game_time: input.tipoff_time_et,
          training_key: gameIdStr,
          unique_id: gameIdStr,
          home_adj_offense: input.home_adj_off_rtg_pregame,
          away_adj_offense: input.away_adj_off_rtg_pregame,
          home_adj_defense: input.home_adj_def_rtg_pregame,
          away_adj_defense: input.away_adj_def_rtg_pregame,
          home_adj_pace: input.home_adj_pace_pregame,
          away_adj_pace: input.away_adj_pace_pregame,
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
      setCachedData(prev => ({
        ...prev,
        nba: { games, lastFetch: Date.now() }
      }));
    } catch (err) {
      console.error('Error fetching NBA data:', err);
      setError(prev => ({ ...prev, nba: 'Failed to fetch NBA games' }));
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
        setCachedData(prev => ({ ...prev, ncaab: { games: [], lastFetch: Date.now() } }));
        return;
      }

      // Get latest run_id first
      const { data: latestRun } = await collegeFootballSupabase
        .from('ncaab_predictions')
        .select('run_id')
        .order('as_of_ts_utc', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('🏀 NCAAB latest run_id:', latestRun?.run_id || 'none');

      let predictionMap = new Map();

      if (latestRun?.run_id) {
        // Fetch predictions only for latest run_id and matching game_ids
        const gameIds = inputValues.map((g: any) => Number(g.game_id));

        const { data: predictions, error: predError } = await collegeFootballSupabase
          .from('ncaab_predictions')
          .select('*')
          .eq('run_id', latestRun.run_id)
          .in('game_id', gameIds);

        console.log('🏀 NCAAB predictions query:', predictions?.length || 0, 'error:', predError?.message || 'none');

        if (predictions && predictions.length > 0) {
          predictions.forEach((pred: any) => {
            predictionMap.set(Number(pred.game_id), pred);
          });
          console.log(`✅ NCAAB predictions matched: ${predictionMap.size} for ${gameIds.length} games`);
        }
      }

      // Merge input values with predictions
      const games: NCAABGame[] = inputValues.map((input: any) => {
        const prediction = predictionMap.get(Number(input.game_id));
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
      setCachedData(prev => ({
        ...prev,
        ncaab: { games, lastFetch: Date.now() }
      }));
    } catch (err) {
      console.error('Error fetching NCAAB data:', err);
      setError(prev => ({ ...prev, ncaab: 'Failed to fetch NCAAB games' }));
    }
  };

  // Fetch data for a specific sport
  const fetchDataForSport = useCallback(async (sport: Sport, forceRefresh = false) => {
    // Check if we have cached data and it's recent (less than 5 minutes old)
    const cached = cachedData[sport];
    if (!forceRefresh && cached.lastFetch && Date.now() - cached.lastFetch < 5 * 60 * 1000) {
      console.log(`Using cached data for ${sport}`);
      return;
    }
    
    try {
      setError(prev => ({ ...prev, [sport]: null }));
      setLoading(prev => ({ ...prev, [sport]: true }));
      
      if (sport === 'nfl') {
        await fetchNFLData();
      } else if (sport === 'cfb') {
        await fetchCFBData();
      } else if (sport === 'nba') {
        await fetchNBAData();
      } else if (sport === 'ncaab') {
        await fetchNCAABData();
      }
    } catch (err) {
      console.error(`Error fetching ${sport} data:`, err);
    } finally {
      setLoading(prev => ({ ...prev, [sport]: false }));
      setRefreshing(prev => ({ ...prev, [sport]: false }));
    }
  }, [cachedData]);

  // Pre-load all sports data on mount
  useEffect(() => {
    // Load all sports in parallel
    sports.forEach(sport => {
      if (sport.available) {
        fetchDataForSport(sport.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle sport change - ensure data is loaded (but don't block UI)
  useEffect(() => {
    // Fetch in background if not cached, but don't block UI
    const cached = cachedData[selectedSport];
    if (!cached.lastFetch || Date.now() - cached.lastFetch > 5 * 60 * 1000) {
      fetchDataForSport(selectedSport);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport]);

  // WagerBot suggestion trigger - when sport changes or data loads
  useEffect(() => {
    const games = cachedData[selectedSport].games;
    if (games.length > 0) {
      onSportChange(selectedSport, games);
    }
  }, [selectedSport, cachedData[selectedSport].games.length, onSportChange]);

  // Setup WagerBot when feed mounts
  useEffect(() => {
    onPageChange('feed');
    onFeedMount();
    return () => {
      onFeedUnmount();
    };
  }, [onPageChange, onFeedMount, onFeedUnmount]);

  // Refresh handler for pull-to-refresh
  const onRefresh = useCallback((sport: Sport) => {
    setRefreshing(prev => ({ ...prev, [sport]: true }));
    fetchDataForSport(sport, true);
  }, [fetchDataForSport]);

  // Get current games, search text, and sort mode for selected sport
  const currentGames = useMemo(() => {
    return cachedData[selectedSport].games;
  }, [selectedSport, cachedData]);
  
  const searchText = searchTexts[selectedSport];
  const sortMode = sortModes[selectedSport];

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

  const renderGameCard = ({ item, index }: { item: NFLPrediction | CFBPrediction | NBAGame | NCAABGame, index: number }) => {
    const cardWidth = (Dimensions.get('window').width - 24) / 2;

    // Non-pro users only see first 2 cards per sport, rest are locked
    const isLocked = !isProLoading && !isPro && index >= 2;

    let gameCard: React.ReactNode = null;

    if (selectedSport === 'nfl') {
      gameCard = <NFLGameCard game={item as NFLPrediction} onPress={() => handleGamePress(item as NFLPrediction)} cardWidth={cardWidth} />;
    } else if (selectedSport === 'cfb') {
      gameCard = <CFBGameCard game={item as CFBPrediction} onPress={() => handleCFBGamePress(item as CFBPrediction)} cardWidth={cardWidth} />;
    } else if (selectedSport === 'nba') {
      gameCard = <NBAGameCard game={item as NBAGame} onPress={() => handleNBAGamePress(item as NBAGame)} cardWidth={cardWidth} />;
    } else if (selectedSport === 'ncaab') {
      gameCard = <NCAABGameCard game={item as NCAABGame} onPress={() => handleNCAABGamePress(item as NCAABGame)} cardWidth={cardWidth} />;
    }

    if (!gameCard) return null;

    // Wrap in LockedGameCard for non-pro users after first 2 cards
    if (isLocked) {
      return (
        <LockedGameCard cardWidth={cardWidth}>
          {gameCard}
        </LockedGameCard>
      );
    }

    return gameCard;
  };

  // Handle tab press - switch immediately, show shimmer if data not ready
  const handleTabPress = useCallback((sport: Sport) => {
    // Switch immediately for instant feel
    setSelectedSport(sport);
    // Fetch in background if needed (won't block UI)
    const cached = cachedData[sport];
    if (!cached.lastFetch || Date.now() - cached.lastFetch > 5 * 60 * 1000) {
      fetchDataForSport(sport);
    }
  }, [cachedData, fetchDataForSport]);

  // Handle suggestion tap - navigate to the specific game
  const handleSuggestionTap = useCallback((gameId: string, sport: string) => {
    console.log(`🤖 Suggestion tapped for game: ${gameId}, sport: ${sport}`);
    dismissSuggestion();

    // Find the game in the cached data
    const sportKey = sport as Sport;
    const games = cachedData[sportKey].games;
    const game = games.find((g: any) => {
      const id = String(g.id || g.unique_id || g.training_key || `${g.away_team}_${g.home_team}` || '');
      return id === gameId || id.includes(gameId) || gameId.includes(id);
    });

    if (game) {
      console.log(`🤖 Found game: ${game.away_team} @ ${game.home_team}`);
      // Open the appropriate bottom sheet
      if (sportKey === 'nfl') {
        openGameSheet(game as NFLPrediction);
      } else if (sportKey === 'cfb') {
        openCFBGameSheet(game as CFBPrediction);
      } else if (sportKey === 'nba') {
        openNBAGameSheet(game as NBAGame);
      } else if (sportKey === 'ncaab') {
        openNCAABGameSheet(game as NCAABGame);
      }
    } else {
      console.log(`🤖 Game not found for ID: ${gameId}`);
    }
  }, [cachedData, dismissSuggestion, openGameSheet, openCFBGameSheet, openNBAGameSheet, openNCAABGameSheet]);

  // Render list header with search and filters for a specific sport
  const renderListHeader = (sport: Sport) => (
    <View>
      <View style={[
        styles.listHeader,
        { backgroundColor: isDark ? '#000000' : '#ffffff' }
      ]}>
        <View style={[styles.searchContainer, {
          backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
        }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.onSurface, opacity: 0.8 }]}
            placeholder="Search teams or cities..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={searchTexts[sport]}
            onChangeText={(text) => setSearchTexts(prev => ({ ...prev, [sport]: text }))}
          />
          {searchTexts[sport].length > 0 && (
            <TouchableOpacity onPress={() => setSearchTexts(prev => ({ ...prev, [sport]: '' }))}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          )}
        </View>

        <Menu
          visible={sortMenuVisible}
          onDismiss={() => setSortMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}
              onPress={() => setSortMenuVisible(true)}
            >
              <MaterialCommunityIcons
                name="sort"
                size={20}
                color={theme.colors.onSurface}
              />
            </TouchableOpacity>
          }
          anchorPosition="bottom"
          contentStyle={{ marginTop: 40 }}
        >
          <Menu.Item
            onPress={() => {
              setSortModes(prev => ({ ...prev, [sport]: 'time' }));
              setSortMenuVisible(false);
            }}
            title="Sort by Time"
            leadingIcon="clock-outline"
          />
          <Menu.Item
            onPress={() => {
              setSortModes(prev => ({ ...prev, [sport]: 'spread' }));
              setSortMenuVisible(false);
            }}
            title="Sort by Spread Value"
            leadingIcon="chart-line"
          />
          <Menu.Item
            onPress={() => {
              setSortModes(prev => ({ ...prev, [sport]: 'ou' }));
              setSortMenuVisible(false);
            }}
            title="Sort by O/U Value"
            leadingIcon="numeric"
          />
        </Menu>
      </View>

      {/* NBA Betting Trends Banner - only show when on NBA tab and not searching */}
      {sport === 'nba' && !searchTexts.nba && <BettingTrendsBanner />}
    </View>
  );

  // Render a sport page
  const renderSportPage = (sport: Sport) => {
    const cardWidth = (Dimensions.get('window').width - 24) / 2;
    const games = cachedData[sport].games;
    const searchTerm = searchTexts[sport];
    const currentSortMode = sortModes[sport];
    const isLoading = loading[sport];
    const isRefreshing = refreshing[sport];
    const errorMsg = error[sport];
    
    // Filter games
    const filtered = useMemo(() => {
      if (!searchTerm.trim()) return games;
      const search = searchTerm.toLowerCase();
      return games.filter(game => {
        const homeTeam = game.home_team.toLowerCase();
        const awayTeam = game.away_team.toLowerCase();
        return homeTeam.includes(search) || awayTeam.includes(search);
      });
    }, [games, searchTerm]);
    
    // Sort games
    const sorted = useMemo(() => {
      const gamesCopy = [...filtered];
      
      if (currentSortMode === 'time') {
        return gamesCopy.sort((a, b) => {
          const timeA = new Date(a.game_date).getTime();
          const timeB = new Date(b.game_date).getTime();
          return timeA - timeB;
        });
      }
      
      if (currentSortMode === 'spread') {
        if (sport === 'cfb') {
          return gamesCopy.sort((a, b) => {
            const edgeA = Math.abs((a as CFBPrediction).home_spread_diff || 0);
            const edgeB = Math.abs((b as CFBPrediction).home_spread_diff || 0);
            return edgeB - edgeA;
          });
        } else {
          return gamesCopy.sort((a, b) => {
            const probA = Math.max((a as any).home_away_spread_cover_prob || 0, 1 - ((a as any).home_away_spread_cover_prob || 0));
            const probB = Math.max((b as any).home_away_spread_cover_prob || 0, 1 - ((b as any).home_away_spread_cover_prob || 0));
            return probB - probA;
          });
        }
      }
      
      if (currentSortMode === 'ou') {
        if (sport === 'cfb') {
          return gamesCopy.sort((a, b) => {
            const edgeA = Math.abs((a as CFBPrediction).over_line_diff || 0);
            const edgeB = Math.abs((b as CFBPrediction).over_line_diff || 0);
            return edgeB - edgeA;
          });
        } else {
          return gamesCopy.sort((a, b) => {
            const probA = Math.max((a as any).ou_result_prob || 0, 1 - ((a as any).ou_result_prob || 0));
            const probB = Math.max((b as any).ou_result_prob || 0, 1 - ((b as any).ou_result_prob || 0));
            return probB - probA;
          });
        }
      }
      
      return gamesCopy;
    }, [filtered, currentSortMode, sport]);
    
    // Show shimmer if loading or if no data yet (for instant feel when switching tabs)
    const hasData = games.length > 0;
    const isCurrentlyLoading = isLoading && !isRefreshing;
    const showShimmer = isCurrentlyLoading || (!hasData && !errorMsg && !isRefreshing);
    
    return (
      <View key={sport} style={styles.pageContainer}>
        {showShimmer ? (
          <View style={{ paddingTop: TOTAL_HEADER_HEIGHT }}>
            <View style={[styles.shimmerContainer, { paddingBottom: 65 + insets.bottom + 20 }]}>
                <View style={styles.shimmerRow}>
                  <GameCardShimmer cardWidth={cardWidth} />
                  <GameCardShimmer cardWidth={cardWidth} />
                </View>
                <View style={styles.shimmerRow}>
                  <GameCardShimmer cardWidth={cardWidth} />
                  <GameCardShimmer cardWidth={cardWidth} />
                </View>
            </View>
          </View>
        ) : errorMsg ? (
          <View style={[styles.centerContainer, { paddingTop: TOTAL_HEADER_HEIGHT }]}>
            <MaterialCommunityIcons name="alert-circle" size={60} color={theme.colors.error} />
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMsg}</Text>
          </View>
        ) : (
          <Animated.FlatList
            data={sorted}
            renderItem={renderGameCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
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
            showsVerticalScrollIndicator={true}
            ListHeaderComponent={renderListHeader(sport)}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <MaterialCommunityIcons name="calendar-blank" size={60} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  {searchTerm ? 'No games match your search' : 'No games available'}
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl 
                refreshing={isRefreshing} 
                onRefresh={() => onRefresh(sport)}
                colors={[theme.colors.primary]}
                progressViewOffset={TOTAL_HEADER_HEIGHT}
              />
            }
          />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
        {/* WagerBot Suggestion Bubble is now rendered in tabs _layout.tsx for all pages */}

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
          <AndroidBlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.fixedHeader, { paddingTop: insets.top }]}
          >
          <View style={styles.headerTop}>
            <TouchableOpacity 
              onPress={() => {
                console.log('Hamburger menu pressed');
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
              <View style={styles.headerRightButtons}>
                {/* Test Mode Trigger Button - only visible when test mode is enabled */}
                {testModeEnabled && (
                  <TouchableOpacity
                    onPress={triggerTestSuggestion}
                    style={[styles.chatButton, styles.testTriggerButton]}
                  >
                    <MaterialCommunityIcons name="lightning-bolt" size={20} color="#00E676" />
                  </TouchableOpacity>
                )}

                {/* WagerBot Icon - Opens manual menu on tap */}
                <TouchableOpacity
                  onPress={openManualMenu}
                  style={styles.chatButton}
                >
                  <MaterialCommunityIcons name="robot" size={24} color={theme.colors.onSurface} />
                </TouchableOpacity>
              </View>
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
              {sports.map((sport) => {
                const isSelected = selectedSport === sport.id;
                return (
                  <TouchableOpacity
                    key={sport.id}
                    style={styles.sportTab}
                    onPress={() => {
                      if (sport.available) {
                        handleTabPress(sport.id);
                      } else {
                        Alert.alert(
                          'Coming Soon',
                          `${sport.label} predictions are coming soon! Stay tuned for updates.`,
                          [{ text: 'OK' }]
                        );
                      }
                    }}
                  >
                    <View style={styles.sportTabLabelContainer}>
                      <Text style={[
                        styles.sportTabText,
                        {
                          color: isSelected ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                          fontWeight: isSelected ? '700' : '500',
                          opacity: sport.available ? 1 : 0.5
                        }
                      ]}>
                        {sport.label}
                      </Text>
                      {sport.badge && (
                        <View style={styles.sportBadge}>
                          <Text style={styles.sportBadgeText}>{sport.badge}</Text>
                        </View>
                      )}
                    </View>
                    {isSelected && (
                      <View style={[styles.sportIndicator, { backgroundColor: '#00E676' }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          </AndroidBlurView>
        </Animated.View>

        {/* Sport Content */}
        {renderSportPage(selectedSport)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
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
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  testTriggerButton: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.3)',
  },
  headerRight: {
    width: 32, // Balances the menu button
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
  sportTabLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sportBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sportBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
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
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    padding: 0,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 0,
  },
  columnWrapper: {
    paddingHorizontal: 8,
    gap: 8,
  },
  shimmerContainer: {
    paddingHorizontal: 8,
    paddingTop: 20,
    gap: 0,
  },
  shimmerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
