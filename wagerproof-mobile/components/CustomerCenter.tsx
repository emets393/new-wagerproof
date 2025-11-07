import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useRevenueCat } from '../contexts/RevenueCatContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Lazy load CustomerInfoView to avoid errors if native module isn't available
let CustomerInfoView: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    CustomerInfoView = purchasesUI.CustomerInfoView;
  }
} catch (error: any) {
  console.warn('Could not load react-native-purchases-ui:', error.message);
}

interface CustomerCenterProps {
  visible: boolean;
  onClose: () => void;
}

export function CustomerCenter({ visible, onClose }: CustomerCenterProps) {
  const { theme } = useThemeContext();
  const {
    customerInfo,
    isLoading,
    refreshCustomerInfo,
    restore,
  } = useRevenueCat();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      await restore();
      Alert.alert('Success', 'Purchases restored successfully!');
      await refreshCustomerInfo();
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
          Subscription Management
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading subscription information...
            </Text>
          </View>
        ) : customerInfo ? (
          <>
            {/* RevenueCat Customer Info View */}
            {CustomerInfoView ? (
              <CustomerInfoView
                customerInfo={customerInfo}
                onRestoreCompleted={async (customerInfo: any) => {
                  console.log('Restore completed:', customerInfo);
                  await refreshCustomerInfo();
                  Alert.alert('Success', 'Purchases restored successfully!');
                }}
                onError={(error: any) => {
                  console.error('Customer center error:', error);
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
                  Customer Center UI not available. Make sure react-native-purchases-ui is properly linked.
                </Text>
              </View>
            )}

            {/* Manual Restore Button */}
            <TouchableOpacity
              onPress={handleRestore}
              disabled={isRestoring}
              style={[
                styles.restoreButton,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="refresh"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.restoreButtonText, { color: theme.colors.primary }]}>
                    Restore Purchases
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Subscription Info */}
            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                Subscription Status
              </Text>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  Status:
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                  {customerInfo.entitlements.active['WagerProof Pro'] ? 'Active' : 'Inactive'}
                </Text>
              </View>
              {customerInfo.entitlements.active['WagerProof Pro'] && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                      Product:
                    </Text>
                    <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                      {customerInfo.entitlements.active['WagerProof Pro'].productIdentifier}
                    </Text>
                  </View>
                  {customerInfo.entitlements.active['WagerProof Pro'].expirationDate && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                        Expires:
                      </Text>
                      <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                        {new Date(
                          customerInfo.entitlements.active['WagerProof Pro'].expirationDate
                        ).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="account-circle-outline"
              size={48}
              color={theme.colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No subscription information available.
            </Text>
          </View>
        )}
      </ScrollView>
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
    minHeight: 200,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 20,
    gap: 8,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  infoCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

