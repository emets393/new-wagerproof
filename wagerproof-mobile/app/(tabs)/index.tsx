import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl, TextInput, ScrollView, Animated, Image, TouchableOpacity } from 'react-native';
import { useTheme, Chip, ActivityIndicator, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import { LiveScoreTicker } from '@/components/LiveScoreTicker';
import { NFLGameCard } from '@/components/NFLGameCard';
import { CFBGameCard } from '@/components/CFBGameCard';
import { NFLGameBottomSheet } from '@/components/NFLGameBottomSheet';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { NFLPrediction } from '@/types/nfl';
import { CFBPrediction } from '@/types/cfb';
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
  
  // State
  const [selectedSport, setSelectedSport] = useState<Sport>('nfl');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [searchText, setSearchText] = useState('');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [nflGames, setNflGames] = useState<NFLPrediction[]>([]);
  const [cfbGames, setCfbGames] = useState<CFBPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  const [selectedGame, setSelectedGame] = useState<NFLPrediction | null>(null);
  
  // Refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  
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
    { id: 'nba', label: 'NBA', available: false },
    { id: 'ncaab', label: 'NCAAB', available: false },
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

  // Fetch NFL data
  const fetchNFLData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get betting lines
      const { data: bettingData, error: bettingError } = await collegeFootballSupabase
        .from('nfl_betting_lines')
        .select('*')
        .gte('game_date', today)
        .order('as_of_ts', { ascending: false });

      if (bettingError) throw bettingError;

      // Get most recent betting line per training_key
      const bettingMap = new Map();
      bettingData?.forEach(bet => {
        const key = bet.training_key;
        if (!bettingMap.has(key) || new Date(bet.as_of_ts) > new Date(bettingMap.get(key).as_of_ts)) {
          bettingMap.set(key, bet);
        }
      });

      // Get latest run_id
      const { data: latestRunData, error: runError } = await collegeFootballSupabase
        .from('nfl_predictions_epa')
        .select('run_id')
        .gte('game_date', today)
        .order('run_id', { ascending: false })
        .limit(1);

      if (runError) throw runError;

      const latestRunId = latestRunData?.[0]?.run_id;
      if (!latestRunId) {
        setNflGames([]);
        return;
      }

      // Get predictions
      const { data: preds, error: predsError } = await collegeFootballSupabase
        .from('nfl_predictions_epa')
        .select('training_key, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, run_id, game_date')
        .gte('game_date', today)
        .eq('run_id', latestRunId)
        .order('game_date', { ascending: true });

      if (predsError) throw predsError;

      // Get weather data from production_weather table
      const { data: weatherData, error: weatherError } = await collegeFootballSupabase
        .from('production_weather')
        .select('*');

      if (weatherError) {
        console.warn('Weather data unavailable:', weatherError);
      }

      // Combine data
      const predictionsWithData: NFLPrediction[] = (preds || [])
        .map((pred: any) => {
          const bettingLine = bettingMap.get(pred.training_key);
          if (!bettingLine) return null;

          const weather = weatherData?.find(w => w.training_key === pred.training_key);

          return {
            id: bettingLine.id,
            away_team: bettingLine.away_team,
            home_team: bettingLine.home_team,
            home_ml: bettingLine.home_ml,
            away_ml: bettingLine.away_ml,
            home_spread: bettingLine.home_spread,
            away_spread: bettingLine.away_spread,
            over_line: bettingLine.over_line,
            game_date: bettingLine.game_date,
            game_time: bettingLine.game_time,
            training_key: pred.training_key,
            unique_id: bettingLine.unique_id,
            home_away_ml_prob: pred.home_away_ml_prob,
            home_away_spread_cover_prob: pred.home_away_spread_cover_prob,
            ou_result_prob: pred.ou_result_prob,
            run_id: pred.run_id,
            // Weather data from production_weather table
            temperature: weather?.temperature || null,
            precipitation: weather?.precipitation_pct || null,
            wind_speed: weather?.wind_speed || null,
            icon: weather?.icon || null,
            // Public betting splits - FROM bettingLine (nfl_betting_lines table)
            spread_splits_label: bettingLine.spread_splits_label || null,
            total_splits_label: bettingLine.total_splits_label || null,
            ml_splits_label: bettingLine.ml_splits_label || null,
          };
        })
        .filter(pred => pred !== null);

      // Debug: Log first game's betting splits
      if (predictionsWithData.length > 0) {
        console.log('NFL Game 1 betting splits:', {
          ml: predictionsWithData[0]?.ml_splits_label,
          spread: predictionsWithData[0]?.spread_splits_label,
          total: predictionsWithData[0]?.total_splits_label
        });
      }

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
          pred_away_score: apiPred?.pred_away_score ?? apiPred?.away_points ?? prediction.pred_away_score ?? null,
          pred_home_score: apiPred?.pred_home_score ?? apiPred?.home_points ?? prediction.pred_home_score ?? null,
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

  // Fetch data on mount and when sport changes
  const fetchData = async () => {
    try {
      setError(null);
      setLoading(true);
      
      if (selectedSport === 'nfl') {
        await fetchNFLData();
      } else if (selectedSport === 'cfb') {
        await fetchCFBData();
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
    return [];
  }, [selectedSport, nflGames, cfbGames]);

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
        return games.sort((a, b) => {
          const probA = Math.max((a as NFLPrediction).home_away_spread_cover_prob || 0, 1 - ((a as NFLPrediction).home_away_spread_cover_prob || 0));
          const probB = Math.max((b as NFLPrediction).home_away_spread_cover_prob || 0, 1 - ((b as NFLPrediction).home_away_spread_cover_prob || 0));
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
        return games.sort((a, b) => {
          const probA = Math.max((a as NFLPrediction).ou_result_prob || 0, 1 - ((a as NFLPrediction).ou_result_prob || 0));
          const probB = Math.max((b as NFLPrediction).ou_result_prob || 0, 1 - ((b as NFLPrediction).ou_result_prob || 0));
          return probB - probA;
        });
      }
    }
    
    return games;
  }, [filteredGames, sortMode, selectedSport]);

  const handleGamePress = (game: NFLPrediction) => {
    setSelectedGame(game);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const handleCloseBottomSheet = () => {
    setSelectedGame(null);
  };

  const renderGameCard = ({ item }: { item: NFLPrediction | CFBPrediction }) => {
    if (selectedSport === 'nfl') {
      return <NFLGameCard game={item as NFLPrediction} onPress={() => handleGamePress(item as NFLPrediction)} />;
    }
    return <CFBGameCard game={item as CFBPrediction} />;
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
                source={require('@/assets/wagerproof-logo.png')}
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
        <View style={[styles.centerContainer, { marginTop: TOTAL_COLLAPSIBLE_HEIGHT + 29 }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading games...
          </Text>
        </View>
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

      {/* NFL Game Bottom Sheet */}
      <NFLGameBottomSheet
        ref={bottomSheetRef}
        game={selectedGame}
        onClose={handleCloseBottomSheet}
      />
    </GestureHandlerRootView>
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
