import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';

// Import RevenueCatUI for presenting paywalls
let RevenueCatUI: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    RevenueCatUI = purchasesUI.default;
  }
} catch (error: any) {
  console.warn('Could not load react-native-purchases-ui:', error.message);
}

interface LockedGameCardProps {
  children: React.ReactNode;
  cardWidth?: number | string;
}

/**
 * A wrapper component for game cards that shows a blurred overlay with a lock icon.
 * Used for non-pro users to indicate locked content.
 */
export function LockedGameCard({ children, cardWidth }: LockedGameCardProps) {
  const { isDark } = useThemeContext();
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (!RevenueCatUI) {
      console.warn('RevenueCatUI not available');
      return;
    }

    try {
      setIsLoading(true);
      await RevenueCatUI.presentPaywall();
    } catch (error) {
      console.error('Error presenting paywall:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, cardWidth ? { width: cardWidth } : undefined]}
      onPress={handlePress}
      activeOpacity={0.9}
      disabled={isLoading}
    >
      {/* Original card content */}
      <View style={styles.cardContent} pointerEvents="none">
        {children}
      </View>

      {/* Blur overlay */}
      <BlurView
        intensity={20}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurOverlay}
      />

      {/* Lock indicator */}
      <View style={styles.lockContainer}>
        <View style={[
          styles.lockBadge,
          { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)' }
        ]}>
          <MaterialCommunityIcons
            name="lock"
            size={20}
            color={isDark ? '#f59e0b' : '#d97706'}
          />
          <Text style={[
            styles.lockText,
            { color: isDark ? '#ffffff' : '#1f2937' }
          ]}>
            Pro
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  cardContent: {
    opacity: 0.4,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  lockContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  lockText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
