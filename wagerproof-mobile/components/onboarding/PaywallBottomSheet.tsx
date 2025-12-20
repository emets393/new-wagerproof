import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRevenueCat } from '../../contexts/RevenueCatContext';
import { useOnboarding } from '../../contexts/OnboardingContext';

// Lazy load RevenueCatUI for Paywalls V2
let RevenueCatUI: any = null;
let PaywallComponent: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    RevenueCatUI = purchasesUI.default;
    PaywallComponent = RevenueCatUI?.Paywall;
  }
} catch (error: any) {
  console.warn('Could not load react-native-purchases-ui:', error.message);
}

interface PaywallBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaywallBottomSheet({ isOpen, onClose }: PaywallBottomSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { offering, refreshOfferings, isLoading, isInitialized } = useRevenueCat();
  const { submitOnboardingData } = useOnboarding();
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);
  const snapPoints = useMemo(() => ['92%'], []);

  useEffect(() => {
    if (isOpen) {
      refreshOfferings();
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isOpen]);

  const handleCompletion = async () => {
    if (isCompleting) return;

    try {
      setIsCompleting(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('Starting onboarding completion from Paywall Bottom Sheet...');
      await submitOnboardingData();
      console.log('Onboarding data submitted successfully!');

      onClose();

      setTimeout(() => {
        router.replace('/(tabs)');
      }, 300);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsCompleting(false);
    }
  };

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      // Sheet was dismissed - complete onboarding
      handleCompletion();
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  );

  const renderContent = () => {
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
          <TouchableOpacity style={styles.skipButton} onPress={handleCompletion}>
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
          <TouchableOpacity style={styles.retryButton} onPress={refreshOfferings}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={handleCompletion}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.paywallContainer}>
        <PaywallComponent
          options={{}}
          onPurchaseStarted={({ packageBeingPurchased }: any) => {
            console.log('🛒 Purchase started:', packageBeingPurchased?.identifier);
          }}
          onPurchaseCompleted={async ({ customerInfo, storeTransaction }: any) => {
            console.log('✅ Purchase completed:', customerInfo);
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
      </View>
    );
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      {renderContent()}
      {isCompleting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 40,
  },
  paywallContainer: {
    flex: 1,
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
