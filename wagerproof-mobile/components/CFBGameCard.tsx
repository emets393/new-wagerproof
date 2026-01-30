import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CFBPrediction } from '@/types/cfb';
import {
  formatMoneyline,
  formatSpread,
  convertTimeToEST,
  formatCompactDate,
  roundToNearestHalf
} from '@/utils/formatting';
import { getCFBTeamColors, getCFBTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';
import { TeamAvatar } from './TeamAvatar';

/**
 * Format team name - single words on one line, multi-word splits across lines
 */
function formatTeamName(name: string): { text: string; lines: 1 | 2 } {
  if (!name.includes(' ')) {
    return { text: name, lines: 1 };
  }
  return { text: name.replace(' ', '\n'), lines: 2 };
}

interface CFBGameCardProps {
  game: CFBPrediction;
  onPress: () => void;
  cardWidth?: number;
}

export function CFBGameCard({ game, onPress, cardWidth }: CFBGameCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const awayColors = getCFBTeamColors(game.away_team);
  const homeColors = getCFBTeamColors(game.home_team);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  // Helper function to get color based on edge value
  const getEdgeColor = (edge: number): string => {
    const absEdge = Math.abs(edge);
    if (absEdge >= 5) return '#22c55e'; // Strong green
    if (absEdge >= 3) return '#84cc16'; // Light green
    if (absEdge >= 2) return '#eab308'; // Yellow
    return '#f97316'; // Orange
  };

  // Determine model's spread pick based on home_away_spread_cover_prob
  // >= 0.5 means model picks home team to cover, < 0.5 means model picks away team
  const spreadModelPick = game.home_away_spread_cover_prob !== null
    ? (game.home_away_spread_cover_prob >= 0.5 ? game.home_team : game.away_team)
    : null;
  const spreadModelPickColors = spreadModelPick === game.home_team ? homeColors : awayColors;
  const spreadValue = spreadModelPick === game.home_team ? game.home_spread : game.away_spread;

  // Determine favorite team for background gradient
  const favorite = game.home_spread !== null && game.away_spread !== null
    ? (game.home_spread < 0 ? game.home_team : game.away_team)
    : (game.home_ml !== null && game.away_ml !== null 
        ? (game.home_ml < game.away_ml ? game.home_team : game.away_team)
        : null);
  const favoriteColors = favorite === game.home_team ? homeColors : awayColors;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={cardWidth ? { width: cardWidth } : undefined}>
      <Card style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        {/* Background gradient of favorite team */}
        <LinearGradient
          colors={[
            `${favoriteColors.primary}15`,
            `${favoriteColors.secondary}10`,
            `${theme.colors.surface}00`
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.backgroundGradient}
        />
        
        {/* Top border gradient */}
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
              <TeamAvatar teamName={game.away_team} sport="cfb" size={42} />
              {(() => {
                const { text, lines } = formatTeamName(game.away_team);
                return (
                  <Text
                    style={[styles.teamName, { color: theme.colors.onSurface }]}
                    numberOfLines={lines}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {text}
                  </Text>
                );
              })()}
              <View style={styles.teamLinesRow}>
                {game.away_spread !== null && (
                  <Text style={[styles.lineText, { color: game.away_spread < 0 ? '#3b82f6' : '#22c55e' }]}>
                    {formatSpread(game.away_spread)}
                  </Text>
                )}
                {game.away_ml !== null && (
                  <Text style={[styles.lineText, { color: game.away_ml < 0 ? '#3b82f6' : '#22c55e' }]}>
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
              <TeamAvatar teamName={game.home_team} sport="cfb" size={42} />
              {(() => {
                const { text, lines } = formatTeamName(game.home_team);
                return (
                  <Text
                    style={[styles.teamName, { color: theme.colors.onSurface }]}
                    numberOfLines={lines}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {text}
                  </Text>
                );
              })()}
              <View style={styles.teamLinesRow}>
                {game.home_spread !== null && (
                  <Text style={[styles.lineText, { color: game.home_spread < 0 ? '#3b82f6' : '#22c55e' }]}>
                    {formatSpread(game.home_spread)}
                  </Text>
                )}
                {game.home_ml !== null && (
                  <Text style={[styles.lineText, { color: game.home_ml < 0 ? '#3b82f6' : '#22c55e' }]}>
                    {formatMoneyline(game.home_ml)}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Model Predictions Pills - Vertical Stack */}
          {(game.home_away_spread_cover_prob !== null || game.ou_result_prob !== null) && (
            <View style={styles.pillsSection}>
              <View style={styles.pillsHeader}>
                <MaterialCommunityIcons name="brain" size={12} color="#22c55e" />
                <Text style={[styles.pillsHeaderText, { color: theme.colors.onSurfaceVariant }]}>
                  Model Picks
                </Text>
              </View>
              <View style={styles.pillsColumn}>
                {/* Spread Pill - Shows model's predicted team to cover */}
                {spreadModelPick && spreadValue !== null && game.home_away_spread_cover_prob !== null && (() => {
                  const confidence = game.home_away_spread_cover_prob >= 0.5 ? game.home_away_spread_cover_prob : 1 - game.home_away_spread_cover_prob;
                  const isFadeAlert = confidence >= 0.8;
                  const edge = game.home_spread_diff !== null && game.home_spread_diff !== undefined ? Math.abs(game.home_spread_diff) : null;
                  return (
                    <View style={styles.pillContainerWithBadge}>
                      <View style={[styles.bettingPillVertical, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', borderColor: theme.colors.outlineVariant }]}>
                        <View style={styles.pillAvatarContainer}>
                          <TeamAvatar teamName={spreadModelPick} sport="cfb" size={20} />
                        </View>
                        <Text style={[styles.pillTextVertical, { color: theme.colors.onSurface }]}>
                          Spread: {formatSpread(spreadValue)}
                        </Text>
                        {edge !== null && (
                          <Text style={[styles.pillValueRight, { color: getEdgeColor(edge) }]}>
                            +{edge.toFixed(1)}
                          </Text>
                        )}
                        {isFadeAlert && (
                          <View style={styles.fadeAlertBadge}>
                            <MaterialCommunityIcons name="lightning-bolt" size={10} color={edge !== null ? getEdgeColor(edge) : '#22c55e'} />
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })()}

                {/* O/U Model Prediction Pill */}
                {game.ou_result_prob !== null && (() => {
                  const isOver = game.ou_result_prob > 0.5;
                  const circleColor = isOver ? '#22c55e' : '#ef4444';
                  const confidence = game.ou_result_prob >= 0.5 ? game.ou_result_prob : 1 - game.ou_result_prob;
                  const isFadeAlert = confidence >= 0.8;
                  const edge = game.over_line_diff !== null && game.over_line_diff !== undefined ? Math.abs(game.over_line_diff) : null;
                  return (
                    <View style={styles.pillContainerWithBadge}>
                      <View style={[styles.bettingPillVertical, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', borderColor: theme.colors.outlineVariant }]}>
                        <View style={[styles.pillCircle, { backgroundColor: circleColor }]}>
                          <MaterialCommunityIcons 
                            name={isOver ? "arrow-up" : "arrow-down"} 
                            size={12} 
                            color="#fff" 
                          />
                        </View>
                        <Text style={[styles.pillTextVertical, { color: theme.colors.onSurface }]}>
                          O/U: {isOver ? 'Over' : 'Under'}
                        </Text>
                        {edge !== null && (
                          <Text style={[styles.pillValueRight, { color: getEdgeColor(edge) }]}>
                            +{edge.toFixed(1)}
                          </Text>
                        )}
                        {isFadeAlert && (
                          <View style={styles.fadeAlertBadge}>
                            <MaterialCommunityIcons name="lightning-bolt" size={10} color={edge !== null ? getEdgeColor(edge) : circleColor} />
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })()}
              </View>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 6,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    overflow: 'hidden',
    width: '100%',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1,
  },
  content: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 10,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamColumn: {
    alignItems: 'center',
    flex: 1,
  },
  centerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  teamCircleContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  teamCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  atSymbol: {
    fontSize: 24,
    fontWeight: '600',
  },
  ouLinePill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  ouLinePillText: {
    fontSize: 9,
    fontWeight: '600',
  },
  teamLinesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    justifyContent: 'center',
  },
  lineText: {
    fontSize: 9,
    fontWeight: '500',
  },
  pillsSection: {
    marginTop: 8,
  },
  pillsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  pillsHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillsColumn: {
    flexDirection: 'column',
    gap: 6,
  },
  bettingPillVertical: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    minHeight: 32,
  },
  pillCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  pillAvatarContainer: {
    marginRight: 8,
  },
  pillInitials: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  pillTextVertical: {
    fontSize: 11,
    fontWeight: '600',
  },
  pillValueRight: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 'auto',
    paddingLeft: 8,
  },
  pillContainerWithBadge: {
    width: '100%',
  },
  fadeAlertBadge: {
    paddingLeft: 4,
  },
});
