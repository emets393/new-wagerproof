import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchH2HData, H2HGame } from '@/utils/nflDataFetchers';
import { getNFLTeamColors, getTeamInitials, getContrastingTextColor } from '@/utils/teamColors';

interface H2HSectionProps {
  homeTeam: string;
  awayTeam: string;
}

export function H2HSection({ homeTeam, awayTeam }: H2HSectionProps) {
  const theme = useTheme();
  const [games, setGames] = useState<H2HGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadH2HData();
  }, [homeTeam, awayTeam]);

  const loadH2HData = async () => {
    setLoading(true);
    const data = await fetchH2HData(homeTeam, awayTeam);
    setGames(data);
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getWinner = (game: H2HGame) => {
    return game.home_score > game.away_score ? game.home_team : game.away_team;
  };

  const renderGame = (game: H2HGame, index: number) => {
    const winner = getWinner(game);
    const isHomeWinner = winner === game.home_team;
    const homeColors = getNFLTeamColors(game.home_team);
    const awayColors = getNFLTeamColors(game.away_team);

    return (
      <View key={index} style={[styles.gameCard, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
        <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
          {formatDate(game.game_date)}
        </Text>

        <View style={styles.teamsRow}>
          {/* Away Team */}
          <View style={styles.teamSection}>
            <LinearGradient
              colors={[awayColors.primary, awayColors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.teamCircle,
                !isHomeWinner && styles.winnerCircle
              ]}
            >
              <Text style={[
                styles.teamInitials,
                { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }
              ]}>
                {getTeamInitials(game.away_team)}
              </Text>
            </LinearGradient>
            <Text style={[
              styles.scoreText,
              { color: theme.colors.onSurface },
              !isHomeWinner && styles.winnerText
            ]}>
              {game.away_score}
            </Text>
          </View>

          <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>

          {/* Home Team */}
          <View style={styles.teamSection}>
            <LinearGradient
              colors={[homeColors.primary, homeColors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.teamCircle,
                isHomeWinner && styles.winnerCircle
              ]}
            >
              <Text style={[
                styles.teamInitials,
                { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }
              ]}>
                {getTeamInitials(game.home_team)}
              </Text>
            </LinearGradient>
            <Text style={[
              styles.scoreText,
              { color: theme.colors.onSurface },
              isHomeWinner && styles.winnerText
            ]}>
              {game.home_score}
            </Text>
          </View>
        </View>

        {winner && (
          <View style={styles.resultRow}>
            <MaterialCommunityIcons name="trophy" size={14} color="#fbbf24" />
            <Text style={[styles.resultText, { color: theme.colors.onSurfaceVariant }]}>
              {winner} won
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="history" size={24} color="#3b82f6" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Head-to-Head History
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : games.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <MaterialCommunityIcons name="information-outline" size={40} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No previous matchups found
          </Text>
        </View>
      ) : (
        <View style={styles.gamesContainer}>
          {games.map((game, index) => renderGame(game, index))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  gamesContainer: {
    gap: 12,
  },
  gameCard: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  teamSection: {
    alignItems: 'center',
    gap: 8,
  },
  teamCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  winnerCircle: {
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  teamInitials: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  winnerText: {
    color: '#fbbf24',
  },
  atSymbol: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  resultText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

