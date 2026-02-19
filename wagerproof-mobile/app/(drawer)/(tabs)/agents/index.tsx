import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useScroll } from '@/contexts/ScrollContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useUserAgents } from '@/hooks/useAgents';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { trackAppOpen } from '@/services/activityService';
import { AgentTimelineSection } from '@/components/agents/AgentTimeline';
import { AgentLeaderboard } from '@/components/agents/AgentLeaderboard';
import { AgentWithPerformance } from '@/types/agent';
import { useDrawer } from '../../_layout';

type AgentsTab = 'my-agents' | 'leaderboard';

// Skeleton component for loading state (matches compact header + CompactPickCard)
function AgentTimelineSkeleton({ isDark }: { isDark: boolean }) {
  const shimmer = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const headerBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
  const cardBg = isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.9)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <View style={styles.skeletonSection}>
      {/* Compact header skeleton */}
      <View style={[styles.skeletonHeader, { backgroundColor: headerBg }]}>
        <View style={[styles.skeletonEmoji, { backgroundColor: shimmer }]} />
        <View style={[styles.skeletonName, { backgroundColor: shimmer }]} />
        <View style={{ flex: 1 }} />
        <View style={[styles.skeletonStat, { backgroundColor: shimmer }]} />
      </View>
      {/* CompactPickCard-shaped skeletons */}
      {[1, 2].map((i) => (
        <View key={i} style={[styles.skeletonCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.skeletonAccent, { backgroundColor: shimmer }]} />
          <View style={styles.skeletonCardContent}>
            <View style={styles.skeletonCardRow}>
              <View style={[styles.skeletonCircle, { backgroundColor: shimmer }]} />
              <View style={[styles.skeletonBar, { width: 30, backgroundColor: shimmer }]} />
              <View style={[styles.skeletonBarSmall, { backgroundColor: shimmer }]} />
              <View style={[styles.skeletonCircle, { backgroundColor: shimmer }]} />
              <View style={[styles.skeletonBar, { width: 30, backgroundColor: shimmer }]} />
            </View>
            <View style={[styles.skeletonCardRow, { marginTop: 8 }]}>
              <View style={[styles.skeletonBar, { width: '60%', backgroundColor: shimmer }]} />
              <View style={{ flex: 1 }} />
              <View style={[styles.skeletonBar, { width: 50, backgroundColor: shimmer }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// Empty state component
const JOURNEY_STEPS = [
  {
    icon: 'tune-variant' as const,
    title: 'Build Your Strategy',
    desc: 'Choose risk level, bet types, and sports. Pick a preset archetype or go fully custom.',
  },
  {
    icon: 'brain' as const,
    title: 'AI Analyzes Every Game',
    desc: 'Your agent scans today\'s slate using WagerProof model data, odds, and market signals.',
  },
  {
    icon: 'lightning-bolt' as const,
    title: 'Get Daily Picks',
    desc: 'Picks generate automatically each morning with reasoning and confidence levels.',
  },
];

function EmptyState({
  onCreatePress,
  isDark,
}: {
  onCreatePress: () => void;
  isDark: boolean;
}) {
  const theme = useTheme();
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)';
  const stepIconBg = isDark ? 'rgba(0, 230, 118, 0.1)' : 'rgba(0, 230, 118, 0.08)';
  const connectorColor = isDark ? 'rgba(0, 230, 118, 0.15)' : 'rgba(0, 230, 118, 0.12)';

  return (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
        Your AI Picks Expert
      </Text>
      <Text
        style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}
      >
        Build a virtual analyst that thinks the way you bet.
      </Text>

      <View style={styles.stepsContainer}>
        {JOURNEY_STEPS.map((step, index) => (
          <View key={index}>
            <View style={[styles.stepRow, { backgroundColor: cardBg, borderColor: connectorColor }]}>
              <View style={[styles.stepIconCircle, { backgroundColor: stepIconBg }]}>
                <MaterialCommunityIcons name={step.icon} size={22} color="#00E676" />
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                  {step.title}
                </Text>
                <Text style={[styles.stepDesc, { color: theme.colors.onSurfaceVariant }]}>
                  {step.desc}
                </Text>
              </View>
            </View>
            {index < JOURNEY_STEPS.length - 1 && (
              <View style={styles.connectorContainer}>
                <View style={[styles.connectorLine, { backgroundColor: connectorColor }]} />
              </View>
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.emptyButton}
        onPress={onCreatePress}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={20} color="#ffffff" />
        <Text style={styles.emptyButtonText}>Create Your First Agent</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AgentsHubScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const { user } = useAuth();
  const { open: openDrawer } = useDrawer();
  const { scrollY, scrollYClamped } = useScroll();
  const { openManualMenu } = useWagerBotSuggestion();
  const { canCreateAnotherAgent, isPro, isAdmin } = useAgentEntitlements();
  const [activeTab, setActiveTab] = useState<AgentsTab>('my-agents');

  // Fetch user's agents
  const {
    data: agents,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useUserAgents();

  // Header Animation Constants (match games page for consistent header/footer hide)
  const HEADER_TOP_HEIGHT = 56;
  const TAB_BAR_ROW_HEIGHT = 48;
  const TOTAL_HEADER_HEIGHT = insets.top + HEADER_TOP_HEIGHT + TAB_BAR_ROW_HEIGHT;
  const TOTAL_COLLAPSIBLE_HEIGHT = TOTAL_HEADER_HEIGHT;

  const headerTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [0, -TOTAL_COLLAPSIBLE_HEIGHT],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  // Track activity on mount
  useEffect(() => {
    if (user?.id) {
      trackAppOpen(user.id);
    }
  }, [user?.id]);

  // Handle navigation to create screen
  const handleCreateAgent = useCallback(() => {
    const totalCount = agents?.length || 0;
    const activeCount = agents?.filter((a) => a.is_active).length || 0;
    if (!canCreateAnotherAgent(activeCount, totalCount)) {
      Alert.alert(
        'Agent Limit Reached',
        isAdmin || isPro
          ? 'Pro users can have up to 10 active agents and 30 total created agents.'
          : 'Free users can have 1 active agent. Upgrade to Pro for more.'
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/agents/create' as any);
  }, [router, agents, canCreateAnotherAgent, isPro, isAdmin]);

  // Handle navigation to agent detail
  const handleAgentPress = useCallback(
    (agent: AgentWithPerformance) => {
      router.push(`/agents/${agent.id}` as any);
    },
    [router]
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Render agent timeline section
  const renderAgentSection = useCallback(
    ({ item }: { item: AgentWithPerformance }) => (
      <AgentTimelineSection agent={item} onAgentPress={() => handleAgentPress(item)} />
    ),
    [handleAgentPress]
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: AgentWithPerformance) => item.id,
    []
  );

  // Render loading skeletons
  const renderLoadingSkeletons = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((i) => (
        <AgentTimelineSkeleton key={i} isDark={isDark} />
      ))}
    </View>
  );

  // Calculate tab bar height for bottom padding
  const TAB_BAR_HEIGHT = 65 + insets.bottom;

  const hasAgents = agents && agents.length > 0;
  const totalCount = agents?.length || 0;
  const activeCount = agents?.filter((a) => a.is_active).length || 0;
  const canCreateMoreAgents = canCreateAnotherAgent(activeCount, totalCount);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff' },
      ]}
    >
      {/* Fixed Header with Frosted Glass Effect */}
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
            <TouchableOpacity
              onPress={() => {
                try {
                  openDrawer();
                } catch (error) {
                  console.error('Error opening drawer:', error);
                }
              }}
              style={styles.menuButton}
            >
              <MaterialCommunityIcons
                name="menu"
                size={28}
                color={theme.colors.onSurface}
              />
            </TouchableOpacity>

            <View style={styles.titleContainer}>
              <Text style={[styles.titleMain, { color: theme.colors.onSurface }]}>Wager</Text>
              <Text style={[styles.titleProof, { color: '#00E676' }]}>Proof</Text>
              <View style={styles.agentsPill}>
                <Text style={styles.agentsPillText}>Agents</Text>
              </View>
            </View>

            {user && (
              <TouchableOpacity
                onPress={openManualMenu}
                style={styles.chatButton}
              >
                <MaterialCommunityIcons name="robot" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={styles.tabButton}
              onPress={() => setActiveTab('my-agents')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'my-agents'
                      ? theme.colors.onSurface
                      : theme.colors.onSurfaceVariant,
                    fontWeight: activeTab === 'my-agents' ? '700' : '500',
                  },
                ]}
              >
                My Agents
              </Text>
              {activeTab === 'my-agents' && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tabButton}
              onPress={() => setActiveTab('leaderboard')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === 'leaderboard'
                      ? theme.colors.onSurface
                      : theme.colors.onSurfaceVariant,
                    fontWeight: activeTab === 'leaderboard' ? '700' : '500',
                  },
                ]}
              >
                Leaderboard
              </Text>
              {activeTab === 'leaderboard' && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          </View>
        </AndroidBlurView>
      </Animated.View>

      {/* Content */}
      {activeTab === 'leaderboard' ? (
        <View style={{ flex: 1 }}>
          <AgentLeaderboard
            limit={50}
            showViewAll={false}
            embedded={true}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingTop: TOTAL_HEADER_HEIGHT,
              paddingBottom: TAB_BAR_HEIGHT + 80,
            }}
            progressViewOffset={TOTAL_HEADER_HEIGHT}
          />
        </View>
      ) : isLoading && !agents ? (
        <View style={{ paddingTop: TOTAL_HEADER_HEIGHT }}>
          {renderLoadingSkeletons()}
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, { paddingTop: TOTAL_HEADER_HEIGHT }]}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.error}
          />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            Failed to load agents
          </Text>
          <TouchableOpacity
            style={[
              styles.retryButton,
              { borderColor: theme.colors.primary },
            ]}
            onPress={() => refetch()}
          >
            <Text
              style={[styles.retryButtonText, { color: theme.colors.primary }]}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : !hasAgents ? (
        <EmptyState onCreatePress={handleCreateAgent} isDark={isDark} />
      ) : (
        <Animated.FlatList
          data={agents}
          renderItem={renderAgentSection}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: TOTAL_HEADER_HEIGHT + 10 ,
              paddingBottom: TAB_BAR_HEIGHT + 80,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
              progressViewOffset={TOTAL_HEADER_HEIGHT}
            />
          }
        />
      )}

      {/* FAB for creating new agent - only on My Agents tab */}
      {activeTab === 'my-agents' && hasAgents && canCreateMoreAgents && (
        <FAB
          icon="plus"
          style={[
            styles.fab,
            {
              bottom: TAB_BAR_HEIGHT + 16,
              backgroundColor: theme.colors.primary,
            },
          ]}
          onPress={handleCreateAgent}
          color="#ffffff"
        />
      )}

      {activeTab === 'my-agents' && hasAgents && !canCreateMoreAgents && (
        <TouchableOpacity
          style={[
            styles.upgradeHint,
            {
              bottom: TAB_BAR_HEIGHT + 18,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.1)',
            },
          ]}
          activeOpacity={0.8}
          onPress={() =>
            Alert.alert(
              'Agent Limit Reached',
              isAdmin || isPro
                ? 'Pro users can have up to 10 active agents and 30 total created agents.'
                : 'Free users can have 1 active agent. Upgrade to Pro for more.'
            )
          }
        >
          <MaterialCommunityIcons name="lock" size={14} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.upgradeHintText, { color: theme.colors.onSurfaceVariant }]}>
            Agent limit reached
          </Text>
        </TouchableOpacity>
      )}
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
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    gap: 16,
  },
  menuButton: {
    padding: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleMain: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  titleProof: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  agentsPill: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
  },
  agentsPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E676',
    letterSpacing: 0.3,
  },
  chatButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    height: 48,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#00E676',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  // Empty state styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  stepsContainer: {
    marginBottom: 28,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  stepIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  connectorContainer: {
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    paddingLeft: 14 + 20, // paddingHorizontal + half icon width
  },
  connectorLine: {
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: '#00E676',
    gap: 8,
    alignSelf: 'center',
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Error state styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Skeleton styles
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  skeletonSection: {
    marginBottom: 16,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  skeletonEmoji: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  skeletonName: {
    height: 16,
    width: 80,
    borderRadius: 4,
  },
  skeletonStat: {
    height: 14,
    width: 60,
    borderRadius: 4,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  skeletonAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  skeletonCardContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  skeletonCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skeletonCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  skeletonBar: {
    height: 14,
    borderRadius: 4,
  },
  skeletonBarSmall: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  // FAB styles
  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: 28,
  },
  upgradeHint: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  upgradeHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
