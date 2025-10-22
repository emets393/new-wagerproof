import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LiveGame } from '@/types/liveScores';

interface CompactLiveScorePillProps {
  game: LiveGame;
  onPress: () => void;
}

export function CompactLiveScorePill({ game, onPress }: CompactLiveScorePillProps) {
  const theme = useTheme();

  // Determine pill color based on prediction status
  const getPillColor = () => {
    if (game.predictions?.hasAnyHitting) {
      return '#16A34A'; // Green for hitting
    }
    // Check if any predictions are not hitting (red)
    const hasNotHitting = 
      (game.predictions?.moneyline && !game.predictions.moneyline.isHitting) ||
      (game.predictions?.spread && !game.predictions.spread.isHitting) ||
      (game.predictions?.overUnder && !game.predictions.overUnder.isHitting);
    
    if (hasNotHitting) {
      return '#DC2626'; // Red for not hitting
    }
    
    return theme.colors.surfaceVariant; // Neutral gray
  };

  const pillColor = getPillColor();
  const isHighlighted = pillColor === '#16A34A' || pillColor === '#DC2626';

  return (
    <TouchableOpacity 
      onPress={onPress}
      style={[
        styles.pill,
        { 
          backgroundColor: pillColor,
          borderColor: isHighlighted ? pillColor : theme.colors.outline,
        }
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* League badge */}
        <Text style={[
          styles.league,
          { color: isHighlighted ? '#FFFFFF' : theme.colors.onSurfaceVariant }
        ]}>
          {game.league}
        </Text>
        
        {/* Score */}
        <View style={styles.scoreContainer}>
          <Text style={[
            styles.teams,
            { color: isHighlighted ? '#FFFFFF' : theme.colors.onSurface }
          ]}>
            {game.away_abbr} {game.away_score}
          </Text>
          <Text style={[
            styles.separator,
            { color: isHighlighted ? '#FFFFFF' : theme.colors.onSurfaceVariant }
          ]}>
            -
          </Text>
          <Text style={[
            styles.teams,
            { color: isHighlighted ? '#FFFFFF' : theme.colors.onSurface }
          ]}>
            {game.home_score} {game.home_abbr}
          </Text>
        </View>

        {/* Quarter */}
        <Text style={[
          styles.quarter,
          { color: isHighlighted ? 'rgba(255,255,255,0.8)' : theme.colors.onSurfaceVariant }
        ]}>
          {game.quarter}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  league: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teams: {
    fontSize: 12,
    fontWeight: '600',
  },
  separator: {
    fontSize: 12,
    fontWeight: '400',
  },
  quarter: {
    fontSize: 10,
    fontWeight: '500',
  },
});

