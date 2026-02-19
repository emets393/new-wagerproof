import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { PresetArchetype, Sport } from '@/types/agent';

interface ArchetypeCardProps {
  archetype: PresetArchetype;
  selected: boolean;
  onSelect: () => void;
}

const SPORT_CONFIG: Record<Sport, {
  label: string;
  icon: string;
  darkBg: string;
  darkText: string;
  darkBorder: string;
  lightBg: string;
  lightText: string;
  lightBorder: string;
}> = {
  nfl: {
    label: 'NFL',
    icon: 'football',
    darkBg: 'rgba(59, 130, 246, 0.15)',
    darkText: '#60a5fa',
    darkBorder: 'rgba(59, 130, 246, 0.25)',
    lightBg: 'rgba(1, 51, 105, 0.08)',
    lightText: '#013369',
    lightBorder: 'rgba(1, 51, 105, 0.18)',
  },
  cfb: {
    label: 'CFB',
    icon: 'football',
    darkBg: 'rgba(248, 113, 113, 0.15)',
    darkText: '#f87171',
    darkBorder: 'rgba(248, 113, 113, 0.25)',
    lightBg: 'rgba(196, 30, 58, 0.08)',
    lightText: '#C41E3A',
    lightBorder: 'rgba(196, 30, 58, 0.18)',
  },
  nba: {
    label: 'NBA',
    icon: 'basketball',
    darkBg: 'rgba(129, 140, 248, 0.15)',
    darkText: '#818cf8',
    darkBorder: 'rgba(129, 140, 248, 0.25)',
    lightBg: 'rgba(29, 66, 138, 0.08)',
    lightText: '#1D428A',
    lightBorder: 'rgba(29, 66, 138, 0.18)',
  },
  ncaab: {
    label: 'NCAAB',
    icon: 'basketball',
    darkBg: 'rgba(251, 146, 60, 0.15)',
    darkText: '#fb923c',
    darkBorder: 'rgba(251, 146, 60, 0.25)',
    lightBg: 'rgba(255, 107, 0, 0.08)',
    lightText: '#CC5500',
    lightBorder: 'rgba(255, 107, 0, 0.18)',
  },
};

export function ArchetypeCard({
  archetype,
  selected,
  onSelect,
}: ArchetypeCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={styles.touchable}
    >
      <Card
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? selected
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(255, 255, 255, 0.05)'
              : selected
              ? 'rgba(0, 0, 0, 0.06)'
              : 'rgba(255, 255, 255, 0.9)',
            borderColor: selected
              ? archetype.color
              : isDark
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.08)',
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <Card.Content style={styles.content}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.emojiContainer,
                { backgroundColor: `${archetype.color}20` },
              ]}
            >
              <Text style={styles.emoji}>{archetype.emoji}</Text>
            </View>

            <View style={styles.titleContainer}>
              <Text
                style={[styles.name, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {archetype.name}
              </Text>
              <Text
                style={[
                  styles.description,
                  { color: theme.colors.onSurfaceVariant },
                ]}
                numberOfLines={2}
              >
                {archetype.description}
              </Text>
            </View>

            {selected && (
              <View
                style={[
                  styles.checkmark,
                  { backgroundColor: archetype.color },
                ]}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color="#ffffff"
                />
              </View>
            )}
          </View>

          {/* Sport Badges */}
          <View style={styles.sportBadges}>
            {archetype.recommended_sports.map((sport) => {
              const config = SPORT_CONFIG[sport];
              const bg = isDark ? config.darkBg : config.lightBg;
              const textColor = isDark ? config.darkText : config.lightText;
              const border = isDark ? config.darkBorder : config.lightBorder;

              return (
                <View
                  key={sport}
                  style={[
                    styles.sportBadge,
                    { backgroundColor: bg, borderColor: border },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={config.icon as any}
                    size={12}
                    color={textColor}
                  />
                  <Text style={[styles.sportBadgeText, { color: textColor }]}>
                    {config.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginVertical: 6,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 24,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sportBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 6,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
