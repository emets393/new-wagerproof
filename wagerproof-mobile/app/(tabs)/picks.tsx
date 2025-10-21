import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useTheme, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { EditorPick, GameData } from '@/types/editorsPicks';
import { EditorPickCard } from '@/components/EditorPickCard';

export default function PicksScreen() {
  const theme = useTheme();
  const [picks, setPicks] = useState<EditorPick[]>([]);
  const [gamesData, setGamesData] = useState<Map<string, GameData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      setPicks((picksData || []) as EditorPick[]);

      // Fetch game data for all picks
      if (picksData && picksData.length > 0) {
        const gameDataMap = new Map<string, GameData>();

        for (const pick of picksData) {
          try {
            if (pick.game_type === 'nfl') {
              // Fetch NFL game data
              const { data: gameData, error: gameError } = await collegeFootballSupabase
                .from('nfl_betting_lines')
                .select('*')
                .eq('id', pick.game_id)
                .single();

              if (!gameError && gameData) {
                const away_colors = getNFLTeamColors(gameData.away_team);
                const home_colors = getNFLTeamColors(gameData.home_team);

                gameDataMap.set(pick.id, {
                  away_team: gameData.away_team,
                  home_team: gameData.home_team,
                  game_date: gameData.game_date,
                  game_time: gameData.game_time,
                  away_spread: gameData.away_spread,
                  home_spread: gameData.home_spread,
                  over_line: gameData.over_line,
                  away_ml: gameData.away_ml,
                  home_ml: gameData.home_ml,
                  home_team_colors: home_colors,
                  away_team_colors: away_colors,
                });
              }
            } else if (pick.game_type === 'cfb') {
              // Fetch CFB game data
              const { data: gameData, error: gameError } = await collegeFootballSupabase
                .from('cfb_live_weekly_inputs')
                .select('*')
                .eq('id', pick.game_id)
                .single();

              if (!gameError && gameData) {
                const away_colors = getCFBTeamColors(gameData.away_team);
                const home_colors = getCFBTeamColors(gameData.home_team);

                gameDataMap.set(pick.id, {
                  away_team: gameData.away_team,
                  home_team: gameData.home_team,
                  game_date: gameData.start_time || gameData.game_date,
                  game_time: gameData.start_time || gameData.game_time,
                  away_spread: gameData.api_spread ? -gameData.api_spread : null,
                  home_spread: gameData.api_spread,
                  over_line: gameData.api_over_line,
                  away_ml: gameData.away_moneyline,
                  home_ml: gameData.home_moneyline,
                  opening_spread: (gameData as any)?.spread ?? null,
                  home_team_colors: home_colors,
                  away_team_colors: away_colors,
                });
              }
            }
          } catch (err) {
            console.error(`Error fetching game data for pick ${pick.id}:`, err);
          }
        }

        setGamesData(gameDataMap);
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

  // Helper color functions (simplified versions)
  const getNFLTeamColors = (team: string): { primary: string; secondary: string } => {
    // Add basic NFL team colors - simplified for mobile
    const colors: Record<string, { primary: string; secondary: string }> = {
      'Kansas City': { primary: '#E31837', secondary: '#FFB612' },
      'Buffalo': { primary: '#00338D', secondary: '#C60C30' },
      'San Francisco': { primary: '#AA0000', secondary: '#B3995D' },
      'Philadelphia': { primary: '#004C54', secondary: '#A5ACAF' },
      // Add more as needed...
    };
    return colors[team] || { primary: '#6B7280', secondary: '#9CA3AF' };
  };

  const getCFBTeamColors = (team: string): { primary: string; secondary: string } => {
    // Add basic CFB team colors - simplified for mobile
    const colors: Record<string, { primary: string; secondary: string }> = {
      'Georgia': { primary: '#BA0C2F', secondary: '#000000' },
      'Alabama': { primary: '#9E1B32', secondary: '#FFFFFF' },
      'Ohio State': { primary: '#BB0000', secondary: '#666666' },
      'Michigan': { primary: '#00274C', secondary: '#FFCB05' },
      // Add more as needed...
    };
    return colors[team] || { primary: '#6B7280', secondary: '#9CA3AF' };
  };

  const renderPickCard = ({ item }: { item: EditorPick }) => {
    const gameData = gamesData.get(item.id);
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="star" size={32} color="#FFD700" style={styles.starIcon} />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Editor's Picks
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="alert-circle" size={60} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      ) : picks.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="star-off" size={60} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No picks available
          </Text>
        </View>
      ) : (
        <FlatList
          data={picks}
          renderItem={renderPickCard}
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
    paddingBottom: 16,
    paddingHorizontal: 16,
    elevation: 4,
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
});

