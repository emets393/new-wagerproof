import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useRevenueCat } from '../contexts/RevenueCatContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Lazy load RevenueCatUI for Paywalls V2
let RevenueCatUI: any = null;
let PaywallComponent: any = null;
let PAYWALL_RESULT: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    RevenueCatUI = purchasesUI.default;
    PaywallComponent = RevenueCatUI?.Paywall;
    PAYWALL_RESULT = purchasesUI.PAYWALL_RESULT;
  }
} catch (error: any) {
  console.warn('Could not load react-native-purchases-ui:', error.message);
}

interface RevenueCatPaywallProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseComplete?: () => void;
  onRestoreComplete?: () => void;
}

export function RevenueCatPaywall({
  visible,
  onClose,
  onPurchaseComplete,
  onRestoreComplete,
}: RevenueCatPaywallProps) {
  const { theme } = useThemeContext();
  const {
    offering,
    isLoading,
    error,
    refreshOfferings,
  } = useRevenueCat();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (visible) {
      refreshOfferings();
    }
  }, [visible, refreshOfferings]);

  const handlePurchaseCompleted = useCallback(async ({ customerInfo }: any) => {
    console.log('Purchase completed:', customerInfo);
    Alert.alert('Success', 'Your subscription is now active!', [
      { text: 'OK', onPress: () => {
        onPurchaseComplete?.();
        onClose();
      }},
    ]);
  }, [onPurchaseComplete, onClose]);

  const handleRestoreCompleted = useCallback(async ({ customerInfo }: any) => {
    console.log('Restore completed:', customerInfo);
    Alert.alert('Success', 'Purchases restored successfully!', [
      { text: 'OK', onPress: () => {
        onRestoreComplete?.();
        onClose();
      }},
    ]);
  }, [onRestoreComplete, onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Upgrade to WagerProof Pro
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading subscription options...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={48}
              color={theme.colors.error}
            />
            <Text style={[styles.errorText, { color: theme.colors.text }]}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={refreshOfferings}
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : offering ? (
          <View style={styles.content}>
            {/* RevenueCat Paywall V2 - Don't pass offering to auto-use attached paywall */}
            {PaywallComponent ? (
              <PaywallComponent
                options={{
                  // Don't pass offering - let RevenueCat auto-select the current offering's V2 paywall
                  // This fixes issues where fallback paywall shows instead of custom V2
                  // offering: offering,
                }}
                style={styles.paywall}
                onPurchaseStarted={({ packageBeingPurchased }: any) => {
                  console.log('Purchase started:', packageBeingPurchased?.identifier);
                  setIsProcessing(true);
                }}
                onPurchaseCompleted={handlePurchaseCompleted}
                onPurchaseError={({ error: purchaseError }: any) => {
                  console.error('Purchase error:', purchaseError?.message);
                  setIsProcessing(false);
                  Alert.alert('Error', purchaseError?.message || 'An error occurred during purchase');
                }}
                onPurchaseCancelled={() => {
                  console.log('Purchase cancelled');
                  setIsProcessing(false);
                }}
                onRestoreStarted={() => {
                  console.log('Restore started');
                  setIsProcessing(true);
                }}
                onRestoreCompleted={handleRestoreCompleted}
                onRestoreError={({ error: restoreError }: any) => {
                  console.error('Restore error:', restoreError?.message);
                  setIsProcessing(false);
                  Alert.alert('Restore Failed', restoreError?.message || 'Failed to restore purchases');
                }}
                onDismiss={() => {
                  console.log('Paywall dismissed');
                  setIsProcessing(false);
                  onClose();
                }}
              />
            ) : (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={48}
                  color={theme.colors.error}
                />
                <Text style={[styles.errorText, { color: theme.colors.text }]}>
                  Paywall UI not available. Make sure react-native-purchases-ui is properly linked.
                </Text>
                <Text style={[styles.errorText, { color: theme.colors.textSecondary, marginTop: 8 }]}>
                  Rebuild the app: npx expo run:ios
                </Text>
              </View>
            )}
            
            {isProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="package-variant"
              size={48}
              color={theme.colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No subscription options available at this time.
            </Text>
            <TouchableOpacity
              onPress={refreshOfferings}
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

