import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  TextInput,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useTopAgentPicksFeed, FeedFilter, FeedPickWithAgent, AgentMeta } from '@/hooks/useTopAgentPicksFeed';
import { useProAccess } from '@/hooks/useProAccess';
import { AgentPickItem, PickCardSkeleton } from '@/components/agents/AgentPickItem';
import { LockedOverlay } from '@/components/LockedOverlay';
import { formatNetUnits } from '@/types/agent';
import { useGameLookup } from '@/hooks/useGameLookup';
import { PixelEmojiInline, hasPixelEmoji } from '@/components/agents/PixelEmojiInline';

const FILTERS: { label: string; value: FeedFilter }[] = [
  { label: 'Top', value: 'top10' },
  { label: 'Following', value: 'following' },
  { label: 'Favorites', value: 'favorites' },
];

const FREE_PICK_LIMIT = 3;

function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) {
    return value.replace('gradient:', '').split(',')[0];
  }
  return value;
}

function getRankDisplay(rank: number | null): { color: string; icon: string | null } {
  if (rank === 1) return { color: '#FFD700', icon: 'trophy' };
  if (rank === 2) return { color: '#C0C0C0', icon: 'medal' };
  if (rank === 3) return { color: '#CD7F32', icon: 'medal-outline' };
  return { color: '#00E676', icon: null };
}

interface AgentHeaderProps {
  agent: AgentMeta;
  onPress: () => void;
  isDark: boolean;
}

