import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LiveGame } from '@/types/liveScores';

interface LiveScoreCardProps {
  game: LiveGame;
}

export function LiveScoreCard({ game }: LiveScoreCardProps) {
  const theme = useTheme();

  const getStatusColor = () => {
    if (game.predictions?.hasAnyHitting) {
      return '#16A34A'; // Green for hitting
    }
    return theme.colors.onSurfaceVariant;
  };

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.content}>
        {/* League Badge */}
        <View style={[styles.leagueBadge, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={[styles.leagueText, { color: theme.colors.onPrimaryContainer }]}>
            {game.league}
          </Text>
        </View>

        {/* Teams and Scores */}
        <View style={styles.teamsContainer}>
          {/* Away Team */}
          <View style={styles.teamRow}>
            <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {game.away_abbr}
            </Text>
            <Text style={[styles.score, { color: theme.colors.onSurface }]}>
              {game.away_score}
            </Text>
          </View>

          {/* Home Team */}
          <View style={styles.teamRow}>
            <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {game.home_abbr}
            </Text>
            <Text style={[styles.score, { color: theme.colors.onSurface }]}>
              {game.home_score}
            </Text>
          </View>
        </View>

        {/* Game Status */}
        <View style={styles.statusContainer}>
          <Text style={[styles.quarter, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {game.quarter}
          </Text>
          {game.time_remaining && (
            <Text style={[styles.time, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
              {game.time_remaining}
            </Text>
          )}
        </View>

        {/* Prediction Status Indicator */}
        {game.predictions?.hasAnyHitting && (
          <View style={styles.hittingIndicator}>
            <MaterialCommunityIcons 
              name="check-circle" 
              size={16} 
              color={getStatusColor()} 
            />
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 140,
    maxWidth: 160,
    marginHorizontal: 4,
    elevation: 2,
  },
  content: {
    padding: 8,
  },
  leagueBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  leagueText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  teamsContainer: {
    gap: 4,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamAbbr: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  score: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statusContainer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 2,
  },
  quarter: {
    fontSize: 10,
    fontWeight: '500',
  },
  time: {
    fontSize: 9,
  },
  hittingIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});

