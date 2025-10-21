import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useLiveScores } from '@/hooks/useLiveScores';
import { LiveScoreCard } from './LiveScoreCard';

export function LiveScoreTicker() {
  const theme = useTheme();
  const { games, hasLiveGames, isLoading } = useLiveScores();

  // Don't render if no live games or still loading
  if (!hasLiveGames || isLoading) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {games.map((game) => (
          <LiveScoreCard key={game.id} game={game} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 8,
    gap: 8,
  },
});

