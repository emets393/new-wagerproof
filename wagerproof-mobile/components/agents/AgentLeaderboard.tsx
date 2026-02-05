import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTheme, Chip, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { LeaderboardEntry } from '@/services/agentPerformanceService';
import { Sport, SPORTS, formatRecord, formatNetUnits } from '@/types/agent';

const SPORT_LABELS: Record<Sport | 'all', string> = {
  all: 'All',
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

interface AgentLeaderboardProps {
  limit?: number;
  showViewAll?: boolean;
  embedded?: boolean;
}

// Leaderboard Row component
function LeaderboardRow({
  entry,
  rank,
  onPress,
  isDark,
}: {
  entry: LeaderboardEntry;
  rank: number;
  onPress: () => void;
  isDark: boolean;
}) {
  const theme = useTheme();

  const record = `${entry.wins}-${entry.losses}${entry.pushes > 0 ? `-${entry.pushes}` : ''}`;
  const netUnits = formatNetUnits(entry.net_units);
  const winRate = entry.win_rate ? `${(entry.win_rate * 100).toFixed(1)}%` : '-';
  const isPositive = entry.net_units >= 0;

  // Rank medal colors
  const getRankStyle = () => {
    if (rank === 1) return { color: '#FFD700', icon: 'trophy' as const };
    if (rank === 2) return { color: '#C0C0C0', icon: 'medal' as const };
    if (rank === 3) return { color: '#CD7F32', icon: 'medal-outline' as const };
    return { color: theme.colors.onSurfaceVariant, icon: null };
  };

  const rankStyle = getRankStyle();

  return (
    <TouchableOpacity
      style={[
        styles.rowContainer,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(0, 0, 0, 0.02)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Rank */}
      <View style={styles.rankContainer}>
        {rankStyle.icon ? (
          <MaterialCommunityIcons
            name={rankStyle.icon}
            size={24}
            color={rankStyle.color}
          />
        ) : (
          <Text style={[styles.rankText, { color: rankStyle.color }]}>
            {rank}
          </Text>
        )}
      </View>

      {/* Avatar and Name */}
      <View style={styles.agentInfo}>
        <View
          style={[
            styles.avatarSmall,
            { backgroundColor: `${entry.avatar_color}25` },
          ]}
        >
          <Text style={styles.avatarEmoji}>{entry.avatar_emoji}</Text>
        </View>
        <View style={styles.nameContainer}>
          <Text
            style={[styles.agentName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {entry.name}
          </Text>
          <View style={styles.sportsRow}>
            {entry.preferred_sports.slice(0, 2).map((sport) => (
              <Text
                key={sport}
                style={[
                  styles.sportTag,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {SPORT_LABELS[sport]}
              </Text>
            ))}
            {entry.preferred_sports.length > 2 && (
              <Text
                style={[
                  styles.sportTag,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                +{entry.preferred_sports.length - 2}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={[styles.recordText, { color: theme.colors.onSurface }]}>
          {record}
        </Text>
        <Text
          style={[
            styles.unitsText,
            { color: isPositive ? '#10b981' : '#ef4444' },
          ]}
        >
          {netUnits}
        </Text>
      </View>

      {/* Win Rate */}
      <View style={styles.winRateContainer}>
        <Text style={[styles.winRateText, { color: theme.colors.primary }]}>
          {winRate}
        </Text>
      </View>

      {/* Chevron */}
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={theme.colors.onSurfaceVariant}
      />
    </TouchableOpacity>
  );
}

// Empty State component
function EmptyState({ isDark }: { isDark: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.emptyContainer,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(0, 0, 0, 0.02)',
        },
      ]}
    >
      <MaterialCommunityIcons
        name="trophy-outline"
        size={48}
        color={theme.colors.onSurfaceVariant}
      />
      <Text
        style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
      >
        No public agents yet
      </Text>
      <Text
        style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}
      >
        Be the first to make your agent public!
      </Text>
    </View>
  );
}

// Skeleton Row component
function SkeletonRow({ isDark }: { isDark: boolean }) {
  return (
    <View
      style={[
        styles.rowContainer,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(0, 0, 0, 0.02)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
    >
      <View
        style={[
          styles.skeletonRank,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.08)',
          },
        ]}
      />
      <View style={styles.agentInfo}>
        <View
          style={[
            styles.avatarSmall,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        />
        <View style={styles.nameContainer}>
          <View
            style={[
              styles.skeletonName,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
          />
          <View
            style={[
              styles.skeletonSports,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.statsContainer}>
        <View
          style={[
            styles.skeletonStat,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        />
      </View>
    </View>
  );
}

export function AgentLeaderboard({
  limit = 10,
  showViewAll = true,
  embedded = false,
}: AgentLeaderboardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { isDark } = useThemeContext();

  // State for sport filter
  const [selectedSport, setSelectedSport] = useState<Sport | undefined>(
    undefined
  );

  // Fetch leaderboard
  const {
    data: leaderboard,
    isLoading,
    isRefetching,
    refetch,
  } = useLeaderboard(limit, selectedSport);

  // Handle sport filter change
  const handleSportChange = useCallback((sport: Sport | undefined) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSport(sport);
  }, []);

  // Handle row press
  const handleRowPress = useCallback(
    (entry: LeaderboardEntry) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/agents/public/${entry.avatar_id}` as any);
    },
    [router]
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Render row
  const renderRow = useCallback(
    ({ item, index }: { item: LeaderboardEntry; index: number }) => (
      <LeaderboardRow
        entry={item}
        rank={index + 1}
        onPress={() => handleRowPress(item)}
        isDark={isDark}
      />
    ),
    [handleRowPress, isDark]
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: LeaderboardEntry) => item.avatar_id,
    []
  );

  // Render header
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Title - only if not embedded */}
      {!embedded && (
        <View style={styles.titleRow}>
          <MaterialCommunityIcons
            name="trophy"
            size={24}
            color="#FFD700"
          />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Leaderboard
          </Text>
        </View>
      )}

      {/* Sport Filter Chips */}
      <View style={styles.filterContainer}>
        <Chip
          mode={selectedSport === undefined ? 'flat' : 'outlined'}
          selected={selectedSport === undefined}
          onPress={() => handleSportChange(undefined)}
          style={[
            styles.filterChip,
            selectedSport === undefined && {
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
          textStyle={{
            color:
              selectedSport === undefined
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurfaceVariant,
            fontSize: 12,
          }}
        >
          All
        </Chip>
        {SPORTS.map((sport) => (
          <Chip
            key={sport}
            mode={selectedSport === sport ? 'flat' : 'outlined'}
            selected={selectedSport === sport}
            onPress={() => handleSportChange(sport)}
            style={[
              styles.filterChip,
              selectedSport === sport && {
                backgroundColor: theme.colors.primaryContainer,
              },
            ]}
            textStyle={{
              color:
                selectedSport === sport
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSurfaceVariant,
              fontSize: 12,
            }}
          >
            {SPORT_LABELS[sport]}
          </Chip>
        ))}
      </View>

      {/* Column Headers */}
      <View style={styles.columnHeaders}>
        <Text
          style={[styles.columnHeader, styles.rankHeader, { color: theme.colors.onSurfaceVariant }]}
        >
          #
        </Text>
        <Text
          style={[
            styles.columnHeader,
            styles.agentHeader,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Agent
        </Text>
        <Text
          style={[
            styles.columnHeader,
            styles.statsHeader,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Record / Units
        </Text>
        <Text
          style={[
            styles.columnHeader,
            styles.winRateHeader,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Win%
        </Text>
      </View>
    </View>
  );

  // Render loading skeletons
  const renderLoadingSkeletons = () => (
    <View>
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonRow key={i} isDark={isDark} />
      ))}
    </View>
  );

  return (
    <View style={[styles.container, embedded && styles.embeddedContainer]}>
      {isLoading && !leaderboard ? (
        <>
          {renderHeader()}
          {renderLoadingSkeletons()}
        </>
      ) : leaderboard && leaderboard.length > 0 ? (
        <FlatList
          data={leaderboard}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            !embedded ? (
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            ) : undefined
          }
        />
      ) : (
        <>
          {renderHeader()}
          <EmptyState isDark={isDark} />
        </>
      )}

      {/* View All Link */}
      {showViewAll && leaderboard && leaderboard.length >= limit && (
        <TouchableOpacity
          style={[
            styles.viewAllButton,
            {
              borderTopColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Navigate to full leaderboard screen if needed
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.viewAllText, { color: theme.colors.primary }]}
          >
            View All
          </Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={18}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  embeddedContainer: {
    flex: 0,
  },
  listContent: {
    paddingBottom: 16,
  },
  // Header
  headerContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    borderRadius: 16,
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rankHeader: {
    width: 32,
    textAlign: 'center',
  },
  agentHeader: {
    flex: 1,
    marginLeft: 8,
  },
  statsHeader: {
    width: 80,
    textAlign: 'center',
  },
  winRateHeader: {
    width: 50,
    textAlign: 'center',
  },
  // Row
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
  },
  agentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  nameContainer: {
    flex: 1,
  },
  agentName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  sportsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sportTag: {
    fontSize: 11,
    fontWeight: '500',
  },
  statsContainer: {
    width: 80,
    alignItems: 'center',
  },
  recordText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  unitsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  winRateContainer: {
    width: 50,
    alignItems: 'center',
  },
  winRateText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    marginHorizontal: 16,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  // View All
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 16,
    borderTopWidth: 1,
    gap: 6,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Skeleton
  skeletonRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  skeletonName: {
    width: 100,
    height: 16,
    borderRadius: 4,
    marginBottom: 4,
  },
  skeletonSports: {
    width: 60,
    height: 12,
    borderRadius: 3,
  },
  skeletonStat: {
    width: 50,
    height: 16,
    borderRadius: 4,
  },
});
