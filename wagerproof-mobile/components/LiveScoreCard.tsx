import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LiveGame } from '@/types/liveScores';

interface LiveScoreCardProps {
  game: LiveGame;
  onPress?: () => void;
}

export function LiveScoreCard({ game, onPress }: LiveScoreCardProps) {
  const theme = useTheme();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const hasHittingPredictions = game.predictions?.hasAnyHitting || false;
  const hasPredictions = !!game.predictions && (
    !!game.predictions.moneyline || 
    !!game.predictions.spread || 
    !!game.predictions.overUnder
  );

  // Pulse animation for hitting predictions
  useEffect(() => {
    if (hasPredictions && hasHittingPredictions) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [hasPredictions, hasHittingPredictions, pulseAnim]);

  // Format spread display like website: "BOS -9.5"
  const getSpreadDisplay = () => {
    if (!game.predictions?.spread) return null;
    const spread = game.predictions.spread;
    const pickedTeam = spread.predicted === 'Home' ? game.home_abbr : game.away_abbr;
    let displayLine = spread.line;
    
    // If picked away, flip the sign for display
    if (spread.predicted === 'Away' && displayLine !== null && displayLine !== undefined) {
      displayLine = -displayLine;
    }
    
    const lineStr = displayLine !== null && displayLine !== undefined
      ? (displayLine > 0 ? `+${displayLine}` : `${displayLine}`)
      : '';
    
    return `${pickedTeam} ${lineStr}`;
  };

  // Format O/U display like website: "O 230.5" or "U 230.5"
  const getOUDisplay = () => {
    if (!game.predictions?.overUnder) return null;
    const ou = game.predictions.overUnder;
    return `${ou.predicted.charAt(0)} ${ou.line}`;
  };

  // Animated shadow for pulsing glow
  const animatedShadowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  const animatedShadowRadius = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 14],
  });

  // Determine border style based on predictions
  const getBorderStyle = () => {
    if (hasPredictions && hasHittingPredictions) {
      return {
        borderColor: '#22D35F',
        borderWidth: 1.5,
      };
    }
    if (hasPredictions && !hasHittingPredictions) {
      return {
        borderColor: 'rgba(239, 68, 68, 0.5)',
        borderWidth: 1,
      };
    }
    return {
      borderColor: theme.colors.outlineVariant,
      borderWidth: 1,
    };
  };

  const spreadDisplay = getSpreadDisplay();
  const ouDisplay = getOUDisplay();

  const cardContent = (
    <>
      {/* Top Row: Indicator + Teams/Scores */}
      <View style={styles.mainRow}>
        {/* Prediction Status Indicator */}
        {hasPredictions && (
          <View style={styles.indicatorContainer}>
            <View style={[
              styles.indicator,
              { backgroundColor: hasHittingPredictions ? '#22D35F' : '#EF4444' }
            ]} />
          </View>
        )}

        {/* Teams and Scores */}
        <View style={styles.teamsContainer}>
          <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>
            {game.away_abbr}
          </Text>
          <Text style={[styles.score, { color: theme.colors.onSurface }]}>
            {game.away_score}
          </Text>
          <Text style={[styles.divider, { color: theme.colors.onSurfaceVariant }]}>-</Text>
          <Text style={[styles.score, { color: theme.colors.onSurface }]}>
            {game.home_score}
          </Text>
          <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>
            {game.home_abbr}
          </Text>
        </View>

        {/* Game Status (when no predictions) */}
        {!hasPredictions && game.is_live && game.period && (
          <View style={styles.statusContainer}>
            <Text style={[styles.period, { color: theme.colors.onSurfaceVariant }]}>
              {game.period || game.quarter}
            </Text>
            {game.time_remaining && (
              <Text style={[styles.time, { color: theme.colors.onSurfaceVariant }]}>
                {game.time_remaining}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Bottom Row: Model Predictions */}
      {hasPredictions && (spreadDisplay || ouDisplay) && (
        <View style={styles.predictionsRow}>
          {spreadDisplay && (
            <Text style={[
              styles.predictionText,
              { color: game.predictions?.spread?.isHitting ? '#22D35F' : '#EF4444' }
            ]}>
              {spreadDisplay}
            </Text>
          )}
          {spreadDisplay && ouDisplay && (
            <Text style={[styles.predictionDivider, { color: theme.colors.onSurfaceVariant }]}>•</Text>
          )}
          {ouDisplay && (
            <Text style={[
              styles.predictionText,
              { color: game.predictions?.overUnder?.isHitting ? '#22D35F' : '#EF4444' }
            ]}>
              {ouDisplay}
            </Text>
          )}
        </View>
      )}
    </>
  );

  // Use Animated.View for pulsing glow effect when hitting
  if (hasPredictions && hasHittingPredictions) {
    return (
      <Pressable onPress={onPress}>
        {({ pressed }) => (
          <Animated.View
            style={[
              styles.card,
              { 
                backgroundColor: theme.colors.surface,
                opacity: pressed ? 0.9 : 1,
                shadowColor: '#22D35F',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: animatedShadowOpacity,
                shadowRadius: animatedShadowRadius,
                elevation: 8,
              },
              getBorderStyle(),
            ]}
          >
            {cardContent}
          </Animated.View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { 
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.9 : 1,
        },
        getBorderStyle(),
      ]}
    >
      {cardContent}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicatorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamAbbr: {
    fontSize: 11,
    fontWeight: '700',
  },
  score: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    fontSize: 10,
    marginHorizontal: 2,
  },
  predictionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  predictionText: {
    fontSize: 10,
    fontWeight: '600',
  },
  predictionDivider: {
    fontSize: 8,
  },
  statusContainer: {
    alignItems: 'flex-end',
    gap: 1,
  },
  period: {
    fontSize: 9,
    fontWeight: '600',
  },
  time: {
    fontSize: 8,
    fontVariant: ['tabular-nums'],
  },
});
