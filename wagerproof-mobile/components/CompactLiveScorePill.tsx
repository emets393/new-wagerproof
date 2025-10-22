import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { LiveGame } from '@/types/liveScores';

interface CompactLiveScorePillProps {
  game: LiveGame;
  onPress: () => void;
}

export function CompactLiveScorePill({ game, onPress }: CompactLiveScorePillProps) {
  const theme = useTheme();

  // Determine pill color based on prediction status
  const getPillColors = () => {
    if (game.predictions?.hasAnyHitting) {
      return {
        gradient: ['rgba(22, 163, 74, 0.15)', 'rgba(22, 163, 74, 0.25)'] as const, // Green gradient
        border: 'rgba(22, 163, 74, 0.4)',
        isHighlighted: true,
        textColor: '#16A34A'
      };
    }
    // Check if any predictions are not hitting (red)
    const hasNotHitting = 
      (game.predictions?.moneyline && !game.predictions.moneyline.isHitting) ||
      (game.predictions?.spread && !game.predictions.spread.isHitting) ||
      (game.predictions?.overUnder && !game.predictions.overUnder.isHitting);
    
    if (hasNotHitting) {
      return {
        gradient: ['rgba(220, 38, 38, 0.15)', 'rgba(220, 38, 38, 0.25)'] as const, // Red gradient
        border: 'rgba(220, 38, 38, 0.4)',
        isHighlighted: true,
        textColor: '#DC2626'
      };
    }
    
    return {
      gradient: [theme.dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)', 
                 theme.dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.4)'] as const,
      border: theme.dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.8)',
      isHighlighted: false,
      textColor: theme.colors.onSurface
    };
  };

  const pillColors = getPillColors();

  return (
    <TouchableOpacity 
      onPress={onPress}
      style={styles.pillContainer}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={[pillColors.gradient[0], pillColors.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.pill,
          { 
            borderColor: pillColors.border,
          }
        ]}
      >
        <View style={styles.content}>
          {/* League badge */}
          <Text style={[
            styles.league,
            { color: pillColors.isHighlighted ? pillColors.textColor : theme.colors.onSurfaceVariant }
          ]}>
            {game.league}
          </Text>
          
          {/* Score and game info container */}
          <View style={styles.gameInfoContainer}>
            {/* Score - Top row */}
            <View style={styles.scoreContainer}>
              <Text style={[
                styles.teams,
                { color: pillColors.isHighlighted ? pillColors.textColor : theme.colors.onSurface }
              ]}>
                {game.away_abbr} {game.away_score}
              </Text>
              <Text style={[
                styles.separator,
                { color: pillColors.isHighlighted ? pillColors.textColor : theme.colors.onSurfaceVariant }
              ]}>
                -
              </Text>
              <Text style={[
                styles.teams,
                { color: pillColors.isHighlighted ? pillColors.textColor : theme.colors.onSurface }
              ]}>
                {game.home_score} {game.home_abbr}
              </Text>
            </View>

            {/* Quarter and Time - Bottom row */}
            <View style={styles.timeInfoContainer}>
              <Text style={[
                styles.quarter,
                { color: pillColors.isHighlighted ? 
                    `${pillColors.textColor}CC` : 
                    theme.colors.onSurfaceVariant 
                }
              ]}>
                {game.quarter}
              </Text>
              {game.time_remaining && (
                <>
                  <Text style={[
                    styles.timeSeparator,
                    { color: pillColors.isHighlighted ? 
                        `${pillColors.textColor}99` : 
                        theme.colors.onSurfaceVariant 
                    }
                  ]}>
                    •
                  </Text>
                  <Text style={[
                    styles.time,
                    { color: pillColors.isHighlighted ? 
                        `${pillColors.textColor}CC` : 
                        theme.colors.onSurfaceVariant 
                    }
                  ]}>
                    {game.time_remaining}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    marginHorizontal: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    minHeight: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  league: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  gameInfoContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teams: {
    fontSize: 13,
    fontWeight: '600',
  },
  separator: {
    fontSize: 12,
    fontWeight: '400',
  },
  timeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quarter: {
    fontSize: 9,
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 8,
  },
  time: {
    fontSize: 9,
    fontWeight: '500',
  },
});

