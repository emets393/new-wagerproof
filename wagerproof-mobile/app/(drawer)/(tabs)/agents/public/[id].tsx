import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme, Button, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAgent } from '@/hooks/useAgents';
import { useAgentPicks } from '@/hooks/useAgentPicks';
import { AgentPickItem, PickCardSkeleton } from '@/components/agents/AgentPickItem';
import { AgentPerformanceCharts } from '@/components/agents/AgentPerformanceCharts';
import { useGameLookup } from '@/hooks/useGameLookup';
import {
  Sport,
  formatRecord,
  formatNetUnits,
  formatStreak,
} from '@/types/agent';
import { supabase } from '@/services/supabase';

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

type PickFilter = 'all' | 'won' | 'lost' | 'pending';

function parseAvatarColor(value: string): { isGradient: boolean; colors: string[] } {
  if (value.startsWith('gradient:')) {
    const colors = value.replace('gradient:', '').split(',');
    return { isGradient: true, colors };
  }
  return { isGradient: false, colors: [value] };
}

function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) {
    return value.replace('gradient:', '').split(',')[0];
  }
  return value;
}

function getPersonalityPills(params: any): string[] {
  if (!params) return [];
  const pills: string[] = [];

  const riskMap: Record<number, string> = { 1: 'Very Safe', 2: 'Conservative', 4: 'Aggressive', 5: 'High Risk' };
  if (params.risk_tolerance && riskMap[params.risk_tolerance]) pills.push(riskMap[params.risk_tolerance]);

  const betTypeMap: Record<string, string> = { spread: 'Spreads', moneyline: 'Moneylines', total: 'Totals' };
  if (params.preferred_bet_type && betTypeMap[params.preferred_bet_type]) pills.push(betTypeMap[params.preferred_bet_type]);

  const underdogMap: Record<number, string> = { 1: 'Chalk Only', 2: 'Favors Favorites', 4: 'Likes Underdogs', 5: 'Underdog Hunter' };
  if (params.underdog_lean && underdogMap[params.underdog_lean]) pills.push(underdogMap[params.underdog_lean]);

  const ouMap: Record<number, string> = { 1: 'Unders', 2: 'Leans Under', 4: 'Leans Over', 5: 'Overs' };
  if (params.over_under_lean && ouMap[params.over_under_lean]) pills.push(ouMap[params.over_under_lean]);

  if (params.chase_value) pills.push('Value Hunter');
  if (params.fade_public) pills.push('Fades Public');

  const confMap: Record<number, string> = { 1: 'Takes Any Edge', 4: 'Selective', 5: 'Very Picky' };
  if (params.confidence_threshold && confMap[params.confidence_threshold]) pills.push(confMap[params.confidence_threshold]);

  if (params.weather_impacts_totals) pills.push('Weather Aware');
  if (params.ride_hot_streaks) pills.push('Streak Rider');
  if (params.fade_cold_streaks) pills.push('Fades Cold Streaks');

  return pills.slice(0, 5);
}

