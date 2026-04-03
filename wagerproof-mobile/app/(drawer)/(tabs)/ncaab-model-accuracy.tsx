import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useNCAABModelAccuracy } from '@/hooks/useNCAABModelAccuracy';
import { useProAccess } from '@/hooks/useProAccess';
import { NCAABModelAccuracyMatchupCard } from '@/components/ncaab/ModelAccuracyMatchupCard';
import { ModelAccuracyCardShimmer } from '@/components/ModelAccuracyCardShimmer';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { ToolExplainerBanner } from '@/components/ToolExplainerBanner';
import { useScroll } from '@/contexts/ScrollContext';
import { NoGamesTerminal } from '@/components/NoGamesTerminal';
import { GameAccuracyData, AccuracySortMode } from '@/types/modelAccuracy';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';

const WAGERPROOF_GREEN = '#00E676';

export default function NCAABModelAccuracyScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { games, isLoading, error, sortMode, setSortMode, refetch } = useNCAABModelAccuracy();
  const { isPro, isLoading: isProLoading } = useProAccess();
  const { refreshCustomerInfo } = useRevenueCat();

  const { scrollY, scrollYClamped } = useScroll();

  const HEADER_HEIGHT = 56;
  const TOTAL_HEADER_HEIGHT = insets.top + HEADER_HEIGHT;

  const headerTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_HEADER_HEIGHT],
    outputRange: [0, -TOTAL_HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_HEADER_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

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
        .catch((err) => {
          console.error('Error presenting paywall:', err);
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

  const handleSortChange = (mode: AccuracySortMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortMode(mode);
  };

  const sortPills: { mode: AccuracySortMode; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[] = [
    { mode: 'time', icon: 'clock-outline', label: 'Time' },
    { mode: 'spread', icon: 'target', label: 'Spread' },
    { mode: 'moneyline', icon: 'chart-bar', label: 'ML' },
    { mode: 'ou', icon: 'swap-vertical', label: 'O/U' },
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

  const renderHeader = () => (
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
  );

  const renderItem = ({ item }: { item: GameAccuracyData }) => (
    <NCAABModelAccuracyMatchupCard game={item} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <NoGamesTerminal context="ncaab_trends" />
    </View>
  );

  const renderShimmer = () => (
    <View style={styles.shimmerContainer}>
      {[1, 2, 3, 4].map((i) => (
        <ModelAccuracyCardShimmer key={i} />
      ))}
    </View>
  );

  const renderHowToUseTool = () => (
    <View
      style={[
        styles.howToUseCard,
        {
          backgroundColor: isDark ? '#111111' : '#f7f7f7',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        },
      ]}
    >
      <View style={styles.howToUseHeader}>
        <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={WAGERPROOF_GREEN} />
        <Text style={[styles.howToUseTitle, { color: theme.colors.onSurface }]}>How to use this tool</Text>
      </View>
      <Text style={[styles.howToUseText, { color: theme.colors.onSurfaceVariant }]}>
        1. Sort by Spread, ML, or O/U to spot where the model is performing best right now.
      </Text>
      <Text style={[styles.howToUseText, { color: theme.colors.onSurfaceVariant }]}>
        2. Focus on games where model confidence and historical accuracy line up.
      </Text>
      <Text style={[styles.howToUseText, { color: theme.colors.onSurfaceVariant }]}>
        3. Treat this as a filter, then validate with matchup context before placing a wager.
      </Text>
    </View>
  );

  if (isLoading && games.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
        {renderHeader()}
        <View style={{ paddingTop: TOTAL_HEADER_HEIGHT + 12 }}>
          {renderShimmer()}
        </View>
      </View>
    );
  }

  if (error && games.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
        {renderHeader()}
        <View style={{ paddingTop: TOTAL_HEADER_HEIGHT + 12 }}>
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
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      {renderHeader()}

      <Animated.FlatList
        data={games}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.gameId}`}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: TOTAL_HEADER_HEIGHT + 12,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16 }}>
            <ToolExplainerBanner
              accentColor="#f97316"
              title="NCAAB Model Accuracy"
              titleIcon="bullseye-arrow"
              headline="The model's college track record."
              description="Games where the model has been extremely accurate or consistently wrong. Both are actionable — trust or fade."
              examples={[
                { icon: 'thumb-up', label: 'Duke spread pick — 79% accurate', value: 'Trust', valueColor: '#22c55e' },
                { icon: 'thumb-down', label: 'UNC O/U pick — only 35% accurate', value: 'Fade', valueColor: '#ef4444' },
                { icon: 'bullseye-arrow', label: 'Kansas ML pick — 74% accurate', value: 'Trust', valueColor: '#22c55e' },
              ]}
            />
            {renderSortPills()}
          </View>
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderHowToUseTool}
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
  howToUseCard: {
    marginTop: 8,
    marginHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  howToUseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  howToUseTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  howToUseText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
