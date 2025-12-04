import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Card, useTheme, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NCAABGame } from '@/types/ncaab';
import { 
  formatMoneyline, 
  formatSpread, 
  convertTimeToEST, 
  formatCompactDate,
  roundToNearestHalf 
} from '@/utils/formatting';
import { getCFBTeamColors, getNCAABTeamInitials, getContrastingTextColor } from '@/utils/teamColors';

interface NCAABGameCardProps {
  game: NCAABGame;
  onPress: () => void;
}

export function NCAABGameCard({ game, onPress }: NCAABGameCardProps) {
  const theme = useTheme();
  // Reuse CFB team colors for NCAAB (same schools)
  const awayColors = getCFBTeamColors(game.away_team);
  const homeColors = getCFBTeamColors(game.home_team);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  // Determine model predictions for pills based on probabilities
  const mlPrediction = game.home_away_ml_prob !== null && game.home_away_ml_prob !== undefined ? {
    team: game.home_away_ml_prob >= 0.5 ? game.home_team : game.away_team,
    isHome: game.home_away_ml_prob >= 0.5,
    prob: game.home_away_ml_prob >= 0.5 ? game.home_away_ml_prob : (1 - game.home_away_ml_prob),
  } : null;

  // Spread prediction
  const spreadPrediction = game.home_away_spread_cover_prob !== null && game.home_away_spread_cover_prob !== undefined ? {
    team: game.home_away_spread_cover_prob >= 0.5 ? game.home_team : game.away_team,
    isHome: game.home_away_spread_cover_prob >= 0.5,
    prob: game.home_away_spread_cover_prob >= 0.5 ? game.home_away_spread_cover_prob : (1 - game.home_away_spread_cover_prob),
  } : null;

  // O/U prediction
  const ouPrediction = game.ou_result_prob !== null && game.ou_result_prob !== undefined ? {
    direction: game.ou_result_prob > 0.5 ? 'Over' : 'Under',
    prob: game.ou_result_prob > 0.5 ? game.ou_result_prob : (1 - game.ou_result_prob),
  } : null;

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
          {/* Date, Time, and Context Badges */}
          <View style={styles.dateContainer}>
            <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
              {formatCompactDate(game.game_date)}
            </Text>
            <View style={[styles.timeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                {convertTimeToEST(game.game_time)}
              </Text>
            </View>
            {game.conference_game && (
              <Chip style={{ height: 22 }} textStyle={{ fontSize: 9 }}>
                Conf
              </Chip>
            )}
            {game.neutral_site && (
              <Chip style={{ height: 22 }} textStyle={{ fontSize: 9 }}>
                Neutral
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
                  {getNCAABTeamInitials(game.away_team)}
                </Text>
              </LinearGradient>
              {/* Ranking Badge */}
              {game.away_ranking && game.away_ranking <= 25 && (
                <View style={[styles.rankingBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.rankingText}>#{game.away_ranking}</Text>
                </View>
              )}
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
                  {getNCAABTeamInitials(game.home_team)}
                </Text>
              </LinearGradient>
              {/* Ranking Badge */}
              {game.home_ranking && game.home_ranking <= 25 && (
                <View style={[styles.rankingBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.rankingText}>#{game.home_ranking}</Text>
                </View>
              )}
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
                      {getNCAABTeamInitials(mlPrediction.team)} {Math.round(mlPrediction.prob * 100)}%
                    </Text>
                  </View>
                )}
                {spreadPrediction && (
                  <View style={[styles.bettingPill, { 
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    borderColor: 'rgba(34, 197, 94, 0.3)'
                  }]}>
                    <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>Spread</Text>
                    <Text style={[styles.pillValue, { color: '#22c55e' }]} numberOfLines={1}>
                      {getNCAABTeamInitials(spreadPrediction.team)} {Math.round(spreadPrediction.prob * 100)}%
                    </Text>
                  </View>
                )}
                {ouPrediction && (
                  <View style={[styles.bettingPill, { 
                    backgroundColor: 'rgba(249, 115, 22, 0.15)',
                    borderColor: 'rgba(249, 115, 22, 0.3)'
                  }]}>
                    <Text style={[styles.pillLabel, { color: theme.colors.onSurfaceVariant }]}>O/U</Text>
                    <Text style={[styles.pillValue, { color: '#f97316' }]}>
                      {ouPrediction.direction} {ouPrediction.direction === 'Over' ? '↑' : '↓'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Predicted Score if available */}
          {(game.pred_home_margin != null || game.pred_total_points != null) && (
            <View style={styles.predictedScoreContainer}>
              <Text style={[styles.predictedScoreLabel, { color: theme.colors.onSurfaceVariant }]}>
                {game.pred_home_margin != null && `Predicted: ${game.home_team} by ${Math.abs(game.pred_home_margin).toFixed(1)}`}
                {game.pred_home_margin != null && game.pred_total_points != null && ' | '}
                {game.pred_total_points != null && `Total: ${game.pred_total_points.toFixed(1)}`}
              </Text>
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
  rankingBadge: {
    position: 'absolute',
    top: -4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 28,
    alignItems: 'center',
  },
  rankingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
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
  bettingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 80,
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
  predictedScoreContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  predictedScoreLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});

