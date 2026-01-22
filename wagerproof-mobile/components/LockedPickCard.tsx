import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { AndroidBlurView } from '@/components/AndroidBlurView';

// Import RevenueCatUI for presenting paywalls
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    RevenueCatUI = purchasesUI.default;
    PAYWALL_RESULT = purchasesUI.PAYWALL_RESULT;
  }
} catch (error: any) {
  console.warn('Could not load react-native-purchases-ui:', error.message);
}

interface LockedPickCardProps {
  sport?: string;
  minHeight?: number;
}

/**
 * A locked pick card that shows a blurred placeholder with a lock icon.
 * Used for non-pro users to indicate locked premium picks.
 */
export function LockedPickCard({ sport = 'NFL', minHeight = 180 }: LockedPickCardProps) {
  const { isDark } = useThemeContext();
  const { refreshCustomerInfo } = useRevenueCat();
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (!RevenueCatUI) {
      console.warn('RevenueCatUI not available');
      return;
    }

    try {
      setIsLoading(true);
      const result = await RevenueCatUI.presentPaywall();
      
      // If user made a purchase or restored, refresh entitlements
      if (PAYWALL_RESULT && (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED)) {
        console.log('🔄 Purchase/restore detected, refreshing customer info...');
        await refreshCustomerInfo();
        console.log('✅ Customer info refreshed - entitlements should now be active');
      }
    } catch (error) {
      console.error('Error presenting paywall:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          minHeight,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={isLoading}
    >
      {/* Placeholder content */}
      <View style={styles.placeholderContent}>
        <View style={[styles.placeholderLine, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)', width: '60%' }]} />
        <View style={[styles.placeholderLine, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)', width: '40%' }]} />
        <View style={[styles.placeholderLine, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)', width: '80%' }]} />
      </View>

      {/* Blur overlay - uses AndroidBlurView for reliable Android rendering */}
      <AndroidBlurView
        intensity={15}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Lock badge */}
      <View style={styles.lockContainer}>
        <View style={[
          styles.lockBadge,
          { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)' }
        ]}>
          <View style={[
            styles.proBadge,
            { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(217, 119, 6, 0.15)' }
          ]}>
            <MaterialCommunityIcons
              name="crown"
              size={14}
              color={isDark ? '#f59e0b' : '#d97706'}
            />
            <Text style={[styles.proText, { color: isDark ? '#f59e0b' : '#d97706' }]}>
              PRO
            </Text>
          </View>
          <View style={styles.lockInfo}>
            <MaterialCommunityIcons
              name="lock"
              size={20}
              color={isDark ? '#ffffff' : '#1f2937'}
            />
            <Text style={[styles.lockTitle, { color: isDark ? '#ffffff' : '#1f2937' }]}>
              Pro Pick
            </Text>
          </View>
          <Text style={[styles.lockSubtitle, { color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }]}>
            Tap to unlock all picks
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  placeholderContent: {
    padding: 20,
    gap: 12,
    opacity: 0.5,
  },
  placeholderLine: {
    height: 12,
    borderRadius: 6,
  },
  lockContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadge: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 8,
  },
  proText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  lockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  lockSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
});
