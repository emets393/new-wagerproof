import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useProAccess } from '@/hooks/useProAccess';
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

interface ProContentSectionProps {
  children: React.ReactNode;
  title?: string;
  minHeight?: number;
}

/**
 * A wrapper component that shows content for Pro users,
 * or a blurred locked state for non-Pro users.
 * Use this to wrap sections in bottom sheets that should be Pro-only.
 */
export function ProContentSection({ children, title, minHeight = 100 }: ProContentSectionProps) {
  const { isDark } = useThemeContext();
  const { isPro, isLoading: isProLoading } = useProAccess();
  const { refreshCustomerInfo } = useRevenueCat();
  const [isPaywallLoading, setIsPaywallLoading] = useState(false);

  // If user is Pro or still loading pro status, show children normally
  if (isProLoading || isPro) {
    return <>{children}</>;
  }

  const handleUnlock = async () => {
    if (!RevenueCatUI) {
      console.warn('RevenueCatUI not available');
      return;
    }

    try {
      setIsPaywallLoading(true);
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
      setIsPaywallLoading(false);
    }
  };

  // Non-Pro users see locked content
  return (
    <TouchableOpacity
      style={[styles.container, { minHeight }]}
      onPress={handleUnlock}
      activeOpacity={0.9}
      disabled={isPaywallLoading}
    >
      {/* Dimmed children (not visible behind blur but helps with sizing) */}
      <View style={styles.contentWrapper} pointerEvents="none">
        {children}
      </View>

      {/* Blur overlay - uses AndroidBlurView for reliable Android rendering */}
      <AndroidBlurView
        intensity={25}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Lock overlay content */}
      <View style={styles.lockOverlay}>
        <View style={[
          styles.lockBadge,
          { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)' }
        ]}>
          <MaterialCommunityIcons
            name="lock"
            size={24}
            color={isDark ? '#f59e0b' : '#d97706'}
          />
          <View style={styles.lockTextContainer}>
            <Text style={[
              styles.lockTitle,
              { color: isDark ? '#ffffff' : '#1f2937' }
            ]}>
              {title || 'Pro Feature'}
            </Text>
            <Text style={[
              styles.lockSubtitle,
              { color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)' }
            ]}>
              Tap to unlock
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 12,
    position: 'relative',
  },
  contentWrapper: {
    opacity: 0.3,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  lockTextContainer: {
    alignItems: 'flex-start',
  },
  lockTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  lockSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
