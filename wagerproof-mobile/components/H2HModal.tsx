import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native';
import { Portal, Dialog, Button, useTheme, ActivityIndicator, DataTable } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { TeamCircle } from './TeamCircle';

interface H2HModalProps {
  visible: boolean;
  homeTeam: string;
  awayTeam: string;
  onDismiss: () => void;
}

interface H2HGame {
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  home_spread: number;
  winner: string;
}

export const H2HModal: React.FC<H2HModalProps> = ({
  visible,
  homeTeam,
  awayTeam,
  onDismiss
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<H2HGame[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && homeTeam && awayTeam) {
      fetchH2HData();
    }
  }, [visible, homeTeam, awayTeam]);

  const fetchH2HData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await collegeFootballSupabase
        .from('nfl_historical_games')
        .select('*')
        .or(`and(home_team.eq.${homeTeam},away_team.eq.${awayTeam}),and(home_team.eq.${awayTeam},away_team.eq.${homeTeam})`)
        .order('game_date', { ascending: false })
        .limit(10);

      if (fetchError) throw fetchError;
      setGames(data || []);
    } catch (err) {
      console.error('Error fetching H2H data:', err);
      setError('Failed to load head-to-head data');
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>
          <MaterialCommunityIcons name="history" size={24} color={theme.colors.primary} />
          <Text style={{ marginLeft: 10 }}>Head-to-Head History</Text>
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <View style={styles.teamsRow}>
              <View style={styles.teamColumn}>
                <TeamCircle teamCity={awayTeam} size="medium" />
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]}>
                  {awayTeam}
                </Text>
              </View>
              <Text style={[styles.vs, { color: theme.colors.onSurfaceVariant }]}>VS</Text>
              <View style={styles.teamColumn}>
                <TeamCircle teamCity={homeTeam} size="medium" />
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]}>
                  {homeTeam}
                </Text>
              </View>
            </View>

            {loading && (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
                  Loading history...
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={40} color={theme.colors.error} />
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
              </View>
            )}

            {!loading && !error && games.length === 0 && (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="information-outline" size={40} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  No historical matchups found
                </Text>
              </View>
            )}

            {!loading && !error && games.length > 0 && (
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>Date</DataTable.Title>
                  <DataTable.Title numeric>Score</DataTable.Title>
                  <DataTable.Title>Winner</DataTable.Title>
                </DataTable.Header>

                {games.map((game, index) => (
                  <DataTable.Row key={index}>
                    <DataTable.Cell>{formatDate(game.game_date)}</DataTable.Cell>
                    <DataTable.Cell numeric>
                      {game.away_score} - {game.home_score}
                    </DataTable.Cell>
                    <DataTable.Cell>{game.winner}</DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollArea: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
  },
  teamColumn: {
    alignItems: 'center',
    gap: 8,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
  },
  vs: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
  },
});

