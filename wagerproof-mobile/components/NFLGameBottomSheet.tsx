import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { NFLPrediction } from '@/types/nfl';
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { getNFLTeamColors, getTeamParts, getTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { formatCompactDate, convertTimeToEST, formatMoneyline, formatSpread, roundToNearestHalf } from '@/utils/formatting';
import { parseBettingSplit, getBettingColorTheme, getThemeColors } from '@/utils/nflDataFetchers';
import { PublicBettingBars } from './nfl/PublicBettingBars';
import { H2HSection } from './nfl/H2HSection';
import { LineMovementSection } from './nfl/LineMovementSection';
import { PolymarketWidget } from './PolymarketWidget';
import { WagerBotInsightPill } from './WagerBotInsightPill';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';

export function NFLGameBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { selectedGame: game, closeGameSheet, bottomSheetRef } = useNFLGameSheet();
  const { onModelDetailsTap, isDetached } = useWagerBotSuggestion();
  const snapPoints = useMemo(() => ['85%', '95%'], []);
  const [spreadExplanationExpanded, setSpreadExplanationExpanded] = useState(false);
  const [ouExplanationExpanded, setOuExplanationExpanded] = useState(false);

  const handleSpreadTap = () => {
    console.log('Spread tap triggered, current state:', spreadExplanationExpanded);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpreadExplanationExpanded(!spreadExplanationExpanded);
    // Notify floating assistant if in detached mode
    if (isDetached && !spreadExplanationExpanded) {
      onModelDetailsTap();
    }
  };

  const handleOuTap = () => {
    console.log('O/U tap triggered, current state:', ouExplanationExpanded);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOuExplanationExpanded(!ouExplanationExpanded);
    // Notify floating assistant if in detached mode
    if (isDetached && !ouExplanationExpanded) {
      onModelDetailsTap();
    }
  };

  // Always render the bottom sheet, just return empty content if no game
  const awayColors = game ? getNFLTeamColors(game.away_team) : { primary: '#000', secondary: '#000' };
  const homeColors = game ? getNFLTeamColors(game.home_team) : { primary: '#000', secondary: '#000' };
  const awayTeamParts = game ? getTeamParts(game.away_team) : { city: '', name: '' };
  const homeTeamParts = game ? getTeamParts(game.home_team) : { city: '', name: '' };

  // Determine predictions
  const spreadPrediction = game && game.home_away_spread_cover_prob !== null && game.home_away_spread_cover_prob !== undefined ? {
    probability: game.home_away_spread_cover_prob >= 0.5 ? game.home_away_spread_cover_prob : 1 - game.home_away_spread_cover_prob,
    predictedTeam: game.home_away_spread_cover_prob >= 0.5 ? game.home_team : game.away_team,
    predictedSpread: game.home_away_spread_cover_prob >= 0.5 ? game.home_spread : game.away_spread,
    teamColors: game.home_away_spread_cover_prob >= 0.5 ? homeColors : awayColors,
    confidence: game.home_away_spread_cover_prob >= 0.5 ? 'high' as const : game.home_away_spread_cover_prob >= 0.4 ? 'medium' as const : 'low' as const,
    isFadeAlert: (game.home_away_spread_cover_prob >= 0.5 ? game.home_away_spread_cover_prob : 1 - game.home_away_spread_cover_prob) >= 0.8,
  } : null;

  const ouPrediction = game && game.ou_result_prob !== null && game.ou_result_prob !== undefined ? {
    probability: game.ou_result_prob >= 0.5 ? game.ou_result_prob : 1 - game.ou_result_prob,
    predictedOutcome: game.ou_result_prob >= 0.5 ? 'over' as const : 'under' as const,
    line: game.over_line,
    confidence: game.ou_result_prob >= 0.5 ? 'high' as const : game.ou_result_prob >= 0.4 ? 'medium' as const : 'low' as const,
    isFadeAlert: (game.ou_result_prob >= 0.5 ? game.ou_result_prob : 1 - game.ou_result_prob) >= 0.8,
  } : null;

  // Explanation generators
  const getSpreadExplanation = () => {
    if (!spreadPrediction || !game) return '';
    const prob = (spreadPrediction.probability * 100).toFixed(1);
    const team = spreadPrediction.predictedTeam;
    const spread = formatSpread(spreadPrediction.predictedSpread);
    
    if (spreadPrediction.probability < 0.55) {
      return `Our model shows a ${prob}% confidence that ${team} will cover the ${spread} spread. This is a tight matchup where the model sees only a slight edge, suggesting the betting line is efficient and both sides have near-equal value.`;
    } else if (spreadPrediction.probability < 0.65) {
      return `Our model projects ${team} to cover ${spread} with ${prob}% confidence. This moderate edge suggests our analytics identify a meaningful advantage that differs from the market's assessment of this matchup.`;
    } else {
      return `Our model strongly favors ${team} to cover ${spread} with ${prob}% confidence. This significant edge indicates our projections see this team performing notably better relative to the spread than the current betting line suggests.`;
    }
  };

  const getOuExplanation = () => {
    if (!ouPrediction || !game) return '';
    const prob = (ouPrediction.probability * 100).toFixed(1);
    const direction = ouPrediction.predictedOutcome.toUpperCase();
    const line = ouPrediction.line ? roundToNearestHalf(ouPrediction.line) : '-';
    
    if (ouPrediction.probability < 0.55) {
      return `Our model predicts the ${direction} ${line} with ${prob}% confidence. This is a close call where the projected total is near the betting line, indicating the market has priced this game's scoring potential efficiently.`;
    } else if (ouPrediction.probability < 0.65) {
      return `Our model projects a moderate ${prob}% confidence on the ${direction} ${line}. This suggests our analytics see a meaningful difference in how this game's scoring will unfold compared to the current total line.`;
    } else {
      return `Our model strongly predicts the ${direction} ${line} with ${prob}% confidence. This significant edge indicates our projections expect the game's total score to differ substantially from what the betting market anticipates.`;
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
            <WagerBotInsightPill game={game} sport="nfl" />
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
                    {getTeamInitials(game.away_team)}
                  </Text>
                </LinearGradient>
                <Text style={[styles.teamCity, { color: theme.colors.onSurface }]}>
                  {awayTeamParts.city}
                </Text>
                <Text style={[styles.teamName, { color: theme.colors.onSurfaceVariant }]}>
                  {awayTeamParts.name}
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
                    {getTeamInitials(game.home_team)}
                  </Text>
                </LinearGradient>
                <Text style={[styles.teamCity, { color: theme.colors.onSurface }]}>
                  {homeTeamParts.city}
                </Text>
                <Text style={[styles.teamName, { color: theme.colors.onSurfaceVariant }]}>
                  {homeTeamParts.name}
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
                league="nfl"
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
                    <View style={styles.predictionRow}>
                      <LinearGradient
                        colors={[spreadPrediction.teamColors.primary, spreadPrediction.teamColors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.predictionTeamCircle}
                      >
                        <Text style={[
                          styles.predictionTeamInitials,
                          { color: getContrastingTextColor(spreadPrediction.teamColors.primary, spreadPrediction.teamColors.secondary) }
                        ]}>
                          {getTeamInitials(spreadPrediction.predictedTeam)}
                        </Text>
                      </LinearGradient>
                      <Text style={[styles.predictionTeamText, { color: theme.colors.onSurface }]}>
                        {spreadPrediction.predictedTeam}
                      </Text>
                      <Text style={[styles.predictionSpread, { color: '#22c55e' }]}>
                        {formatSpread(spreadPrediction.predictedSpread)}
                      </Text>
                    </View>
                    <View style={styles.confidenceContainer}>
                      <View style={styles.confidenceBarBackground}>
                        <View style={[
                          styles.confidenceBarFill,
                          { 
                            width: `${spreadPrediction.probability * 100}%`,
                            backgroundColor: '#22c55e'
                          }
                        ]} />
                      </View>
                      <Text style={[styles.predictionProb, { color: '#22c55e' }]}>
                        {(spreadPrediction.probability * 100).toFixed(1)}% confidence
                      </Text>
                    </View>
                    {/* Fade Alert Pill */}
                    {spreadPrediction?.isFadeAlert && (
                      <View style={[styles.fadeAlertPill, { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: 'rgba(34, 197, 94, 0.4)' }]}>
                        <MaterialCommunityIcons name="lightning-bolt" size={12} color="#22c55e" />
                        <Text style={[styles.fadeAlertPillText, { color: '#22c55e', marginLeft: 4 }]}>
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
                    <View style={styles.ouPredictionRow}>
                      <MaterialCommunityIcons 
                        name={ouPrediction.predictedOutcome === 'over' ? 'chevron-up' : 'chevron-down'} 
                        size={32} 
                        color={ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444'} 
                      />
                      <Text style={[
                        styles.ouPredictionText,
                        { color: ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444' }
                      ]}>
                        {ouPrediction.predictedOutcome === 'over' ? 'OVER' : 'UNDER'} {ouPrediction.line ? roundToNearestHalf(ouPrediction.line) : '-'}
                      </Text>
                    </View>
                    <View style={styles.confidenceContainer}>
                      <View style={styles.confidenceBarBackground}>
                        <View style={[
                          styles.confidenceBarFill,
                          { 
                            width: `${ouPrediction.probability * 100}%`,
                            backgroundColor: ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444'
                          }
                        ]} />
                      </View>
                      <Text style={[
                        styles.predictionProb,
                        { color: ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444' }
                      ]}>
                        {(ouPrediction.probability * 100).toFixed(1)}% confidence
                      </Text>
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

          {/* H2H History */}
          <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
            <View style={styles.sectionContent}>
              <H2HSection homeTeam={game.home_team} awayTeam={game.away_team} />
            </View>
          </View>

          {/* Line Movement */}
          <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
            <View style={styles.sectionContent}>
              <LineMovementSection 
                trainingKey={game.training_key} 
                homeTeam={game.home_team}
                awayTeam={game.away_team}
              />
            </View>
          </View>

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
  },
  teamCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  teamInitialsLarge: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  teamCity: {
    fontSize: 16,
    fontWeight: '600',
  },
  teamName: {
    fontSize: 14,
    fontWeight: '500',
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

