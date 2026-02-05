import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, Card } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import {
  AgentWithPerformance,
  Sport,
  formatRecord,
  formatNetUnits,
  formatStreak,
} from '@/types/agent';

interface AgentCardProps {
  agent: AgentWithPerformance;
  onPress: () => void;
}

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

export function AgentCard({ agent, onPress }: AgentCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

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

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
      <Card
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.08)',
          },
        ]}
      >
        {/* Color accent bar */}
        <View
          style={[styles.accentBar, { backgroundColor: agent.avatar_color }]}
        />

        <Card.Content style={styles.content}>
          {/* Top Row: Avatar, Name, Sport Badges */}
          <View style={styles.topRow}>
            <View
              style={[
                styles.avatarContainer,
                { backgroundColor: `${agent.avatar_color}20` },
              ]}
            >
              <Text style={styles.avatarEmoji}>{agent.avatar_emoji}</Text>
            </View>

            <View style={styles.nameSection}>
              <Text
                style={[styles.name, { color: theme.colors.onSurface }]}
                numberOfLines={1}
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

            {/* Active indicator */}
            {agent.is_active && (
              <View style={styles.activeIndicator}>
                <View style={styles.activeDot} />
              </View>
            )}
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {/* Record */}
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Record
              </Text>
              <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
                {record}
              </Text>
            </View>

            {/* Net Units */}
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

            {/* Streak */}
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
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 6,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  content: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 26,
  },
  nameSection: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sportBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  sportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sportBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  activeIndicator: {
    marginLeft: 8,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.15)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  unitsValue: {
    fontWeight: '800',
  },
});
