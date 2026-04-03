import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useNBABettingTrends } from '@/hooks/useNBABettingTrends';
import { useProAccess } from '@/hooks/useProAccess';
import { BettingTrendsMatchupCard } from '@/components/nba/BettingTrendsMatchupCard';
import { NBAGameTrendsData, TrendsSortMode } from '@/types/nbaBettingTrends';
import { BettingTrendsMatchupCardShimmer } from '@/components/BettingTrendsMatchupCardShimmer';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { ToolExplainerBanner } from '@/components/ToolExplainerBanner';
import { useScroll } from '@/contexts/ScrollContext';
import { NoGamesTerminal } from '@/components/NoGamesTerminal';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';

/**
 * NBA Betting Trends Page
 * Displays situational ATS & O/U trends for today's NBA games
 * Pro feature - non-Pro users see paywall
 */
// WagerProof green color
const WAGERPROOF_GREEN = '#00E676';

export default function NBABettingTrendsScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { games, isLoading, error, sortMode, setSortMode, refetch } = useNBABettingTrends();
  const { isPro, isLoading: isProLoading } = useProAccess();
  const { refreshCustomerInfo } = useRevenueCat();

  // Use shared scroll context (same as main feed) to sync header and tab bar animations
  const { scrollY, scrollYClamped } = useScroll();

  // Calculate header heights (must match tab bar calculation in _layout.tsx)
  const HEADER_HEIGHT = 56;
  const TOTAL_HEADER_HEIGHT = insets.top + HEADER_HEIGHT;
  const TOTAL_COLLAPSIBLE_HEIGHT = TOTAL_HEADER_HEIGHT;

  // Header slides up as user scrolls (synced with tab bar)
  const headerTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [0, -TOTAL_COLLAPSIBLE_HEIGHT],
    extrapolate: 'clamp',
  });

  // Header fades out as user scrolls
  const headerOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Handle scroll event - updates shared scrollY which drives both header and tab bar
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  // Show paywall for non-Pro users
  useEffect(() => {
    if (!isProLoading && !isPro) {
      presentPaywallForPlacementIfNeeded(
        ENTITLEMENT_IDENTIFIER,
        PAYWALL_PLACEMENTS.GENERIC_FEATURE
      )
        .then((result) => {
          if (didPaywallGrantEntitlement(result)) {
            return refreshCustomerInfo();
          }
        })
        .catch((error) => {
          console.error('Error presenting paywall:', error);
        });
    }
  }, [isPro, isProLoading, refreshCustomerInfo]);

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

  // Sort pill configurations with icons and labels
  const sortPills: { mode: TrendsSortMode; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[] = [
    { mode: 'time', icon: 'clock-outline', label: 'Time' },
    { mode: 'ou-consensus', icon: 'trending-up', label: 'O/U' },
    { mode: 'ats-dominance', icon: 'chart-line', label: 'ATS' },
  ];

  const renderSortPills = () => (
    <View style={styles.pillsContainer}>
      {sortPills.map((pill) => {
        const isActive = sortMode === pill.mode;
        return (
          <TouchableOpacity
            key={pill.mode}
            style={[
              styles.sortPill,
              {
                backgroundColor: isActive ? WAGERPROOF_GREEN : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
              },
            ]}
            onPress={() => handleSortChange(pill.mode)}
          >
            <MaterialCommunityIcons
              name={pill.icon}
              size={16}
              color={isActive ? '#000000' : theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.sortPillText,
                { color: isActive ? '#000000' : theme.colors.onSurfaceVariant },
              ]}
            >
              {pill.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderItem = ({ item }: { item: NBAGameTrendsData }) => (
    <BettingTrendsMatchupCard game={item} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <NoGamesTerminal context="nba_trends" />
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
        <BettingTrendsMatchupCardShimmer key={i} />
      ))}
    </View>
  );

  // Show loading shimmer
  if (isLoading && games.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
        <Animated.View style={[styles.fixedHeaderContainer]}>
          <AndroidBlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.fixedHeader, { paddingTop: insets.top }]}
          >
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={WAGERPROOF_GREEN} />
                ) : (
                  <MaterialCommunityIcons name="refresh" size={24} color={theme.colors.onSurface} />
                )}
              </TouchableOpacity>
            </View>
          </AndroidBlurView>
        </Animated.View>
        <View style={{ paddingTop: TOTAL_HEADER_HEIGHT + 12 }}>
          {renderShimmer()}
        </View>
      </View>
    );
  }

  // Show error state
  if (error && games.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
        <Animated.View style={[styles.fixedHeaderContainer]}>
          <AndroidBlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.fixedHeader, { paddingTop: insets.top }]}
          >
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton} disabled={isLoading}>
                <MaterialCommunityIcons name="refresh" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
            </View>
          </AndroidBlurView>
        </Animated.View>
        <View style={{ paddingTop: TOTAL_HEADER_HEIGHT + 12 }}>
          {renderError()}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      {/* Frosted Glass Header - Slides away on scroll */}
      <Animated.View
        style={[
          styles.fixedHeaderContainer,
          {
            transform: [{ translateY: headerTranslate }],
            opacity: headerOpacity,
          },
        ]}
      >
        <AndroidBlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.fixedHeader, { paddingTop: insets.top }]}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color={WAGERPROOF_GREEN} />
              ) : (
                <MaterialCommunityIcons name="refresh" size={24} color={theme.colors.onSurface} />
              )}
            </TouchableOpacity>
          </View>
        </AndroidBlurView>
      </Animated.View>

      <Animated.FlatList
        data={games}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.gameId}`}
        contentContainerStyle={[
          styles.listContent,
          { 
            paddingTop: TOTAL_HEADER_HEIGHT + 12,
            paddingBottom: insets.bottom + 100 
          }
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16 }}>
            <ToolExplainerBanner
              accentColor="#0ea5e9"
              title="NBA Betting Trends"
              titleIcon="basketball"
              headline="Situations that keep paying off."
              description="Teams covering at 65%+ in specific situations — after wins, as favorites, on rest — patterns the line doesn't always price in."
              examples={[
                { icon: 'shield-check', label: 'Celtics ATS after a loss', value: '72% (13-5)', valueColor: '#22c55e' },
                { icon: 'trending-up', label: 'Lakers Over as home favorite', value: '68% (11-5)', valueColor: '#22c55e' },
                { icon: 'sleep', label: 'Nuggets ATS on 2+ days rest', value: '70% (9-4)', valueColor: '#22c55e' },
              ]}
            />
            {renderSortPills()}
          </View>
        }
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  fixedHeader: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
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
  pillsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  sortPillText: {
    fontSize: 13,
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
    paddingTop: 8,
  },
});
