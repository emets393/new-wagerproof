import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme, Chip } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { NCAABGame } from '@/types/ncaab';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';
import { getCFBTeamColors, getNCAABTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { formatCompactDate, convertTimeToEST, formatMoneyline, formatSpread, roundToNearestHalf } from '@/utils/formatting';
import { PolymarketWidget } from './PolymarketWidget';
import { WagerBotInsightPill } from './WagerBotInsightPill';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';

export function NCAABGameBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { selectedGame: game, closeGameSheet, bottomSheetRef } = useNCAABGameSheet();
  const { onModelDetailsTap, isDetached } = useWagerBotSuggestion();
  const snapPoints = useMemo(() => ['85%', '95%'], []);
  const [spreadExplanationExpanded, setSpreadExplanationExpanded] = useState(false);
  const [ouExplanationExpanded, setOuExplanationExpanded] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationRevealed, setSimulationRevealed] = useState(false);

  // Reset simulation state when game changes
  useEffect(() => {
    setSimulating(false);
    setSimulationRevealed(false);
    setSpreadExplanationExpanded(false);
    setOuExplanationExpanded(false);
  }, [game?.id]);

  const handleSpreadTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpreadExplanationExpanded(!spreadExplanationExpanded);
    // Notify floating assistant if in detached mode
    if (isDetached && !spreadExplanationExpanded) {
      onModelDetailsTap();
    }
  };

  const handleOuTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOuExplanationExpanded(!ouExplanationExpanded);
    // Notify floating assistant if in detached mode
    if (isDetached && !ouExplanationExpanded) {
      onModelDetailsTap();
    }
  };

  const handleSimulate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      setSimulationRevealed(true);
    }, 2500);
  };

  // Reuse CFB colors for NCAAB (same schools)
  const awayColors = game ? getCFBTeamColors(game.away_team) : { primary: '#000', secondary: '#000' };
  const homeColors = game ? getCFBTeamColors(game.home_team) : { primary: '#000', secondary: '#000' };

  // Calculate edge values for spread (like CFB)
  const spreadPrediction = useMemo(() => {
    if (!game) return null;
    
    // Use model_fair_home_spread or pred_home_margin to calculate edge
    if (game.model_fair_home_spread !== null && game.home_spread !== null) {
      const edge = Math.abs(game.model_fair_home_spread - game.home_spread);
      const isHomeEdge = game.model_fair_home_spread < game.home_spread;
      return {
        edge,
        predictedTeam: isHomeEdge ? game.home_team : game.away_team,
        predictedSpread: isHomeEdge ? game.model_fair_home_spread : -game.model_fair_home_spread,
        teamColors: isHomeEdge ? homeColors : awayColors,
        isHome: isHomeEdge,
        vegasSpread: isHomeEdge ? game.home_spread : game.away_spread,
        isFadeAlert: edge >= 5,
      };
    }
    
    // Use pred_home_margin if available
    if (game.pred_home_margin !== null && game.home_spread !== null) {
      const modelSpread = -game.pred_home_margin; // Convert margin to spread
      const edge = Math.abs(modelSpread - game.home_spread);
      const isHomeEdge = modelSpread < game.home_spread;
      return {
        edge,
        predictedTeam: isHomeEdge ? game.home_team : game.away_team,
        predictedSpread: isHomeEdge ? modelSpread : -modelSpread,
        teamColors: isHomeEdge ? homeColors : awayColors,
        isHome: isHomeEdge,
        vegasSpread: isHomeEdge ? game.home_spread : game.away_spread,
        isFadeAlert: edge >= 5,
      };
    }
    
    // Fallback to probability-based
    if (game.home_away_spread_cover_prob !== null) {
      const prob = game.home_away_spread_cover_prob >= 0.5 ? game.home_away_spread_cover_prob : 1 - game.home_away_spread_cover_prob;
      const isHome = game.home_away_spread_cover_prob >= 0.5;
      return {
        edge: (prob - 0.5) * 20,
        predictedTeam: isHome ? game.home_team : game.away_team,
        predictedSpread: isHome ? game.home_spread : game.away_spread,
        teamColors: isHome ? homeColors : awayColors,
        isHome,
        vegasSpread: isHome ? game.home_spread : game.away_spread,
        probability: prob,
        isFadeAlert: prob >= 0.8 || (prob - 0.5) * 20 >= 5,
      };
    }
    
    return null;
  }, [game, homeColors, awayColors]);

  // Calculate edge values for O/U (like CFB)
  const ouPrediction = useMemo(() => {
    if (!game) return null;
    
    // Use pred_total_points to calculate edge
    if (game.pred_total_points !== null && game.over_line !== null) {
      const edge = Math.abs(game.pred_total_points - game.over_line);
      const isOver = game.pred_total_points > game.over_line;
      return {
        edge,
        predictedOutcome: isOver ? 'over' as const : 'under' as const,
        modelTotal: game.pred_total_points,
        line: game.over_line,
        isFadeAlert: edge >= 5,
      };
    }
    
    // Fallback to probability-based
    if (game.ou_result_prob !== null) {
      const prob = game.ou_result_prob >= 0.5 ? game.ou_result_prob : 1 - game.ou_result_prob;
      const isOver = game.ou_result_prob >= 0.5;
      return {
        edge: (prob - 0.5) * 20,
        predictedOutcome: isOver ? 'over' as const : 'under' as const,
        modelTotal: null,
        line: game.over_line,
        probability: prob,
        isFadeAlert: prob >= 0.8 || (prob - 0.5) * 20 >= 5,
      };
    }
    
    return null;
  }, [game]);

  const getSpreadExplanation = () => {
    if (!spreadPrediction || !game) return '';
    const edge = spreadPrediction.edge.toFixed(1);
    const team = spreadPrediction.predictedTeam;
    const spread = formatSpread(spreadPrediction.predictedSpread);
    
    if (spreadPrediction.edge < 2) {
      return `Our model differs from Vegas by ${edge} points on ${team}. This small edge indicates our projection is fairly close to the market's assessment. While the value is limited, our model still sees ${team} as slightly better positioned than the Vegas spread suggests.`;
    } else if (spreadPrediction.edge < 4) {
      return `Our model projects ${team} to cover ${spread} with a ${edge}-point edge over Vegas. This moderate discrepancy shows our analytics identify a meaningful difference in how we evaluate this matchup compared to the current market line.`;
    } else {
      return `Our model sees a significant ${edge}-point edge favoring ${team} to cover ${spread}. This large discrepancy indicates our projections differ substantially from the Vegas line, suggesting strong value on this side of the spread.`;
    }
  };

  const getOuExplanation = () => {
    if (!ouPrediction || !game) return '';
    const edge = ouPrediction.edge.toFixed(1);
    const direction = ouPrediction.predictedOutcome.toUpperCase();
    const line = ouPrediction.line ? roundToNearestHalf(ouPrediction.line) : '-';
    const modelTotal = ouPrediction.modelTotal ? roundToNearestHalf(ouPrediction.modelTotal) : '-';
    
    if (ouPrediction.edge < 2) {
      return `Our model projects a total that's ${edge} points different from Vegas, favoring the ${direction.toLowerCase()}. This small edge indicates our scoring projection is fairly aligned with the market, though we still see slight value on the ${direction.toLowerCase()} side.`;
    } else if (ouPrediction.edge < 4) {
      return `Our model projects a ${modelTotal} total with a ${edge}-point edge favoring the ${direction.toLowerCase()}. This moderate discrepancy shows our scoring projection doesn't align with the market, suggesting meaningful value on the ${direction.toLowerCase()}.`;
    } else {
      return `Our model sees a significant ${edge}-point edge favoring the ${direction.toLowerCase()}. This large difference between our ${modelTotal} projection and the Vegas ${line} line indicates the actual total is more likely to land on the ${direction.toLowerCase()} side than what the current market implies.`;
    }
  };

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.7}
    />
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={closeGameSheet}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
    >
      <BottomSheetScrollView 
        contentContainerStyle={[styles.contentContainer, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}
        showsVerticalScrollIndicator={false}
      >
        {game ? (
          <>
          {/* Header with Teams */}
          <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
            <LinearGradient
              colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.headerGradient}
            />
            {/* WagerBot Insight Pill */}
            <WagerBotInsightPill game={game} sport="ncaab" />
            <View style={styles.headerContent}>
              <View style={styles.dateTimeRow}>
              <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
                {formatCompactDate(game.game_date)}
              </Text>
              <View style={[styles.timeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                  {convertTimeToEST(game.game_time)}
                </Text>
              </View>
              {game.conference_game && (
                <Chip style={{ height: 22 }} textStyle={{ fontSize: 9 }}>Conf</Chip>
              )}
              {game.neutral_site && (
                <Chip style={{ height: 22 }} textStyle={{ fontSize: 9 }}>Neutral</Chip>
              )}
            </View>

            <View style={styles.teamsRow}>
              {/* Away Team */}
              <View style={styles.teamSection}>
                <View style={styles.teamCircleWrapper}>
                  <LinearGradient
                    colors={[awayColors.primary, awayColors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.teamCircleLarge, { borderColor: awayColors.primary }]}
                  >
                    <Text style={[styles.teamInitialsLarge, { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }]}>
                      {getNCAABTeamInitials(game.away_team)}
                    </Text>
                  </LinearGradient>
                  {game.away_ranking && game.away_ranking <= 25 && (
                    <View style={[styles.rankingBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.rankingText}>#{game.away_ranking}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                  {game.away_team}
                </Text>
                <View style={styles.teamLines}>
                  {game.away_spread !== null && (
                    <View style={[styles.linePill, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                      <Text style={[styles.lineValue, { color: '#22c55e' }]}>{formatSpread(game.away_spread)}</Text>
                    </View>
                  )}
                  {game.away_ml !== null && (
                    <View style={[styles.linePill, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                      <Text style={[styles.lineValue, { color: '#3b82f6' }]}>{formatMoneyline(game.away_ml)}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.centerSection}>
                <Text style={[styles.vsText, { color: theme.colors.outlineVariant }]}>@</Text>
                {game.over_line && (
                  <View style={[styles.totalPill, { backgroundColor: 'rgba(156, 163, 175, 0.15)', borderColor: 'rgba(156, 163, 175, 0.3)' }]}>
                    <Text style={[styles.totalText, { color: theme.colors.onSurfaceVariant }]}>
                      O/U: {roundToNearestHalf(game.over_line)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Home Team */}
              <View style={styles.teamSection}>
                <View style={styles.teamCircleWrapper}>
                  <LinearGradient
                    colors={[homeColors.primary, homeColors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.teamCircleLarge, { borderColor: homeColors.primary }]}
                  >
                    <Text style={[styles.teamInitialsLarge, { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }]}>
                      {getNCAABTeamInitials(game.home_team)}
                    </Text>
                  </LinearGradient>
                  {game.home_ranking && game.home_ranking <= 25 && (
                    <View style={[styles.rankingBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.rankingText}>#{game.home_ranking}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                  {game.home_team}
                </Text>
                <View style={styles.teamLines}>
                  {game.home_spread !== null && (
                    <View style={[styles.linePill, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                      <Text style={[styles.lineValue, { color: '#22c55e' }]}>{formatSpread(game.home_spread)}</Text>
                    </View>
                  )}
                  {game.home_ml !== null && (
                    <View style={[styles.linePill, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                      <Text style={[styles.lineValue, { color: '#3b82f6' }]}>{formatMoneyline(game.home_ml)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            </View>
          </View>

          {/* Polymarket Widget */}
          <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
            <View style={styles.sectionContent}>
              <PolymarketWidget
            awayTeam={game.away_team}
            homeTeam={game.home_team}
            gameDate={game.game_date}
            awayTeamColors={awayColors}
            homeTeamColors={homeColors}
            league="ncaab"
              />
            </View>
          </View>

          {/* Spread Prediction - Edge-based like CFB */}
          {spreadPrediction && (
            <View>
              <Pressable onPress={handleSpreadTap} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
                  <View style={styles.predictionCard}>
                    <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons name="target" size={20} color="#22c55e" />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Spread Prediction</Text>
                    <View style={styles.tapHintContainer}>
                      <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.onSurfaceVariant} />
                      <Text style={[styles.tapHintText, { color: theme.colors.onSurfaceVariant }]}>Tap for Explanation</Text>
                    </View>
                  </View>
                  <View style={[styles.predictionContent, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                    <View style={styles.edgeRow}>
                      <View style={styles.edgeSection}>
                        <Text style={[styles.edgeLabel, { color: theme.colors.onSurfaceVariant }]}>
                          Edge to {getNCAABTeamInitials(spreadPrediction.predictedTeam)}
                        </Text>
                        <Text style={[styles.edgeValue, { color: '#22c55e' }]}>
                          {spreadPrediction.edge.toFixed(1)}
                        </Text>
                        <LinearGradient
                          colors={[spreadPrediction.teamColors.primary, spreadPrediction.teamColors.secondary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.edgeTeamCircle}
                        >
                          <Text style={[
                            styles.edgeTeamInitials,
                            { color: getContrastingTextColor(spreadPrediction.teamColors.primary, spreadPrediction.teamColors.secondary) }
                          ]}>
                            {getNCAABTeamInitials(spreadPrediction.predictedTeam)}
                          </Text>
                        </LinearGradient>
                      </View>
                      <View style={styles.edgeSection}>
                        <Text style={[styles.edgeLabel, { color: theme.colors.onSurfaceVariant }]}>
                          Model Spread
                        </Text>
                        <Text style={[styles.edgeValue, { color: theme.colors.onSurface }]}>
                          {spreadPrediction.predictedSpread !== null 
                            ? (spreadPrediction.predictedSpread > 0 ? `+${spreadPrediction.predictedSpread.toFixed(1)}` : spreadPrediction.predictedSpread.toFixed(1)) 
                            : '-'}
                        </Text>
                        <View style={styles.vsVegasContainer}>
                          <Text style={[styles.vsVegasLabel, { color: theme.colors.onSurfaceVariant }]}>
                            vs. Vegas Spread
                          </Text>
                          <Text style={[styles.vsVegasValue, { color: theme.colors.onSurfaceVariant }]}>
                            {game.home_spread ? formatSpread(game.home_spread) : '-'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {/* Fade Alert Pill */}
                    {spreadPrediction?.isFadeAlert && (
                      <View style={[styles.fadeAlertPill, { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(59, 130, 246, 0.4)' }]}>
                        <MaterialCommunityIcons name="lightning-bolt" size={12} color="#3b82f6" />
                        <Text style={[styles.fadeAlertPillText, { color: '#3b82f6', marginLeft: 4 }]}>
                          FADE ALERT
                        </Text>
                      </View>
                    )}
                  </View>
                  </View>
                </View>
              </Pressable>

              {spreadExplanationExpanded && (
                <MotiView
                  from={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  style={{ overflow: 'hidden' }}
                >
                  <View style={[styles.explanationBox, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.25)' }]}>
                    <View style={styles.explanationHeader}>
                      <MaterialCommunityIcons name="information" size={16} color="#22c55e" />
                      <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>What This Means</Text>
                    </View>
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>{getSpreadExplanation()}</Text>
                  </View>
                </MotiView>
              )}
            </View>
          )}

          {/* Over/Under Prediction - Edge-based like CFB */}
          {ouPrediction && (
            <View>
              <Pressable onPress={handleOuTap} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
                  <View style={styles.predictionCard}>
                    <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons 
                      name={ouPrediction.predictedOutcome === 'over' ? 'arrow-up-bold' : 'arrow-down-bold'} 
                      size={20} 
                      color={ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444'} 
                    />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Over/Under Prediction</Text>
                    <View style={styles.tapHintContainer}>
                      <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.onSurfaceVariant} />
                      <Text style={[styles.tapHintText, { color: theme.colors.onSurfaceVariant }]}>Tap for Explanation</Text>
                    </View>
                  </View>
                  <View style={[styles.predictionContent, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                    <View style={styles.edgeRow}>
                      <View style={styles.edgeSection}>
                        <Text style={[styles.edgeLabel, { color: theme.colors.onSurfaceVariant }]}>
                          Edge to {ouPrediction.predictedOutcome === 'over' ? 'Over' : 'Under'}
                        </Text>
                        <View style={styles.ouEdgeColumn}>
                          <Text style={[
                            styles.edgeValue,
                            { color: ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444' }
                          ]}>
                            {ouPrediction.edge.toFixed(1)}
                          </Text>
                          <MaterialCommunityIcons 
                            name={ouPrediction.predictedOutcome === 'over' ? 'chevron-up' : 'chevron-down'} 
                            size={48} 
                            color={ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444'} 
                          />
                        </View>
                      </View>
                      <View style={styles.edgeSection}>
                        <Text style={[styles.edgeLabel, { color: theme.colors.onSurfaceVariant }]}>
                          Model O/U
                        </Text>
                        <Text style={[styles.edgeValue, { color: theme.colors.onSurface }]}>
                          {ouPrediction.modelTotal ? roundToNearestHalf(ouPrediction.modelTotal) : '-'}
                        </Text>
                        <View style={styles.vsVegasContainer}>
                          <Text style={[styles.vsVegasLabel, { color: theme.colors.onSurfaceVariant }]}>
                            vs. Vegas O/U
                          </Text>
                          <Text style={[styles.vsVegasValue, { color: theme.colors.onSurfaceVariant }]}>
                            {game.over_line ? roundToNearestHalf(game.over_line) : '-'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {/* Fade Alert Pill */}
                    {ouPrediction?.isFadeAlert && (
                      <View style={[
                        styles.fadeAlertPill, 
                        { 
                          backgroundColor: ouPrediction.predictedOutcome === 'over' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          borderColor: ouPrediction.predictedOutcome === 'over' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'
                        }
                      ]}>
                        <MaterialCommunityIcons 
                          name="lightning-bolt" 
                          size={12} 
                          color={ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444'} 
                        />
                        <Text style={[
                          styles.fadeAlertPillText, 
                          { 
                            color: ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444',
                            marginLeft: 4
                          }
                        ]}>
                          FADE ALERT
                        </Text>
                      </View>
                    )}
                  </View>
                  </View>
                </View>
              </Pressable>

              {ouExplanationExpanded && (
                <MotiView
                  from={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  style={{ overflow: 'hidden' }}
                >
                  <View style={[styles.explanationBox, { 
                    backgroundColor: ouPrediction.predictedOutcome === 'over' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderColor: ouPrediction.predictedOutcome === 'over' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'
                  }]}>
                    <View style={styles.explanationHeader}>
                      <MaterialCommunityIcons name="information" size={16} color={ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444'} />
                      <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>What This Means</Text>
                    </View>
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>{getOuExplanation()}</Text>
                  </View>
                </MotiView>
              )}
            </View>
          )}

          {/* Team Stats Section */}
          {(game.home_adj_offense !== null || game.away_adj_offense !== null) && (
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
              <View style={styles.sectionContent}>
                <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="chart-bar" size={20} color="#3b82f6" />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Team Stats</Text>
              </View>
              <View style={[styles.statsContent, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                <View style={styles.statsHeaderRow}>
                  <Text style={[styles.statsHeaderLabel, { color: theme.colors.onSurfaceVariant }]}></Text>
                  <Text style={[styles.statsHeaderValue, { color: theme.colors.onSurfaceVariant }]}>{getNCAABTeamInitials(game.away_team)}</Text>
                  <Text style={[styles.statsHeaderValue, { color: theme.colors.onSurfaceVariant }]}>{getNCAABTeamInitials(game.home_team)}</Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={[styles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>Adj. Offense</Text>
                  <Text style={[styles.statsValue, { color: theme.colors.onSurface }]}>{game.away_adj_offense?.toFixed(1) ?? '-'}</Text>
                  <Text style={[styles.statsValue, { color: theme.colors.onSurface }]}>{game.home_adj_offense?.toFixed(1) ?? '-'}</Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={[styles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>Adj. Defense</Text>
                  <Text style={[styles.statsValue, { color: theme.colors.onSurface }]}>{game.away_adj_defense?.toFixed(1) ?? '-'}</Text>
                  <Text style={[styles.statsValue, { color: theme.colors.onSurface }]}>{game.home_adj_defense?.toFixed(1) ?? '-'}</Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={[styles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>Adj. Pace</Text>
                  <Text style={[styles.statsValue, { color: theme.colors.onSurface }]}>{game.away_adj_pace?.toFixed(1) ?? '-'}</Text>
                  <Text style={[styles.statsValue, { color: theme.colors.onSurface }]}>{game.home_adj_pace?.toFixed(1) ?? '-'}</Text>
                </View>
              </View>
              </View>
            </View>
          )}

          {/* Match Simulator Section */}
          {game.home_score_pred !== null && game.away_score_pred !== null && (
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
              <View style={styles.sectionContent}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="creation" size={20} color="#fbbf24" />
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    Match Simulator
                  </Text>
                </View>

                {!simulationRevealed ? (
                  <View style={styles.simulateButtonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.simulateButton,
                        { 
                          backgroundColor: simulating ? theme.colors.surfaceVariant : theme.colors.primary,
                          borderColor: theme.colors.primary 
                        }
                      ]}
                      onPress={handleSimulate}
                      disabled={simulating}
                    >
                      {simulating ? (
                        <View style={styles.simulatingRow}>
                          <ActivityIndicator size="small" color={theme.colors.onSurface} />
                          <Text style={[styles.simulateButtonText, { color: theme.colors.onSurface }]}>
                            Simulating...
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.simulateButtonText, { color: '#fff' }]}>
                          Simulate Match
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.simulationResult, { backgroundColor: 'rgba(251, 191, 36, 0.15)', borderColor: 'rgba(251, 191, 36, 0.3)' }]}>
                    {/* Away Team Score */}
                    <View style={styles.teamScoreSection}>
                      <LinearGradient
                        colors={[awayColors.primary, awayColors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.scoreTeamCircle, { borderColor: awayColors.primary }]}
                      >
                        <Text style={[
                          styles.scoreTeamInitials,
                          { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }
                        ]}>
                          {getNCAABTeamInitials(game.away_team)}
                        </Text>
                      </LinearGradient>
                      <Text style={[styles.predictedScore, { color: theme.colors.onSurface }]}>
                        {Math.round(game.away_score_pred)}
                      </Text>
                    </View>

                    {/* VS Separator */}
                    <View style={styles.vsSeparator}>
                      <Text style={[styles.vsTextSmall, { color: theme.colors.onSurfaceVariant }]}>VS</Text>
                    </View>

                    {/* Home Team Score */}
                    <View style={styles.teamScoreSection}>
                      <LinearGradient
                        colors={[homeColors.primary, homeColors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.scoreTeamCircle, { borderColor: homeColors.primary }]}
                      >
                        <Text style={[
                          styles.scoreTeamInitials,
                          { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }
                        ]}>
                          {getNCAABTeamInitials(game.home_team)}
                        </Text>
                      </LinearGradient>
                      <Text style={[styles.predictedScore, { color: theme.colors.onSurface }]}>
                        {Math.round(game.home_score_pred)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Model Projections Summary (if no simulator but has margin/total) */}
          {game.home_score_pred === null && game.pred_home_margin !== null && game.pred_total_points !== null && (
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
              <View style={styles.sectionContent}>
                <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="scoreboard" size={20} color="#a855f7" />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Model Projections</Text>
              </View>
              <View style={[styles.statsContent, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                <View style={styles.statsRow}>
                  <Text style={[styles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>Predicted Margin</Text>
                  <Text style={[styles.statsValue, { color: '#a855f7' }]}>
                    {game.pred_home_margin > 0 ? game.home_team : game.away_team} by {Math.abs(game.pred_home_margin).toFixed(1)}
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={[styles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>Predicted Total</Text>
                  <Text style={[styles.statsValue, { color: '#a855f7' }]}>
                    {game.pred_total_points.toFixed(1)} points
                  </Text>
                </View>
              </View>
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
          </>
        ) : (
          <View style={{ height: 100 }} />
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: { padding: 16 },
  sectionCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 12 },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  headerContent: { padding: 12 },
  sectionContent: { padding: 12 },
  dateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  dateText: { fontSize: 16, fontWeight: '600' },
  timeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  timeText: { fontSize: 13, fontWeight: '600' },
  teamsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 24 },
  teamSection: { alignItems: 'center', gap: 8, flex: 1 },
  teamCircleWrapper: { position: 'relative' },
  teamCircleLarge: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  teamInitialsLarge: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', maxWidth: 76 },
  rankingBadge: { position: 'absolute', top: -4, right: -4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 28, alignItems: 'center' },
  rankingText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  teamName: { fontSize: 12, fontWeight: '600', textAlign: 'center', maxWidth: 100 },
  teamLines: { flexDirection: 'row', gap: 6, marginTop: 8 },
  linePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  lineValue: { fontSize: 11, fontWeight: '700' },
  centerSection: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  vsText: { fontSize: 24, fontWeight: '600' },
  totalPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  totalText: { fontSize: 12, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  tapHintContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  tapHintText: { fontSize: 11, fontWeight: '500' },
  predictionCard: { padding: 12 },
  predictionContent: { padding: 12, borderRadius: 8, gap: 12 },
  edgeRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 16 },
  edgeSection: { flex: 1, alignItems: 'center', gap: 8 },
  edgeLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  edgeValue: { fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
  edgeTeamCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  edgeTeamInitials: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', maxWidth: 50 },
  ouEdgeColumn: { flexDirection: 'column', alignItems: 'center', gap: 0 },
  vsVegasContainer: { marginTop: 12, alignItems: 'center', gap: 4 },
  vsVegasLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  vsVegasValue: { fontSize: 16, fontWeight: '700' },
  explanationBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 8, marginBottom: 12 },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  explanationTitle: { fontSize: 14, fontWeight: '600' },
  explanationText: { fontSize: 13, lineHeight: 20, fontWeight: '400' },
  statsContent: { padding: 12, borderRadius: 8, gap: 8 },
  statsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  statsHeaderLabel: { flex: 2, fontSize: 11, fontWeight: '600' },
  statsHeaderValue: { flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsLabel: { flex: 2, fontSize: 13, fontWeight: '500' },
  statsValue: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  simulateButtonContainer: { marginTop: 12, alignItems: 'center' },
  simulateButton: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, borderWidth: 2, minWidth: 200, alignItems: 'center' },
  simulateButtonText: { fontSize: 18, fontWeight: 'bold' },
  simulatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  simulationResult: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 12 },
  teamScoreSection: { flex: 1, alignItems: 'center', gap: 12 },
  scoreTeamCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  scoreTeamInitials: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  predictedScore: { fontSize: 32, fontWeight: 'bold' },
  vsSeparator: { paddingHorizontal: 16 },
  vsTextSmall: { fontSize: 16, fontWeight: 'bold' },
  fadeAlertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  fadeAlertPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
