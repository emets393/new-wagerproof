import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTheme, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveGame, PredictionStatus } from '@/types/liveScores';
import { useLiveScores } from '@/hooks/useLiveScores';
import { useSettings } from '@/contexts/SettingsContext';
import { getNFLTeamColors, getCFBTeamColors, getTeamInitials, getCFBTeamInitials, getContrastingTextColor } from '@/utils/teamColors';

export default function ScoreboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { useDummyData } = useSettings();
  
  // Get live scores
  const { games: liveGames, loading, refetch } = useLiveScores();
  const [refreshing, setRefreshing] = React.useState(false);

  // Dummy data for testing
  const dummyGames: LiveGame[] = [
    {
      id: '1',
      league: 'NFL',
      home_team: 'Kansas City Chiefs',
      away_team: 'Buffalo Bills',
      home_abbr: 'KC',
      away_abbr: 'BUF',
      home_score: 24,
      away_score: 21,
      quarter: 'Q3',
      time_remaining: '8:42',
      is_live: true,
      game_status: 'live',
      last_updated: new Date().toISOString(),
      predictions: {
        hasAnyHitting: true,
        moneyline: {
          predicted: 'Home',
          isHitting: true,
          probability: 0.65,
          currentDifferential: 3
        },
        spread: {
          predicted: 'Home',
          isHitting: false,
          probability: 0.58,
          line: -6.5,
          currentDifferential: 3
        },
        overUnder: {
          predicted: 'Over',
          isHitting: true,
          probability: 0.62,
          line: 47.5,
          currentDifferential: 45
        }
      }
    },
    {
      id: '2',
      league: 'NFL',
      home_team: 'San Francisco 49ers',
      away_team: 'Dallas Cowboys',
      home_abbr: 'SF',
      away_abbr: 'DAL',
      home_score: 17,
      away_score: 14,
      quarter: 'Q2',
      time_remaining: '2:15',
      is_live: true,
      game_status: 'live',
      last_updated: new Date().toISOString(),
      predictions: {
        hasAnyHitting: false,
        moneyline: {
          predicted: 'Home',
          isHitting: true,
          probability: 0.72,
          currentDifferential: 3
        },
        spread: {
          predicted: 'Home',
          isHitting: false,
          probability: 0.55,
          line: -3.5,
          currentDifferential: 3
        }
      }
    },
    {
      id: '3',
      league: 'CFB',
      home_team: 'Georgia',
      away_team: 'Alabama',
      home_abbr: 'UGA',
      away_abbr: 'ALA',
      home_score: 28,
      away_score: 31,
      quarter: 'Q4',
      time_remaining: '4:38',
      is_live: true,
      game_status: 'live',
      last_updated: new Date().toISOString(),
      predictions: {
        hasAnyHitting: true,
        spread: {
          predicted: 'Away',
          isHitting: true,
          probability: 0.68,
          line: 2.5,
          currentDifferential: -3
        },
        overUnder: {
          predicted: 'Over',
          isHitting: true,
          probability: 0.71,
          line: 54.5,
          currentDifferential: 59
        }
      }
    },
    {
      id: '4',
      league: 'NFL',
      home_team: 'Miami Dolphins',
      away_team: 'Philadelphia Eagles',
      home_abbr: 'MIA',
      away_abbr: 'PHI',
      home_score: 10,
      away_score: 7,
      quarter: 'Q1',
      time_remaining: '11:23',
      is_live: true,
      game_status: 'live',
      last_updated: new Date().toISOString(),
      predictions: {
        hasAnyHitting: true,
        moneyline: {
          predicted: 'Home',
          isHitting: true,
          probability: 0.58,
          currentDifferential: 3
        }
      }
    }
  ];

  const games = useDummyData ? dummyGames : liveGames;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderTeamCircle = (
    game: LiveGame,
    isHome: boolean,
    size: number = 40
  ) => {
    const teamName = isHome ? game.home_team : game.away_team;
    const isNFL = game.league === 'NFL';
    const colors = isNFL 
      ? getNFLTeamColors(teamName)
      : getCFBTeamColors(teamName);
    const initials = isHome
      ? (isNFL ? (game.home_abbr || getTeamInitials(game.home_team)) : getCFBTeamInitials(game.home_team))
      : (isNFL ? (game.away_abbr || getTeamInitials(game.away_team)) : getCFBTeamInitials(game.away_team));
    const textColor = getContrastingTextColor(colors.primary, colors.secondary);

    return (
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.teamCircle, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={[styles.teamInitials, { color: textColor, fontSize: size / 2.5 }]}>
          {initials}
        </Text>
      </LinearGradient>
    );
  };

  const renderPredictionIndicator = (
    prediction?: PredictionStatus,
    label: string = ''
  ) => {
    if (!prediction) return null;

    return (
      <View style={styles.predictionIndicator}>
        <View style={[
          styles.predictionDot,
          { backgroundColor: prediction.isHitting ? '#22D35F' : '#EF4444' }
        ]} />
        <Text style={[styles.predictionLabel, { color: theme.colors.onSurfaceVariant }]}>
          {label}
        </Text>
      </View>
    );
  };

  const renderGameCard = (game: LiveGame) => {
    const isHomeWinning = game.home_score > game.away_score;
    const isAwayWinning = game.away_score > game.home_score;
    const hasAnyPredictions = game.predictions && (
      game.predictions.moneyline || 
      game.predictions.spread || 
      game.predictions.overUnder
    );

    return (
      <Card key={game.id} style={[styles.gameCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.gameCardContent}>
          {/* Header: League + Status */}
          <View style={styles.gameHeader}>
            <View style={styles.leagueContainer}>
              <View style={[styles.leagueBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text style={[styles.leagueText, { color: theme.colors.onPrimaryContainer }]}>
                  {game.league}
                </Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={[styles.liveText, { color: theme.colors.error }]}>
                  LIVE
                </Text>
              </View>
            </View>
            <Text style={[styles.quarterText, { color: theme.colors.onSurfaceVariant }]}>
              {game.quarter && game.quarter.trim() ? `${game.quarter}${game.time_remaining ? ' • ' : ''}` : ''}
              {game.time_remaining || ''}
            </Text>
          </View>

          {/* Teams and Scores */}
          <View style={styles.teamsContainer}>
            {/* Away Team */}
            <View style={styles.teamRow}>
              {renderTeamCircle(game, false)}
              <View style={styles.teamInfo}>
                <Text 
                  style={[
                    styles.teamName, 
                    { color: theme.colors.onSurface },
                    isAwayWinning && styles.winningTeam
                  ]}
                  numberOfLines={1}
                >
                  {game.away_team}
                </Text>
              </View>
              <Text 
                style={[
                  styles.score,
                  { color: isAwayWinning ? '#22D35F' : theme.colors.onSurface }
                ]}
              >
                {game.away_score}
              </Text>
            </View>

            {/* Home Team */}
            <View style={styles.teamRow}>
              {renderTeamCircle(game, true)}
              <View style={styles.teamInfo}>
                <Text 
                  style={[
                    styles.teamName, 
                    { color: theme.colors.onSurface },
                    isHomeWinning && styles.winningTeam
                  ]}
                  numberOfLines={1}
                >
                  {game.home_team}
                </Text>
              </View>
              <Text 
                style={[
                  styles.score,
                  { color: isHomeWinning ? '#22D35F' : theme.colors.onSurface }
                ]}
              >
                {game.home_score}
              </Text>
            </View>
          </View>

          {/* Predictions */}
          {hasAnyPredictions && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
              
              <View style={styles.predictionsContainer}>
                <View style={styles.predictionsHeader}>
                  <MaterialCommunityIcons 
                    name="chart-line" 
                    size={16} 
                    color={theme.colors.onSurfaceVariant} 
                  />
                  <Text style={[styles.predictionsTitle, { color: theme.colors.onSurfaceVariant }]}>
                    Model Predictions
                  </Text>
                </View>

                <View style={styles.predictionsGrid}>
                  {game.predictions?.moneyline && (
                    <View style={styles.predictionItem}>
                      <Text style={[styles.predictionType, { color: theme.colors.onSurface }]}>
                        ML
                      </Text>
                      <View style={[
                        styles.predictionBadge,
                        { backgroundColor: game.predictions.moneyline.isHitting 
                          ? 'rgba(34, 211, 95, 0.15)' 
                          : 'rgba(239, 68, 68, 0.15)' 
                        }
                      ]}>
                        <MaterialCommunityIcons 
                          name={game.predictions.moneyline.isHitting ? 'check' : 'close'} 
                          size={14} 
                          color={game.predictions.moneyline.isHitting ? '#22D35F' : '#EF4444'} 
                        />
                        <Text style={[
                          styles.predictionBadgeText,
                          { color: game.predictions.moneyline.isHitting ? '#22D35F' : '#EF4444' }
                        ]}>
                          {game.predictions.moneyline.isHitting ? 'Hit' : 'Miss'}
                        </Text>
                      </View>
                      <Text style={[styles.predictionDetail, { color: theme.colors.onSurfaceVariant }]}>
                        {game.predictions.moneyline.predicted === 'Home' ? game.home_abbr : game.away_abbr} wins
                      </Text>
                      <Text style={[styles.predictionConfidence, { color: theme.colors.onSurfaceVariant }]}>
                        {(game.predictions.moneyline.probability * 100).toFixed(0)}%
                      </Text>
                    </View>
                  )}

                  {game.predictions?.spread && (
                    <View style={styles.predictionItem}>
                      <Text style={[styles.predictionType, { color: theme.colors.onSurface }]}>
                        Spread
                      </Text>
                      <View style={[
                        styles.predictionBadge,
                        { backgroundColor: game.predictions.spread.isHitting 
                          ? 'rgba(34, 211, 95, 0.15)' 
                          : 'rgba(239, 68, 68, 0.15)' 
                        }
                      ]}>
                        <MaterialCommunityIcons 
                          name={game.predictions.spread.isHitting ? 'check' : 'close'} 
                          size={14} 
                          color={game.predictions.spread.isHitting ? '#22D35F' : '#EF4444'} 
                        />
                        <Text style={[
                          styles.predictionBadgeText,
                          { color: game.predictions.spread.isHitting ? '#22D35F' : '#EF4444' }
                        ]}>
                          {game.predictions.spread.isHitting ? 'Hit' : 'Miss'}
                        </Text>
                      </View>
                      <Text style={[styles.predictionDetail, { color: theme.colors.onSurfaceVariant }]}>
                        {game.predictions.spread.line !== undefined 
                          ? `Line: ${game.predictions.spread.line > 0 ? '+' : ''}${game.predictions.spread.line.toFixed(1)}`
                          : 'No line'}
                      </Text>
                      <Text style={[styles.predictionDetail, { color: theme.colors.onSurfaceVariant }]}>
                        Diff: {game.predictions.spread.currentDifferential > 0 ? '+' : ''}{game.predictions.spread.currentDifferential.toFixed(1)}
                      </Text>
                      <Text style={[styles.predictionConfidence, { color: theme.colors.onSurfaceVariant }]}>
                        {(game.predictions.spread.probability * 100).toFixed(0)}%
                      </Text>
                    </View>
                  )}

                  {game.predictions?.overUnder && (
                    <View style={styles.predictionItem}>
                      <Text style={[styles.predictionType, { color: theme.colors.onSurface }]}>
                        O/U
                      </Text>
                      <View style={[
                        styles.predictionBadge,
                        { backgroundColor: game.predictions.overUnder.isHitting 
                          ? 'rgba(34, 211, 95, 0.15)' 
                          : 'rgba(239, 68, 68, 0.15)' 
                        }
                      ]}>
                        <MaterialCommunityIcons 
                          name={game.predictions.overUnder.isHitting ? 'check' : 'close'} 
                          size={14} 
                          color={game.predictions.overUnder.isHitting ? '#22D35F' : '#EF4444'} 
                        />
                        <Text style={[
                          styles.predictionBadgeText,
                          { color: game.predictions.overUnder.isHitting ? '#22D35F' : '#EF4444' }
                        ]}>
                          {game.predictions.overUnder.isHitting ? 'Hit' : 'Miss'}
                        </Text>
                      </View>
                      <Text style={[styles.predictionDetail, { color: theme.colors.onSurfaceVariant }]}>
                        {game.predictions.overUnder.predicted} {game.predictions.overUnder.line?.toFixed(1)}
                      </Text>
                      <Text style={[styles.predictionDetail, { color: theme.colors.onSurfaceVariant }]}>
                        Total: {game.home_score + game.away_score}
                      </Text>
                      <Text style={[styles.predictionConfidence, { color: theme.colors.onSurfaceVariant }]}>
                        {(game.predictions.overUnder.probability * 100).toFixed(0)}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* Overall Status */}
                {game.predictions?.hasAnyHitting !== undefined && (
                  <View style={[
                    styles.overallStatus,
                    { backgroundColor: game.predictions.hasAnyHitting 
                      ? 'rgba(34, 211, 95, 0.1)' 
                      : 'rgba(239, 68, 68, 0.1)' 
                    }
                  ]}>
                    <MaterialCommunityIcons 
                      name={game.predictions.hasAnyHitting ? 'trophy-variant' : 'alert-circle-outline'} 
                      size={16} 
                      color={game.predictions.hasAnyHitting ? '#22D35F' : '#EF4444'} 
                    />
                    <Text style={[
                      styles.overallStatusText,
                      { color: game.predictions.hasAnyHitting ? '#22D35F' : '#EF4444' }
                    ]}>
                      {game.predictions.hasAnyHitting 
                        ? 'Predictions Performing' 
                        : 'All Predictions Missing'}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={['rgba(34, 211, 95, 0.1)', 'transparent']}
        style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" size={28} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <MaterialCommunityIcons name="scoreboard" size={24} color={theme.colors.primary} />
            <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
              Live Scoreboard
            </Text>
          </View>
          <View style={{ width: 28 }} />
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Stats Banner */}
        {games.length > 0 && (
          <View style={[styles.statsBanner, { backgroundColor: theme.colors.primaryContainer }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.onPrimaryContainer }]}>
                {games.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.onPrimaryContainer }]}>
                Live Games
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.onPrimaryContainer + '30' }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.onPrimaryContainer }]}>
                {games.filter(g => g.predictions?.hasAnyHitting).length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.onPrimaryContainer }]}>
                Hitting
              </Text>
            </View>
          </View>
        )}

        {/* Loading State */}
        {loading && games.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="loading" size={48} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              Loading live games...
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && games.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="scoreboard-outline" size={64} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
              No Live Games
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              Check back when games are in progress
            </Text>
          </View>
        )}

        {/* Game Cards */}
        {games.map(renderGameCard)}

        {/* Last Updated */}
        {games.length > 0 && (
          <View style={styles.lastUpdatedContainer}>
            <MaterialCommunityIcons name="refresh" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.lastUpdatedText, { color: theme.colors.onSurfaceVariant }]}>
              Pull down to refresh • Last updated: {new Date().toLocaleTimeString()}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  statsBanner: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  gameCard: {
    borderRadius: 12,
    elevation: 2,
  },
  gameCardContent: {
    padding: 16,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leagueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leagueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  leagueText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  quarterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  teamsContainer: {
    gap: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  teamInitials: {
    fontWeight: 'bold',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '500',
  },
  winningTeam: {
    fontWeight: '600',
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  predictionsContainer: {
    gap: 8,
  },
  predictionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  predictionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  predictionsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  predictionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  predictionType: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  predictionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  predictionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  predictionDetail: {
    fontSize: 10,
    textAlign: 'center',
  },
  predictionConfidence: {
    fontSize: 11,
  },
  predictionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  predictionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  predictionLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  overallStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  overallStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  lastUpdatedText: {
    fontSize: 11,
    textAlign: 'center',
  },
});
