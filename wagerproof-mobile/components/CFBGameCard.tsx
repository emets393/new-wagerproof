import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, useTheme, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
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
import { getBettingColors } from '@/constants/theme';

interface CFBGameCardProps {
  game: CFBPrediction;
}

export function CFBGameCard({ game }: CFBGameCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const bettingColors = getBettingColors(isDark);
  const [expanded, setExpanded] = useState(false);
  const [spreadExplanationExpanded, setSpreadExplanationExpanded] = useState(false);
  const [ouExplanationExpanded, setOuExplanationExpanded] = useState(false);
  const awayColors = getCFBTeamColors(game.away_team);
  const homeColors = getCFBTeamColors(game.home_team);
  const reducedMotion = useReducedMotion();

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Animation config - smooth timing with no bounce
  const animationConfig = {
    type: 'timing' as const,
    duration: reducedMotion ? 0 : 300,
  };

  // Calculate predictions for expanded view
  const spreadPrediction = game.home_away_spread_cover_prob !== null && game.home_away_spread_cover_prob !== undefined ? {
    isHome: game.home_away_spread_cover_prob > 0.5,
    team: game.home_away_spread_cover_prob > 0.5 ? game.home_team : game.away_team,
    teamColors: game.home_away_spread_cover_prob > 0.5 ? homeColors : awayColors,
    spread: game.home_away_spread_cover_prob > 0.5 ? game.home_spread : game.away_spread,
    confidence: Math.round((game.home_away_spread_cover_prob > 0.5 ? game.home_away_spread_cover_prob : 1 - game.home_away_spread_cover_prob) * 100)
  } : null;

  const ouPrediction = game.ou_result_prob !== null && game.ou_result_prob !== undefined ? {
    isOver: game.ou_result_prob > 0.5,
    confidence: Math.round((game.ou_result_prob > 0.5 ? game.ou_result_prob : 1 - game.ou_result_prob) * 100)
  } : null;

  // Debug logging for CFB predictions
  if (expanded && __DEV__) {
    console.log('CFB Game Data:', {
      gameId: game.id,
      away: game.away_team,
      home: game.home_team,
      spread_prob: game.home_away_spread_cover_prob,
      ou_prob: game.ou_result_prob,
      ml_prob: game.home_away_ml_prob,
      home_spread_diff: game.home_spread_diff,
      over_line_diff: game.over_line_diff,
      pred_away_score: game.pred_away_score,
      pred_home_score: game.pred_home_score,
      hasSpreadPred: !!spreadPrediction,
      hasOuPred: !!ouPrediction
    });
  }

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

          {/* Teams Row with Circles */}
          <View style={styles.teamsRow}>
            {/* Away Team */}
            <View style={styles.teamColumn}>
              {/* Team Circle */}
              <View style={styles.teamCircleContainer}>
                <MotiView
                  animate={{
                    rotate: expanded ? '25deg' : '0deg',
                  }}
                  transition={{
                    type: 'timing',
                    duration: 300,
                  }}
                  style={StyleSheet.absoluteFill}
                >
                  <LinearGradient
                    colors={[awayColors.primary, awayColors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.teamCircle, { borderColor: awayColors.primary }]}
                  />
                </MotiView>
                <View style={styles.teamCircleContent}>
                  <Text style={[styles.teamInitials, { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }]}>
                    {getCFBTeamInitials(game.away_team)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {game.away_team}
              </Text>
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
              <View style={styles.teamCircleContainer}>
                <MotiView
                  animate={{
                    rotate: expanded ? '25deg' : '0deg',
                  }}
                  transition={{
                    type: 'timing',
                    duration: 300,
                  }}
                  style={StyleSheet.absoluteFill}
                >
                  <LinearGradient
                    colors={[homeColors.primary, homeColors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.teamCircle, { borderColor: homeColors.primary }]}
                  />
                </MotiView>
                <View style={styles.teamCircleContent}>
                  <Text style={[styles.teamInitials, { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }]}>
                    {getCFBTeamInitials(game.home_team)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {game.home_team}
              </Text>
              <Text style={[styles.spreadText, { color: theme.colors.onSurfaceVariant }]}>
                {formatSpread(game.home_spread)}
              </Text>
              <Text style={[styles.mlText, { color: bettingColors.homeMoneyline }]}>
                {formatMoneyline(game.home_ml)}
              </Text>
            </View>
          </View>

          {/* Collapsed State - Model Edge Indicators */}
          {!expanded && (game.home_spread_diff !== null || game.over_line_diff !== null) && (
            <View style={styles.edgeSection}>
              <View style={[styles.edgeRow, { backgroundColor: theme.colors.surfaceVariant }]}>
                {game.home_spread_diff !== null && game.home_spread_diff !== undefined && (
                  <View style={styles.edgeItem}>
                    <MaterialCommunityIcons name="target" size={14} color={bettingColors.success} />
                    <Text style={[styles.edgeText, { color: theme.colors.onSurfaceVariant }]}>
                      Spread Edge: {Math.abs(Number(game.home_spread_diff)).toFixed(1)}
                    </Text>
                  </View>
                )}
                {game.over_line_diff !== null && game.over_line_diff !== undefined && (
                  <View style={styles.edgeItem}>
                    <MaterialCommunityIcons name="chart-bar" size={14} color={bettingColors.warning} />
                    <Text style={[styles.edgeText, { color: theme.colors.onSurfaceVariant }]}>
                      O/U Edge: {Math.abs(Number(game.over_line_diff)).toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Expanded State - Full Predictions */}
          <MotiView
            animate={{
              maxHeight: expanded ? 3000 : 0,
              opacity: expanded ? 1 : 0,
            }}
            transition={animationConfig}
            style={{ overflow: 'hidden' }}
          >
            {expanded && (
              <MotiView
                from={{ opacity: 0, translateY: -10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 150 }}
              >
                {/* Predicted Scores */}
                {(game.pred_away_score !== null && game.pred_home_score !== null && 
                  game.pred_away_score !== undefined && game.pred_home_score !== undefined) && (
                  <View style={[styles.scoreSection, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="scoreboard-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.scoreLabel, { color: theme.colors.onSurfaceVariant }]}>
                      Predicted Score:
                    </Text>
                    <Text style={[styles.scorePredict, { color: theme.colors.primary }]}>
                      {Math.round(Number(game.pred_away_score))} - {Math.round(Number(game.pred_home_score))}
                    </Text>
                  </View>
                )}

              {/* Model Predictions Section Header */}
              <View style={[styles.sectionHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
                <MaterialCommunityIcons name="brain" size={20} color={bettingColors.purple} />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Model Predictions
                </Text>
              </View>

              {/* Show message if no predictions available */}
              {(!game.home_spread_diff && !game.over_line_diff) && (
                <View style={[styles.noPredictionsBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="information-outline" size={20} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.noPredictionsText, { color: theme.colors.onSurfaceVariant }]}>
                    Model predictions will be available closer to game time.
                  </Text>
                </View>
              )}

              {/* Spread Prediction */}
              {(game.home_spread_diff !== null && game.home_spread_diff !== undefined) && (
                <View style={styles.predictionContainer}>
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    onPress={() => setSpreadExplanationExpanded(!spreadExplanationExpanded)}
                  >
                    <View style={[styles.predictionCard, { backgroundColor: bettingColors.successLight, borderColor: bettingColors.success }]}>
                    <View style={styles.predictionHeader}>
                      <MaterialCommunityIcons name="target" size={16} color={bettingColors.success} />
                      <Text style={[styles.predictionLabel, { color: theme.colors.onSurface }]}>
                        Spread
                      </Text>
                    </View>
                    
                    <View style={styles.threeColumnGrid}>
                      {/* Team Logo */}
                      <View style={styles.logoColumn}>
                        <LinearGradient
                          colors={[spreadPrediction?.teamColors.primary || homeColors.primary, spreadPrediction?.teamColors.secondary || homeColors.secondary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.teamCircleMedium, { borderColor: spreadPrediction?.teamColors.primary || homeColors.primary }]}
                        >
                          <Text style={[styles.teamInitialsMedium, { color: getContrastingTextColor(spreadPrediction?.teamColors.primary || homeColors.primary, spreadPrediction?.teamColors.secondary || homeColors.secondary) }]}>
                            {getCFBTeamInitials(spreadPrediction?.team || game.home_team)}
                          </Text>
                        </LinearGradient>
                      </View>

                      {/* Edge Value */}
                      <View style={styles.valueColumn}>
                        <Text style={[styles.valueLabel, { color: theme.colors.onSurfaceVariant }]}>
                          Edge to {getCFBTeamInitials(spreadPrediction?.team || game.home_team)}
                        </Text>
                        <Text style={[styles.valueLarge, { color: theme.colors.onSurface }]}>
                          {roundToNearestHalf(Math.abs(Number(game.home_spread_diff)))}
                        </Text>
                      </View>

                      {/* Model Spread */}
                      <View style={styles.valueColumn}>
                        <Text style={[styles.valueLabel, { color: theme.colors.onSurfaceVariant }]}>
                          Model Spread
                        </Text>
                        <Text style={[styles.valueLarge, { color: theme.colors.onSurface }]}>
                          {(() => {
                            // Calculate model spread display like web version
                            const baseSpread = game.pred_spread || game.home_spread || 0;
                            let modelSpread = Number(baseSpread);
                            // If edge is to away team, flip the sign
                            if (spreadPrediction && !spreadPrediction.isHome) {
                              modelSpread = -modelSpread;
                            }
                            return formatSpread(roundToNearestHalf(modelSpread));
                          })()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  </TouchableOpacity>

                  {/* What This Means */}
                  {spreadExplanationExpanded && (
                    <MotiView
                      from={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        type: 'spring',
                        damping: 20,
                        stiffness: 300,
                      }}
                      style={{ overflow: 'hidden' }}
                    >
                      <View style={[styles.explanationBox, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}>
                        <View style={styles.explanationHeader}>
                          <MaterialCommunityIcons name="information" size={14} color={bettingColors.info} />
                          <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
                            What This Means
                          </Text>
                        </View>
                        <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                          Our model's {roundToNearestHalf(Math.abs(Number(game.home_spread_diff)))}-point difference from the Vegas spread favors {spreadPrediction?.team || game.home_team}. This {Math.abs(Number(game.home_spread_diff)) > 3 ? 'significant' : Math.abs(Number(game.home_spread_diff)) > 2 ? 'moderate' : 'slight'} edge shows our analytics see the game differently than the market. The gap between our model and Vegas suggests there's value here – we're projecting {spreadPrediction?.team || game.home_team} will perform {Math.abs(Number(game.home_spread_diff)) > 3 ? 'significantly' : 'better'} relative to the spread than the current line indicates.
                        </Text>
                      </View>
                    </MotiView>
                  )}
                </View>
              )}

              {/* O/U Prediction */}
              {(game.over_line_diff !== null && game.over_line_diff !== undefined) && (
                <View style={styles.predictionContainer}>
                  {(() => {
                    const isOver = Number(game.over_line_diff) > 0;
                    const magnitude = Math.abs(Number(game.over_line_diff));
                    
                    return (
                      <>
                        <TouchableOpacity 
                          activeOpacity={0.7}
                          onPress={() => setOuExplanationExpanded(!ouExplanationExpanded)}
                        >
                          <View style={[styles.predictionCard, { backgroundColor: isOver ? bettingColors.successLight : bettingColors.dangerLight, borderColor: isOver ? bettingColors.success : bettingColors.danger }]}>
                          <View style={styles.predictionHeader}>
                            <MaterialCommunityIcons name="chart-line-variant" size={16} color={isOver ? bettingColors.success : bettingColors.danger} />
                            <Text style={[styles.predictionLabel, { color: theme.colors.onSurface }]}>
                              Over/Under
                            </Text>
                          </View>
                          
                          <View style={styles.threeColumnGrid}>
                            {/* Arrow Indicator */}
                            <View style={styles.logoColumn}>
                              <View style={styles.arrowContainer}>
                                <Text style={[styles.arrowIcon, { color: isOver ? bettingColors.success : bettingColors.danger }]}>
                                  {isOver ? '▲' : '▼'}
                                </Text>
                                <Text style={[styles.arrowLabel, { color: isOver ? bettingColors.successDark : bettingColors.dangerDark }]}>
                                  {isOver ? 'Over' : 'Under'}
                                </Text>
                              </View>
                            </View>

                            {/* Edge Value */}
                            <View style={styles.valueColumn}>
                              <Text style={[styles.valueLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Edge to {isOver ? 'Over' : 'Under'}
                              </Text>
                              <Text style={[styles.valueLarge, { color: theme.colors.onSurface }]}>
                                {roundToNearestHalf(magnitude)}
                              </Text>
                            </View>

                            {/* Model O/U */}
                            <View style={styles.valueColumn}>
                              <Text style={[styles.valueLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Model O/U
                              </Text>
                              <Text style={[styles.valueLarge, { color: theme.colors.onSurface }]}>
                                {roundToNearestHalf(game.pred_over_line || game.over_line || 0)}
                              </Text>
                            </View>
                          </View>
                        </View>
                        </TouchableOpacity>

                        {/* What This Means */}
                        {ouExplanationExpanded && (
                          <MotiView
                            from={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              type: 'spring',
                              damping: 20,
                              stiffness: 300,
                            }}
                            style={{ overflow: 'hidden' }}
                          >
                            <View style={[styles.explanationBox, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}>
                              <View style={styles.explanationHeader}>
                                <MaterialCommunityIcons name="information" size={14} color={bettingColors.info} />
                                <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
                                  What This Means
                                </Text>
                              </View>
                              <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                                Our model's total is {roundToNearestHalf(magnitude)} {roundToNearestHalf(magnitude) === 1 ? 'point' : 'points'} {isOver ? 'higher than' : 'lower than'} the Vegas line, {magnitude < 2 ? 'slightly' : magnitude < 4 ? 'moderately' : 'strongly'} favoring the {isOver ? 'over' : 'under'}. This {magnitude < 2 ? 'minimal' : magnitude < 4 ? 'moderate' : 'significant'} edge means our projection {magnitude < 2 ? 'closely matches' : magnitude < 4 ? 'noticeably differs from' : 'significantly diverges from'} what Vegas expects. While the edge is {magnitude < 2 ? 'small' : magnitude < 4 ? 'moderate' : 'substantial'}, our analytics {magnitude < 2 ? 'slightly lean' : 'lean'} toward the {isOver ? 'under' : 'over'} when compared to what Vegas expects.
                              </Text>
                            </View>
                          </MotiView>
                        )}
                      </>
                    );
                  })()}
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
                </View>
              </MotiView>
            )}
          </MotiView>

          {/* Tap to Expand Hint (collapsed state) */}
          {!expanded && (
            <View style={styles.expandHint}>
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
    gap: 6,
    flexWrap: 'wrap',
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
    gap: 2,
  },
  teamCircleContainer: {
    width: 48,
    height: 48,
    marginBottom: 4,
    position: 'relative',
  },
  teamCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  teamCircleContent: {
    position: 'absolute',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitials: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    minHeight: 32,
  },
  teamNameExpanded: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
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
  edgeSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  edgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  edgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  edgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scoreSection: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  scorePredict: {
    fontSize: 15,
    fontWeight: 'bold',
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
  predictionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  predictionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  threeColumnGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  logoColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  valueColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  valueLarge: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  teamCircleMedium: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  teamInitialsMedium: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  arrowLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: -4,
  },
  edgeBadge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
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
    fontSize: 11,
    fontWeight: 'bold',
  },
  predictionTeam: {
    fontSize: 12,
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
  noPredictionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  noPredictionsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
