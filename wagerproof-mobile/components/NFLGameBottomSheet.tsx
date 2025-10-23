import React, { forwardRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NFLPrediction } from '@/types/nfl';
import { getNFLTeamColors, getTeamParts, getTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { formatCompactDate, convertTimeToEST, formatMoneyline, formatSpread, roundToNearestHalf } from '@/utils/formatting';
import { parseBettingSplit, getBettingColorTheme, getThemeColors } from '@/utils/nflDataFetchers';
import { PublicBettingBars } from './nfl/PublicBettingBars';
import { H2HSection } from './nfl/H2HSection';
import { LineMovementSection } from './nfl/LineMovementSection';

interface NFLGameBottomSheetProps {
  game: NFLPrediction | null;
  onClose: () => void;
}

export const NFLGameBottomSheet = forwardRef<BottomSheet, NFLGameBottomSheetProps>(
  ({ game, onClose }, ref) => {
    const theme = useTheme();
    const snapPoints = useMemo(() => ['90%', '100%'], []);

    if (!game) return null;

    const awayColors = getNFLTeamColors(game.away_team);
    const homeColors = getNFLTeamColors(game.home_team);
    const awayTeamParts = getTeamParts(game.away_team);
    const homeTeamParts = getTeamParts(game.home_team);

    // Determine predictions
    const spreadPrediction = game.home_away_spread_cover_prob !== null && game.home_away_spread_cover_prob !== undefined ? {
      probability: game.home_away_spread_cover_prob >= 0.5 ? game.home_away_spread_cover_prob : 1 - game.home_away_spread_cover_prob,
      predictedTeam: game.home_away_spread_cover_prob >= 0.5 ? game.home_team : game.away_team,
      predictedSpread: game.home_away_spread_cover_prob >= 0.5 ? game.home_spread : game.away_spread,
      teamColors: game.home_away_spread_cover_prob >= 0.5 ? homeColors : awayColors,
      confidence: game.home_away_spread_cover_prob >= 0.5 ? 'high' as const : game.home_away_spread_cover_prob >= 0.4 ? 'medium' as const : 'low' as const,
    } : null;

    const ouPrediction = game.ou_result_prob !== null && game.ou_result_prob !== undefined ? {
      probability: game.ou_result_prob >= 0.5 ? game.ou_result_prob : 1 - game.ou_result_prob,
      predictedOutcome: game.ou_result_prob >= 0.5 ? 'over' as const : 'under' as const,
      line: game.over_line,
      confidence: game.ou_result_prob >= 0.5 ? 'high' as const : game.ou_result_prob >= 0.4 ? 'medium' as const : 'low' as const,
    } : null;

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
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
      >
        <BottomSheetScrollView 
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Teams */}
          <View style={styles.header}>
            <LinearGradient
              colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.headerGradient}
            />

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
              </View>

              <Text style={[styles.vsText, { color: theme.colors.outlineVariant }]}>@</Text>

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
              </View>
            </View>
          </View>

          {/* Weather Widget */}
          {(game.temperature !== null || game.wind_speed !== null) && (
            <View style={[styles.weatherWidget, { backgroundColor: 'rgba(147, 197, 253, 0.15)', borderColor: 'rgba(147, 197, 253, 0.3)' }]}>
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
          )}

          {/* Spread Prediction */}
          {spreadPrediction && (
            <View style={[styles.predictionCard, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="target" size={20} color="#22c55e" />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Spread Prediction
                </Text>
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
                <Text style={[styles.predictionProb, { color: '#22c55e' }]}>
                  {(spreadPrediction.probability * 100).toFixed(1)}% confidence
                </Text>
              </View>
            </View>
          )}

          {/* Over/Under Prediction */}
          {ouPrediction && (
            <View style={[
              styles.predictionCard,
              { 
                backgroundColor: ouPrediction.predictedOutcome === 'over' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                borderColor: ouPrediction.predictedOutcome === 'over' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
              }
            ]}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons 
                  name={ouPrediction.predictedOutcome === 'over' ? 'arrow-up-bold' : 'arrow-down-bold'} 
                  size={20} 
                  color={ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444'} 
                />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Over/Under Prediction
                </Text>
              </View>
              <View style={[styles.predictionContent, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                <Text style={[
                  styles.ouPredictionText,
                  { color: ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444' }
                ]}>
                  {ouPrediction.predictedOutcome === 'over' ? 'OVER' : 'UNDER'} {ouPrediction.line ? roundToNearestHalf(ouPrediction.line) : '-'}
                </Text>
                <Text style={[
                  styles.predictionProb,
                  { color: ouPrediction.predictedOutcome === 'over' ? '#22c55e' : '#ef4444' }
                ]}>
                  {(ouPrediction.probability * 100).toFixed(1)}% confidence
                </Text>
              </View>
            </View>
          )}

          {/* Public Betting Bars */}
          {(game.ml_splits_label || game.spread_splits_label || game.total_splits_label) && (
            <PublicBettingBars
              mlSplitsLabel={game.ml_splits_label}
              spreadSplitsLabel={game.spread_splits_label}
              totalSplitsLabel={game.total_splits_label}
              homeTeam={game.home_team}
              awayTeam={game.away_team}
            />
          )}

          {/* H2H History */}
          <H2HSection homeTeam={game.home_team} awayTeam={game.away_team} />

          {/* Line Movement */}
          <LineMovementSection 
            trainingKey={game.training_key} 
            homeTeam={game.home_team}
            awayTeam={game.away_team}
          />

          {/* Bottom Padding */}
          <View style={{ height: 40 }} />
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  contentContainer: {
    padding: 16,
  },
  header: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
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
  vsText: {
    fontSize: 24,
    fontWeight: '600',
  },
  weatherWidget: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
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
  ouPredictionText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

