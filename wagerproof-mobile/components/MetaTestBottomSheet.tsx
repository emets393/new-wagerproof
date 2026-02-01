/**
 * Meta Test Bottom Sheet
 *
 * Developer debugging tool for testing Meta/Facebook SDK events.
 * Provides device info display, test event buttons, and response inspection.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme, Button, Divider, ActivityIndicator, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useMetaTestSheet } from '@/contexts/MetaTestSheetContext';
import { useAuth } from '@/contexts/AuthContext';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import {
  getDeviceInfo,
  ATT_STATUS_LABELS,
  DeviceInfo,
  requestATTPermission,
} from '@/services/deviceInfo';
import {
  isFacebookSDKReady,
  isMixpanelReady,
  flushAllAnalytics,
  sendTestMetaSubscriptionEvent,
  sendTestMetaRegistrationEvent,
  MetaTestEventResponse,
  SubscriptionType,
} from '@/services/analytics';

// Test prices matching WagerProof's structure
const TEST_PRICES = {
  monthly: 19.99,
  yearly: 99.0,
  lifetime: 199.99,
  monthlyPromo: 9.99,
  yearlyPromo: 49.99,
};

export function MetaTestBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { bottomSheetRef, closeSheet } = useMetaTestSheet();
  const { user } = useAuth();

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [isLoadingDeviceInfo, setIsLoadingDeviceInfo] = useState(true);
  const [lastResponse, setLastResponse] = useState<MetaTestEventResponse | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);

  const snapPoints = useMemo(() => ['85%', '95%'], []);

  // Load device info when sheet opens
  useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    setIsLoadingDeviceInfo(true);
    try {
      const info = await getDeviceInfo();
      setDeviceInfo(info);
    } catch (error) {
      console.error('Error loading device info:', error);
    } finally {
      setIsLoadingDeviceInfo(false);
    }
  };

  const handleSheetChanges = useCallback((index: number) => {
    if (index >= 0) {
      // Reload device info when sheet opens
      loadDeviceInfo();
    }
  }, []);

  const handleRequestATT = async () => {
    const newStatus = await requestATTPermission();
    // Reload device info to reflect new status
    loadDeviceInfo();
    Alert.alert('ATT Permission', `New status: ${ATT_STATUS_LABELS[newStatus].label}`);
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const handleSendTestEvent = async (
    type: 'monthly' | 'yearly' | 'lifetime' | 'monthlyPromo' | 'yearlyPromo' | 'registration'
  ) => {
    setIsSending(true);
    setLastResponse(null);

    try {
      let response: MetaTestEventResponse;

      if (type === 'registration') {
        response = await sendTestMetaRegistrationEvent({
          registrationMethod: 'test_onboarding',
        });
      } else {
        const isPromo = type === 'monthlyPromo' || type === 'yearlyPromo';
        const subscriptionType: SubscriptionType =
          type === 'monthly' || type === 'monthlyPromo'
            ? 'monthly'
            : type === 'yearly' || type === 'yearlyPromo'
            ? 'yearly'
            : 'lifetime';

        const price =
          type === 'monthlyPromo'
            ? TEST_PRICES.monthlyPromo
            : type === 'yearlyPromo'
            ? TEST_PRICES.yearlyPromo
            : TEST_PRICES[subscriptionType];

        response = await sendTestMetaSubscriptionEvent({
          subscriptionType,
          price,
          currency: 'USD',
          isPromo,
        });
      }

      setLastResponse(response);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send test event');
    } finally {
      setIsSending(false);
    }
  };

  const handleFlushEvents = async () => {
    setIsFlushing(true);
    try {
      const result = await flushAllAnalytics();
      Alert.alert(
        'Events Flushed',
        `Mixpanel: ${result.mixpanel.message}\nFacebook: ${result.facebook.message}`
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to flush events');
    } finally {
      setIsFlushing(false);
    }
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    []
  );

  const renderDeviceInfoSection = () => {
    if (isLoadingDeviceInfo) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading device info...
          </Text>
        </View>
      );
    }

    if (!deviceInfo) {
      return (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          Failed to load device info
        </Text>
      );
    }

    const attLabel = ATT_STATUS_LABELS[deviceInfo.attStatus];

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Device Info</Text>

        {!deviceInfo.nativeModulesAvailable && (
          <View style={[styles.warningBanner, { backgroundColor: '#f59e0b20', borderColor: '#f59e0b' }]}>
            <MaterialCommunityIcons name="alert" size={16} color="#f59e0b" />
            <Text style={[styles.warningText, { color: '#f59e0b' }]}>
              Rebuild app for full device info (expo run:android)
            </Text>
          </View>
        )}

        <View style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <InfoRow label="Platform" value={deviceInfo.platform} theme={theme} />
          <InfoRow
            label="Device"
            value={`${deviceInfo.manufacturer} ${deviceInfo.deviceModel}`}
            theme={theme}
          />
          <InfoRow label="OS Version" value={deviceInfo.osVersion} theme={theme} />
          <InfoRow
            label="App Version"
            value={`${deviceInfo.appVersion} (${deviceInfo.buildNumber})`}
            theme={theme}
          />
          <InfoRow
            label="Physical Device"
            value={deviceInfo.isDevice ? 'Yes' : 'No (Simulator)'}
            theme={theme}
          />

          <Divider style={styles.divider} />

          {/* ATT Status (iOS only) */}
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
              ATT Status
            </Text>
            <View style={styles.attStatusContainer}>
              <MaterialCommunityIcons
                name={attLabel.icon as any}
                size={18}
                color={attLabel.color}
              />
              <Text style={[styles.infoValue, { color: attLabel.color }]}>{attLabel.label}</Text>
              {Platform.OS === 'ios' && deviceInfo.attStatus === 'not_determined' && (
                <TouchableOpacity onPress={handleRequestATT} style={styles.requestButton}>
                  <Text style={[styles.requestButtonText, { color: theme.colors.primary }]}>
                    Request
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Advertising ID */}
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
              {Platform.OS === 'ios' ? 'IDFA Status' : 'Android ID'}
            </Text>
            <TouchableOpacity
              onPress={() =>
                deviceInfo.advertisingId &&
                copyToClipboard(deviceInfo.advertisingId, 'Advertising ID')
              }
              disabled={!deviceInfo.advertisingId}
            >
              <Text
                style={[
                  styles.infoValue,
                  { color: deviceInfo.advertisingId ? theme.colors.primary : theme.colors.outline },
                ]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {deviceInfo.advertisingId || 'Not available'}
              </Text>
            </TouchableOpacity>
          </View>

          <Divider style={styles.divider} />

          {/* SDK Status */}
          <View style={styles.sdkStatusContainer}>
            <View style={styles.sdkStatusItem}>
              <MaterialCommunityIcons
                name={isFacebookSDKReady() ? 'check-circle' : 'close-circle'}
                size={16}
                color={isFacebookSDKReady() ? '#22c55e' : '#ef4444'}
              />
              <Text style={[styles.sdkStatusText, { color: theme.colors.onSurface }]}>
                Facebook SDK
              </Text>
            </View>
            <View style={styles.sdkStatusItem}>
              <MaterialCommunityIcons
                name={isMixpanelReady() ? 'check-circle' : 'close-circle'}
                size={16}
                color={isMixpanelReady() ? '#22c55e' : '#ef4444'}
              />
              <Text style={[styles.sdkStatusText, { color: theme.colors.onSurface }]}>
                Mixpanel
              </Text>
            </View>
          </View>
        </View>

        {user && (
          <TouchableOpacity
            onPress={() => copyToClipboard(user.id, 'User ID')}
            style={[styles.userIdContainer, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <Text style={[styles.userIdLabel, { color: theme.colors.onSurfaceVariant }]}>
              User ID:
            </Text>
            <Text
              style={[styles.userIdValue, { color: theme.colors.primary }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {user.id}
            </Text>
            <MaterialCommunityIcons name="content-copy" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderTestButtons = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Test Events</Text>

      <View style={styles.buttonGrid}>
        <Button
          mode="contained"
          onPress={() => handleSendTestEvent('monthly')}
          style={styles.testButton}
          labelStyle={styles.buttonLabel}
          disabled={isSending}
          icon="cash"
        >
          Monthly (${TEST_PRICES.monthly})
        </Button>

        <Button
          mode="contained"
          onPress={() => handleSendTestEvent('yearly')}
          style={styles.testButton}
          labelStyle={styles.buttonLabel}
          disabled={isSending}
          icon="cash"
        >
          Yearly (${TEST_PRICES.yearly})
        </Button>

        <Button
          mode="contained"
          onPress={() => handleSendTestEvent('lifetime')}
          style={styles.testButton}
          labelStyle={styles.buttonLabel}
          disabled={isSending}
          icon="cash"
        >
          Lifetime (${TEST_PRICES.lifetime})
        </Button>

        <Button
          mode="outlined"
          onPress={() => handleSendTestEvent('monthlyPromo')}
          style={styles.testButton}
          labelStyle={styles.buttonLabel}
          disabled={isSending}
          icon="sale"
        >
          Promo Monthly (${TEST_PRICES.monthlyPromo})
        </Button>

        <Button
          mode="outlined"
          onPress={() => handleSendTestEvent('yearlyPromo')}
          style={styles.testButton}
          labelStyle={styles.buttonLabel}
          disabled={isSending}
          icon="sale"
        >
          Promo Yearly (${TEST_PRICES.yearlyPromo})
        </Button>

        <Button
          mode="contained-tonal"
          onPress={() => handleSendTestEvent('registration')}
          style={styles.testButton}
          labelStyle={styles.buttonLabel}
          disabled={isSending}
          icon="account-check"
        >
          CompleteRegistration
        </Button>
      </View>

      <Button
        mode="elevated"
        onPress={handleFlushEvents}
        style={styles.flushButton}
        loading={isFlushing}
        disabled={isFlushing || isSending}
        icon="send"
      >
        Flush All Events Now
      </Button>
    </View>
  );

  const renderResponseSection = () => {
    if (!lastResponse) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Last Response</Text>

        <View style={[styles.responseCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          {/* Header */}
          <View style={styles.responseHeader}>
            <Text style={[styles.responseEventName, { color: theme.colors.onSurface }]}>
              {lastResponse.eventName}
            </Text>
            <Chip mode="flat" compact>
              Test Event
            </Chip>
          </View>
          <Text style={[styles.responseTimestamp, { color: theme.colors.onSurfaceVariant }]}>
            {new Date(lastResponse.timestamp).toLocaleString()}
          </Text>

          <Divider style={styles.divider} />

          {/* Meta Status */}
          <ServiceResponseRow
            serviceName="Meta/Facebook"
            response={lastResponse.services.meta}
            theme={theme}
            onCopyPayload={() =>
              copyToClipboard(
                JSON.stringify(lastResponse.services.meta.sentPayload, null, 2),
                'Meta payload'
              )
            }
          />

          <Divider style={styles.divider} />

          {/* Mixpanel Status */}
          <ServiceResponseRow
            serviceName="Mixpanel"
            response={lastResponse.services.mixpanel}
            theme={theme}
            onCopyPayload={() =>
              copyToClipboard(
                JSON.stringify(lastResponse.services.mixpanel.sentPayload, null, 2),
                'Mixpanel payload'
              )
            }
          />
        </View>
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
      backgroundStyle={{ backgroundColor: 'transparent' }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
    >
      <AndroidBlurView
        intensity={100}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.blurContainer, !isDark && { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]}
      >
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View
                style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}20` }]}
              >
                <MaterialCommunityIcons name="facebook" size={28} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                  Meta SDK Debugger
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Test events and view payloads
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeSheet}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {isSending && (
            <View style={styles.sendingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.sendingText, { color: theme.colors.onSurface }]}>
                Sending test event...
              </Text>
            </View>
          )}

          {renderDeviceInfoSection()}
          {renderTestButtons()}
          {renderResponseSection()}
        </BottomSheetScrollView>
      </AndroidBlurView>
    </BottomSheet>
  );
}

// Helper Components

interface InfoRowProps {
  label: string;
  value: string;
  theme: any;
}

function InfoRow({ label, value, theme }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>{value}</Text>
    </View>
  );
}

interface ServiceResponseRowProps {
  serviceName: string;
  response: {
    success: boolean;
    message: string;
    sentPayload: Record<string, any>;
    error?: string;
  };
  theme: any;
  onCopyPayload: () => void;
}

function ServiceResponseRow({ serviceName, response, theme, onCopyPayload }: ServiceResponseRowProps) {
  const [showPayload, setShowPayload] = useState(false);

  return (
    <View style={styles.serviceResponse}>
      <View style={styles.serviceHeader}>
        <View style={styles.serviceNameContainer}>
          <MaterialCommunityIcons
            name={response.success ? 'check-circle' : 'close-circle'}
            size={20}
            color={response.success ? '#22c55e' : '#ef4444'}
          />
          <Text style={[styles.serviceName, { color: theme.colors.onSurface }]}>{serviceName}</Text>
        </View>
        <Text
          style={[
            styles.serviceStatus,
            { color: response.success ? '#22c55e' : '#ef4444' },
          ]}
        >
          {response.success ? 'Success' : 'Failed'}
        </Text>
      </View>

      <Text style={[styles.serviceMessage, { color: theme.colors.onSurfaceVariant }]}>
        {response.message}
      </Text>

      {response.error && (
        <Text style={[styles.serviceError, { color: theme.colors.error }]}>
          Error: {response.error}
        </Text>
      )}

      <View style={styles.payloadActions}>
        <TouchableOpacity onPress={() => setShowPayload(!showPayload)} style={styles.togglePayload}>
          <MaterialCommunityIcons
            name={showPayload ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.primary}
          />
          <Text style={[styles.togglePayloadText, { color: theme.colors.primary }]}>
            {showPayload ? 'Hide Payload' : 'Show Payload'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCopyPayload} style={styles.copyButton}>
          <MaterialCommunityIcons name="content-copy" size={16} color={theme.colors.primary} />
          <Text style={[styles.copyButtonText, { color: theme.colors.primary }]}>Copy</Text>
        </TouchableOpacity>
      </View>

      {showPayload && (
        <View style={[styles.payloadContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.payloadText, { color: theme.colors.onSurface }]}>
            {JSON.stringify(response.sentPayload, null, 2)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    flex: 1,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    marginVertical: 8,
  },
  attStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requestButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  requestButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sdkStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  sdkStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sdkStatusText: {
    fontSize: 13,
  },
  userIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  userIdLabel: {
    fontSize: 13,
  },
  userIdValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonGrid: {
    gap: 10,
  },
  testButton: {
    borderRadius: 8,
  },
  buttonLabel: {
    fontSize: 13,
  },
  flushButton: {
    marginTop: 16,
    borderRadius: 8,
  },
  responseCard: {
    borderRadius: 12,
    padding: 16,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  responseEventName: {
    fontSize: 15,
    fontWeight: '600',
  },
  responseTimestamp: {
    fontSize: 12,
    marginBottom: 8,
  },
  serviceResponse: {
    paddingVertical: 8,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
  },
  serviceStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  serviceMessage: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 28,
  },
  serviceError: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 28,
  },
  payloadActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 28,
  },
  togglePayload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  togglePayloadText: {
    fontSize: 13,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyButtonText: {
    fontSize: 13,
  },
  payloadContainer: {
    marginTop: 8,
    marginLeft: 28,
    padding: 12,
    borderRadius: 8,
  },
  payloadText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  sendingOverlay: {
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  sendingText: {
    fontSize: 14,
  },
});