function AgentHeader({ agent, onPress, isDark }: AgentHeaderProps) {
  const theme = useTheme();
  const record = `${agent.wins}-${agent.losses}${agent.pushes > 0 ? `-${agent.pushes}` : ''}`;
  const netUnits = formatNetUnits(agent.net_units);
  const isPositive = agent.net_units >= 0;
  const rankStyle = agent.rank ? getRankDisplay(agent.rank) : null;

  return (
    <TouchableOpacity
      style={[
        styles.agentHeader,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.03)'
            : 'rgba(0, 0, 0, 0.02)',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Rank badge */}
      {agent.rank != null && (
        <View style={styles.rankBadge}>
          {rankStyle?.icon ? (
            <MaterialCommunityIcons
              name={rankStyle.icon as any}
              size={16}
              color={rankStyle.color}
            />
          ) : (
            <Text style={[styles.rankText, { color: rankStyle?.color || theme.colors.onSurfaceVariant }]}>
              #{agent.rank}
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.agentAvatar,
          { backgroundColor: `${getPrimaryColor(agent.avatar_color)}25` },
        ]}
      >
        {hasPixelEmoji(agent.avatar_emoji)
          ? <PixelEmojiInline emoji={agent.avatar_emoji} size={20} fps={5} />
          : <Text style={styles.agentEmoji}>{agent.avatar_emoji}</Text>
        }
      </View>
      <View style={styles.agentNameContainer}>
        <Text
          style={[styles.agentName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {agent.name}
        </Text>
        <View style={styles.agentStatsRow}>
          <Text style={[styles.agentRecord, { color: theme.colors.onSurfaceVariant }]}>
            {record}
          </Text>
          <Text
            style={[
              styles.agentUnits,
              { color: isPositive ? '#10b981' : '#ef4444' },
            ]}
          >
            {netUnits}
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color={theme.colors.onSurfaceVariant}
      />
    </TouchableOpacity>
  );
}

interface TopAgentPicksFeedProps {
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
  contentContainerStyle?: any;
  progressViewOffset?: number;
}

export function TopAgentPicksFeed({
  onScroll,
  scrollEventThrottle = 16,
  contentContainerStyle,
  progressViewOffset = 0,
}: TopAgentPicksFeedProps) {
  const theme = useTheme();
  const router = useRouter();
  const { isDark } = useThemeContext();
  const { isPro } = useProAccess();
  const { openGameForPick } = useGameLookup();
  const [filter, setFilter] = useState<FeedFilter>('top10');
  const [searchText, setSearchText] = useState('');

  const { picks, isLoading, isRefetching, refetch } = useTopAgentPicksFeed(filter);

  // Filter picks by search text (agent name or team matchup)
  const filteredPicks = useMemo(() => {
    if (!searchText.trim()) return picks;
    const q = searchText.toLowerCase();
    return picks.filter(
      (p) =>
        p.agent.name.toLowerCase().includes(q) ||
        p.matchup.toLowerCase().includes(q) ||
        p.pick_selection.toLowerCase().includes(q),
    );
  }, [picks, searchText]);

  // Group consecutive picks by agent for display
  const groupedItems = useMemo(() => {
    const items: any[] = [];
    let lastAgentId: string | null = null;

    filteredPicks.forEach((pick, index) => {
      if (pick.agent.avatar_id !== lastAgentId) {
        items.push({
          type: 'header',
          agent: pick.agent,
          key: `header-${pick.agent.avatar_id}-${index}`,
        });
        lastAgentId = pick.agent.avatar_id;
      }
      items.push({
        type: 'pick',
        pick,
        key: pick.id,
      });
    });

    return items;
  }, [filteredPicks]);

  // Pro gating: free users see first N picks, rest locked
  const visibleItems = useMemo(() => {
    if (isPro) return groupedItems;

    let pickCount = 0;
    const result: any[] = [];
    for (const item of groupedItems) {
      if (item.type === 'pick') {
        pickCount++;
        if (pickCount > FREE_PICK_LIMIT) break;
      }
      result.push(item);
    }
    return result;
  }, [groupedItems, isPro]);

  const hasLockedPicks = !isPro && filteredPicks.length > FREE_PICK_LIMIT;

  const handleAgentPress = useCallback(
    (agentId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/agents/public/${agentId}` as any);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === 'header') {
        return (
          <AgentHeader
            agent={item.agent}
            onPress={() => handleAgentPress(item.agent.avatar_id)}
            isDark={isDark}
          />
        );
      }

      return (
        <View style={styles.pickContainer}>
          <AgentPickItem
            pick={item.pick}
            showReasoning="summary"
            onPress={() => {
              if (item.pick.game_id) {
                openGameForPick(item.pick.sport, item.pick.game_id, item.pick);
              }
            }}
          />
        </View>
      );
    },
    [handleAgentPress, isDark, openGameForPick],
  );

  const renderHeader = () => (
    <View>
      {/* Filter pills */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const isActive = filter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive
                      ? (isDark ? 'rgba(0, 230, 118, 0.16)' : 'rgba(0, 230, 118, 0.14)')
                      : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'),
                    borderColor: isActive
                      ? 'rgba(0, 230, 118, 0.45)'
                      : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'),
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setFilter(f.value)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isActive ? '#00E676' : theme.colors.onSurfaceVariant },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color={theme.colors.onSurfaceVariant}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.onSurface }]}
            placeholder="Search agent or team..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={searchText}
            onChangeText={setSearchText}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <MaterialCommunityIcons
                name="close-circle"
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (hasLockedPicks) {
      return (
        <LockedOverlay
          message="Unlock all agent picks with Pro"
          style={styles.lockedOverlay}
        >
          <View style={styles.lockedContent}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.lockedPickPlaceholder}>
                <PickCardSkeleton isDark={isDark} />
              </View>
            ))}
          </View>
        </LockedOverlay>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.pickContainer}>
              <PickCardSkeleton isDark={isDark} />
            </View>
          ))}
        </View>
      );
    }

    if (searchText.trim() && picks.length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="magnify"
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No picks matching "{searchText}"
          </Text>
        </View>
      );
    }

    const emptyMessage =
      filter === 'following'
        ? "You're not following any agents yet. Visit the Agents tab to discover and follow agents."
        : filter === 'favorites'
        ? "No favorited agents yet. Favorite your own agents or followed agents to see them here."
        : 'No agent picks available for the next few days. Check back later!';

    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name={filter === 'following' ? 'account-plus-outline' : filter === 'favorites' ? 'star-outline' : 'brain'}
          size={48}
          color={theme.colors.onSurfaceVariant}
        />
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.FlatList
        data={visibleItems}
        renderItem={renderItem}
        keyExtractor={(item: any) => item.key}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[styles.listContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressViewOffset={progressViewOffset}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  filterContainer: {
    paddingHorizontal: 16,
  },
  filterRow: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  rankBadge: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
  },
  agentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentEmoji: {
    fontSize: 18,
  },
  agentNameContainer: {
    flex: 1,
  },
  agentName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  agentStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentRecord: {
    fontSize: 11,
    fontWeight: '500',
  },
  agentUnits: {
    fontSize: 11,
    fontWeight: '700',
  },
  pickContainer: {
    marginHorizontal: 16,
    marginBottom: 6,
  },
  skeletonContainer: {
    paddingTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    marginHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockedOverlay: {
    marginHorizontal: 16,
    marginTop: 8,
    minHeight: 200,
  },
  lockedContent: {
    gap: 6,
    padding: 8,
  },
  lockedPickPlaceholder: {
    marginBottom: 4,
  },
});
