import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { formatNetUnits, formatRecord } from '@/types/agent';
import type { FollowedAgentDetailed } from '@/hooks/useFollowedAgents';

function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) return value.replace('gradient:', '').split(',')[0];
  return value;
}
function getSecondaryColor(value: string): string {
  if (value.startsWith('gradient:')) {
    const parts = value.replace('gradient:', '').split(',');
    return parts[1] || parts[0];
  }
  return value;
}

interface FollowingAgentCardProps {
  agent: FollowedAgentDetailed;
  onPress: () => void;
  onToggleFavorite: () => void;
  onToggleNotify: () => void;
}

/**
 * Compact full-width card for a FOLLOWED agent (spectator-only — no generate/run).
 * Tap opens the PUBLIC detail route. Star toggles is_favorite, bell toggles
 * notify_on_pick (both mutate only the caller's own follow row).
 */
export const FollowingAgentCard = React.memo(function FollowingAgentCard({
  agent,
  onPress,
  onToggleFavorite,
  onToggleNotify,
}: FollowingAgentCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const primary = useMemo(() => getPrimaryColor(agent.avatar_color), [agent.avatar_color]);
  const secondary = useMemo(() => getSecondaryColor(agent.avatar_color), [agent.avatar_color]);
  const perf = agent.performance;
  const record = formatRecord(perf);
  const netUnits = perf ? formatNetUnits(perf.net_units) : '+0.00u';
  const isPositive = perf ? perf.net_units >= 0 : true;

  const cardBg = isDark ? '#1a1a1a' : '#ffffff';
  const dimText = isDark ? '#8b949e' : '#6b7280';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      {/* Avatar */}
      <LinearGradient
        colors={[primary, secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatar}
      >
        <Text style={styles.avatarEmoji}>{agent.avatar_emoji}</Text>
      </LinearGradient>

      {/* Identity + record */}
      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {agent.name}
          </Text>
          <View style={styles.followingBadge}>
            <MaterialCommunityIcons name="eye-outline" size={10} color="#3b82f6" />
            <Text style={styles.followingBadgeText}>Following</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <Text style={[styles.record, { color: dimText }]}>{record}</Text>
          <Text style={[styles.units, { color: isPositive ? '#22c55e' : '#ef4444' }]}>{netUnits}</Text>
        </View>
      </View>

      {/* Star + bell toggles */}
      <View style={styles.actions}>
        <TouchableOpacity
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation?.();
            Haptics.selectionAsync();
            onToggleFavorite();
          }}
          style={styles.actionBtn}
        >
          <MaterialCommunityIcons
            name={agent.is_favorite ? 'star' : 'star-outline'}
            size={20}
            color={agent.is_favorite ? '#f59e0b' : dimText}
          />
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation?.();
            Haptics.selectionAsync();
            onToggleNotify();
          }}
          style={styles.actionBtn}
        >
          <MaterialCommunityIcons
            name={agent.notify_on_pick ? 'bell' : 'bell-outline'}
            size={20}
            color={agent.notify_on_pick ? theme.colors.primary : dimText}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 22 },
  middle: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  followingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  followingBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3b82f6',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  record: { fontSize: 12, fontWeight: '600' },
  units: { fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { padding: 6 },
});
