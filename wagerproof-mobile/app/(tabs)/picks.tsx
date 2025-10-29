import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Linking } from 'react-native';
import { useTheme, Card, ActivityIndicator, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { EditorPick, GameData } from '@/types/editorsPicks';
import { EditorPickCard } from '@/components/EditorPickCard';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNFLTeamColors, getCFBTeamColors } from '@/constants/teamColors';

export default function PicksScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
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
                .eq('training_key', pick.game_id)
                .single();

              if (!gameError && gameData) {
                const away_colors = getNFLTeamColors(gameData.away_team);
                const home_colors = getNFLTeamColors(gameData.home_team);

                // Format NFL date
                let formattedDate = gameData.game_date;
                if (gameData.game_date) {
                  try {
                    const [year, month, day] = gameData.game_date.split('-').map(Number);
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
                let formattedTime = gameData.game_time;
                if (gameData.game_time) {
                  try {
                    const [hours, minutes] = gameData.game_time.split(':').map(Number);
                    const estHours = hours + 4;
                    const finalHours = estHours >= 24 ? estHours - 24 : estHours;
                    const today = new Date();
                    const estDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), finalHours, minutes, 0);
                    formattedTime = estDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    }) + ' EST';
                  } catch (error) {
                    console.error('Error formatting NFL time:', error);
                  }
                }

                gameDataMap.set(pick.id, {
                  away_team: gameData.away_team,
                  home_team: gameData.home_team,
                  game_date: formattedDate,
                  game_time: formattedTime,
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

                // Get the start time from any available field
                const startTimeString = gameData.start_time || gameData.start_date || gameData.game_datetime || gameData.datetime;
                
                // Format date and time
                let formattedDate = 'TBD';
                let formattedTime = 'TBD';
                
                if (startTimeString) {
                  try {
                    const utcDate = new Date(startTimeString);
                    
                    // Format date
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
                    
                    // Format time
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

                gameDataMap.set(pick.id, {
                  away_team: gameData.away_team,
                  home_team: gameData.home_team,
                  game_date: formattedDate,
                  game_time: formattedTime,
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

  const handleOpenTikTok = () => {
    Linking.openURL('https://www.tiktok.com/@wagerproof');
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
      <View style={[styles.header, { backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="star" size={32} color={isDark ? '#FFD700' : '#FFD700'} style={styles.starIcon} />
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
          <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.emptyContent}>
                <MaterialCommunityIcons 
                  name="sparkles" 
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
        <FlatList
          data={picks}
          renderItem={renderPickCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 65 + insets.bottom + 20 }]}
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
});

