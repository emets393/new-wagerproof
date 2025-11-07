import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useProAccess } from '../hooks/useProAccess';
import { RevenueCatPaywall } from './RevenueCatPaywall';
import { useThemeContext } from '../contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';

interface ProFeatureGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * Component that gates Pro features behind a subscription check
 * 
 * @example
 * ```tsx
 * <ProFeatureGate>
 *   <ProFeature />
 * </ProFeatureGate>
 * ```
 * 
 * @example With custom fallback
 * ```tsx
 * <ProFeatureGate
 *   fallback={<Text>This is a Pro feature</Text>}
 *   showUpgradePrompt={true}
 * >
 *   <ProFeature />
 * </ProFeatureGate>
 * ```
 */
export function ProFeatureGate({
  children,
  fallback,
  showUpgradePrompt = false,
}: ProFeatureGateProps) {
  const { isPro, isLoading } = useProAccess();
  const { theme } = useThemeContext();
  const [paywallVisible, setPaywallVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!isPro) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
      return (
        <>
          <View style={[styles.upgradeContainer, { backgroundColor: theme.colors.surface }]}>
            <MaterialCommunityIcons
              name="crown"
              size={48}
              color="#FFD700"
              style={styles.crownIcon}
            />
            <Text style={[styles.upgradeTitle, { color: theme.colors.text }]}>
              Pro Feature
            </Text>
            <Text style={[styles.upgradeDescription, { color: theme.colors.textSecondary }]}>
              This feature is available for WagerProof Pro subscribers.
            </Text>
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setPaywallVisible(true)}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
          <RevenueCatPaywall
            visible={paywallVisible}
            onClose={() => setPaywallVisible(false)}
            onPurchaseComplete={() => setPaywallVisible(false)}
          />
        </>
      );
    }

    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  upgradeContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    margin: 16,
  },
  crownIcon: {
    marginBottom: 12,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  upgradeDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  upgradeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

