import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TextInput, ScrollView } from 'react-native';
import { useTheme, Chip, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LiveScoreTicker } from '@/components/LiveScoreTicker';
import { NFLGameCard } from '@/components/NFLGameCard';
import { CFBGameCard } from '@/components/CFBGameCard';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { NFLPrediction } from '@/types/nfl';
import { CFBPrediction } from '@/types/cfb';

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
  
  // State
  const [selectedSport, setSelectedSport] = useState<Sport>('nfl');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [searchText, setSearchText] = useState('');
  const [nflGames, setNflGames] = useState<NFLPrediction[]>([]);
  const [cfbGames, setCfbGames] = useState<CFBPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sports: SportOption[] = [
    { id: 'nfl', label: 'NFL', available: true },
    { id: 'cfb', label: 'CFB', available: true },
    { id: 'nba', label: 'NBA', available: false, badge: 'Coming Soon' },
    { id: 'ncaab', label: 'NCAAB', available: false, badge: 'Coming Soon' },
  ];

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

      // Get betting splits
      const { data: bettingSplitsData } = await collegeFootballSupabase
        .from('production_betting_facts_nfl')
        .select('*');

      const bettingSplitsMap = new Map();
      bettingSplitsData?.forEach(b => bettingSplitsMap.set(b.training_key, b));

      // Combine data
      const predictionsWithData: NFLPrediction[] = (preds || [])
        .map((pred: any) => {
          const bettingLine = bettingMap.get(pred.training_key);
          if (!bettingLine) return null;

          const bettingSplits = bettingSplitsMap.get(pred.training_key);

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
            temperature: null,
            precipitation: null,
            wind_speed: null,
            icon: null,
            spread_splits_label: bettingSplits?.spread_splits_label || null,
            total_splits_label: bettingSplits?.total_splits_label || null,
            ml_splits_label: bettingSplits?.ml_splits_label || null,
          };
        })
        .filter(pred => pred !== null);

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

  // Filter games by search text
  const filteredGames = useMemo(() => {
    if (!searchText.trim()) return currentGames;
    
    const search = searchText.toLowerCase();
    return currentGames.filter(game =>
      game.home_team.toLowerCase().includes(search) ||
      game.away_team.toLowerCase().includes(search)
    );
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

  const renderGameCard = ({ item }: { item: NFLPrediction | CFBPrediction }) => {
    if (selectedSport === 'nfl') {
      return <NFLGameCard game={item as NFLPrediction} />;
    }
    return <CFBGameCard game={item as CFBPrediction} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with Title and Live Ticker */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Feed</Text>
        </View>
        <LiveScoreTicker />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.onSurfaceVariant} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
          placeholder="Search teams..."
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <MaterialCommunityIcons
            name="close-circle"
            size={20}
            color={theme.colors.onSurfaceVariant}
            onPress={() => setSearchText('')}
          />
        )}
      </View>

      {/* Sport Pills */}
      <View style={[styles.pillsWrapper, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text style={[styles.pillsLabel, { color: theme.colors.onSurfaceVariant }]}>Sport:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsContainer}
          contentContainerStyle={styles.pillsContent}
        >
          {sports.map((sport) => (
            <Chip
              key={sport.id}
              selected={selectedSport === sport.id}
              onPress={() => sport.available && setSelectedSport(sport.id)}
              disabled={!sport.available}
              style={[
                styles.sportChip,
                selectedSport === sport.id && { backgroundColor: theme.colors.primary },
                !sport.available && { opacity: 0.5 }
              ]}
              textStyle={[
                styles.sportChipText,
                selectedSport === sport.id && { color: theme.colors.onPrimary }
              ]}
            >
              {sport.label} {sport.badge && `(${sport.badge})`}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* Sort Options */}
      <View style={[styles.sortContainer, { backgroundColor: theme.colors.surface }]}>
        <Chip
          selected={sortMode === 'time'}
          onPress={() => setSortMode('time')}
          style={[styles.sortChip, sortMode === 'time' && { backgroundColor: theme.colors.primary }]}
          textStyle={[sortMode === 'time' && { color: theme.colors.onPrimary }]}
          icon={() => <MaterialCommunityIcons name="clock-outline" size={16} color={sortMode === 'time' ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />}
        >
          Time
        </Chip>
        <Chip
          selected={sortMode === 'spread'}
          onPress={() => setSortMode('spread')}
          style={[styles.sortChip, sortMode === 'spread' && { backgroundColor: theme.colors.primary }]}
          textStyle={[sortMode === 'spread' && { color: theme.colors.onPrimary }]}
          icon={() => <MaterialCommunityIcons name="chart-line" size={16} color={sortMode === 'spread' ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />}
        >
          Spread
        </Chip>
        <Chip
          selected={sortMode === 'ou'}
          onPress={() => setSortMode('ou')}
          style={[styles.sortChip, sortMode === 'ou' && { backgroundColor: theme.colors.primary }]}
          textStyle={[sortMode === 'ou' && { color: theme.colors.onPrimary }]}
          icon={() => <MaterialCommunityIcons name="numeric" size={16} color={sortMode === 'ou' ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />}
        >
          O/U
        </Chip>
      </View>

      {/* Games List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading games...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="alert-circle" size={60} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      ) : sortedGames.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="calendar-blank" size={60} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            {searchText ? 'No games match your search' : 'No games available'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedGames}
          renderItem={renderGameCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
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
  header: {
    paddingTop: 50,
    paddingBottom: 8,
    elevation: 4,
  },
  headerTop: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  pillsWrapper: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 1,
  },
  pillsLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillsContainer: {
    flexGrow: 0,
  },
  pillsContent: {
    gap: 8,
    alignItems: 'center',
  },
  sportChip: {
    marginRight: 8,
  },
  sportChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    elevation: 1,
  },
  sortChip: {
    flex: 1,
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
