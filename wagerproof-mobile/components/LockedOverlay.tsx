import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';

interface LockedOverlayProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  children?: React.ReactNode;
  blurIntensity?: number;
  placementId?: string;
}

/**
 * A reusable overlay component that shows blurred content with a lock icon.
 * Tapping on it opens the paywall by default, or calls custom onPress if provided.
 */
export function LockedOverlay({
  message = 'Unlock with Pro',
  style,
  onPress,
  children,
  blurIntensity = 15,
  placementId = PAYWALL_PLACEMENTS.GENERIC_FEATURE,
}: LockedOverlayProps) {
  const { isDark } = useThemeContext();
  const { refreshCustomerInfo } = useRevenueCat();
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (onPress) {
      onPress();
      return;
    }

    // Default behavior: open paywall
    try {
      setIsLoading(true);
      const result = await presentPaywallForPlacementIfNeeded(
        ENTITLEMENT_IDENTIFIER,
        placementId
      );
      
      if (didPaywallGrantEntitlement(result)) {
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
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.9}
      disabled={isLoading}
    >
      {/* Content that will be blurred */}
      {children && (
        <View style={styles.contentContainer}>
          {children}
        </View>
      )}

      {/* Blur overlay - uses AndroidBlurView for reliable Android rendering */}
      <AndroidBlurView
        intensity={blurIntensity}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Lock icon and message */}
      <View style={styles.lockContainer}>
        <View style={[
          styles.lockIconBackground,
          { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)' }
        ]}>
          <MaterialCommunityIcons
            name="lock"
            size={28}
            color={isDark ? '#f59e0b' : '#d97706'}
          />
        </View>
        <Text style={[
          styles.lockText,
          { color: isDark ? '#ffffff' : '#1f2937' }
        ]}>
          {message}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  contentContainer: {
    opacity: 0.5,
  },
  lockContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  lockIconBackground: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  lockText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
