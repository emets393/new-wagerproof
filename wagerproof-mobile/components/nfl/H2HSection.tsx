import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
  const [expanded, setExpanded] = useState(false);

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
    // Parse date string manually to avoid timezone issues
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // months are 0-indexed
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    // Fallback to original behavior if format is unexpected
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

  const getTeamRecord = () => {
    let homeWins = 0;
    let awayWins = 0;

    games.forEach(game => {
      const winner = getWinner(game);
      // Check if current matchup's home team won or if it was the away team
      if (game.home_team === homeTeam && winner === homeTeam) homeWins++;
      else if (game.away_team === homeTeam && winner === homeTeam) homeWins++;
      else if (game.home_team === awayTeam && winner === awayTeam) awayWins++;
      else if (game.away_team === awayTeam && winner === awayTeam) awayWins++;
    });

    return { homeWins, awayWins };
  };

  const handleToggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
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

  const record = getTeamRecord();
  const homeColors = getNFLTeamColors(homeTeam);
  const awayColors = getNFLTeamColors(awayTeam);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="history" size={20} color="#3b82f6" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Head-to-Head History
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : games.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <MaterialCommunityIcons name="information-outline" size={32} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No previous matchups found
          </Text>
        </View>
      ) : (
        <View>
          {/* Record Summary */}
          <TouchableOpacity 
            onPress={handleToggleExpand}
            activeOpacity={0.7}
            style={[styles.recordCard, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}
          >
            <View style={styles.recordRow}>
              {/* Home Team */}
              <View style={styles.recordTeam}>
                <LinearGradient
                  colors={[homeColors.primary, homeColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.recordCircle}
                >
                  <Text style={[
                    styles.recordInitials,
                    { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }
                  ]}>
                    {getTeamInitials(homeTeam)}
                  </Text>
                </LinearGradient>
                <Text style={[styles.recordNumber, { color: theme.colors.onSurface }]}>
                  {record.homeWins}
                </Text>
              </View>

              <Text style={[styles.recordDash, { color: theme.colors.onSurfaceVariant }]}>-</Text>

              {/* Away Team */}
              <View style={styles.recordTeam}>
                <Text style={[styles.recordNumber, { color: theme.colors.onSurface }]}>
                  {record.awayWins}
                </Text>
                <LinearGradient
                  colors={[awayColors.primary, awayColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.recordCircle}
                >
                  <Text style={[
                    styles.recordInitials,
                    { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }
                  ]}>
                    {getTeamInitials(awayTeam)}
                  </Text>
                </LinearGradient>
              </View>
            </View>

            <View style={styles.expandHint}>
              <MaterialCommunityIcons 
                name={expanded ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={theme.colors.onSurfaceVariant} 
              />
              <Text style={[styles.expandText, { color: theme.colors.onSurfaceVariant }]}>
                {expanded ? 'Hide' : 'View'} game history
              </Text>
            </View>
          </TouchableOpacity>

          {/* Game History */}
          {expanded && (
            <View style={styles.gamesContainer}>
              {games.map((game, index) => renderGame(game, index))}
            </View>
          )}
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
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  recordCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  recordTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInitials: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  recordNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  recordDash: {
    fontSize: 20,
    fontWeight: '600',
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  expandText: {
    fontSize: 12,
    fontWeight: '500',
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
    marginTop: 12,
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

