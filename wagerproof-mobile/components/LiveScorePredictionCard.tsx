import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LiveGame, PredictionStatus } from '@/types/liveScores';
import { 
  getNFLTeamColors, 
  getCFBTeamColors, 
  getNBATeamColors,
  getTeamInitials, 
  getCFBTeamInitials, 
  getNBATeamInitials,
  getNCAABTeamInitials,
  getContrastingTextColor 
} from '@/utils/teamColors';

interface LiveScorePredictionCardProps {
  game: LiveGame;
}

export function LiveScorePredictionCard({ game }: LiveScorePredictionCardProps) {
  const theme = useTheme();
  const { predictions } = game;

  // Helper to get team colors based on league
  const getTeamColors = (teamName: string) => {
    switch (game.league) {
      case 'NFL': return getNFLTeamColors(teamName);
      case 'CFB': return getCFBTeamColors(teamName);
      case 'NCAAF': return getCFBTeamColors(teamName);
      case 'NBA': return getNBATeamColors(teamName);
      case 'NCAAB': return getCFBTeamColors(teamName); // Reuse CFB colors for college
      default: return { primary: '#6B7280', secondary: '#9CA3AF' };
    }
  };

  // Helper to get initials based on league
  const getInitials = (teamName: string, abbr?: string) => {
    if (abbr) return abbr;
    switch (game.league) {
      case 'NFL': return getTeamInitials(teamName);
      case 'CFB': return getCFBTeamInitials(teamName);
      case 'NCAAF': return getCFBTeamInitials(teamName);
      case 'NBA': return getNBATeamInitials(teamName);
      case 'NCAAB': return getNCAABTeamInitials(teamName);
      default: return teamName.substring(0, 3).toUpperCase();
    }
  };

  const renderTeamCircle = (isHome: boolean) => {
    const teamName = isHome ? game.home_team : game.away_team;
    const abbr = isHome ? game.home_abbr : game.away_abbr;
    const colors = getTeamColors(teamName);
    const initials = getInitials(teamName, abbr);
    const textColor = getContrastingTextColor(colors.primary, colors.secondary);

    return (
      <View style={styles.teamCircleContainer}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.teamCircle}
        >
          <Text style={[styles.teamInitials, { color: textColor }]}>
            {initials}
          </Text>
        </LinearGradient>
        <Text style={[styles.teamName, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {teamName}
        </Text>
      </View>
    );
  };

  const renderPredictionRow = (
    label: string, 
    prediction?: PredictionStatus, 
    detail?: string
  ) => {
    if (!prediction) return null;

    const isHitting = prediction.isHitting;
    const hitColor = '#22D35F';
    const missColor = '#EF4444';
    const statusColor = isHitting ? hitColor : missColor;
    const bgColor = isHitting ? 'rgba(34, 211, 95, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    return (
      <View style={[styles.predictionRow, { backgroundColor: bgColor, borderColor: isHitting ? 'rgba(34, 211, 95, 0.3)' : 'rgba(239, 68, 68, 0.3)' }]}>
        <View style={styles.predictionHeader}>
          <MaterialCommunityIcons 
            name={isHitting ? "check-circle" : "close-circle"} 
            size={16} 
            color={statusColor} 
          />
          <View style={styles.predictionInfo}>
            <Text style={[styles.predictionType, { color: theme.colors.onSurface }]}>{label}</Text>
            <Text style={[styles.predictionValue, { color: theme.colors.onSurfaceVariant }]}>
              {detail}
            </Text>
          </View>
        </View>
        <View style={styles.predictionStatus}>
          <View style={styles.statusBadge}>
            <MaterialCommunityIcons 
              name={isHitting ? "trending-up" : "trending-down"} 
              size={12} 
              color={statusColor} 
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isHitting ? "Hitting" : "Not Hitting"}
            </Text>
          </View>
          <Text style={[styles.probabilityText, { color: theme.colors.onSurfaceVariant }]}>
            {(prediction.probability * 100).toFixed(0)}% Conf.
          </Text>
        </View>
      </View>
    );
  };

  const formatLine = (line?: number) => {
    if (line === undefined || line === null) return '';
    return line > 0 ? `+${line}` : `${line}`;
  };

  if (!predictions || (!predictions.moneyline && !predictions.spread && !predictions.overUnder)) {
    return (
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Text style={[styles.noPredictions, { color: theme.colors.onSurfaceVariant }]}>
            No predictions available for this game
          </Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      {/* Header Section */}
      <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
        <View style={styles.teamsRow}>
          {renderTeamCircle(false)}
          
          <View style={styles.scoreContainer}>
            <View style={styles.scoreRow}>
              <Text style={[styles.score, { color: theme.colors.onSurface }]}>{game.away_score}</Text>
              <Text style={[styles.scoreDivider, { color: theme.colors.onSurfaceVariant }]}>-</Text>
              <Text style={[styles.score, { color: theme.colors.onSurface }]}>{game.home_score}</Text>
            </View>
            <View style={styles.gameStatus}>
              <Text style={[styles.quarter, { color: theme.colors.onSurfaceVariant }]}>{game.quarter}</Text>
              {game.time_remaining && (
                <Text style={[styles.time, { color: theme.colors.onSurfaceVariant }]}>{game.time_remaining}</Text>
              )}
            </View>
          </View>

          {renderTeamCircle(true)}
        </View>
      </View>

      {/* Predictions Section */}
      <Card.Content style={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          AI Model Predictions
        </Text>
        
        <View style={styles.predictionsList}>
          {predictions.moneyline && renderPredictionRow(
            "Moneyline",
            predictions.moneyline,
            `${predictions.moneyline.predicted} to win`
          )}
          
          {predictions.spread && renderPredictionRow(
            "Spread",
            predictions.spread,
            `${predictions.spread.predicted} ${formatLine(predictions.spread.line)}`
          )}
          
          {predictions.overUnder && renderPredictionRow(
            "Over/Under",
            predictions.overUnder,
            `${predictions.overUnder.predicted} ${predictions.overUnder.line}`
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamCircleContainer: {
    alignItems: 'center',
    width: 80,
  },
  teamCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  teamInitials: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 11,
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  score: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  scoreDivider: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  gameStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quarter: {
    fontSize: 12,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  predictionsList: {
    gap: 8,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  predictionInfo: {
    gap: 2,
  },
  predictionType: {
    fontSize: 13,
    fontWeight: '600',
  },
  predictionValue: {
    fontSize: 11,
  },
  predictionStatus: {
    alignItems: 'flex-end',
    gap: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  probabilityText: {
    fontSize: 10,
  },
  noPredictions: {
    textAlign: 'center',
    fontSize: 14,
    padding: 16,
  },
});

