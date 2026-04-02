import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, ActivityIndicator, BackHandler } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuth } from '@/contexts/AuthContext';
import { PAYWALL_PLACEMENTS } from '@/services/revenuecat';
import { usePlacementOffering } from '@/hooks/usePlacementOffering';

// Lazy load RevenueCatUI
let PaywallComponent: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    PaywallComponent = purchasesUI.default?.Paywall;
  }
} catch {}

/**
 * Non-dismissible paywall modal that appears after onboarding completes.
 * Decoupled from onboarding — if RevenueCat fails, user can skip.
 * Mounts in the root layout.
 */
export function PostOnboardingPaywall() {
  const { user } = useAuth();
  const { isPro, isInitialized, refreshCustomerInfo } = useRevenueCat();
  const { isCompleted, completionOverride } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const effectiveCompleted = completionOverride || isCompleted;

  // Show paywall when: user exists, onboarding is done, not a pro subscriber, not dismissed
  const shouldShow = !!user && effectiveCompleted && !isPro && !dismissed;

  const { offering, isLoading, refresh } = usePlacementOffering(
    PAYWALL_PLACEMENTS.ONBOARDING,
    shouldShow && isInitialized
  );

  // Safety timeout — don't leave user stuck on loading
  useEffect(() => {
    if (!shouldShow) return;
    if (!isLoading && isInitialized) return;

    const timeout = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(timeout);
  }, [shouldShow, isLoading, isInitialized]);

  // Block Android back button while paywall is visible
  useEffect(() => {
    if (!shouldShow) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, [shouldShow]);

  const handleComplete = () => {
    refreshCustomerInfo().catch(() => {});
    setDismissed(true);
  };

  if (!shouldShow) return null;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {}}
    >
      <View style={styles.container}>
        {(isLoading || !isInitialized) && !timedOut ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#22c55e" />
            <Text style={styles.loadingText}>Loading subscription options...</Text>
          </View>
        ) : !PaywallComponent || !offering ? (
          <View style={styles.loading}>
            <MaterialCommunityIcons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.loadingText}>Unable to load subscription options.</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => { setTimedOut(false); refresh(); }}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, styles.skipButton]}
              onPress={handleComplete}
            >
              <Text style={[styles.retryText, { color: '#999' }]}>Continue without subscription</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <PaywallComponent
            options={{ offering }}
            onPurchaseCompleted={handleComplete}
            onRestoreCompleted={({ customerInfo }: any) => {
              if (customerInfo?.entitlements?.active?.['WagerProof Pro']) {
                handleComplete();
              }
            }}
            onDismiss={() => {
              // Non-dismissible — do nothing
            }}
            style={styles.paywall}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  paywall: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  skipButton: {
    marginTop: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
