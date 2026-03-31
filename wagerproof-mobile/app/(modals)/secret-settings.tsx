import React from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useProAccess } from '@/hooks/useProAccess';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useMetaTestSheet } from '@/contexts/MetaTestSheetContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import {
  didPaywallGrantEntitlement,
  getOfferingById,
  getAllOfferings,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacement,
  syncPurchases,
} from '@/services/revenuecat';
import {
  initializeNotifications,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  getExpoPushToken,
  registerPushToken,
} from '@/services/notificationService';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

type ActionRowProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  iconBackground: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightContent?: React.ReactNode;
  last?: boolean;
};

function ActionRow({
  icon,
  iconColor,
  iconBackground,
  title,
  subtitle,
  onPress,
  rightContent,
  last = false,
}: ActionRowProps) {
  const { isDark } = useThemeContext();
  const rowBackground = isDark ? '#1d1d1d' : '#ffffff';
  const rowBorder = isDark ? 'rgba(255,255,255,0.08)' : '#ece7e1';
  const titleColor = isDark ? '#f5f1eb' : '#232325';
  const subtitleColor = isDark ? '#aea79f' : '#7d7873';
  const chevronColor = isDark ? '#8f8a84' : '#b7b7b7';

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.72 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.actionRow,
        { backgroundColor: rowBackground },
        !last && styles.actionRowBorder,
        !last && { borderBottomColor: rowBorder },
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: iconBackground }]}>
        <MaterialCommunityIcons name={icon} size={23} color={iconColor} />
      </View>

      <View style={styles.actionTextWrap}>
        <Text style={[styles.actionTitle, { color: titleColor }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.actionSubtitle, { color: subtitleColor }]}>{subtitle}</Text>}
      </View>

      <View style={styles.actionRight}>
        {rightContent ?? <MaterialCommunityIcons name="chevron-right" size={28} color={chevronColor} />}
      </View>
    </TouchableOpacity>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { isDark } = useThemeContext();
  const sectionTitleColor = isDark ? '#9e978f' : '#6c6763';
  const sectionCardColor = isDark ? '#1d1d1d' : '#ffffff';

  return (
    <View style={styles.sectionWrap}>
      <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: sectionCardColor }]}>{children}</View>
    </View>
  );
}

