import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme, Chip } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { CFBPrediction } from '@/types/cfb';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { getCFBTeamColors, getCFBTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { formatCompactDate, convertTimeToEST, formatMoneyline, formatSpread, roundToNearestHalf } from '@/utils/formatting';
import { PublicBettingBars } from './cfb/PublicBettingBars';
import { PolymarketWidget } from './PolymarketWidget';
import { WagerBotInsightPill } from './WagerBotInsightPill';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';

export function CFBGameBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { selectedGame: game, closeGameSheet, bottomSheetRef } = useCFBGameSheet();
  const { onModelDetailsTap, isDetached } = useWagerBotSuggestion();
  const snapPoints = useMemo(() => ['85%', '95%'], []);
  const [spreadExplanationExpanded, setSpreadExplanationExpanded] = useState(false);
  const [ouExplanationExpanded, setOuExplanationExpanded] = useState(false);
  const [lineMovementExplanationExpanded, setLineMovementExplanationExpanded] = useState(false);
  const [openingLine, setOpeningLine] = useState<{ spread: number | null; total: number | null } | null>(null);
  const [currentLine, setCurrentLine] = useState<{ spread: number | null; total: number | null } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationRevealed, setSimulationRevealed] = useState(false);

  // Reset simulation state when game changes
  useEffect(() => {
    setSimulating(false);
    setSimulationRevealed(false);
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

  const handleLineMovementTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineMovementExplanationExpanded(!lineMovementExplanationExpanded);
  };

  const handleSimulate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      setSimulationRevealed(true);
    }, 2500);
  };

  // Set opening and current lines from game data
  useEffect(() => {
    if (!game) {
      setOpeningLine(null);
      setCurrentLine(null);
      return;
    }

    console.log('CFB: Setting line data');
    console.log('CFB: Opening - Spread:', game.opening_spread, 'Total:', game.opening_total);
    console.log('CFB: Current - Spread:', game.home_spread, 'Total:', game.over_line);
    
    // Opening lines from cfb_live_weekly_inputs (spread and total_line columns)
    setOpeningLine({
      spread: game.opening_spread ?? null,
      total: game.opening_total ?? null,
    });
    
    // Current lines from cfb_live_weekly_inputs (api_spread and api_over_line columns)
    setCurrentLine({
      spread: game.home_spread ?? null,
      total: game.over_line ?? null,
    });
  }, [game?.opening_spread, game?.opening_total, game?.home_spread, game?.over_line]);

  const awayColors = game ? getCFBTeamColors(game.away_team) : { primary: '#000', secondary: '#000' };
  const homeColors = game ? getCFBTeamColors(game.home_team) : { primary: '#000', secondary: '#000' };

  // CFB uses edge values instead of probabilities
  const spreadPrediction = game && game.home_spread_diff !== null && game.home_spread_diff !== undefined ? {
    edge: Math.abs(game.home_spread_diff),
    predictedTeam: game.home_spread_diff > 0 ? game.home_team : game.away_team,
    predictedSpread: game.pred_spread || (game.home_spread_diff > 0 ? game.home_spread : game.away_spread),
    teamColors: game.home_spread_diff > 0 ? homeColors : awayColors,
    isHome: game.home_spread_diff > 0,
    isFadeAlert: Math.abs(game.home_spread_diff) > 10,
  } : null;

  const ouPrediction = game && game.over_line_diff !== null && game.over_line_diff !== undefined ? {
    edge: Math.abs(game.over_line_diff),
    predictedOutcome: game.over_line_diff > 0 ? 'over' as const : 'under' as const,
    modelTotal: game.pred_over_line || game.pred_total || game.over_line,
    line: game.over_line,
    isFadeAlert: Math.abs(game.over_line_diff) > 10,
  } : null;

  // Explanation generators for edge-based predictions
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

  const getLineMovementExplanation = () => {
    if (!openingLine?.spread || !currentLine?.spread || !game) return '';
    
    const openValue = openingLine.spread;
    const currentValue = currentLine.spread;
    const movement = currentValue - openValue;
    const homeTeam = getCFBTeamInitials(game.home_team);
    const awayTeam = getCFBTeamInitials(game.away_team);
    
    // Calculate both teams' spread movements
    const homeOpenSpread = openValue;
    const homeCurrentSpread = currentValue;
    const awayOpenSpread = -openValue;
    const awayCurrentSpread = -currentValue;
    
    if (Math.abs(movement) === 0) {
      return `📊 NO MOVEMENT - Line locked\n\n${homeTeam}: ${formatSpread(homeCurrentSpread)}\n${awayTeam}: ${formatSpread(awayCurrentSpread)}\n\n✓ Market Consensus: Both sharp bettors and public agree on this number\n✓ Balanced Action: Equal money on both sides\n✓ Actionable Insight: This is a "clean" line with no manipulation. If your model disagrees with this number, it could indicate genuine value since the market is confident in this spread.`;
    }
    
    const movementAbs = Math.abs(movement).toFixed(1);
    const movingTowardTeam = movement > 0 ? homeTeam : awayTeam;
    const movingAgainstTeam = movement > 0 ? awayTeam : homeTeam;
    const gettingMorePoints = movement > 0 ? homeTeam : awayTeam;
    const gettingFewerPoints = movement > 0 ? awayTeam : homeTeam;
    
    if (Math.abs(movement) < 1) {
      return `📈 MINOR MOVE (${movement > 0 ? '+' : ''}${movementAbs} pts)\n\n📊 Line Movement:\n${homeTeam}: ${formatSpread(homeOpenSpread)} → ${formatSpread(homeCurrentSpread)}\n${awayTeam}: ${formatSpread(awayOpenSpread)} → ${formatSpread(awayCurrentSpread)}\n\n⚡ What Happened:\n• ${gettingMorePoints} getting ${movementAbs} MORE points\n• ${gettingFewerPoints} giving up ${movementAbs} FEWER points\n• Light line shopping or micro-adjustments\n\n💡 Actionable Insight:\nThis subtle move suggests books are fine-tuning risk but nothing significant has changed.\n\n• Betting ${movingAgainstTeam}? You're getting a slightly worse number than early bettors\n• Betting ${movingTowardTeam}? You're getting improved value (${movementAbs} extra points)\n• Impact is minimal—bet based on your model, not this movement`;
    } else if (Math.abs(movement) < 3) {
      return `🔥 SIGNIFICANT MOVE (${movement > 0 ? '+' : ''}${movementAbs} pts)\n\n📊 Line Movement:\n${homeTeam}: ${formatSpread(homeOpenSpread)} → ${formatSpread(homeCurrentSpread)}\n${awayTeam}: ${formatSpread(awayOpenSpread)} → ${formatSpread(awayCurrentSpread)}\n\n⚡ What Happened:\n• ${gettingMorePoints} getting ${movementAbs} MORE points\n• ${gettingFewerPoints} giving up ${movementAbs} FEWER points\n• Sharp money OR heavy public action on ${movingAgainstTeam}\n• Possible injury news, weather update, or lineup change\n\n💰 Sharp Action Indicator:\nMoves of 1-3 points often signal respected money came in on ${movingAgainstTeam}. Books moved the line to make ${movingTowardTeam} more attractive to balance action.\n\n💡 Actionable Insights:\n✓ VALUE PLAY: ${movingTowardTeam} at ${formatSpread(movement > 0 ? homeCurrentSpread : awayCurrentSpread)} is getting ${movementAbs} extra points\n✓ FADE PUBLIC: If public-driven, sharps likely on ${movingTowardTeam}\n✓ DUE DILIGENCE: Check injury reports and weather—this move has a reason`;
    } else {
      return `🚨 MAJOR MOVE (${movement > 0 ? '+' : ''}${movementAbs} pts)\n\n📊 Line Movement:\n${homeTeam}: ${formatSpread(homeOpenSpread)} → ${formatSpread(homeCurrentSpread)}\n${awayTeam}: ${formatSpread(awayOpenSpread)} → ${formatSpread(awayCurrentSpread)}\n\n⚡ What Happened:\n• ${gettingMorePoints} now getting ${movementAbs} MORE points\n• ${gettingFewerPoints} now giving up ${movementAbs} FEWER points\n• 🚨 This is NOT normal line movement 🚨\n\n🔍 Likely Causes:\n• Key Player Out: Star QB, top defender, critical starter\n• Sharp Syndicate: Professionals hammering ${movingAgainstTeam}\n• Weather Alert: Game conditions drastically changed\n• Inside Info: Market knows something you don't\n\n⚠️ CRITICAL ACTION REQUIRED:\n\n🛑 STOP: Do not bet without investigating\n\n🔍 RESEARCH NOW:\n  • Injury reports and lineup changes\n  • Weather forecasts\n  • Beat writer Twitter feeds\n  • Sharp betting percentages\n\n💰 VALUE OPPORTUNITY:\n${movingTowardTeam} at ${formatSpread(movement > 0 ? homeCurrentSpread : awayCurrentSpread)} may offer tremendous value (${movementAbs} extra points) if the move is an overreaction.\n\n⚠️ RESPECT THE MOVE:\nIf sharp money caused this, betting ${movingAgainstTeam} means fighting professional action. Proceed with extreme caution.\n\n💡 BEST PLAY:\nIf no significant news surfaces and you trust your model, ${movingTowardTeam} is getting exceptional closing line value with an extra ${movementAbs} points.`;
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
            <WagerBotInsightPill game={game} sport="cfb" />
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
              {game.conference && (
                <Chip style={{ height: 22 }} textStyle={{ fontSize: 9 }}>
                  {game.conference}
                </Chip>
              )}
            </View>

            <View style={styles.teamsRow}>
              {/* Away Team */}
              <View style={styles.teamSection}>
                <LinearGradient
                  colors={[awayColors.primary, awayColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.teamCircleLarge, { borderColor: awayColors.primary }]}
                >
                  <Text style={[
                    styles.teamInitialsLarge,
                    { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }
                  ]}>
                    {getCFBTeamInitials(game.away_team)}
                  </Text>
                </LinearGradient>
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                  {game.away_team}
                </Text>
                <View style={styles.teamLines}>
                  {game.away_spread !== null && (
                    <View style={[styles.linePill, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                      <Text style={[styles.lineValue, { color: '#22c55e' }]}>
                        {formatSpread(game.away_spread)}
                      </Text>
                    </View>
                  )}
                  {game.away_ml !== null && (
                    <View style={[styles.linePill, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                      <Text style={[styles.lineValue, { color: '#3b82f6' }]}>
                        {formatMoneyline(game.away_ml)}
                      </Text>
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
                <LinearGradient
                  colors={[homeColors.primary, homeColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.teamCircleLarge, { borderColor: homeColors.primary }]}
                >
                  <Text style={[
                    styles.teamInitialsLarge,
                    { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }
                  ]}>
                    {getCFBTeamInitials(game.home_team)}
                  </Text>
                </LinearGradient>
                <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                  {game.home_team}
                </Text>
                <View style={styles.teamLines}>
                  {game.home_spread !== null && (
                    <View style={[styles.linePill, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                      <Text style={[styles.lineValue, { color: '#22c55e' }]}>
                        {formatSpread(game.home_spread)}
                      </Text>
                    </View>
                  )}
                  {game.home_ml !== null && (
                    <View style={[styles.linePill, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                      <Text style={[styles.lineValue, { color: '#3b82f6' }]}>
                        {formatMoneyline(game.home_ml)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            </View>
          </View>

          {/* Weather Widget */}
          {(game.temperature !== null || game.wind_speed !== null) && (
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
              <View style={styles.weatherWidget}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="weather-partly-cloudy" size={20} color="#3b82f6" />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Weather Conditions
                </Text>
              </View>
              <View style={[styles.weatherContent, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                {game.temperature !== null && (
                  <View style={styles.weatherItem}>
                    <MaterialCommunityIcons name="thermometer" size={16} color="#3b82f6" />
                    <Text style={[styles.weatherText, { color: theme.colors.onSurfaceVariant }]}>
                      {Math.round(game.temperature)}°F
                    </Text>
                  </View>
                )}
                {game.wind_speed !== null && (
                  <View style={styles.weatherItem}>
                    <MaterialCommunityIcons name="weather-windy" size={16} color="#3b82f6" />
                    <Text style={[styles.weatherText, { color: theme.colors.onSurfaceVariant }]}>
                      {Math.round(game.wind_speed)} mph
                    </Text>
                  </View>
                )}
                {game.precipitation !== null && game.precipitation > 0 && (
                  <View style={styles.weatherItem}>
                    <MaterialCommunityIcons name="weather-rainy" size={16} color="#3b82f6" />
                    <Text style={[styles.weatherText, { color: theme.colors.onSurfaceVariant }]}>
                      {Math.round(game.precipitation)}%
                    </Text>
                  </View>
                )}
              </View>
              </View>
            </View>
          )}

          {/* Polymarket Widget */}
          <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
            <View style={styles.sectionContent}>
              <PolymarketWidget
                awayTeam={game.away_team}
                homeTeam={game.home_team}
                gameDate={game.game_date}
                awayTeamColors={awayColors}
                homeTeamColors={homeColors}
                league="cfb"
              />
            </View>
          </View>

          {/* Spread Prediction */}
          {spreadPrediction && (
            <View>
              <Pressable 
                onPress={handleSpreadTap}
                style={({ pressed }) => [
                  { opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
                  <View style={styles.predictionCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons name="target" size={20} color="#22c55e" />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                      Spread Prediction
                    </Text>
                    <View style={styles.tapHintContainer}>
                      <MaterialCommunityIcons 
                        name="information-outline" 
                        size={16} 
                        color={theme.colors.onSurfaceVariant}
                      />
                      <Text style={[styles.tapHintText, { color: theme.colors.onSurfaceVariant }]}>
                        Tap for Explanation
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.predictionContent, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                    <View style={styles.edgeRow}>
                      <View style={styles.edgeSection}>
                        <Text style={[styles.edgeLabel, { color: theme.colors.onSurfaceVariant }]}>
                          Edge to {getCFBTeamInitials(spreadPrediction.predictedTeam)}
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
                            {getCFBTeamInitials(spreadPrediction.predictedTeam)}
                          </Text>
                        </LinearGradient>
                      </View>
                      <View style={styles.edgeSection}>
                        <Text style={[styles.edgeLabel, { color: theme.colors.onSurfaceVariant }]}>
                          Model Spread
                        </Text>
                        <Text style={[styles.edgeValue, { color: theme.colors.onSurface }]}>
                          {spreadPrediction.predictedSpread ? (spreadPrediction.predictedSpread > 0 ? `+${spreadPrediction.predictedSpread.toFixed(1)}` : spreadPrediction.predictedSpread.toFixed(1)) : '-'}
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

              {/* What This Means - Spread */}
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
                  <View style={[styles.explanationBox, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.25)' }]}>
                    <View style={styles.explanationHeader}>
                      <MaterialCommunityIcons name="information" size={16} color="#22c55e" />
                      <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
                        What This Means
                      </Text>
                    </View>
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                      {getSpreadExplanation()}
                    </Text>
                  </View>
                </MotiView>
              )}
            </View>
          )}

          {/* Over/Under Prediction */}
          {ouPrediction && (
            <View>
              <Pressable 
                onPress={handleOuTap}
                style={({ pressed }) => [
                  { opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
                  <View style={styles.predictionCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons 
                      name={ouPrediction.predictedOutcome === 'over' ? 'arrow-up-bold' : 'arrow-down-bold'} 
                      size={20} 
                      color={ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444'} 
                    />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                      Over/Under Prediction
                    </Text>
                    <View style={styles.tapHintContainer}>
                      <MaterialCommunityIcons 
                        name="information-outline" 
                        size={16} 
                        color={theme.colors.onSurfaceVariant}
                      />
                      <Text style={[styles.tapHintText, { color: theme.colors.onSurfaceVariant }]}>
                        Tap for Explanation
                      </Text>
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

              {/* What This Means - O/U */}
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
                  <View style={[
                    styles.explanationBox, 
                    { 
                      backgroundColor: ouPrediction.predictedOutcome === 'over' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      borderColor: ouPrediction.predictedOutcome === 'over' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'
                    }
                  ]}>
                    <View style={styles.explanationHeader}>
                      <MaterialCommunityIcons 
                        name="information" 
                        size={16} 
                        color={ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444'} 
                      />
                      <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
                        What This Means
                      </Text>
                    </View>
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                      {getOuExplanation()}
                    </Text>
                  </View>
                </MotiView>
              )}
            </View>
          )}

          {/* Public Betting Bars */}
          {(game.ml_splits_label || game.spread_splits_label || game.total_splits_label) && (
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
              <View style={styles.sectionContent}>
                <PublicBettingBars
                  mlSplitsLabel={game.ml_splits_label}
                  spreadSplitsLabel={game.spread_splits_label}
                  totalSplitsLabel={game.total_splits_label}
                  homeTeam={game.home_team}
                  awayTeam={game.away_team}
                />
              </View>
            </View>
          )}

          {/* Line Movement - Simple Open → Current Display */}
          <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
            <View style={styles.sectionContent}>
              <Pressable 
                onPress={handleLineMovementTap}
                style={({ pressed }) => [
                  { opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <View>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="chart-line" size={20} color="#10b981" />
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    Line Movement
                  </Text>
                  <View style={styles.tapHintContainer}>
                    <MaterialCommunityIcons 
                      name="information-outline" 
                      size={16} 
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text style={[styles.tapHintText, { color: theme.colors.onSurfaceVariant }]}>
                      Tap for Explanation
                    </Text>
                  </View>
                </View>

                {/* Spread Movement Only */}
                <View style={[styles.lineMovementCard, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                  <Text style={[styles.lineMovementLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Spread
                  </Text>
                  <View style={styles.lineMovementRow}>
                    <View style={[styles.linePillLarge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                      <Text style={[styles.linePillSmallLabel, { color: theme.colors.onSurfaceVariant }]}>Open</Text>
                      <Text style={[styles.linePillValue, { color: '#3b82f6' }]}>
                        {openingLine?.spread ? formatSpread(openingLine.spread) : '-'}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={24} color={theme.colors.onSurfaceVariant} />
                    <View style={[styles.linePillLarge, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                      <Text style={[styles.linePillSmallLabel, { color: theme.colors.onSurfaceVariant }]}>Current</Text>
                      <Text style={[styles.linePillValue, { color: '#22c55e' }]}>
                        {currentLine?.spread ? formatSpread(currentLine.spread) : '-'}
                      </Text>
                    </View>
                  </View>
                </View>
                </View>
              </Pressable>

              {/* What This Means - Line Movement */}
              {lineMovementExplanationExpanded && (
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
                  <View style={[styles.explanationBox, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.25)' }]}>
                    <View style={styles.explanationHeader}>
                      <MaterialCommunityIcons name="information" size={16} color="#22c55e" />
                      <Text style={[styles.explanationTitle, { color: theme.colors.onSurface }]}>
                        What This Means
                      </Text>
                    </View>
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                      {getLineMovementExplanation()}
                    </Text>
                  </View>
                </MotiView>
              )}
            </View>
          </View>

          {/* Match Simulator Section */}
          {(() => {
            const awayScore = game.pred_away_points ?? game.pred_away_score;
            const homeScore = game.pred_home_points ?? game.pred_home_score;
            console.log('CFB Simulator data:', {
              away_team: game.away_team,
              home_team: game.home_team,
              pred_away_points: game.pred_away_points,
              pred_away_score: game.pred_away_score,
              pred_home_points: game.pred_home_points,
              pred_home_score: game.pred_home_score,
              awayScore,
              homeScore
            });
            
            return (awayScore !== null && awayScore !== undefined) && 
                   (homeScore !== null && homeScore !== undefined) && (
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
                        {getCFBTeamInitials(game.away_team)}
                      </Text>
                    </LinearGradient>
                    <Text style={[styles.predictedScore, { color: theme.colors.onSurface }]}>
                      {Math.round(Number(awayScore))}
                    </Text>
                  </View>

                  {/* VS Separator */}
                  <View style={styles.vsSeparator}>
                    <Text style={[styles.vsTextSimulator, { color: theme.colors.onSurfaceVariant }]}>VS</Text>
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
                        {getCFBTeamInitials(game.home_team)}
                      </Text>
                    </LinearGradient>
                    <Text style={[styles.predictedScore, { color: theme.colors.onSurface }]}>
                      {Math.round(Number(homeScore))}
                    </Text>
                  </View>
                  </View>
                )}
              </View>
              </View>
            );
          })()}

          {/* Bottom Padding */}
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
  contentContainer: {
    padding: 16,
  },
  sectionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  headerContent: {
    padding: 12,
  },
  sectionContent: {
    padding: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 24,
  },
  teamSection: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  teamCircleLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  teamInitialsLarge: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    maxWidth: 76,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamLines: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  linePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  lineValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  vsText: {
    fontSize: 24,
    fontWeight: '600',
  },
  totalPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  totalText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weatherWidget: {
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  tapHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tapHintText: {
    fontSize: 11,
    fontWeight: '500',
  },
  weatherContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    borderRadius: 8,
  },
  weatherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherText: {
    fontSize: 13,
    fontWeight: '500',
  },
  predictionCard: {
    padding: 12,
  },
  predictionContent: {
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  predictionTeamCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  predictionTeamInitials: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  predictionTeamText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  predictionSpread: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  predictionProb: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  ouPredictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ouPredictionText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  explanationBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  confidenceBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceContainer: {
    width: '100%',
  },
  edgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  edgeSection: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  edgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  edgeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  edgeWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ouEdgeColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
  },
  edgeTeamCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  edgeTeamInitials: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    maxWidth: 50,
  },
  vsVegasContainer: {
    marginTop: 12,
    alignItems: 'center',
    gap: 4,
  },
  vsVegasLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vsVegasValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  lineMovementCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  lineMovementLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  lineMovementRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 12,
  },
  linePillLarge: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  linePillSmallLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  linePillValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  simulateButtonContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  simulateButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 200,
    alignItems: 'center',
  },
  simulateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  simulatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simulationResult: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  teamScoreSection: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  scoreTeamCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  scoreTeamInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  predictedScore: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  vsSeparator: {
    paddingHorizontal: 16,
  },
  vsTextSimulator: {
    fontSize: 16,
    fontWeight: 'bold',
  },
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

