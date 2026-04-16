import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { AgentPickItem, PickCardSkeleton, parseMatchup } from '@/components/agents/AgentPickItem';
import { LockedOverlay } from '@/components/LockedOverlay';
import { OutlierMatchupCard } from '@/components/OutlierMatchupCard';
import { OutlierCardShimmer } from '@/components/OutlierCardShimmer';
import { formatNetUnits } from '@/types/agent';
import { useGameLookup } from '@/hooks/useGameLookup';
import { SportType } from '@/components/TeamAvatar';

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

/** Group picks into agent sections: { agent, picks[] } */
interface AgentSection {
  agent: AgentMeta;
  picks: FeedPickWithAgent[];
}

function groupPicksByAgent(picks: FeedPickWithAgent[]): AgentSection[] {
  const sections: AgentSection[] = [];
  let currentSection: AgentSection | null = null;

  for (const pick of picks) {
    if (!currentSection || currentSection.agent.avatar_id !== pick.agent.avatar_id) {
      currentSection = { agent: pick.agent, picks: [] };
      sections.push(currentSection);
    }
    currentSection.picks.push(pick);
  }

  return sections;
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
  const { isPro, isLoading: isProLoading } = useProAccess();
  const { openGameForPick } = useGameLookup();
  const [filter, setFilter] = useState<FeedFilter>('top10');
  const [searchText, setSearchText] = useState('');
  const [loadingPickId, setLoadingPickId] = useState<string | null>(null);

  const { picks, isLoading, isRefetching, refetch } = useTopAgentPicksFeed(filter);

  // Filter picks by search text
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

  // Group into agent sections
  const agentSections = useMemo(() => groupPicksByAgent(filteredPicks), [filteredPicks]);

  // Pro gating: free users see first N picks total
  const visibleSections = useMemo(() => {
    if (isProLoading || isPro) return agentSections;

    let pickCount = 0;
    const result: AgentSection[] = [];
    for (const section of agentSections) {
      if (pickCount >= FREE_PICK_LIMIT) break;
      const remaining = FREE_PICK_LIMIT - pickCount;
      const visiblePicks = section.picks.slice(0, remaining);
      result.push({ agent: section.agent, picks: visiblePicks });
      pickCount += visiblePicks.length;
    }
    return result;
  }, [agentSections, isPro, isProLoading]);

  const hasLockedPicks = !isProLoading && !isPro && filteredPicks.length > FREE_PICK_LIMIT;

  const handleAgentPress = useCallback(
    (agentId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/agents/public/${agentId}` as any);
    },
    [router],
  );

  const emptyMessage =
    filter === 'following'
      ? "You're not following any agents yet. Visit the Agents tab to discover and follow agents."
      : filter === 'favorites'
      ? "No favorited agents yet. Favorite your own agents or followed agents to see them here."
      : 'No agent picks available for the next few days. Check back later!';

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
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
      >
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

        {/* Loading state — cascading shimmer */}
        {isLoading && (
          <View style={styles.skeletonContainer}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.sectionSkeleton}>
                <View style={[styles.skeletonHeader, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />
                <View style={styles.skeletonCardRow}>
                  {[0, 1, 2].map((j) => (
                    <OutlierCardShimmer key={j} delay={i * 400 + j * 150} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {!isLoading && filteredPicks.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name={
                searchText.trim() && picks.length > 0 ? 'magnify' :
                filter === 'following' ? 'account-plus-outline' :
                filter === 'favorites' ? 'star-outline' : 'brain'
              }
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              {searchText.trim() && picks.length > 0
                ? `No picks matching "${searchText}"`
                : emptyMessage}
            </Text>
          </View>
        )}

        {/* Agent sections — Spotify-style horizontal card rows */}
        {!isLoading && visibleSections.map((section) => {
          const { agent } = section;
          const record = `${agent.wins}-${agent.losses}${agent.pushes > 0 ? `-${agent.pushes}` : ''}`;
          const netUnits = formatNetUnits(agent.net_units);
          const isPositive = agent.net_units >= 0;
          const rankStyle = agent.rank ? getRankDisplay(agent.rank) : null;

          return (
            <View key={`section-${agent.avatar_id}`} style={styles.agentSection}>
              {/* Agent header */}
              <TouchableOpacity
                style={styles.agentHeader}
                onPress={() => handleAgentPress(agent.avatar_id)}
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
                  <Text style={styles.agentEmoji}>{agent.avatar_emoji}</Text>
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

              {/* Horizontally scrollable pick cards */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.cardScrollBreakout}
                contentContainerStyle={styles.cardRow}
              >
                {section.picks.slice(0, 4).map((pick) => {
                  const { away, home } = parseMatchup(pick.matchup);
                  return (
                    <OutlierMatchupCard
                      key={pick.id}
                      awayTeam={away}
                      homeTeam={home}
                      sport={pick.sport as SportType}
                      pickIcon={
                        pick.bet_type === 'spread' ? 'numeric' :
                        pick.bet_type === 'moneyline' ? 'currency-usd' :
                        pick.bet_type === 'total' ? 'arrow-up-down' :
                        'cards-outline'
                      }
                      betTypeIcon={
                        pick.bet_type === 'spread' ? 'numeric' :
                        pick.bet_type === 'moneyline' ? 'currency-usd' :
                        pick.bet_type === 'total' ? 'arrow-up-down' :
                        'cards-outline'
                      }
                      pickLabel={pick.pick_selection}
                      pickValue={pick.odds || undefined}
                      accentColor={getPrimaryColor(agent.avatar_color)}
                      loading={loadingPickId === pick.id}
                      onPress={async () => {
                        if (pick.game_id) {
                          setLoadingPickId(pick.id);
                          try {
                            await openGameForPick(pick.sport, pick.game_id, pick);
                          } finally {
                            setTimeout(() => setLoadingPickId(null), 500);
                          }
                        }
                      }}
                    />
                  );
                })}
              </ScrollView>
            </View>
          );
        })}

        {/* Locked overlay for free users */}
        {hasLockedPicks && (
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
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterContainer: {
    marginHorizontal: -16,
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
    marginBottom: 12,
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
  // Agent sections — Spotify-style
  agentSection: {
    marginBottom: 24,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingRight: 4,
  },
  rankBadge: {
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentEmoji: {
    fontSize: 16,
  },
  agentNameContainer: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
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
  // Horizontal card scroll — edge to edge
  cardScrollBreakout: {
    marginHorizontal: -16,
  },
  cardRow: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  // Loading
  skeletonContainer: {
    gap: 24,
    paddingTop: 8,
  },
  sectionSkeleton: {
    gap: 12,
  },
  skeletonHeader: {
    height: 32,
    borderRadius: 10,
    width: '60%',
  },
  skeletonCardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonCard: {
    width: 160,
    height: 160,
    borderRadius: 14,
  },
  // Empty
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    marginTop: 24,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Locked
  lockedOverlay: {
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