export default function SecretSettingsScreen() {
  const { isDark } = useThemeContext();
  const { user } = useAuth();
  const { testModeEnabled, setTestModeEnabled, triggerTestSuggestion } = useWagerBotSuggestion();
  const { forceFreemiumMode, setForceFreemiumMode } = useProAccess();
  const { adminModeEnabled, toggleAdminMode, canEnableAdminMode } = useAdminMode();
  const { refreshCustomerInfo } = useRevenueCat();
  const { openSheet: openMetaTestSheet } = useMetaTestSheet();
  const { setOnboardingIncomplete } = useOnboarding();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const pageBackground = isDark ? '#111111' : '#f3f0eb';
  const titleColor = isDark ? '#f8f4ef' : '#1e1e1f';
  const subtitleColor = isDark ? '#b8b2aa' : '#6f6a66';
  const switchTrackColors = isDark
    ? { false: '#4f4a45', true: '#f0c542' }
    : { false: '#cfc7bf', true: '#1f1f1f' };
  const switchThumbColor = isDark ? '#fffaf2' : '#ffffff';

  const handleTestPushDiagnostics = async () => {
    const lines: string[] = [];
    lines.push(`Platform: ${Platform.OS}`);
    lines.push(`Device.isDevice: ${Device.isDevice}`);
    lines.push(`Device.modelName: ${Device.modelName}`);

    try {
      await initializeNotifications();
      lines.push(`Init: OK`);
    } catch (e: any) {
      lines.push(`Init error: ${e.message}`);
    }

    try {
      const status = await getNotificationPermissionStatus();
      lines.push(`Permission: ${status}`);
    } catch (e: any) {
      lines.push(`Permission error: ${e.message}`);
    }

    const Constants = require('expo-constants').default;
    const pid1 = Constants.expoConfig?.extra?.eas?.projectId;
    const pid2 = (Constants as any).manifest?.extra?.eas?.projectId;
    const pid3 = (Constants as any).manifest2?.extra?.expoClient?.extra?.eas?.projectId;
    lines.push(`projectId (expoConfig): ${pid1 ?? 'null'}`);
    lines.push(`projectId (manifest): ${pid2 ?? 'null'}`);
    lines.push(`projectId (manifest2): ${pid3 ?? 'null'}`);

    try {
      const Constants = require('expo-constants').default;
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).manifest?.extra?.eas?.projectId ??
        'e00a12fb-670d-4d36-87f4-ae8c63d715d5';
      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      lines.push(`Token: ${tokenResult.data?.slice(0, 30)}...`);
    } catch (e: any) {
      lines.push(`Token ERROR: ${e.message}`);
      lines.push(`Error code: ${e.code ?? 'none'}`);
    }

    if (user?.id) {
      try {
        const { data, error } = await supabase
          .from('user_push_tokens')
          .select('expo_push_token, is_active')
          .eq('user_id', user.id);
        lines.push(`DB tokens: ${data?.length ?? 0} (error: ${error?.message ?? 'none'})`);
        data?.forEach((t: any, i: number) => {
          lines.push(`  [${i}] active=${t.is_active} ${t.expo_push_token.slice(0, 30)}...`);
        });
      } catch (e: any) {
        lines.push(`DB query error: ${e.message}`);
      }
    } else {
      lines.push(`User: not logged in`);
    }

    const report = lines.join('\n');
    console.log('Push Diagnostics:\n' + report);
    Alert.alert('Push Notification Diagnostics', report);
  };

  const handleRegisterAndTestPush = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Must be logged in');
      return;
    }

    try {
      let status = await getNotificationPermissionStatus();
      if (status !== 'granted') {
        status = await requestNotificationPermission();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', `Status: ${status}. Cannot send push without permission.`);
          return;
        }
      }

      await initializeNotifications();
      await registerPushToken(user.id);
      const token = await getExpoPushToken();

      if (!token) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Test Agent Picks Ready!',
            body: '3 new picks just dropped. Tap to view.',
            sound: 'default',
            data: { type: 'auto_pick_ready', agent_id: 'test', run_id: 'test' },
          },
          trigger: null,
        });
        Alert.alert('Local Only', 'No push token available (simulator). Sent a local notification instead.');
        return;
      }

      const message = {
        to: token,
        sound: 'default',
        title: "Test Agent's picks are ready!",
        body: '3 new picks just dropped. Tap to view.',
        channelId: 'agent-picks',
        data: { type: 'auto_pick_ready', agent_id: 'test', run_id: 'test' },
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('Expo push response:', JSON.stringify(result));

      const ticket = result.data?.[0] || result.data || result;
      const ticketStatus = ticket.status || 'unknown';

      Alert.alert(
        'Real Push Sent',
        `Sent via Expo Push API.\n\nStatus: ${ticketStatus}\nToken: ${token.slice(0, 35)}...\n\n${ticketStatus === 'ok' ? 'You should receive the push notification momentarily.' : `Error: ${JSON.stringify(ticket.details || ticket.message || 'unknown')}`}`
      );
    } catch (e: any) {
      console.error('Test push error:', e);
      Alert.alert('Error', e.message);
    }
  };

  const handleResetOnboarding = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to reset onboarding');
      return;
    }

    Alert.alert(
      'Reset Onboarding',
      'This will reset your onboarding status and you will be taken through the onboarding flow again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({
                  onboarding_completed: false,
                  onboarding_data: null,
                })
                .eq('user_id', user.id);

              if (error) {
                Alert.alert('Error', 'Failed to reset onboarding. Please try again.');
                return;
              }

              Alert.alert(
                'Success',
                'Onboarding reset! Redirecting to onboarding...',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      setOnboardingIncomplete();
                      router.back();
                      setTimeout(() => {
                        router.replace('/(onboarding)');
                      }, 300);
                    },
                  },
                ]
              );
            } catch {
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCheckOfferings = async () => {
    try {
      const allOfferings = await getAllOfferings();

      if (!allOfferings) {
        Alert.alert(
          'No Offerings',
          `Platform: ${Platform.OS}\n\nNo offerings found. Check RevenueCat config.`
        );
        return;
      }

      const availableIdentifiers = allOfferings.all ? Object.keys(allOfferings.all) : [];
      const defaultOffering = await getOfferingById('default');

      if (!defaultOffering) {
        const message = availableIdentifiers.length > 0
          ? `"default" not found.\n\nAvailable: ${availableIdentifiers.join(', ')}`
          : 'No offerings found. Check RevenueCat dashboard.';
        Alert.alert('No "default" Offering', message);
        return;
      }

      const packagesCount = defaultOffering.availablePackages?.length || 0;
      Alert.alert(
        'Offering Found',
        `Platform: ${Platform.OS}\nOffering: ${defaultOffering.identifier}\nPackages: ${packagesCount}`
      );
    } catch (error: any) {
      Alert.alert('Error', `Failed to fetch offerings:\n\n${error.message}`);
    }
  };

  const handleTestPaywall = async () => {
    try {
      const paywallResult = await presentPaywallForPlacement(
        PAYWALL_PLACEMENTS.GENERIC_FEATURE,
        'secret_settings_test_paywall'
      );

      if (didPaywallGrantEntitlement(paywallResult)) {
        await refreshCustomerInfo();
        Alert.alert('Success', 'Purchase completed!');
      } else if (String(paywallResult).toUpperCase().includes('NOT_PRESENTED')) {
        Alert.alert('Paywall Not Shown', 'Check that the placement exists and has a published paywall.');
      } else if (!String(paywallResult).toUpperCase().includes('CANCEL')) {
        Alert.alert('Info', `Result: ${paywallResult}`);
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to present paywall:\n\n${error.message || 'Unknown error'}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
            <MaterialCommunityIcons name="chevron-left" size={38} color={titleColor} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: titleColor }]}>Developer</Text>
            <Text style={[styles.headerSubtitle, { color: subtitleColor }]}>
              Testing & debug options
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.pagePadding}>
          {/* Developer Tools */}
          <SectionCard title="Developer Tools">
            <ActionRow
              icon="phone"
              iconColor="#22c55e"
              iconBackground="#e9f8f0"
              title="Voice Chat"
              subtitle="Open real-time voice chat with WagerBot"
              onPress={() => router.push('/voice-chat' as any)}
            />
            <ActionRow
              icon="fire"
              iconColor="#f97316"
              iconBackground="#fff3e8"
              title="Roast Mode"
              subtitle="Open hidden roast bot mode"
              onPress={() => router.push('/roast' as any)}
              last
            />
          </SectionCard>

          {/* Testing Toggles */}
          <SectionCard title="Testing Toggles">
            <ActionRow
              icon="bug"
              iconColor="#22c55e"
              iconBackground="#e9f8f0"
              title="WagerBot Test Mode"
              subtitle={testModeEnabled ? 'Trigger button visible in header' : 'Show trigger button in Feed header'}
              rightContent={
                <Switch
                  value={testModeEnabled}
                  onValueChange={setTestModeEnabled}
                  trackColor={switchTrackColors}
                  thumbColor={switchThumbColor}
                />
              }
            />
            <ActionRow
              icon="robot-outline"
              iconColor="#22c55e"
              iconBackground="#e9f8f0"
              title="Trigger Test Bubble"
              subtitle="Show a test suggestion bubble now"
              onPress={() => {
                triggerTestSuggestion();
                Alert.alert('Test Bubble', 'A test suggestion bubble should appear on the Feed screen.');
              }}
            />
            <ActionRow
              icon="account-lock"
              iconColor="#f59e0b"
              iconBackground="#fff8e6"
              title="Simulate Freemium"
              subtitle={forceFreemiumMode ? 'Viewing as non-subscriber' : 'Test the app as a non-subscriber'}
              rightContent={
                <Switch
                  value={forceFreemiumMode}
                  onValueChange={setForceFreemiumMode}
                  trackColor={switchTrackColors}
                  thumbColor={switchThumbColor}
                />
              }
              last={!canEnableAdminMode}
            />
            {canEnableAdminMode && (
              <ActionRow
                icon="shield-account"
                iconColor="#22c55e"
                iconBackground="#e9f8f0"
                title="Admin Mode"
                subtitle={adminModeEnabled ? 'Admin features enabled' : 'Enable editor picks management'}
                rightContent={
                  <Switch
                    value={adminModeEnabled}
                    onValueChange={toggleAdminMode}
                    trackColor={switchTrackColors}
                    thumbColor={switchThumbColor}
                  />
                }
                last
              />
            )}
          </SectionCard>

          {/* Diagnostics */}
          <SectionCard title="Diagnostics">
            <ActionRow
              icon="stethoscope"
              iconColor="#f59e0b"
              iconBackground="#fff8e6"
              title="Push Diagnostics"
              subtitle="Check device, permission, token, and DB status"
              onPress={handleTestPushDiagnostics}
            />
            <ActionRow
              icon="bell-ring-outline"
              iconColor="#22c55e"
              iconBackground="#e9f8f0"
              title="Register & Test Push"
              subtitle="Request permission, register token, send notification"
              onPress={handleRegisterAndTestPush}
            />
            <ActionRow
              icon="refresh"
              iconColor="#2a86ff"
              iconBackground="#edf5ff"
              title="Sync Offerings"
              subtitle="Force refresh from RevenueCat servers"
              onPress={async () => {
                try {
                  await syncPurchases();
                  Alert.alert('Success', 'Offerings refreshed from server.');
                } catch (error: any) {
                  Alert.alert('Error', `Failed to sync: ${error.message}`);
                }
              }}
            />
            <ActionRow
              icon="package-variant"
              iconColor="#2a86ff"
              iconBackground="#edf5ff"
              title="Check Offerings"
              subtitle="Debug available RevenueCat offerings"
              onPress={handleCheckOfferings}
            />
            <ActionRow
              icon="credit-card"
              iconColor="#2a86ff"
              iconBackground="#edf5ff"
              title="Test Paywall"
              subtitle="Present the dynamic paywall"
              onPress={handleTestPaywall}
            />
            <ActionRow
              icon="facebook"
              iconColor="#1877F2"
              iconBackground="#e8f0fe"
              title="Meta SDK Events"
              subtitle="Debug Facebook/Meta attribution events"
              onPress={openMetaTestSheet}
            />
            <ActionRow
              icon="reload"
              iconColor="#d16a00"
              iconBackground="#fff0e1"
              title="Reset Onboarding"
              subtitle="Go through the onboarding flow again"
              onPress={handleResetOnboarding}
              last
            />
          </SectionCard>

          {/* Info */}
          {user && (
            <SectionCard title="Info">
              <ActionRow
                icon="account-key"
                iconColor="#8b8b8b"
                iconBackground="#f4f1ec"
                title="User ID"
                subtitle={user.id}
                rightContent={<View />}
                last
              />
            </SectionCard>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 88,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 18,
  },
  backButton: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  pagePadding: {
    paddingHorizontal: 18,
    gap: 22,
  },
  sectionWrap: {
    gap: 12,
  },
  sectionTitle: {
    paddingHorizontal: 6,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  actionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  actionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRight: {
    minWidth: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
