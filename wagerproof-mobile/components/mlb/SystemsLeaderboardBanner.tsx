import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';

/** Banner that opens the Systems Leaderboard. Style-matches MLBHistoricalAnalysisBanner. */
export function SystemsLeaderboardBanner({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#2a2410', '#332b12'] : ['#fdf6e3', '#faedc8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBackground}
          >
            <Text style={styles.trophy}>🏆</Text>
          </LinearGradient>
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Systems Leaderboard</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            The most profitable systems users have shared
          </Text>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={28} color={theme.colors.onSurfaceVariant} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 70,
  },
  iconContainer: { marginRight: 14 },
  iconBackground: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophy: { fontSize: 22 },
  textContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  subtitle: { fontSize: 12, lineHeight: 16 },
});
