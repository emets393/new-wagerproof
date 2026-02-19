import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Switch } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { useTodaysPicks } from '@/hooks/useAgentPicks';
import { useUpdateAgent } from '@/hooks/useAgents';
import {
  AgentWithPerformance,
  Sport,
  formatRecord,
  formatNetUnits,
  formatStreak,
} from '@/types/agent';
import { AgentPickItem, PickCardSkeleton } from './AgentPickItem';
import { LockedPickCard } from '@/components/LockedPickCard';
import { LockedGameCard } from '@/components/LockedGameCard';

// ============================================================================
// CONSTANTS
// ============================================================================

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

const SPORT_ICONS: Record<Sport, string> = {
  nfl: 'football',
  cfb: 'shield-half-full',
  nba: 'basketball',
  ncaab: 'school',
};

// ============================================================================
// HELPERS
// ============================================================================

function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) {
    return value.replace('gradient:', '').split(',')[0];
  }
  return value;
}

// ============================================================================
// AGENT TIMELINE SECTION — card container with agent header + picks
// ============================================================================

interface AgentTimelineSectionProps {
  agent: AgentWithPerformance;
  onAgentPress: () => void;
}

export function AgentTimelineSection({ agent, onAgentPress }: AgentTimelineSectionProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { canViewAgentPicks } = useAgentEntitlements();
  const updateAgent = useUpdateAgent();

  const {
    data: todaysPicks,
    isLoading,
  } = useTodaysPicks(agent.id);

  const performance = agent.performance;
  const record = formatRecord(performance);
  const netUnits = performance ? formatNetUnits(performance.net_units) : '+0.00u';
  const streak = performance ? formatStreak(performance.current_streak) : '-';
  const isPositive = performance ? performance.net_units >= 0 : true;
  const streakColor =
    performance && performance.current_streak > 0
      ? '#10b981'
      : performance && performance.current_streak < 0
      ? '#ef4444'
      : theme.colors.onSurfaceVariant;

  const handleToggleActive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateAgent.mutate({
      agentId: agent.id,
      data: { is_active: !agent.is_active, auto_generate: !agent.is_active },
    });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAgentPress();
  };

  const containerBg = isDark
    ? 'rgba(255, 255, 255, 0.04)'
    : 'rgba(255, 255, 255, 0.95)';
  const containerBorder = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.06)';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: containerBg,
          borderColor: containerBorder,
          borderLeftColor: getPrimaryColor(agent.avatar_color),
        },
      ]}
    >
      {/* Agent header row */}
      <TouchableOpacity
        style={styles.agentHeader}
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <View style={[styles.agentEmojiContainer, { backgroundColor: `${getPrimaryColor(agent.avatar_color)}25` }]}>
          <Text style={styles.agentEmoji}>{agent.avatar_emoji}</Text>
        </View>
        <View style={styles.agentInfo}>
          <View style={styles.agentTitleRow}>
            <Text
              style={[styles.agentName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {agent.name}
            </Text>
          <View style={styles.sportBadges}>
            {agent.preferred_sports.slice(0, 2).map((sport) => (
              <View
                key={sport}
                style={[
                  styles.sportBadge,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={SPORT_ICONS[sport] as any}
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            ))}
          </View>
          </View>
          <View style={styles.agentStatsRow}>
            <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
              {record}
            </Text>
            <Text style={[styles.statText, { color: isPositive ? '#10b981' : '#ef4444', fontWeight: '700' }]}>
              {netUnits}
            </Text>
            <Text style={[styles.statText, { color: streakColor }]}>{streak}</Text>
          </View>
        </View>
        {/* Active toggle + autopilot indicator */}
        <View style={styles.toggleArea}>
          <Switch
            value={agent.is_active}
            onValueChange={handleToggleActive}
            trackColor={{
              false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
              true: getPrimaryColor(agent.avatar_color) + '80',
            }}
            thumbColor={agent.is_active ? getPrimaryColor(agent.avatar_color) : isDark ? '#666' : '#ccc'}
            style={styles.activeToggle}
          />
          {agent.is_active && (
            <View style={styles.autopilotRow}>
              <Text style={[styles.autopilotText, { color: '#10b981' }]}>
                autopilot on
              </Text>
              <LottieView
                source={require('@/assets/pulselottie.json')}
                autoPlay
                loop
                style={styles.autopilotLottie}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Divider */}
      <View
        style={[
          styles.divider,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        ]}
      />

      {/* Picks list */}
      <View style={styles.picksContainer}>
        {isLoading ? (
          <>
            <PickCardSkeleton isDark={isDark} />
            <PickCardSkeleton isDark={isDark} />
          </>
        ) : !canViewAgentPicks ? (
          todaysPicks && todaysPicks.length > 0 ? (
            todaysPicks.map((pick) => (
              <LockedGameCard key={pick.id}>
                <AgentPickItem pick={pick} showReasoning="summary" onPress={onAgentPress} />
              </LockedGameCard>
            ))
          ) : (
            <>
              <LockedPickCard sport={agent.preferred_sports[0]?.toUpperCase() || 'PRO'} minHeight={96} />
              <LockedPickCard sport={agent.preferred_sports[0]?.toUpperCase() || 'PRO'} minHeight={96} />
            </>
          )
        ) : todaysPicks && todaysPicks.length > 0 ? (
          todaysPicks.map((pick) => (
            <AgentPickItem key={pick.id} pick={pick} showReasoning="summary" onPress={onAgentPress} />
          ))
        ) : (
          <TouchableOpacity
            style={styles.noPicksRow}
            activeOpacity={0.6}
            onPress={onAgentPress}
          >
            <MaterialCommunityIcons
              name="clock-outline"
              size={14}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={[styles.noPicksText, { color: theme.colors.onSurfaceVariant }]}>
              No picks today — tap to generate
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // ---- Outer container card ----
  container: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 14,
    overflow: 'hidden',
  },

  // ---- Agent header ----
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  agentEmojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentEmoji: {
    fontSize: 22,
  },
  agentInfo: {
    flex: 1,
  },
  agentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  sportBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  sportBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  activeToggle: {
    transform: [{ scale: 0.8 }],
    alignSelf: 'flex-end',
    margin: -4,
  },
  autopilotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: -4,
  },
  autopilotLottie: {
    width: 32,
    height: 32,
  },
  autopilotText: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // ---- Divider ----
  divider: {
    height: 1,
    marginHorizontal: 14,
  },

  // ---- Picks container ----
  picksContainer: {
    padding: 10,
    gap: 6,
  },

  // ---- No picks row ----
  noPicksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 6,
  },
  noPicksText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
