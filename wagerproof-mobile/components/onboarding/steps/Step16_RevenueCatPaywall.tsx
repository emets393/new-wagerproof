import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Alert, TouchableOpacity } from 'react-native';
import { useRevenueCat } from '../../../contexts/RevenueCatContext';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Lazy load RevenueCatUI for Paywalls V2
let RevenueCatUI: any = null;
let PaywallComponent: any = null;
let PAYWALL_RESULT: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    RevenueCatUI = purchasesUI.default;
    // Use RevenueCatUI.Paywall for V2 paywalls (embedded component)
    PaywallComponent = RevenueCatUI?.Paywall;
    PAYWALL_RESULT = purchasesUI.PAYWALL_RESULT;
    console.log('✅ RevenueCatUI loaded, Paywall component:', !!PaywallComponent);
    console.log('✅ PAYWALL_RESULT:', PAYWALL_RESULT);
  }
} catch (error: any) {
  console.warn('Could not load react-native-purchases-ui:', error.message);
}

export function RevenueCatPaywallStep() {
  const { offering, refreshOfferings, refreshCustomerInfo, isLoading, isInitialized } = useRevenueCat();
  const { submitOnboardingData } = useOnboarding();
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    refreshOfferings();
  }, []);

  const handleCompletion = async () => {
    if (isCompleting) return;
    
    try {
      setIsCompleting(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Refresh customer info to ensure entitlements are up to date
      console.log('🔄 Refreshing customer info after purchase...');
      await refreshCustomerInfo();
      console.log('✅ Customer info refreshed - entitlements should now be active');
      
      console.log('Starting onboarding completion from Paywall...');
      await submitOnboardingData();
      console.log('Onboarding data submitted successfully!');
      
      // Short delay to ensure UX feels right
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 300);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsCompleting(false);
      Alert.alert('Error', 'There was an issue completing setup. Please try again.');
    }
  };

  if (isLoading || !isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading subscription options...</Text>
      </View>
    );
  }

  if (!PaywallComponent) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>
          Native Paywall UI not available on this platform.
        </Text>
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={handleCompletion}
        >
          <Text style={styles.skipButtonText}>Continue to App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!offering) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="package-variant" size={48} color="#fff" />
        <Text style={styles.errorText}>
          No subscription options available at this time.
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={refreshOfferings}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={handleCompletion}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Log offering metadata to help debug V2 paywall issues
  useEffect(() => {
    if (offering) {
      console.log('📦 Offering for Paywall:', {
        identifier: offering.identifier,
        serverDescription: offering.serverDescription,
        metadata: offering.metadata,
        availablePackagesCount: offering.availablePackages?.length,
        // Check if paywall data is included in the offering
        paywall: (offering as any).paywall,
        paywallData: (offering as any).paywallData,
      });
    }
  }, [offering]);

  return (
    <View style={styles.container}>
      {/* 
        NOTE: For Paywalls V2, try NOT passing the offering to let RevenueCat 
        automatically use the paywall attached to the current offering.
        If you have issues, check in RevenueCat Dashboard:
        1. Paywall is PUBLISHED (not Draft/Inactive)
        2. Paywall is attached to the offering
        3. Paywall is NOT named "default" (naming conflict)
        4. No legacy/V1 paywall is attached to this offering
      */}
      <PaywallComponent
        options={{
          // Don't pass offering - let RevenueCat auto-select the current offering's paywall
          // This can fix issues where the fallback paywall shows
          // offering: offering,
        }}
        onPurchaseStarted={({ packageBeingPurchased }: any) => {
          console.log('🛒 Purchase started:', packageBeingPurchased?.identifier);
        }}
        onPurchaseCompleted={async ({ customerInfo, storeTransaction }: any) => {
          console.log('✅ Purchase completed:', customerInfo);
          console.log('✅ Store transaction:', storeTransaction?.transactionIdentifier);
          await handleCompletion();
        }}
        onPurchaseError={({ error }: any) => {
          console.error('❌ Purchase error:', error?.message);
        }}
        onPurchaseCancelled={() => {
          console.log('🚫 Purchase cancelled by user');
        }}
        onRestoreStarted={() => {
          console.log('🔄 Restore started');
        }}
        onRestoreCompleted={async ({ customerInfo }: any) => {
          console.log('✅ Restore completed:', customerInfo);
          await handleCompletion();
        }}
        onRestoreError={({ error }: any) => {
          console.error('❌ Restore error:', error?.message);
        }}
        onDismiss={async () => {
          console.log('👋 Paywall dismissed');
          await handleCompletion();
        }}
        style={styles.paywall}
      />
      {isCompleting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      )}
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  errorText: {
    color: '#fff',
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  skipButton: {
    padding: 12,
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