export default function PublicAgentViewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Local state
  const [pickFilter, setPickFilter] = useState<PickFilter>('all');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Fetch agent data
  const {
    data: agent,
    isLoading: isLoadingAgent,
    isRefetching: isRefetchingAgent,
    refetch: refetchAgent,
  } = useAgent(id || '');

  // Fetch pick history
  const {
    data: allPicks,
    isLoading: isLoadingAllPicks,
    refetch: refetchAllPicks,
  } = useAgentPicks(id || '');

  // Game lookup for opening bottom sheets
  const { openGameForPick } = useGameLookup();

  // Check if user is following this agent
  React.useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user?.id || !id) return;

      try {
        const { data, error } = await supabase
          .from('user_avatar_follows')
          .select('id')
          .eq('user_id', user.id)
          .eq('avatar_id', id)
          .maybeSingle();

        if (!error && data) {
          setIsFollowing(true);
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };

    checkFollowStatus();
  }, [user?.id, id]);

  // Filter picks for history
  const filteredPicks = useMemo(() => {
    if (!allPicks) return [];
    if (pickFilter === 'all') return allPicks;
    return allPicks.filter((pick) => pick.result === pickFilter);
  }, [allPicks, pickFilter]);

  // Handle follow/unfollow
  const handleFollowToggle = useCallback(async () => {
    if (!user?.id || !id) {
      Alert.alert('Sign In Required', 'Please sign in to follow agents');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsFollowLoading(true);

    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('user_avatar_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('avatar_id', id);

        if (error) throw error;
        setIsFollowing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Follow
        const { error } = await supabase
          .from('user_avatar_follows')
          .insert({
            user_id: user.id,
            avatar_id: id,
          });

        if (error) throw error;
        setIsFollowing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  }, [user?.id, id, isFollowing]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetchAgent();
    refetchAllPicks();
  }, [refetchAgent, refetchAllPicks]);

  // Render loading state
  if (isLoadingAgent && !agent) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContent,
          { backgroundColor: isDark ? '#000000' : '#ffffff' },
        ]}
      >
        <Text style={{ color: theme.colors.onSurfaceVariant }}>
          Loading agent...
        </Text>
      </View>
    );
  }

  // Render error state
  if (!agent) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContent,
          { backgroundColor: isDark ? '#000000' : '#ffffff' },
        ]}
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={48}
          color={theme.colors.error}
        />
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          Agent not found
        </Text>
        <Button mode="outlined" onPress={() => router.back()}>
          Go Back
        </Button>
      </View>
    );
  }

  // Check if agent is public
  if (!agent.is_public) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContent,
          { backgroundColor: isDark ? '#000000' : '#ffffff' },
        ]}
      >
        <MaterialCommunityIcons
          name="lock-outline"
          size={48}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}
        >
          This agent is private
        </Text>
        <Button mode="outlined" onPress={() => router.back()}>
          Go Back
        </Button>
      </View>
    );
  }

  const performance = agent.performance;
  const record = formatRecord(performance);
  const netUnits = performance ? formatNetUnits(performance.net_units) : '+0.00u';
  const winRate = performance?.win_rate
    ? `${(performance.win_rate * 100).toFixed(1)}%`
    : '-';
  const streak = performance ? formatStreak(performance.current_streak) : '-';
  const isPositive = performance ? performance.net_units >= 0 : true;
  const streakColor =
    performance && performance.current_streak > 0
      ? '#10b981'
      : performance && performance.current_streak < 0
      ? '#ef4444'
      : theme.colors.onSurfaceVariant;

  // Check if this is the user's own agent
  const isOwnAgent = user?.id === agent.user_id;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff' },
      ]}
    >
      {/* Header */}
      <AndroidBlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            borderBottomColor: 'rgba(150, 150, 150, 0.1)',
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.colors.onSurface}
            />
          </TouchableOpacity>

          <View style={styles.headerTitleSection}>
            <Text
              style={[styles.headerTitle, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {agent.name}
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>
      </AndroidBlurView>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingAgent}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Agent Profile Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.02)',
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          {/* Avatar and Info */}
          <View style={styles.profileHeader}>
            {(() => {
              const parsed = parseAvatarColor(agent.avatar_color);
              if (parsed.isGradient) {
                return (
                  <LinearGradient
                    colors={parsed.colors as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarLarge}
                  >
                    <Text style={styles.avatarEmojiLarge}>{agent.avatar_emoji}</Text>
                  </LinearGradient>
                );
              }
              return (
                <View
                  style={[
                    styles.avatarLarge,
                    { backgroundColor: agent.avatar_color },
                  ]}
                >
                  <Text style={styles.avatarEmojiLarge}>{agent.avatar_emoji}</Text>
                </View>
              );
            })()}
            <View style={styles.profileInfo}>
              <Text
                style={[styles.agentName, { color: theme.colors.onSurface }]}
              >
                {agent.name}
              </Text>
              <View style={styles.sportBadges}>
                {agent.preferred_sports.map((sport) => (
                  <View
                    key={sport}
                    style={[
                      styles.sportBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sportBadgeText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {SPORT_LABELS[sport]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Personality Pills */}
          {(() => {
            const pills = getPersonalityPills(agent.personality_params);
            if (pills.length === 0) return null;
            const pillColor = getPrimaryColor(agent.avatar_color);
            return (
              <View style={styles.personalityPills}>
                {pills.map((pill) => (
                  <View
                    key={pill}
                    style={[
                      styles.personalityPill,
                      { backgroundColor: `${pillColor}20` },
                    ]}
                  >
                    <Text style={[styles.personalityPillText, { color: pillColor }]}>
                      {pill}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {/* Public indicator */}
          <View style={styles.publicIndicator}>
            <MaterialCommunityIcons
              name="earth"
              size={14}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.publicIndicatorText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Public Agent
            </Text>
          </View>

          {/* Stats Row */}
          <View
            style={[
              styles.statsRow,
              {
                borderTopColor: isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
          >
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Record
              </Text>
              <Text
                style={[styles.statValue, { color: theme.colors.onSurface }]}
              >
                {record}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Net Units
              </Text>
              <Text
                style={[
                  styles.statValue,
                  styles.unitsValue,
                  { color: isPositive ? '#10b981' : '#ef4444' },
                ]}
              >
                {netUnits}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Win Rate
              </Text>
              <Text
                style={[styles.statValue, { color: theme.colors.onSurface }]}
              >
                {winRate}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Streak
              </Text>
              <Text style={[styles.statValue, { color: streakColor }]}>
                {streak}
              </Text>
            </View>
          </View>
        </View>

        {/* Follow Button (only show if not own agent) */}
        {!isOwnAgent && (
          <TouchableOpacity
            style={[
              styles.followButton,
              {
                backgroundColor: isFollowing
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.05)'
                  : theme.colors.primary,
                borderColor: isFollowing
                  ? theme.colors.primary
                  : 'transparent',
              },
            ]}
            onPress={handleFollowToggle}
            disabled={isFollowLoading}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={isFollowing ? 'check' : 'plus'}
              size={20}
              color={isFollowing ? theme.colors.primary : '#ffffff'}
            />
            <Text
              style={[
                styles.followButtonText,
                {
                  color: isFollowing ? theme.colors.primary : '#ffffff',
                },
              ]}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Own Agent Indicator */}
        {isOwnAgent && (
          <View
            style={[
              styles.ownAgentIndicator,
              {
                backgroundColor: isDark
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(16, 185, 129, 0.1)',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="account-check"
              size={20}
              color="#10b981"
            />
            <Text style={[styles.ownAgentText, { color: '#10b981' }]}>
              This is your agent
            </Text>
          </View>
        )}

        {/* Pick History Section */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            Pick History
          </Text>

          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
            {(['all', 'won', 'lost', 'pending'] as PickFilter[]).map(
              (filter) => (
                <Chip
                  key={filter}
                  mode={pickFilter === filter ? 'flat' : 'outlined'}
                  selected={pickFilter === filter}
                  onPress={() => setPickFilter(filter)}
                  style={[
                    styles.filterChip,
                    pickFilter === filter && {
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                  textStyle={{
                    color:
                      pickFilter === filter
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurfaceVariant,
                    textTransform: 'capitalize',
                  }}
                >
                  {filter}
                </Chip>
              )
            )}
          </ScrollView>

          {/* Pick List */}
          <View style={styles.picksList}>
            {isLoadingAllPicks ? (
              <>
                <PickCardSkeleton isDark={isDark} />
                <PickCardSkeleton isDark={isDark} />
                <PickCardSkeleton isDark={isDark} />
              </>
            ) : filteredPicks.length > 0 ? (
              filteredPicks.slice(0, 20).map((pick) => (
                <AgentPickItem
                  key={pick.id}
                  pick={pick}
                  showReasoning="full"
                  onPress={() => pick.game_id ? openGameForPick(pick.sport, pick.game_id) : undefined}
                />
              ))
            ) : (
              <View
                style={[
                  styles.emptyPicksContainer,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={40}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.emptyPicksText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {pickFilter === 'all'
                    ? 'No picks yet'
                    : `No ${pickFilter} picks`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Performance Charts */}
        <AgentPerformanceCharts
          allPicks={allPicks || []}
          preferredSports={agent.preferred_sports}
          agentColor={getPrimaryColor(agent.avatar_color)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleSection: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: 16,
  },
  // Profile Card
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarEmojiLarge: {
    fontSize: 36,
  },
  profileInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  sportBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sportBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sportBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  personalityPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  personalityPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  personalityPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  publicIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  publicIndicatorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  unitsValue: {
    fontWeight: '800',
  },
  // Follow Button
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    gap: 8,
    marginBottom: 24,
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Own Agent Indicator
  ownAgentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  ownAgentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  picksList: {
    gap: 6,
  },
  // Empty Picks
  emptyPicksContainer: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyPicksText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  // Filter Chips
  filterChips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    borderRadius: 20,
  },
  // Error
  errorText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
});
