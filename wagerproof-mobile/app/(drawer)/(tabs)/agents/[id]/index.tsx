import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTheme, Button, Chip, Snackbar } from 'react-native-paper';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useAgent } from '@/hooks/useAgents';
import {
  useTodaysPicks,
  useAgentPicks,
  useGeneratePicks,
} from '@/hooks/useAgentPicks';
import { AgentPickItem, PickCardSkeleton } from '@/components/agents/AgentPickItem';
import { AgentPerformanceCharts } from '@/components/agents/AgentPerformanceCharts';
import { ThinkingAnimation } from '@/components/agents/ThinkingAnimation';
import { useGameLookup } from '@/hooks/useGameLookup';
import {
  AgentPick,
  Sport,
  formatRecord,
  formatNetUnits,
  formatStreak,
} from '@/types/agent';

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

function buildPersonalityAlignmentFallback(personality: any): string {
  if (!personality) return 'No archived personality settings available for this pick.';

  const parts: string[] = [];
  if (personality.preferred_bet_type) parts.push(`bet_type=${personality.preferred_bet_type}`);
  if (typeof personality.risk_tolerance === 'number') parts.push(`risk_tolerance=${personality.risk_tolerance}/5`);
  if (typeof personality.confidence_threshold === 'number') parts.push(`confidence_threshold=${personality.confidence_threshold}/5`);
  if (typeof personality.trust_model === 'number') parts.push(`trust_model=${personality.trust_model}/5`);
  if (typeof personality.trust_polymarket === 'number') parts.push(`trust_polymarket=${personality.trust_polymarket}/5`);
  if (personality.chase_value === true) parts.push('chase_value=true');
  if (personality.fade_public === true) parts.push('fade_public=true');
  if (personality.skip_weak_slates === true) parts.push('skip_weak_slates=true');

  if (parts.length === 0) {
    return 'No explicit personality dimensions were found in archived_personality.';
  }

  return `Fallback personality mapping from archived settings: ${parts.join(', ')}.`;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

function AgentDetailLoadingShimmer({ isDark, topInset }: { isDark: boolean; topInset: number }) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmer.value,
          [0, 1],
          [-240, 240],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const baseColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const highlightColor = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.75)';

  const shimmerBlock = (style: any) => (
    <View style={[style, { backgroundColor: baseColor, overflow: 'hidden' }]}>
      <AnimatedLinearGradient
        colors={[baseColor, highlightColor, baseColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[StyleSheet.absoluteFillObject, animatedStyle]}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <View style={[styles.loadingHeader, { paddingTop: topInset, borderBottomColor: 'rgba(150, 150, 150, 0.1)' }]}>
        <View style={styles.headerContent}>
          {shimmerBlock(styles.loadingIconSkeleton)}
          {shimmerBlock(styles.loadingTitleSkeleton)}
          {shimmerBlock(styles.loadingIconSkeleton)}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset + 56, paddingBottom: 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          <View style={styles.profileHeader}>
            {shimmerBlock(styles.loadingAvatarSkeleton)}
            <View style={styles.profileInfo}>
              {shimmerBlock(styles.loadingNameSkeleton)}
              <View style={styles.sportBadges}>
                {shimmerBlock(styles.loadingChipSkeleton)}
                {shimmerBlock(styles.loadingChipSkeleton)}
              </View>
            </View>
          </View>

          <View style={[styles.statsRow, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.statItem}>
                {shimmerBlock(styles.loadingStatLabelSkeleton)}
                {shimmerBlock(styles.loadingStatValueSkeleton)}
              </View>
            ))}
          </View>
        </View>

        {shimmerBlock(styles.loadingGenerateButtonSkeleton)}

        <View style={styles.section}>
          {shimmerBlock(styles.loadingSectionTitleSkeleton)}
          <View style={styles.picksList}>
            <PickCardSkeleton isDark={isDark} />
            <PickCardSkeleton isDark={isDark} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function AgentDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const { adminModeEnabled } = useAdminMode();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Local state
  const [pickFilter, setPickFilter] = useState<PickFilter>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [limitToastVisible, setLimitToastVisible] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState<string | null>(null);
  const [noPicksConclusion, setNoPicksConclusion] = useState<string | null>(null);
  const [generatingToastVisible, setGeneratingToastVisible] = useState(false);
  const [selectedAuditPick, setSelectedAuditPick] = useState<AgentPick | null>(null);
  const isGeneratingRef = useRef(false);
  const auditSheetRef = useRef<BottomSheet>(null);

  // Fetch agent data
  const {
    data: agent,
    isLoading: isLoadingAgent,
    isRefetching: isRefetchingAgent,
    refetch: refetchAgent,
  } = useAgent(id || '');

  // Fetch today's picks
  const {
    data: todaysPicks,
    isLoading: isLoadingTodaysPicks,
    refetch: refetchTodaysPicks,
  } = useTodaysPicks(id || '');

  // Fetch pick history
  const {
    data: allPicks,
    isLoading: isLoadingAllPicks,
    refetch: refetchAllPicks,
  } = useAgentPicks(id || '');

  // Game lookup for opening bottom sheets
  const { openGameForPick } = useGameLookup();

  // Generate picks mutation
  const generatePicksMutation = useGeneratePicks();

  // Calculate daily generation limit
  const MAX_DAILY_GENERATIONS = 3;
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const dailyGenCount = useMemo(() => {
    if (!agent) return 0;
    // Reset count if the stored date doesn't match today
    if (agent.last_generation_date !== todayStr) return 0;
    return agent.daily_generation_count || 0;
  }, [agent?.daily_generation_count, agent?.last_generation_date, todayStr]);

  const regensRemaining = adminModeEnabled
    ? Infinity
    : MAX_DAILY_GENERATIONS - dailyGenCount;

  const canRegenerate = adminModeEnabled || regensRemaining > 0;

  // Filter picks for history
  const filteredPicks = useMemo(() => {
    if (!allPicks) return [];
    if (pickFilter === 'all') return allPicks;
    return allPicks.filter((pick) => pick.result === pickFilter);
  }, [allPicks, pickFilter]);

  // Handle generate picks (initial or regeneration)
  const handleGeneratePicks = useCallback(async () => {
    if (!id || !canRegenerate) return;

    if (isGeneratingRef.current || generatePicksMutation.isPending) {
      setGeneratingToastVisible(true);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    isGeneratingRef.current = true;
    setNoPicksConclusion(null);

    try {
      const { result } = await generatePicksMutation.mutateAsync({ agentId: id, isAdmin: adminModeEnabled });
      // Refetch data after generation
      refetchAgent();
      refetchTodaysPicks();
      refetchAllPicks();

      if (result.picks.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setNoPicksConclusion(result.slate_note || 'Conclusion: no quality picks found on this slate.');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNoPicksConclusion(null);
      }
    } catch (error) {
      console.error('Error generating picks:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorToastMessage(error instanceof Error ? error.message : 'Failed to generate picks. Please try again.');
    } finally {
      isGeneratingRef.current = false;
    }
  }, [
    id,
    canRegenerate,
    adminModeEnabled,
    generatePicksMutation,
    refetchAgent,
    refetchTodaysPicks,
    refetchAllPicks,
  ]);

  // Handle navigation to settings
  const handleOpenSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/agents/${id}/settings` as any);
  }, [router, id]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetchAgent();
    refetchTodaysPicks();
    refetchAllPicks();
  }, [refetchAgent, refetchTodaysPicks, refetchAllPicks]);

  const auditSnapPoints = useMemo(() => ['85%', '95%'], []);

  const openPickAudit = useCallback((pick: AgentPick) => {
    setSelectedAuditPick(pick);
    auditSheetRef.current?.snapToIndex(0);
  }, []);

  const closePickAudit = useCallback(() => {
    setSelectedAuditPick(null);
    auditSheetRef.current?.close();
  }, []);

  const renderPickWithActions = (pick: AgentPick) => (
    <View key={pick.id}>
      <AgentPickItem
        pick={pick}
        showReasoning="full"
      />
      <View style={styles.pickActionsRow}>
        <TouchableOpacity
          style={[styles.pickActionButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => {
            if (pick.game_id) openGameForPick(pick.sport, pick.game_id, pick);
          }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="cards-outline" size={14} color="#ffffff" />
          <Text style={styles.pickActionButtonText}>Open Game Card</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pickActionButton,
            {
              backgroundColor: isDark ? '#111717' : '#0f1718',
              borderColor: isDark ? 'rgba(0, 230, 118, 0.24)' : 'rgba(0, 186, 98, 0.3)',
              borderWidth: 1,
            },
          ]}
          onPress={() => openPickAudit(pick)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="file-code-outline" size={14} color="#26df85" />
          <Text style={[styles.pickActionButtonText, { color: '#26df85' }]}>Open Pick Audit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAuditBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.7}
    />
  );

  const auditTrace = (selectedAuditPick?.ai_decision_trace as any) || {};
  const leanedMetrics = Array.isArray(auditTrace.leaned_metrics) && auditTrace.leaned_metrics.length > 0
    ? auditTrace.leaned_metrics
    : (selectedAuditPick?.key_factors || []).map((factor, idx) => ({
        metric_key: `key_factor_${idx + 1}`,
        metric_value: factor,
        why_it_mattered: factor,
        personality_trait: 'fallback_from_key_factors',
      }));
  const rationaleText =
    auditTrace.rationale_summary ||
    selectedAuditPick?.reasoning_text ||
    'No rationale text available.';
  const personalityAlignmentText =
    auditTrace.personality_alignment ||
    buildPersonalityAlignmentFallback(selectedAuditPick?.archived_personality);
  const auditPayload = (selectedAuditPick?.ai_audit_payload as any) || {};
  const modelInputGamePayload =
    auditPayload.model_input_game_payload ||
    selectedAuditPick?.archived_game_data ||
    {};
  const modelInputPersonalityPayload =
    auditPayload.model_input_personality_payload ||
    selectedAuditPick?.archived_personality ||
    {};
  const modelResponsePayload =
    auditPayload.model_response_payload || {
      game_id: selectedAuditPick?.game_id,
      bet_type: selectedAuditPick?.bet_type,
      selection: selectedAuditPick?.pick_selection,
      odds: selectedAuditPick?.odds,
      confidence: selectedAuditPick?.confidence,
      reasoning: selectedAuditPick?.reasoning_text,
      key_factors: selectedAuditPick?.key_factors,
      decision_trace: selectedAuditPick?.ai_decision_trace,
    };
  const payloadIsFormatted =
    !!modelInputGamePayload &&
    (Object.prototype.hasOwnProperty.call(modelInputGamePayload, 'vegas_lines') ||
      Object.prototype.hasOwnProperty.call(modelInputGamePayload, 'model_predictions') ||
      Object.prototype.hasOwnProperty.call(modelInputGamePayload, 'game_data_complete'));

  // Render loading state
  if (isLoadingAgent && !agent) {
    return <AgentDetailLoadingShimmer isDark={isDark} topInset={insets.top} />;
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

  const hasTodaysPicks = todaysPicks && todaysPicks.length > 0;

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

          <TouchableOpacity
            onPress={handleOpenSettings}
            style={styles.settingsButton}
          >
            <MaterialCommunityIcons
              name="cog"
              size={24}
              color={theme.colors.onSurface}
            />
          </TouchableOpacity>
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

        {/* Generate Picks Button */}
        {generatePicksMutation.isPending ? (
          <ThinkingAnimation variant="generatingPicks" />
        ) : hasTodaysPicks ? (
          <View
            style={[
              styles.generateButton,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.05)',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.generateButtonText,
                { color: theme.colors.onSurfaceVariant, flex: 1 },
              ]}
            >
              Picks Generated
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (canRegenerate) {
                  handleGeneratePicks();
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  setLimitToastVisible(true);
                }
              }}
              activeOpacity={0.7}
              style={[
                styles.regenButton,
                {
                  backgroundColor: canRegenerate
                    ? theme.colors.primary
                    : isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.03)',
                },
              ]}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={18}
                color={canRegenerate ? '#ffffff' : theme.colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.regenText,
                  {
                    color: canRegenerate ? '#ffffff' : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {adminModeEnabled
                  ? 'Unlimited'
                  : `${regensRemaining}/${MAX_DAILY_GENERATIONS}`}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <TouchableOpacity
              style={[
                styles.generateButton,
                {
                  backgroundColor: canRegenerate
                    ? theme.colors.primary
                    : isDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
              onPress={() => {
                if (canRegenerate) {
                  handleGeneratePicks();
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  setLimitToastVisible(true);
                }
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="lightning-bolt"
                size={24}
                color={canRegenerate ? '#ffffff' : theme.colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.generateButtonText,
                  {
                    color: canRegenerate
                      ? '#ffffff'
                      : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {canRegenerate
                  ? "Generate Today's Picks"
                  : 'Daily limit reached'}
              </Text>
            </TouchableOpacity>

            {!!noPicksConclusion && (
              <View style={[styles.noPicksTerminal, { borderColor: isDark ? 'rgba(0, 230, 118, 0.22)' : 'rgba(0, 186, 98, 0.22)' }]}>
                <Text style={[styles.noPicksHeader, { color: isDark ? '#9fb3ad' : '#7f908c' }]}>
                  terminal://generation-result
                </Text>
                <View style={styles.noPicksLineRow}>
                  <Text style={[styles.noPicksPrefix, { color: isDark ? '#00E676' : '#00BA62' }]}>›</Text>
                  <Text style={[styles.noPicksLineText, { color: isDark ? '#00E676' : '#0f7d4f' }]}>
                    Analysis complete: no high-confidence picks found.
                  </Text>
                </View>
                <View style={styles.noPicksLineRow}>
                  <Text style={[styles.noPicksPrefix, { color: isDark ? '#00E676' : '#00BA62' }]}>›</Text>
                  <Text style={[styles.noPicksLineText, { color: isDark ? '#8ca89b' : '#6b7f79' }]}>
                    {noPicksConclusion}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Today's Picks Section */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            Today&apos;s Picks
          </Text>

          <View style={styles.picksList}>
            {isLoadingTodaysPicks ? (
              <>
                <PickCardSkeleton isDark={isDark} />
                <PickCardSkeleton isDark={isDark} />
              </>
            ) : hasTodaysPicks ? (
              todaysPicks.map((pick) => renderPickWithActions(pick))
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
                  name="calendar-blank-outline"
                  size={40}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.emptyPicksText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  No picks yet today
                </Text>
                <Text
                  style={[
                    styles.emptyPicksSubtext,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Tap Generate to get started
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Pick History Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowHistory(!showHistory)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
              Pick History
            </Text>
            <MaterialCommunityIcons
              name={showHistory ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>

          {showHistory && (
            <>
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
                  filteredPicks.slice(0, 10).map((pick) => renderPickWithActions(pick))
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
                    <Text
                      style={[
                        styles.emptyPicksText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      No picks in history
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* Performance Charts */}
        <AgentPerformanceCharts
          allPicks={allPicks || []}
          preferredSports={agent.preferred_sports}
          agentColor={getPrimaryColor(agent.avatar_color)}
        />
      </ScrollView>

      <Snackbar
        visible={limitToastVisible}
        onDismiss={() => setLimitToastVisible(false)}
        duration={3000}
        style={{ backgroundColor: isDark ? '#333' : '#323232' }}
      >
        Today's limit exceeded
      </Snackbar>
      <Snackbar
        visible={!!errorToastMessage}
        onDismiss={() => setErrorToastMessage(null)}
        duration={4000}
        style={{ backgroundColor: isDark ? '#333' : '#323232' }}
      >
        {errorToastMessage || ''}
      </Snackbar>
      <Snackbar
        visible={generatingToastVisible}
        onDismiss={() => setGeneratingToastVisible(false)}
        duration={2500}
        style={{ backgroundColor: isDark ? '#333' : '#323232' }}
      >
        Already generating picks...
      </Snackbar>

      <BottomSheet
        ref={auditSheetRef}
        index={-1}
        snapPoints={auditSnapPoints}
        enablePanDownToClose
        onClose={closePickAudit}
        backdropComponent={renderAuditBackdrop}
        backgroundStyle={{ backgroundColor: isDark ? '#050909' : '#0b1011' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#2a3432' : '#96a6a0' }}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.auditSheetContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedAuditPick ? (
            <View style={[styles.auditTerminal, { borderColor: isDark ? 'rgba(0, 230, 118, 0.25)' : 'rgba(0, 186, 98, 0.3)' }]}>
              <Text style={[styles.auditHeader, { color: isDark ? '#9fb3ad' : '#c4d3ce' }]}>
                terminal://pick-audit/{selectedAuditPick.id}
              </Text>

              <View style={styles.auditLineRow}>
                <Text style={styles.auditPrefix}>›</Text>
                <Text style={styles.auditLineMain}>
                  {selectedAuditPick.matchup} | {selectedAuditPick.pick_selection}
                </Text>
              </View>

              <View style={styles.auditSection}>
                <Text style={styles.auditSectionTitle}>LEANED METRICS</Text>
                {leanedMetrics.length > 0 ? (
                  leanedMetrics.map((m: any, idx: number) => (
                    <View key={`${m.metric_key || 'metric'}-${idx}`} style={styles.auditMetricBlock}>
                      <Text style={styles.auditMetricKey}>
                        {m.metric_key || 'metric'} = {m.metric_value || 'n/a'}
                      </Text>
                      <Text style={styles.auditMetricWhy}>{m.why_it_mattered || 'No rationale provided.'}</Text>
                      <Text style={styles.auditMetricTrait}>trait: {m.personality_trait || 'unspecified'}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.auditBodyText}>No explicit leaned metrics were returned for this pick.</Text>
                )}
              </View>

              <View style={styles.auditSection}>
                <Text style={styles.auditSectionTitle}>WHY THIS PICK</Text>
                <Text style={styles.auditBodyText}>{rationaleText}</Text>
              </View>

              <View style={styles.auditSection}>
                <Text style={styles.auditSectionTitle}>PERSONALITY ALIGNMENT</Text>
                <Text style={styles.auditBodyText}>{personalityAlignmentText}</Text>
              </View>

              <View style={styles.auditSection}>
                <Text style={styles.auditSectionTitle}>MODEL INPUT GAME PAYLOAD</Text>
                {!payloadIsFormatted ? (
                  <Text style={styles.auditPayloadWarning}>
                    Note: This appears to be a legacy raw snapshot. New picks store the exact formatted model input payload.
                  </Text>
                ) : null}
                <Text style={styles.auditPayloadText}>
                  {JSON.stringify(modelInputGamePayload, null, 2)}
                </Text>
              </View>

              <View style={styles.auditSection}>
                <Text style={styles.auditSectionTitle}>AGENT PERSONALITY PAYLOAD</Text>
                <Text style={styles.auditPayloadText}>
                  {JSON.stringify(modelInputPersonalityPayload, null, 2)}
                </Text>
              </View>

              <View style={styles.auditSection}>
                <Text style={styles.auditSectionTitle}>AGENT RESPONSE PAYLOAD</Text>
                <Text style={styles.auditPayloadText}>
                  {JSON.stringify(modelResponsePayload, null, 2)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.auditBodyText, { color: isDark ? '#a4b3af' : '#4f5f5b' }]}>
              No pick selected.
            </Text>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
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
  loadingHeader: {
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
  settingsButton: {
    padding: 8,
  },
  scrollContent: {
    padding: 16,
  },
  // Profile Card
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 16,
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
  // Generate Button
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 10,
    marginBottom: 24,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  regenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  regenText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  picksList: {
    gap: 6,
  },
  pickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  pickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
  },
  pickActionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Loading
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  loadingIconSkeleton: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  loadingTitleSkeleton: {
    flex: 1,
    height: 24,
    borderRadius: 8,
    marginHorizontal: 12,
  },
  loadingAvatarSkeleton: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginRight: 16,
  },
  loadingNameSkeleton: {
    width: '58%',
    height: 24,
    borderRadius: 8,
    marginBottom: 10,
  },
  loadingChipSkeleton: {
    width: 52,
    height: 20,
    borderRadius: 8,
  },
  loadingStatLabelSkeleton: {
    width: 44,
    height: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  loadingStatValueSkeleton: {
    width: 52,
    height: 18,
    borderRadius: 6,
  },
  loadingGenerateButtonSkeleton: {
    height: 56,
    borderRadius: 14,
    marginBottom: 24,
  },
  loadingSectionTitleSkeleton: {
    width: 130,
    height: 24,
    borderRadius: 8,
    marginBottom: 12,
  },
  noPicksTerminal: {
    marginTop: -12,
    marginBottom: 24,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#0c1111',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  noPicksHeader: {
    fontSize: 11,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noPicksLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  noPicksPrefix: {
    marginRight: 8,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noPicksLineText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  auditSheetContent: {
    padding: 16,
    paddingBottom: 28,
  },
  auditTerminal: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#050909',
  },
  auditHeader: {
    fontSize: 11,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  auditLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  auditPrefix: {
    color: '#22d978',
    marginRight: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  auditLineMain: {
    color: '#22d978',
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  auditSection: {
    marginBottom: 14,
  },
  auditSectionTitle: {
    color: '#8ca89b',
    fontSize: 11,
    letterSpacing: 0.4,
    marginBottom: 6,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  auditMetricBlock: {
    marginBottom: 8,
  },
  auditMetricKey: {
    color: '#7de8b0',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  auditMetricWhy: {
    color: '#b9c7c2',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  auditMetricTrait: {
    color: '#61d29b',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  auditBodyText: {
    color: '#b9c7c2',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  auditPayloadText: {
    color: '#89d7a8',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  auditPayloadWarning: {
    color: '#d2b26a',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  emptyPicksSubtext: {
    fontSize: 14,
    marginTop: 4,
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
