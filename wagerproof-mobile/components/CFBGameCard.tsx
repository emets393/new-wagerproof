import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Card, useTheme, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { CFBPrediction } from '@/types/cfb';
import { 
  formatMoneyline, 
  formatSpread, 
  convertTimeToEST, 
  formatCompactDate,
  roundToNearestHalf 
} from '@/utils/formatting';
import { getCFBTeamColors, getCFBTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { getAllMarketsData } from '@/services/polymarketService';
import { detectValueAlerts } from '@/utils/polymarketValueAlerts';

interface CFBGameCardProps {
  game: CFBPrediction;
  onPress: () => void;
}

export function CFBGameCard({ game, onPress }: CFBGameCardProps) {
  const theme = useTheme();
  const awayColors = getCFBTeamColors(game.away_team);
  const homeColors = getCFBTeamColors(game.home_team);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  // Parse public betting splits
  const parseSplit = (label: string | null): { team: string; percentage: number } | null => {
    if (!label) return null;
    const match = label.match(/(.+?)\s+(\d+)%/);
    if (match) {
      return { team: match[1].trim(), percentage: parseInt(match[2], 10) };
    }
    return null;
  };

  const mlSplit = parseSplit(game.ml_splits_label);
  const spreadSplit = parseSplit(game.spread_splits_label);
  const totalSplit = parseSplit(game.total_splits_label);

  // Fetch Polymarket data for value alerts
  const { data: polymarketData } = useQuery({
    queryKey: ['polymarket-all', 'cfb', game.away_team, game.home_team],
    queryFn: () => getAllMarketsData(game.away_team, game.home_team, 'cfb'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Detect value alerts
  const valueAlerts = detectValueAlerts(
    polymarketData,
    game.away_team,
    game.home_team,
    game.game_date
  );

  const hasSpreadValue = valueAlerts.some(alert => alert.market === 'spread');
  const hasTotalValue = valueAlerts.some(alert => alert.market === 'total');
  const hasMoneylineValue = valueAlerts.some(alert => alert.market === 'moneyline');

  // Determine model predictions for pills based on edge values
  const mlPrediction = game.home_away_ml_prob !== null && game.home_away_ml_prob !== undefined ? {
    team: game.home_away_ml_prob >= 0.5 ? game.home_team : game.away_team,
    isHome: game.home_away_ml_prob >= 0.5,
  } : null;

  // Spread edge: positive = home team edge, negative = away team edge
  const spreadPrediction = game.home_spread_diff !== null && game.home_spread_diff !== undefined ? {
    team: game.home_spread_diff > 0 ? game.home_team : game.away_team,
    edge: Math.abs(game.home_spread_diff),
    isHome: game.home_spread_diff > 0,
  } : null;

  // O/U edge: positive = Over, negative = Under
  const ouPrediction = game.over_line_diff !== null && game.over_line_diff !== undefined ? {
    direction: game.over_line_diff > 0 ? 'Over' : 'Under',
    edge: Math.abs(game.over_line_diff),
  } : null;

  // Get pill colors for public betting
  const getPublicBettingColors = (team: string, isSpread: boolean = false) => {
    if (team === game.home_team) {
      return { bg: `${homeColors.primary}25`, border: `${homeColors.primary}50`, text: homeColors.primary };
    } else if (team === game.away_team) {
      return { bg: `${awayColors.primary}25`, border: `${awayColors.primary}50`, text: awayColors.primary };
    } else if (team.toLowerCase().includes('over')) {
      return { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' };
    } else if (team.toLowerCase().includes('under')) {
      return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' };
    }
    return { bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.3)', text: theme.colors.onSurfaceVariant };
  };

  return (
    <Pressable 
      onPress={handlePress}
      style={({ pressed }) => [
        { opacity: pressed ? 0.7 : 1 }
      ]}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <LinearGradient
          colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientBorder}
        />
        
        <Card.Content style={styles.content}>
          {/* Date, Time, and Conference */}
          <View style={styles.dateContainer}>
            <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
              {formatCompactDate(game.game_date)}
            </Text>
            <View style={[styles.timeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                {convertTimeToEST(game.game_time)}
              </Text>
            </View>
            {game.conference && (
              <Chip style={{ height: 22 }} textStyle={{ fontSize: 9 }}>
                {game.conference}
              </Chip>
            )}
          </View>

          {/* Teams Row */}
          <View style={styles.teamsRow}>
            {/* Away Team */}
            <View style={styles.teamColumn}>
              <LinearGradient
                colors={[awayColors.primary, awayColors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.teamCircle, { borderColor: awayColors.primary }]}
              >
                <Text style={[styles.teamInitials, { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }]}>
                  {getCFBTeamInitials(game.away_team)}
                </Text>
              </LinearGradient>
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {game.away_team}
              </Text>
              {/* Actual lines under team */}
              <View style={styles.teamLinesRow}>
                {game.away_spread !== null && (
                  <Text style={[styles.lineText, { color: theme.colors.onSurfaceVariant }]}>
                    {formatSpread(game.away_spread)}
                  </Text>
                )}
                {game.away_ml !== null && (
                  <Text style={[styles.lineText, { color: theme.colors.onSurfaceVariant }]}>
                    {formatMoneyline(game.away_ml)}
                  </Text>
                )}
              </View>
            </View>

            {/* Center - @ and O/U Line */}
            <View style={styles.centerColumn}>
              <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
              {game.over_line && (
                <View style={[styles.ouLinePill, { backgroundColor: 'rgba(156, 163, 175, 0.15)', borderColor: 'rgba(156, 163, 175, 0.3)' }]}>
                  <Text style={[styles.ouLineText, { color: theme.colors.onSurfaceVariant }]}>
                    O/U: {roundToNearestHalf(game.over_line)}
                  </Text>
                </View>
              )}
            </View>

            {/* Home Team */}
            <View style={styles.teamColumn}>
              <LinearGradient
                colors={[homeColors.primary, homeColors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.teamCircle, { borderColor: homeColors.primary }]}
              >
                <Text style={[styles.teamInitials, { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }]}>
                  {getCFBTeamInitials(game.home_team)}
                </Text>
              </LinearGradient>
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {game.home_team}
              </Text>
              {/* Actual lines under team */}
              <View style={styles.teamLinesRow}>
                {game.home_spread !== null && (
                  <Text style={[styles.lineText, { color: theme.colors.onSurfaceVariant }]}>
                    {formatSpread(game.home_spread)}
                  </Text>
                )}
                {game.home_ml !== null && (
                  <Text style={[styles.lineText, { color: theme.colors.onSurfaceVariant }]}>
                    {formatMoneyline(game.home_ml)}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Model Predictions Pills */}
          {(mlPrediction || spreadPrediction || ouPrediction) && (
            <View style={styles.pillsSection}>
              <View style={styles.pillsHeader}>
                <MaterialCommunityIcons name="brain" size={14} color="#22c55e" />
                <Text style={[styles.pillsHeaderText, { color: theme.colors.onSurfaceVariant }]}>
                  Model Predictions
                </Text>
              </View>
              <View style={styles.pillsRow}>
                {mlPrediction && (
                  <View style={[styles.bettingPill, { 
                    backgroundColor: mlPrediction.isHome ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    borderColor: mlPrediction.isHome ? 'rgba(59, 130, 246, 0.3)' : 'rgba(34, 197, 94, 0.3)'
                  }]}>
                    <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>ML</Text>
                    <Text style={[styles.pillValue, { 
                      color: mlPrediction.isHome ? '#3b82f6' : '#22c55e'
                    }]} numberOfLines={1}>
                      {getCFBTeamInitials(mlPrediction.team)}
                    </Text>
                  </View>
                )}
                {spreadPrediction && (() => {
                  const isFadeAlert = spreadPrediction.edge > 10;
                  return (
                    <View style={styles.pillContainer}>
                      <View style={[styles.bettingPill, { 
                        backgroundColor: 'rgba(34, 197, 94, 0.15)',
                        borderColor: 'rgba(34, 197, 94, 0.3)'
                      }]}>
                        <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>Spread</Text>
                        <Text style={[styles.pillValue, { color: '#22c55e', marginLeft: 6 }]} numberOfLines={1}>
                          {getCFBTeamInitials(spreadPrediction.team)} +{spreadPrediction.edge.toFixed(1)}
                        </Text>
                      </View>
                      {isFadeAlert && (
                        <View style={styles.fadeAlertBadge}>
                          <MaterialCommunityIcons name="lightning-bolt" size={10} color="#3b82f6" />
                          <Text style={[styles.fadeAlertText, { color: '#3b82f6', marginLeft: 3 }]}>FADE</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
                {ouPrediction && (() => {
                  const isFadeAlert = ouPrediction.edge > 10;
                  return (
                    <View style={styles.pillContainer}>
                      <View style={[styles.bettingPill, { 
                        backgroundColor: 'rgba(249, 115, 22, 0.15)',
                        borderColor: 'rgba(249, 115, 22, 0.3)'
                      }]}>
                        <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>O/U</Text>
                        <Text style={[styles.pillValue, { color: '#f97316', marginLeft: 6 }]}>
                          {ouPrediction.direction} +{ouPrediction.edge.toFixed(1)} {ouPrediction.direction === 'Over' ? '↑' : '↓'}
                        </Text>
                      </View>
                      {isFadeAlert && (
                        <View style={styles.fadeAlertBadge}>
                          <MaterialCommunityIcons name="lightning-bolt" size={10} color="#f97316" />
                          <Text style={[styles.fadeAlertText, { color: '#f97316', marginLeft: 3 }]}>FADE</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            </View>
          )}

          {/* Public Lean Pills */}
          {(mlSplit || spreadSplit || totalSplit) && (
            <View style={styles.pillsSection}>
              <View style={styles.pillsHeader}>
                <MaterialCommunityIcons name="account-group" size={14} color="#3b82f6" />
                <Text style={[styles.pillsHeaderText, { color: theme.colors.onSurfaceVariant }]}>
                  Sportsbook Lean
                </Text>
              </View>
              <View style={styles.pillsRow}>
                {mlSplit && (
                  <View style={[styles.bettingPill, { 
                    backgroundColor: getPublicBettingColors(mlSplit.team).bg,
                    borderColor: getPublicBettingColors(mlSplit.team).border
                  }]}>
                    <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>ML</Text>
                    <Text style={[styles.pillValue, { color: getPublicBettingColors(mlSplit.team).text }]} numberOfLines={1}>
                      {getCFBTeamInitials(mlSplit.team)}
                    </Text>
                  </View>
                )}
                {spreadSplit && (
                  <View style={[styles.bettingPill, { 
                    backgroundColor: getPublicBettingColors(spreadSplit.team, true).bg,
                    borderColor: getPublicBettingColors(spreadSplit.team, true).border
                  }]}>
                    <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>Spread</Text>
                    <Text style={[styles.pillValue, { color: getPublicBettingColors(spreadSplit.team, true).text }]} numberOfLines={1}>
                      {getCFBTeamInitials(spreadSplit.team)}
                    </Text>
                  </View>
                )}
                {totalSplit && (
                  <View style={[styles.bettingPill, { 
                    backgroundColor: getPublicBettingColors(totalSplit.team).bg,
                    borderColor: getPublicBettingColors(totalSplit.team).border
                  }]}>
                    <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>Total</Text>
                    <Text style={[styles.pillValue, { color: getPublicBettingColors(totalSplit.team).text }]}>
                      {totalSplit.team.toLowerCase().includes('over') ? 'Over' : 'Under'} {totalSplit.team.toLowerCase().includes('over') ? '↑' : '↓'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Prediction Markets Alerts */}
          {(hasSpreadValue || hasTotalValue || hasMoneylineValue) && (
            <View style={styles.pillsSection}>
              <View style={styles.pillsHeader}>
                <MaterialCommunityIcons name="alert-circle" size={14} color="#f97316" />
                <Text style={[styles.pillsHeaderText, { color: theme.colors.onSurfaceVariant }]}>
                  Prediction Markets Alerts
                </Text>
              </View>
              <View style={styles.pillsRow}>
                {hasSpreadValue && (() => {
                  const spreadAlerts = valueAlerts.filter(alert => alert.market === 'spread');
                  const maxSpreadAlert = spreadAlerts.reduce((max, alert) => 
                    alert.percentage > max.percentage ? alert : max, spreadAlerts[0]
                  );
                  return maxSpreadAlert ? (
                    <View style={[
                      styles.bettingPill,
                      { 
                        backgroundColor: 'rgba(249, 115, 22, 0.15)',
                        borderColor: 'rgba(249, 115, 22, 0.3)'
                      }
                    ]}>
                      <MaterialCommunityIcons name="alert-circle" size={12} color="#f97316" />
                      <Text style={[styles.pillValue, { color: '#f97316', marginLeft: 6 }]}>
                        Spread {maxSpreadAlert.percentage}%
                      </Text>
                    </View>
                  ) : null;
                })()}

                {hasTotalValue && (() => {
                  const totalAlerts = valueAlerts.filter(alert => alert.market === 'total');
                  const maxTotalAlert = totalAlerts.reduce((max, alert) => 
                    alert.percentage > max.percentage ? alert : max, totalAlerts[0]
                  );
                  return maxTotalAlert ? (
                    <View style={[
                      styles.bettingPill,
                      { 
                        backgroundColor: 'rgba(249, 115, 22, 0.15)',
                        borderColor: 'rgba(249, 115, 22, 0.3)'
                      }
                    ]}>
                      <MaterialCommunityIcons name="alert-circle" size={12} color="#f97316" />
                      <Text style={[styles.pillValue, { color: '#f97316', marginLeft: 6 }]}>
                        O/U {maxTotalAlert.percentage}%
                      </Text>
                    </View>
                  ) : null;
                })()}

                {hasMoneylineValue && (() => {
                  const mlAlerts = valueAlerts.filter(alert => alert.market === 'moneyline');
                  const maxMLAlert = mlAlerts.reduce((max, alert) => 
                    alert.percentage > max.percentage ? alert : max, mlAlerts[0]
                  );
                  return maxMLAlert ? (
                    <View style={[
                      styles.bettingPill,
                      { 
                        backgroundColor: 'rgba(249, 115, 22, 0.15)',
                        borderColor: 'rgba(249, 115, 22, 0.3)'
                      }
                    ]}>
                      <MaterialCommunityIcons name="alert-circle" size={12} color="#f97316" />
                      <Text style={[styles.pillValue, { color: '#f97316', marginLeft: 6 }]}>
                        ML {maxMLAlert.percentage}%
                      </Text>
                    </View>
                  ) : null;
                })()}
              </View>
            </View>
          )}
        </Card.Content>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  content: {
    paddingTop: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  teamCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitials: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    maxWidth: 56,
  },
  teamName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamLinesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  lineText: {
    fontSize: 10,
    fontWeight: '600',
  },
  centerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  atSymbol: {
    fontSize: 36,
    fontWeight: '600',
  },
  ouLinePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  ouLineText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pillsSection: {
    marginBottom: 12,
  },
  pillsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pillsHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillContainer: {
    alignItems: 'center',
  },
  bettingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 80,
  },
  fadeAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  fadeAlertText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pillValue: {
    fontSize: 12,
    fontWeight: '700',
  },
});
