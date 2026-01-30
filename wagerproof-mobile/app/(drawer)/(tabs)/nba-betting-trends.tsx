import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import RevenueCatUI from 'react-native-purchases-ui';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useNBABettingTrends } from '@/hooks/useNBABettingTrends';
import { useProAccess } from '@/hooks/useProAccess';
import { BettingTrendsMatchupCard } from '@/components/nba/BettingTrendsMatchupCard';
import { NBAGameTrendsData, TrendsSortMode } from '@/types/nbaBettingTrends';
import { GameCardShimmer } from '@/components/GameCardShimmer';

/**
 * NBA Betting Trends Page
 * Displays situational ATS & O/U trends for today's NBA games
 * Pro feature - non-Pro users see paywall
 */
export default function NBABettingTrendsScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { games, isLoading, error, sortMode, setSortMode, refetch } = useNBABettingTrends();
  const { isPro, isLoading: isProLoading } = useProAccess();

  // Show paywall for non-Pro users
  useEffect(() => {
    if (!isProLoading && !isPro) {
      RevenueCatUI.presentPaywall();
    }
  }, [isPro, isProLoading]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refetch();
  };

  const handleSortChange = (mode: TrendsSortMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortMode(mode);
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <MaterialCommunityIcons name="chart-line" size={24} color="#3b82f6" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>Betting Trends</Text>
      </View>

      <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <MaterialCommunityIcons name="refresh" size={24} color={theme.colors.onSurface} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSortButtons = () => (
    <View style={styles.sortContainer}>
      <TouchableOpacity
        style={[
          styles.sortButton,
          sortMode === 'time' && styles.sortButtonActive,
          { borderColor: sortMode === 'time' ? '#3b82f6' : theme.colors.outlineVariant },
        ]}
        onPress={() => handleSortChange('time')}
      >
        <Text
          style={[
            styles.sortButtonText,
            { color: sortMode === 'time' ? '#3b82f6' : theme.colors.onSurfaceVariant },
          ]}
        >
          Game Time
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.sortButton,
          sortMode === 'ou-consensus' && styles.sortButtonActive,
          { borderColor: sortMode === 'ou-consensus' ? '#3b82f6' : theme.colors.outlineVariant },
        ]}
        onPress={() => handleSortChange('ou-consensus')}
      >
        <Text
          style={[
            styles.sortButtonText,
            { color: sortMode === 'ou-consensus' ? '#3b82f6' : theme.colors.onSurfaceVariant },
          ]}
        >
          OU Consensus
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.sortButton,
          sortMode === 'ats-dominance' && styles.sortButtonActive,
          { borderColor: sortMode === 'ats-dominance' ? '#3b82f6' : theme.colors.outlineVariant },
        ]}
        onPress={() => handleSortChange('ats-dominance')}
      >
        <Text
          style={[
            styles.sortButtonText,
            { color: sortMode === 'ats-dominance' ? '#3b82f6' : theme.colors.onSurfaceVariant },
          ]}
        >
          ATS Dominance
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: NBAGameTrendsData }) => (
    <BettingTrendsMatchupCard game={item} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="calendar-blank" size={60} color={theme.colors.onSurfaceVariant} />
      <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
        No betting trends available for today
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="alert-circle" size={60} color={theme.colors.error} />
      <Text style={[styles.emptyText, { color: theme.colors.error }]}>{error}</Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
        onPress={refetch}
      >
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderShimmer = () => (
    <View style={styles.shimmerContainer}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.shimmerCard}>
          <GameCardShimmer cardWidth={200} />
        </View>
      ))}
    </View>
  );

  // Show loading shimmer
  if (isLoading && games.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
        {renderHeader()}
        {renderShimmer()}
      </View>
    );
  }

  // Show error state
  if (error && games.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
        {renderHeader()}
        {renderError()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      {renderHeader()}

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Situational ATS & O/U records
        </Text>
        <Text style={[styles.gamesCount, { color: theme.colors.onSurfaceVariant }]}>
          {games.length} game{games.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Sort Buttons */}
      {renderSortButtons()}

      <FlatList
        data={games}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.gameId}`}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  refreshButton: {
    padding: 8,
  },
  subtitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  gamesCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  sortButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  shimmerContainer: {
    paddingHorizontal: 16,
    paddingTop: 80,
  },
  shimmerCard: {
    marginBottom: 12,
    alignItems: 'center',
  },
});
