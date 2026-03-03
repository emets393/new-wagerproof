import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeContext } from '@/contexts/ThemeContext';
import { AgentPickOverlap } from '@/types/agent';

interface AgentOverlapFooterProps {
  overlap: AgentPickOverlap;
}

const MAX_VISIBLE = 5;

function parseAvatarColor(color: string): { isGradient: boolean; colors: string[] } {
  if (color.startsWith('gradient:')) {
    return { isGradient: true, colors: color.replace('gradient:', '').split(',') };
  }
  return { isGradient: false, colors: [color] };
}

export function AgentOverlapFooter({ overlap }: AgentOverlapFooterProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  if (overlap.totalCount === 0) return null;

  const visible = overlap.agents.slice(0, MAX_VISIBLE);
  const overflow = overlap.totalCount - MAX_VISIBLE;
  const borderColor = isDark ? 'rgba(30, 30, 30, 1)' : 'rgba(255, 255, 255, 1)';

  return (
    <View style={[styles.container, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
      <View style={styles.avatarStack}>
        {visible.map((agent, i) => {
          const { isGradient, colors } = parseAvatarColor(agent.avatar_color);

          const circleContent = (
            <Text style={styles.emoji}>{agent.avatar_emoji}</Text>
          );

          if (isGradient) {
            return (
              <View
                key={agent.avatar_id}
                style={[styles.avatarCircle, { borderColor, zIndex: MAX_VISIBLE - i, marginLeft: i === 0 ? 0 : -8 }]}
              >
                <LinearGradient
                  colors={colors as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientFill}
                >
                  {circleContent}
                </LinearGradient>
              </View>
            );
          }

          return (
            <View
              key={agent.avatar_id}
              style={[
                styles.avatarCircle,
                { backgroundColor: colors[0], borderColor, zIndex: MAX_VISIBLE - i, marginLeft: i === 0 ? 0 : -8 },
              ]}
            >
              {circleContent}
            </View>
          );
        })}

        {overflow > 0 && (
          <View
            style={[
              styles.avatarCircle,
              styles.overflowCircle,
              {
                borderColor,
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                zIndex: 0,
                marginLeft: -8,
              },
            ]}
          >
            <Text style={[styles.overflowText, { color: theme.colors.onSurfaceVariant }]}>
              +{overflow}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
        {overlap.totalCount === 1
          ? '1 other agent made this pick'
          : `${overlap.totalCount} other agents made this pick`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradientFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 10,
  },
  overflowCircle: {},
  overflowText: {
    fontSize: 8,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    flexShrink: 1,
  },
});
