import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';

interface ComingSoonBannerProps {
  sport: 'mlb';
  title?: string;
  description?: string;
}

const SPORT_CONFIG = {
  mlb: {
    icon: 'baseball' as const,
    title: 'MLB COMING SOON',
    description: 'Baseball predictions launching soon',
    gradientColors: ['#22c55e', '#16a34a'] as [string, string],
  },
};

export function ComingSoonBanner({ sport, title, description }: ComingSoonBannerProps) {
  const { isDark } = useThemeContext();
  const config = SPORT_CONFIG[sport];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)' }]}>
      <LinearGradient
        colors={config.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.iconContainer}
      >
        <MaterialCommunityIcons name={config.icon} size={24} color="#ffffff" />
      </LinearGradient>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: isDark ? '#ffffff' : '#000000' }]}>
          {title || config.title}
        </Text>
        <Text style={[styles.description, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }]}>
          {description || config.description}
        </Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>PREVIEW</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
