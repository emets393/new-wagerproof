import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { NBAGame } from '@/types/nba';
import { 
  formatMoneyline, 
  formatSpread, 
  convertTimeToEST, 
  formatCompactDate,
  roundToNearestHalf 
} from '@/utils/formatting';
import { getNBATeamColors, getNBATeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { getAllMarketsData } from '@/services/polymarketService';
import { detectValueAlerts } from '@/utils/polymarketValueAlerts';

interface NBAGameCardProps {
  game: NBAGame;
  onPress: () => void;
}

export function NBAGameCard({ game, onPress }: NBAGameCardProps) {
  const theme = useTheme();
  const awayColors = getNBATeamColors(game.away_team);
  const homeColors = getNBATeamColors(game.home_team);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  // Determine favored team for ML
  const mlFavorite = game.home_ml !== null && game.away_ml !== null 
    ? (game.home_ml < game.away_ml ? game.home_team : game.away_team)
    : null;
  const mlFavoriteColors = mlFavorite === game.home_team ? homeColors : awayColors;

  // Determine favored team for Spread
  const spreadFavorite = game.home_spread !== null && game.away_spread !== null
    ? (game.home_spread < 0 ? game.home_team : game.away_team)
    : null;
  const spreadFavoriteColors = spreadFavorite === game.home_team ? homeColors : awayColors;
  const spreadValue = spreadFavorite === game.home_team ? game.home_spread : game.away_spread;

  // Fetch Polymarket data for value alerts
  const { data: polymarketData } = useQuery({
    queryKey: ['polymarket-all', 'nba', game.away_team, game.home_team],
    queryFn: () => getAllMarketsData(game.away_team, game.home_team, 'nba'),
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

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <LinearGradient
          colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientBorder}
        />

        <Card.Content style={styles.content}>
          {/* Date and Time */}
          <View style={styles.dateContainer}>
            <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
              {formatCompactDate(game.game_date)}
            </Text>
            <View style={[styles.timeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                {convertTimeToEST(game.game_time)}
              </Text>
            </View>
          </View>

          {/* Teams Row with Circles */}
          <View style={styles.teamsRow}>
            {/* Away Team */}
            <View style={styles.teamColumn}>
              <View style={styles.teamCircleContainer}>
                <LinearGradient
                  colors={[awayColors.primary, awayColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.teamCircle, { borderColor: awayColors.primary }]}
                />
                <View style={styles.teamCircleContent}>
                  <Text style={[styles.teamInitials, { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }]}>
                    {getNBATeamInitials(game.away_team)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {game.away_team}
              </Text>
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

            {/* Center - @ with O/U Line */}
            <View style={styles.centerColumn}>
              <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
              {game.over_line && (
                <View style={[styles.ouLinePill, { backgroundColor: 'rgba(156, 163, 175, 0.15)', borderColor: 'rgba(156, 163, 175, 0.3)' }]}>
                  <Text style={[styles.ouLinePillText, { color: theme.colors.onSurfaceVariant }]}>
                    O/U: {roundToNearestHalf(game.over_line)}
                  </Text>
                </View>
              )}
            </View>

            {/* Home Team */}
            <View style={styles.teamColumn}>
              <View style={styles.teamCircleContainer}>
                <LinearGradient
                  colors={[homeColors.primary, homeColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.teamCircle, { borderColor: homeColors.primary }]}
                />
                <View style={styles.teamCircleContent}>
                  <Text style={[styles.teamInitials, { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }]}>
                    {getNBATeamInitials(game.home_team)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {game.home_team}
              </Text>
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
          {(game.home_away_ml_prob !== null || game.home_away_spread_cover_prob !== null || game.ou_result_prob !== null) && (
            <View style={styles.pillsSection}>
              <View style={styles.pillsHeader}>
                <MaterialCommunityIcons name="brain" size={14} color="#22c55e" />
                <Text style={[styles.pillsHeaderText, { color: theme.colors.onSurfaceVariant }]}>
                  Model Predictions
                </Text>
              </View>
              <View style={styles.pillsRow}>
                {/* ML Pill */}
                {mlFavorite && game.home_away_ml_prob !== null && (
                  <View style={styles.pillContainer}>
                    <View style={[styles.bettingPill, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                      <LinearGradient
                        colors={[mlFavoriteColors.primary, mlFavoriteColors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.pillCircle}
                      >
                        <Text style={[styles.pillInitials, { color: getContrastingTextColor(mlFavoriteColors.primary, mlFavoriteColors.secondary) }]}>
                          {getNBATeamInitials(mlFavorite)}
                        </Text>
                      </LinearGradient>
                      <View style={styles.pillContent}>
                        <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>ML</Text>
                        <Text style={[styles.pillValue, { color: '#3b82f6' }]}>
                          {Math.round((mlFavorite === game.home_team ? game.home_away_ml_prob : (1 - game.home_away_ml_prob)) * 100)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Spread Pill */}
                {spreadFavorite && spreadValue !== null && game.home_away_spread_cover_prob !== null && (() => {
                  const confidence = game.home_away_spread_cover_prob >= 0.5 ? game.home_away_spread_cover_prob : 1 - game.home_away_spread_cover_prob;
                  const edge = game.model_fair_home_spread !== null && game.home_spread !== null 
                    ? Math.abs(game.model_fair_home_spread - game.home_spread)
                    : (confidence - 0.5) * 20;
                  const isFadeAlert = confidence >= 0.8 || edge >= 3;
                  return (
                    <View style={styles.pillContainer}>
                      <View style={[styles.bettingPill, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                        <LinearGradient
                          colors={[spreadFavoriteColors.primary, spreadFavoriteColors.secondary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.pillCircle}
                        >
                          <Text style={[styles.pillInitials, { color: getContrastingTextColor(spreadFavoriteColors.primary, spreadFavoriteColors.secondary) }]}>
                            {getNBATeamInitials(spreadFavorite)}
                          </Text>
                        </LinearGradient>
                        <View style={styles.pillContent}>
                          <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>Spread</Text>
                          <Text style={[styles.pillValue, { color: '#22c55e' }]}>
                            {formatSpread(spreadValue)}
                          </Text>
                        </View>
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

                {/* O/U Model Prediction Pill */}
                {game.ou_result_prob !== null && (() => {
                  const confidence = game.ou_result_prob >= 0.5 ? game.ou_result_prob : 1 - game.ou_result_prob;
                  const edge = game.model_fair_total !== null && game.over_line !== null 
                    ? Math.abs(game.model_fair_total - game.over_line)
                    : (confidence - 0.5) * 20;
                  const isFadeAlert = confidence >= 0.8 || edge >= 3;
                  return (
                    <View style={styles.pillContainer}>
                      <View style={[styles.bettingPill, { backgroundColor: 'rgba(249, 115, 22, 0.15)', borderColor: 'rgba(249, 115, 22, 0.3)' }]}>
                        <View style={styles.pillContent}>
                          <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>O/U</Text>
                          <Text style={[styles.pillValue, { color: '#f97316' }]}>
                            {game.ou_result_prob > 0.5 ? 'Over ↑' : 'Under ↓'}
                          </Text>
                        </View>
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

          {/* Tap to View More Hint */}
          <View style={styles.tapHint}>
            <MaterialCommunityIcons name="chevron-up" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.tapHintText, { color: theme.colors.onSurfaceVariant }]}>
              Tap for details
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 12,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  content: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  timeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamColumn: {
    alignItems: 'center',
    flex: 1,
  },
  centerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  teamCircleContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  teamCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
  },
  teamCircleContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitials: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 90,
  },
  atSymbol: {
    fontSize: 36,
    fontWeight: '600',
  },
  ouLinePill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  ouLinePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  teamLinesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    justifyContent: 'center',
  },
  lineText: {
    fontSize: 10,
    fontWeight: '500',
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 110,
    minHeight: 40,
  },
  pillCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillInitials: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  pillContent: {
    marginLeft: 8,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pillValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  tapHintText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

