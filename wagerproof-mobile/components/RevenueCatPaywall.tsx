import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useRevenueCat } from '../contexts/RevenueCatContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Lazy load PaywallView to avoid errors if native module isn't available
let PaywallView: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    PaywallView = purchasesUI.PaywallView;
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
    packages,
    isLoading,
    purchase,
    restore,
    error,
    refreshOfferings,
  } = useRevenueCat();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (visible) {
      refreshOfferings();
    }
  }, [visible, refreshOfferings]);

  const handlePurchase = async (packageToPurchase: any) => {
    try {
      setIsPurchasing(true);
      await purchase(packageToPurchase);
      Alert.alert('Success', 'Your subscription is now active!', [
        { text: 'OK', onPress: () => {
          onPurchaseComplete?.();
          onClose();
        }},
      ]);
    } catch (err: any) {
      if (err.message !== 'Purchase cancelled by user') {
        Alert.alert('Purchase Failed', err.message || 'An error occurred during purchase');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      await restore();
      Alert.alert('Success', 'Purchases restored successfully!', [
        { text: 'OK', onPress: () => {
          onRestoreComplete?.();
          onClose();
        }},
      ]);
    } catch (err: any) {
      Alert.alert('Restore Failed', err.message || 'Failed to restore purchases');
    } finally {
      setIsRestoring(false);
    }
  };

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
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* RevenueCat Paywall View */}
            {PaywallView ? (
              <PaywallView
                offering={offering}
                onPurchaseCompleted={(customerInfo: any) => {
                  console.log('Purchase completed:', customerInfo);
                  handlePurchase(null); // The purchase is already completed by PaywallView
                }}
                onRestoreCompleted={(customerInfo: any) => {
                  console.log('Restore completed:', customerInfo);
                  handleRestore();
                }}
                onError={(error: any) => {
                  console.error('Paywall error:', error);
                  Alert.alert('Error', error.message || 'An error occurred');
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

            {/* Restore Purchases Button */}
            <TouchableOpacity
              onPress={handleRestore}
              disabled={isRestoring}
              style={styles.restoreButton}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={[styles.restoreButtonText, { color: theme.colors.primary }]}>
                  Restore Purchases
                </Text>
              )}
            </TouchableOpacity>

            {/* Terms and Privacy */}
            <Text style={[styles.termsText, { color: theme.colors.textSecondary }]}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
              Subscriptions will auto-renew unless cancelled at least 24 hours before the end of the current period.
            </Text>
          </ScrollView>
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
  contentContainer: {
    padding: 20,
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
  restoreButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  termsText: {
    marginTop: 20,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});

