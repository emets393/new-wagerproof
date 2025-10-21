import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
import { getNFLTeamColors, getFullTeamName } from '@/utils/teamColors';

interface NFLGameCardProps {
  game: NFLPrediction;
}

export function NFLGameCard({ game }: NFLGameCardProps) {
  const theme = useTheme();
  const awayColors = getNFLTeamColors(game.away_team);
  const homeColors = getNFLTeamColors(game.home_team);
  const awayTeamFull = getFullTeamName(game.away_team);
  const homeTeamFull = getFullTeamName(game.home_team);

  return (
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

        {/* Teams */}
        <View style={styles.teamsRow}>
          {/* Away Team */}
          <View style={styles.teamColumn}>
            <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {awayTeamFull}
            </Text>
            <Text style={[styles.spreadText, { color: theme.colors.onSurfaceVariant }]}>
              {formatSpread(game.away_spread)}
            </Text>
            <Text style={[styles.mlText, { color: '#2563EB' }]}>
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
            <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {homeTeamFull}
            </Text>
            <Text style={[styles.spreadText, { color: theme.colors.onSurfaceVariant }]}>
              {formatSpread(game.home_spread)}
            </Text>
            <Text style={[styles.mlText, { color: '#16A34A' }]}>
              {formatMoneyline(game.home_ml)}
            </Text>
          </View>
        </View>

        {/* Model Probabilities */}
        {(game.home_away_ml_prob !== null || game.home_away_spread_cover_prob !== null || game.ou_result_prob !== null) && (
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
      </Card.Content>
    </Card>
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
  teamName: {
    fontSize: 14,
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
});

