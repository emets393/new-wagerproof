import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, useTheme, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CFBPrediction } from '@/types/cfb';
import { 
  formatMoneyline, 
  formatSpread, 
  convertTimeToEST, 
  formatCompactDate,
  roundToNearestHalf 
} from '@/utils/formatting';

interface CFBGameCardProps {
  game: CFBPrediction;
}

export function CFBGameCard({ game }: CFBGameCardProps) {
  const theme = useTheme();

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
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

        {/* Teams */}
        <View style={styles.teamsRow}>
          {/* Away Team */}
          <View style={styles.teamColumn}>
            <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
              {game.away_team}
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
            <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
              {game.home_team}
            </Text>
            <Text style={[styles.spreadText, { color: theme.colors.onSurfaceVariant }]}>
              {formatSpread(game.home_spread)}
            </Text>
            <Text style={[styles.mlText, { color: '#16A34A' }]}>
              {formatMoneyline(game.home_ml)}
            </Text>
          </View>
        </View>

        {/* Model Edge Indicators */}
        {(game.home_spread_diff !== null || game.over_line_diff !== null) && (
          <View style={styles.edgeSection}>
            <View style={[styles.edgeRow, { backgroundColor: theme.colors.surfaceVariant }]}>
              {game.home_spread_diff !== null && game.home_spread_diff !== undefined && (
                <View style={styles.edgeItem}>
                  <MaterialCommunityIcons name="target" size={14} color="#16A34A" />
                  <Text style={[styles.edgeText, { color: theme.colors.onSurfaceVariant }]}>
                    Spread Edge: {Math.abs(Number(game.home_spread_diff)).toFixed(1)}
                  </Text>
                </View>
              )}
              {game.over_line_diff !== null && game.over_line_diff !== undefined && (
                <View style={styles.edgeItem}>
                  <MaterialCommunityIcons name="chart-bar" size={14} color="#F59E0B" />
                  <Text style={[styles.edgeText, { color: theme.colors.onSurfaceVariant }]}>
                    O/U Edge: {Math.abs(Number(game.over_line_diff)).toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Predicted Scores */}
        {(game.pred_away_score !== null && game.pred_home_score !== null && 
          game.pred_away_score !== undefined && game.pred_home_score !== undefined) && (
          <View style={styles.scoreSection}>
            <Text style={[styles.scoreLabel, { color: theme.colors.onSurfaceVariant }]}>
              Predicted Score:
            </Text>
            <Text style={[styles.scorePredict, { color: theme.colors.primary }]}>
              {Math.round(Number(game.pred_away_score))} - {Math.round(Number(game.pred_home_score))}
            </Text>
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
    gap: 4,
  },
  teamName: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    minHeight: 32,
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
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  scorePredict: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});

