import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NFLPrediction } from '@/types/nfl';
import { 
  formatMoneyline, 
  formatSpread, 
  convertTimeToEST, 
  formatCompactDate,
  roundToNearestHalf 
} from '@/utils/formatting';
import { getNFLTeamColors, getTeamParts, getTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';
import { getBettingColors } from '@/constants/theme';

interface NFLGameCardProps {
  game: NFLPrediction;
}

export function NFLGameCard({ game }: NFLGameCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const bettingColors = getBettingColors(isDark);
  const [expanded, setExpanded] = useState(false);
  const awayColors = getNFLTeamColors(game.away_team);
  const homeColors = getNFLTeamColors(game.home_team);
  const awayTeamParts = getTeamParts(game.away_team);
  const homeTeamParts = getTeamParts(game.home_team);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Calculate predictions for expanded view
  const spreadPrediction = game.home_away_spread_cover_prob !== null ? {
    isHome: game.home_away_spread_cover_prob > 0.5,
    team: game.home_away_spread_cover_prob > 0.5 ? game.home_team : game.away_team,
    teamColors: game.home_away_spread_cover_prob > 0.5 ? homeColors : awayColors,
    spread: game.home_away_spread_cover_prob > 0.5 ? game.home_spread : game.away_spread,
    confidence: Math.round((game.home_away_spread_cover_prob > 0.5 ? game.home_away_spread_cover_prob : 1 - game.home_away_spread_cover_prob) * 100)
  } : null;

  const ouPrediction = game.ou_result_prob !== null ? {
    isOver: game.ou_result_prob > 0.5,
    confidence: Math.round((game.ou_result_prob > 0.5 ? game.ou_result_prob : 1 - game.ou_result_prob) * 100)
  } : null;

  return (
    <TouchableOpacity onPress={toggleExpanded} activeOpacity={0.8}>
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
              {/* Team Circle */}
              <LinearGradient
                colors={[awayColors.primary, awayColors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.teamCircle, { borderColor: awayColors.primary }]}
              >
                <Text style={[styles.teamInitials, { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }]}>
                  {getTeamInitials(game.away_team)}
                </Text>
              </LinearGradient>
              {expanded && (
                <>
                  <Text style={[styles.teamCity, { color: theme.colors.onSurface }]}>
                    {awayTeamParts.city}
                  </Text>
                  <Text style={[styles.teamNickname, { color: theme.colors.onSurfaceVariant }]}>
                    {awayTeamParts.name}
                  </Text>
                </>
              )}
              <Text style={[styles.spreadText, { color: theme.colors.onSurfaceVariant }]}>
                {formatSpread(game.away_spread)}
              </Text>
              <Text style={[styles.mlText, { color: bettingColors.awayMoneyline }]}>
                {formatMoneyline(game.away_ml)}
              </Text>
            </View>

            {/* Center - @ and Total */}
            <View style={styles.centerColumn}>
              <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
              <View style={[styles.totalBadge, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}>
                <Text style={[styles.totalText, { color: theme.colors.onSurfaceVariant }]}>
                  O/U: {game.over_line ? roundToNearestHalf(game.over_line) : '-'}
                </Text>
              </View>
            </View>

            {/* Home Team */}
            <View style={styles.teamColumn}>
              {/* Team Circle */}
              <LinearGradient
                colors={[homeColors.primary, homeColors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.teamCircle, { borderColor: homeColors.primary }]}
              >
                <Text style={[styles.teamInitials, { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }]}>
                  {getTeamInitials(game.home_team)}
                </Text>
              </LinearGradient>
              {expanded && (
                <>
                  <Text style={[styles.teamCity, { color: theme.colors.onSurface }]}>
                    {homeTeamParts.city}
                  </Text>
                  <Text style={[styles.teamNickname, { color: theme.colors.onSurfaceVariant }]}>
                    {homeTeamParts.name}
                  </Text>
                </>
              )}
              <Text style={[styles.spreadText, { color: theme.colors.onSurfaceVariant }]}>
                {formatSpread(game.home_spread)}
              </Text>
              <Text style={[styles.mlText, { color: bettingColors.homeMoneyline }]}>
                {formatMoneyline(game.home_ml)}
              </Text>
            </View>
          </View>

          {/* Collapsed State - Quick Probabilities */}
          {!expanded && (game.home_away_ml_prob !== null || game.home_away_spread_cover_prob !== null || game.ou_result_prob !== null) && (
            <View style={styles.probSection}>
              <View style={[styles.probRow, { backgroundColor: theme.colors.surfaceVariant }]}>
                {game.home_away_ml_prob !== null && game.home_away_ml_prob !== undefined && (
                  <View style={styles.probItem}>
                    <MaterialCommunityIcons name="cash" size={14} color={theme.colors.primary} />
                    <Text style={[styles.probText, { color: theme.colors.onSurfaceVariant }]}>
                      ML: {(Math.max(Number(game.home_away_ml_prob), 1 - Number(game.home_away_ml_prob)) * 100).toFixed(0)}%
                    </Text>
                  </View>
                )}
                {game.home_away_spread_cover_prob !== null && game.home_away_spread_cover_prob !== undefined && (
                  <View style={styles.probItem}>
                    <MaterialCommunityIcons name="chart-line" size={14} color={theme.colors.primary} />
                    <Text style={[styles.probText, { color: theme.colors.onSurfaceVariant }]}>
                      Spread: {(Math.max(Number(game.home_away_spread_cover_prob), 1 - Number(game.home_away_spread_cover_prob)) * 100).toFixed(0)}%
                    </Text>
                  </View>
                )}
                {game.ou_result_prob !== null && game.ou_result_prob !== undefined && (
                  <View style={styles.probItem}>
                    <MaterialCommunityIcons name="numeric" size={14} color={theme.colors.primary} />
                    <Text style={[styles.probText, { color: theme.colors.onSurfaceVariant }]}>
                      O/U: {(Math.max(Number(game.ou_result_prob), 1 - Number(game.ou_result_prob)) * 100).toFixed(0)}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Expanded State - Full Predictions */}
          {expanded && (
            <>
              {/* Model Predictions Header */}
              <View style={[styles.sectionHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
                <MaterialCommunityIcons name="brain" size={20} color={bettingColors.purple} />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Model Predictions
                </Text>
              </View>

              {/* Spread Prediction */}
              {spreadPrediction && (
                <View style={styles.predictionContainer}>
                  <View style={styles.predictionHeader}>
                    <MaterialCommunityIcons name="target" size={16} color={bettingColors.success} />
                    <Text style={[styles.predictionLabel, { color: theme.colors.onSurface }]}>
                      Spread
                    </Text>
                  </View>
                  <View style={styles.predictionGrid}>
                    {/* Team Prediction */}
                    <View style={[styles.predictionBox, { backgroundColor: bettingColors.successLight }]}>
                      <LinearGradient
                        colors={[spreadPrediction.teamColors.primary, spreadPrediction.teamColors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.teamCircleSmall, { borderColor: spreadPrediction.teamColors.primary }]}
                      >
                        <Text style={[styles.teamInitialsSmall, { color: getContrastingTextColor(spreadPrediction.teamColors.primary, spreadPrediction.teamColors.secondary) }]}>
                          {getTeamInitials(spreadPrediction.team)}
                        </Text>
                      </LinearGradient>
                      <Text style={[styles.predictionTeam, { color: bettingColors.successDark }]}>
                        {getTeamParts(spreadPrediction.team).city}
                      </Text>
                      <Text style={[styles.predictionSpread, { color: bettingColors.success }]}>
                        ({formatSpread(spreadPrediction.spread)})
                      </Text>
                    </View>
                    {/* Confidence */}
                    <View style={[styles.predictionBox, { backgroundColor: spreadPrediction.confidence <= 58 ? bettingColors.dangerLight : spreadPrediction.confidence <= 65 ? bettingColors.warningLight : bettingColors.successLight }]}>
                      <Text style={[styles.confidencePercent, { color: spreadPrediction.confidence <= 58 ? bettingColors.danger : spreadPrediction.confidence <= 65 ? bettingColors.warning : bettingColors.success }]}>
                        {spreadPrediction.confidence}%
                      </Text>
                      <Text style={[styles.confidenceLabel, { color: bettingColors.neutral }]}>
                        {spreadPrediction.confidence <= 58 ? 'Low' : spreadPrediction.confidence <= 65 ? 'Moderate' : 'High'}
                      </Text>
                    </View>
                  </View>
                  {/* What This Means */}
                  <View style={[styles.explanationBox, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}>
                    <View style={styles.explanationHeader}>
                      <MaterialCommunityIcons name="information" size={14} color={bettingColors.info} />
                      <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
                        What This Means
                      </Text>
                    </View>
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                      {(() => {
                        const spreadValue = Math.abs(Number(spreadPrediction.spread));
                        const isNegativeSpread = Number(spreadPrediction.spread) < 0;
                        const teamCity = getTeamParts(spreadPrediction.team).city;
                        
                        if (spreadPrediction.confidence <= 58) {
                          return `For this bet to win, ${teamCity} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${spreadPrediction.confidence}% confidence, this is a toss-up where the model sees both outcomes as nearly equally likely.`;
                        } else if (spreadPrediction.confidence <= 65) {
                          return `For this bet to win, ${teamCity} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. The model gives this a ${spreadPrediction.confidence}% chance, indicating a slight advantage but still plenty of risk.`;
                        } else {
                          return `For this bet to win, ${teamCity} needs to ${isNegativeSpread ? `win by more than ${spreadValue} points` : `either win the game or lose by fewer than ${spreadValue} points`}. With ${spreadPrediction.confidence}% confidence, the model sees a strong likelihood they'll achieve this margin.`;
                        }
                      })()}
                    </Text>
                  </View>
                </View>
              )}

              {/* O/U Prediction */}
              {ouPrediction && (
                <View style={styles.predictionContainer}>
                  <View style={styles.predictionHeader}>
                    <MaterialCommunityIcons name="chart-line-variant" size={16} color={bettingColors.info} />
                    <Text style={[styles.predictionLabel, { color: theme.colors.onSurface }]}>
                      Over / Under
                    </Text>
                  </View>
                  <View style={styles.predictionGrid}>
                    {/* Direction */}
                    <View style={[styles.predictionBox, { backgroundColor: ouPrediction.isOver ? bettingColors.successLight : bettingColors.dangerLight }]}>
                      <Text style={[styles.ouArrow, { color: ouPrediction.isOver ? bettingColors.success : bettingColors.danger }]}>
                        {ouPrediction.isOver ? '▲' : '▼'}
                      </Text>
                      <Text style={[styles.ouLabel, { color: ouPrediction.isOver ? bettingColors.successDark : bettingColors.dangerDark }]}>
                        {ouPrediction.isOver ? 'Over' : 'Under'} {game.over_line}
                      </Text>
                    </View>
                    {/* Confidence */}
                    <View style={[styles.predictionBox, { backgroundColor: ouPrediction.confidence <= 58 ? bettingColors.dangerLight : ouPrediction.confidence <= 65 ? bettingColors.warningLight : bettingColors.successLight }]}>
                      <Text style={[styles.confidencePercent, { color: ouPrediction.confidence <= 58 ? bettingColors.danger : ouPrediction.confidence <= 65 ? bettingColors.warning : bettingColors.success }]}>
                        {ouPrediction.confidence}%
                      </Text>
                      <Text style={[styles.confidenceLabel, { color: bettingColors.neutral }]}>
                        {ouPrediction.confidence <= 58 ? 'Low' : ouPrediction.confidence <= 65 ? 'Moderate' : 'High'}
                      </Text>
                    </View>
                  </View>
                  {/* What This Means */}
                  <View style={[styles.explanationBox, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}>
                    <View style={styles.explanationHeader}>
                      <MaterialCommunityIcons name="information" size={14} color={bettingColors.info} />
                      <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
                        What This Means
                      </Text>
                    </View>
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                      {(() => {
                        const totalPoints = game.over_line;
                        const direction = ouPrediction.isOver ? 'MORE' : 'LESS';
                        
                        if (ouPrediction.confidence <= 58) {
                          return `For this bet to win, the combined score of both teams needs to be ${direction} than ${totalPoints} points. With ${ouPrediction.confidence}% confidence, the model sees this as a coin flip—the game could go either way in terms of total scoring.`;
                        } else if (ouPrediction.confidence <= 65) {
                          return `For this bet to win, the combined score needs to be ${direction} than ${totalPoints} points. The model gives this a ${ouPrediction.confidence}% chance, suggesting a slight ${ouPrediction.isOver ? 'offensive' : 'defensive'} edge but the scoring environment is still uncertain.`;
                        } else {
                          return `For this bet to win, the combined score needs to be ${direction} than ${totalPoints} points. With ${ouPrediction.confidence}% confidence, the model expects a ${ouPrediction.isOver ? 'high-scoring, offensive-oriented' : 'low-scoring, defense-dominated'} game that should clearly ${ouPrediction.isOver ? 'exceed' : 'stay under'} this total.`;
                        }
                      })()}
                    </Text>
                  </View>
                </View>
              )}

              {/* Public Betting Facts */}
              {(game.ml_splits_label || game.spread_splits_label || game.total_splits_label) && (
                <>
                  <View style={[styles.sectionHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="account-group" size={20} color={bettingColors.info} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                      Public Betting Facts
                    </Text>
                  </View>
                  <View style={styles.bettingFactsContainer}>
                    {game.ml_splits_label && (
                      <View style={[styles.bettingFact, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <MaterialCommunityIcons name="cash-multiple" size={14} color={bettingColors.info} />
                        <Text style={[styles.bettingFactText, { color: theme.colors.onSurfaceVariant }]}>
                          {game.ml_splits_label}
                        </Text>
                      </View>
                    )}
                    {game.spread_splits_label && (
                      <View style={[styles.bettingFact, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <MaterialCommunityIcons name="chart-line" size={14} color={bettingColors.success} />
                        <Text style={[styles.bettingFactText, { color: theme.colors.onSurfaceVariant }]}>
                          {game.spread_splits_label}
                        </Text>
                      </View>
                    )}
                    {game.total_splits_label && (
                      <View style={[styles.bettingFact, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <MaterialCommunityIcons name="chart-bar" size={14} color={bettingColors.warning} />
                        <Text style={[styles.bettingFactText, { color: theme.colors.onSurfaceVariant }]}>
                          {game.total_splits_label}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Tap to Collapse Hint */}
              <View style={styles.collapseHint}>
                <MaterialCommunityIcons name="chevron-up" size={20} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.collapseText, { color: theme.colors.onSurfaceVariant }]}>
                  Tap to collapse
                </Text>
              </View>
            </>
          )}

          {/* Tap to Expand Hint (collapsed state) */}
          {!expanded && (
            <View style={styles.expandHint}>
              <Text style={[styles.expandText, { color: theme.colors.onSurfaceVariant }]}>
                Tap for details
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={theme.colors.onSurfaceVariant} />
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  gradientBorder: {
    height: 4,
  },
  content: {
    paddingVertical: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  teamCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 4,
  },
  teamInitials: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamCity: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  teamNickname: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  spreadText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mlText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  centerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  atSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  totalText: {
    fontSize: 11,
    fontWeight: '600',
  },
  probSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  probRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  probItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  probText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  predictionContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  predictionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  predictionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  predictionBox: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  teamCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  teamInitialsSmall: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  predictionTeam: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  predictionSpread: {
    fontSize: 11,
    fontWeight: '500',
  },
  confidencePercent: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  ouArrow: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  ouLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bettingFactsContainer: {
    gap: 8,
    marginTop: 8,
  },
  bettingFact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  bettingFactText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  expandText: {
    fontSize: 11,
    fontWeight: '500',
  },
  collapseHint: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
  },
  collapseText: {
    fontSize: 11,
    fontWeight: '500',
  },
  explanationBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  explanationText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'left',
  },
});

