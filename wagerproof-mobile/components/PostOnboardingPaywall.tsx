import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, ActivityIndicator, BackHandler, StatusBar } from 'react-native';
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

// Android: RevenueCat's PaywallView is Jetpack Compose-based and requires a
// LifecycleOwner in the view tree. React Native's <Modal> renders inside a
// Dialog that doesn't provide one, causing a native crash. We use a full-screen
// overlay View on Android instead.
const isAndroid = Platform.OS === 'android';

/**
 * Non-dismissible paywall that appears after onboarding completes.
 * Uses Modal on iOS, full-screen overlay on Android (Compose view crash workaround).
 * Decoupled from onboarding — if RevenueCat fails, user can skip.
 * Mounts in the root layout.
 */
export function PostOnboardingPaywall() {
  const { user } = useAuth();
  const { isPro, isInitialized, refreshCustomerInfo } = useRevenueCat();
  const { isCompleted, completionOverride } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

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
    setDismissed(true);
  };

  const handlePurchaseOrRestoreComplete = async () => {
    try {
      setIsFinalizing(true);
      await refreshCustomerInfo();
      setDismissed(true);
    } catch (error) {
      console.warn('📱 RevenueCat: Failed to finalize paywall purchase/restore:', error);
    } finally {
      setIsFinalizing(false);
    }
  };

  if (!shouldShow) return null;

  const paywallContent = (
    <View style={isAndroid ? styles.androidOverlay : styles.container}>
      {isAndroid && <StatusBar backgroundColor="#000" barStyle="light-content" />}
      {(isLoading || !isInitialized || isFinalizing) && !timedOut ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>
            {isFinalizing ? 'Finalizing your subscription...' : 'Loading subscription options...'}
          </Text>
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
          onPurchaseCompleted={handlePurchaseOrRestoreComplete}
          onRestoreCompleted={({ customerInfo }: any) => {
            if (customerInfo?.entitlements?.active?.['WagerProof Pro']) {
              handlePurchaseOrRestoreComplete();
            }
          }}
          onDismiss={() => {
            // X button in RevenueCat paywall config triggers this — let user through
            handleComplete();
          }}
          style={styles.paywall}
        />
      )}
    </View>
  );

  // Android: render as full-screen overlay to avoid Modal/Compose crash.
  // iOS: use Modal for proper presentation and animation.
  if (isAndroid) {
    return paywallContent;
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {}}
    >
      {paywallContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  androidOverlay: {
    // Full-screen overlay instead of Modal — avoids Compose/LifecycleOwner crash
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
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
