import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useTheme, List, Switch, Divider, Button } from 'react-native-paper';
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

export default function SecretSettingsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { testModeEnabled, setTestModeEnabled, triggerTestSuggestion } = useWagerBotSuggestion();
  const { forceFreemiumMode, setForceFreemiumMode, isPro } = useProAccess();
  const { adminModeEnabled, toggleAdminMode, canEnableAdminMode } = useAdminMode();
  const { refreshCustomerInfo } = useRevenueCat();
  const { openSheet: openMetaTestSheet } = useMetaTestSheet();
  const insets = useSafeAreaInsets();
  const router = useRouter();

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

    // Show projectId resolution
    const Constants = require('expo-constants').default;
    const pid1 = Constants.expoConfig?.extra?.eas?.projectId;
    const pid2 = (Constants as any).manifest?.extra?.eas?.projectId;
    const pid3 = (Constants as any).manifest2?.extra?.expoClient?.extra?.eas?.projectId;
    lines.push(`projectId (expoConfig): ${pid1 ?? 'null'}`);
    lines.push(`projectId (manifest): ${pid2 ?? 'null'}`);
    lines.push(`projectId (manifest2): ${pid3 ?? 'null'}`);

    // Call getExpoPushTokenAsync directly to surface the real error
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
    console.log('🔔 Push Diagnostics:\n' + report);
    Alert.alert('Push Notification Diagnostics', report);
  };

  const handleRegisterAndTestPush = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Must be logged in');
      return;
    }

    try {
      // 1. Request permission if needed
      let status = await getNotificationPermissionStatus();
      if (status !== 'granted') {
        status = await requestNotificationPermission();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', `Status: ${status}. Cannot send push without permission.`);
          return;
        }
      }

      // 2. Ensure notification handler is set
      await initializeNotifications();

      // 3. Register token
      await registerPushToken(user.id);
      const token = await getExpoPushToken();

      if (!token) {
        // Fallback to local notification on simulator
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🎯 Test Agent Picks Ready!',
            body: '3 new picks just dropped. Tap to view.',
            sound: 'default',
            data: { type: 'auto_pick_ready', agent_id: 'test', run_id: 'test' },
          },
          trigger: null,
        });
        Alert.alert('Local Only', 'No push token available (simulator). Sent a local notification instead.');
        return;
      }

      // 4. Send a REAL push via Expo Push API
      const message = {
        to: token,
        sound: 'default',
        title: "🎯 Test Agent's picks are ready!",
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
      console.log('🔔 Expo push response:', JSON.stringify(result));

      const ticket = result.data?.[0] || result.data || result;
      const ticketStatus = ticket.status || 'unknown';

      Alert.alert(
        'Real Push Sent',
        `Sent via Expo Push API.\n\nStatus: ${ticketStatus}\nToken: ${token.slice(0, 35)}...\n\n${ticketStatus === 'ok' ? 'You should receive the push notification momentarily.' : `Error: ${JSON.stringify(ticket.details || ticket.message || 'unknown')}`}`
      );
    } catch (e: any) {
      console.error('🔔 Test push error:', e);
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
              console.log('Resetting onboarding for user:', user.id);
              
              // Update the profile to mark onboarding as incomplete
              const { error } = await supabase
                .from('profiles')
                .update({
                  onboarding_completed: false,
                  onboarding_data: null,
                })
                .eq('user_id', user.id);

              if (error) {
                console.error('Error resetting onboarding:', error);
                Alert.alert('Error', 'Failed to reset onboarding. Please try again.');
                return;
              }

              console.log('Onboarding reset successfully');
              Alert.alert(
                'Success',
                'Onboarding reset! Redirecting to onboarding...',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Close this modal first
                      router.back();
                      // Small delay to allow modal to close, then navigate to onboarding
                      setTimeout(() => {
                        router.replace('/(onboarding)');
                      }, 300);
                    },
                  },
                ]
              );
            } catch (err) {
              console.error('Unexpected error resetting onboarding:', err);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCheckOfferings = async () => {
    console.log('📦 Check Offerings button pressed');
    console.log('📱 Platform:', Platform.OS);
    console.log('📱 Platform Version:', Platform.Version);
    
    try {
      // First, get all offerings to see what's available
      console.log('📦 Calling getAllOfferings()...');
      const allOfferings = await getAllOfferings();
      
      console.log('📦 getAllOfferings() returned:', {
        isNull: allOfferings === null,
        isUndefined: allOfferings === undefined,
        hasAll: !!allOfferings?.all,
        hasCurrent: !!allOfferings?.current,
      });
      
      if (!allOfferings) {
        console.error('❌ getAllOfferings() returned null/undefined');
        Alert.alert(
          'No Offerings',
          `Platform: ${Platform.OS}\n\nNo offerings found at all. Check:\n\n1. RevenueCat is initialized\n2. Internet connectivity\n3. API key is correct for ${Platform.OS}\n4. Android app is configured in RevenueCat dashboard\n\nCheck console logs for details.`
        );
        return;
      }

      // Log all available offerings
      const availableIdentifiers = allOfferings.all ? Object.keys(allOfferings.all) : [];
      console.log('📦 All available offering identifiers:', availableIdentifiers);
      console.log('📦 Current offering identifier:', allOfferings.current?.identifier);
      
      // Try to fetch the specific "default" offering
      const defaultOffering = await getOfferingById('default');
      
      if (!defaultOffering) {
        const message = availableIdentifiers.length > 0
          ? `The offering named "default" was not found.\n\nAvailable offerings:\n${availableIdentifiers.join('\n')}\n\nPlatform: ${Platform.OS}\n\nCheck console logs for details.`
          : 'No offerings found. Make sure you have:\n\n1. Created offerings in RevenueCat dashboard\n2. Internet connectivity\n3. API key matches platform\n\nCheck console logs for details.';
        
        Alert.alert('No "default" Offering', message);
        return;
      }

      const offeringInfo = {
        identifier: defaultOffering.identifier,
        serverDescription: defaultOffering.serverDescription,
        packagesCount: defaultOffering.availablePackages?.length || 0,
        packages: defaultOffering.availablePackages?.map((pkg: any) => ({
          identifier: pkg.identifier,
          packageType: pkg.packageType,
          product: {
            identifier: pkg.product.identifier,
            price: pkg.product.priceString,
          }
        })) || []
      };

      console.log('✅ "default" offering:', offeringInfo);
      
      Alert.alert(
        'Offering "default" Found',
        `Platform: ${Platform.OS}\nOffering: ${offeringInfo.identifier}\nPackages: ${offeringInfo.packagesCount}\n\nCheck console for full details.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('❌ Error fetching offerings:', error);
      Alert.alert(
        'Error',
        `Failed to fetch offerings:\n\n${error.message}\n\nPlatform: ${Platform.OS}\n\nCheck console for details.`
      );
    }
  };

  const handleTestPaywall = async () => {
    console.log('🎬 Test Paywall button pressed');
    console.log('Platform:', Platform.OS);

    try {
      const paywallResult = await presentPaywallForPlacement(
        PAYWALL_PLACEMENTS.GENERIC_FEATURE,
        'secret_settings_test_paywall'
      );
      
      console.log('✅ Paywall completed with result:', paywallResult);
      console.log('Result type:', typeof paywallResult);

      if (didPaywallGrantEntitlement(paywallResult)) {
        console.log('🔄 Refreshing customer info to update entitlements...');
        await refreshCustomerInfo();
        console.log('✅ Customer info refreshed - entitlements should now be active');
        Alert.alert('Success', 'Purchase completed!');
      } else if (String(paywallResult).toUpperCase().includes('NOT_PRESENTED')) {
        Alert.alert(
          'Paywall Not Shown',
          'The paywall could not be presented for the configured placement. Check that the placement exists, has an offering, and the paywall is published.'
        );
      } else {
        console.log('ℹ️ Paywall completed with result:', paywallResult);
        if (!String(paywallResult).toUpperCase().includes('CANCEL')) {
          Alert.alert('Info', `Paywall completed with result: ${paywallResult}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Exception while presenting paywall:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      Alert.alert(
        'Error',
        `Failed to present paywall:\n\n${error.message || 'Unknown error'}\n\nCheck console logs for more details.`
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="shield-key" size={32} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Secret Settings
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Developer & Testing Options
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* WagerBot Testing Section */}
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
            WagerBot Suggestions Testing
          </List.Subheader>

          <List.Item
            title="Test Mode"
            description={testModeEnabled ? "Test mode enabled - trigger button visible in header" : "Enable to show trigger button in Feed header"}
            left={props => <List.Icon {...props} icon="bug" color={testModeEnabled ? '#00E676' : theme.colors.primary} />}
            right={() => (
              <Switch
                value={testModeEnabled}
                onValueChange={setTestModeEnabled}
                color="#00E676"
              />
            )}
            style={{ backgroundColor: theme.colors.surface }}
          />

          <List.Item
            title="Trigger Test Bubble"
            description="Show a test suggestion bubble now"
            left={props => <List.Icon {...props} icon="robot" color="#00E676" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              triggerTestSuggestion();
              Alert.alert('Test Bubble', 'A test suggestion bubble should appear on the Feed screen. Go back to see it!');
            }}
            style={{ backgroundColor: theme.colors.surface }}
          />
        </List.Section>
        <Divider />

        {/* Freemium Testing Section */}
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
            Freemium Mode Testing
          </List.Subheader>

          <List.Item
            title="Simulate Freemium Mode"
            description={forceFreemiumMode
              ? "Freemium mode active - viewing as non-subscriber"
              : "Enable to test the app as a non-subscriber"}
            left={props => <List.Icon {...props} icon="account-lock" color={forceFreemiumMode ? '#f59e0b' : theme.colors.primary} />}
            right={() => (
              <Switch
                value={forceFreemiumMode}
                onValueChange={setForceFreemiumMode}
                color="#f59e0b"
              />
            )}
            style={{ backgroundColor: theme.colors.surface }}
          />

          <List.Item
            title="Current Status"
            description={isPro ? "Pro access active" : "Free tier (limited access)"}
            left={props => <List.Icon {...props} icon={isPro ? "crown" : "account"} color={isPro ? '#22c55e' : '#94a3b8'} />}
            style={{ backgroundColor: theme.colors.surface }}
          />
        </List.Section>
        <Divider />

        {/* Admin Mode Section - Only visible to admins */}
        {canEnableAdminMode && (
          <>
            <List.Section>
              <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
                Admin Mode
              </List.Subheader>

              <List.Item
                title="Admin Mode"
                description={adminModeEnabled
                  ? "Admin features enabled - can edit picks, set results"
                  : "Enable to access editor picks management"}
                left={props => <List.Icon {...props} icon="shield-account" color={adminModeEnabled ? '#22c55e' : theme.colors.primary} />}
                right={() => (
                  <Switch
                    value={adminModeEnabled}
                    onValueChange={toggleAdminMode}
                    color="#22c55e"
                  />
                )}
                style={{ backgroundColor: theme.colors.surface }}
              />

              <List.Item
                title="Admin Status"
                description="You have admin privileges"
                left={props => <List.Icon {...props} icon="check-decagram" color="#22c55e" />}
                style={{ backgroundColor: theme.colors.surface }}
              />
            </List.Section>
            <Divider />
          </>
        )}

        {/* Developer Section */}
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
            Developer Options
          </List.Subheader>

          <List.Item
            title="WagerBot Voice Chat"
            description="Open real-time voice chat with WagerBot"
            left={props => <List.Icon {...props} icon="phone" color="#22c55e" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/voice-chat' as any)}
            style={{ backgroundColor: theme.colors.surface }}
          />

          <List.Item
            title="Roast Mode"
            description="Open hidden roast bot mode"
            left={props => <List.Icon {...props} icon="fire" color="#f97316" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/roast' as any)}
            style={{ backgroundColor: theme.colors.surface }}
          />

        </List.Section>
        <Divider />

        {/* Push Notification Testing */}
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
            Push Notification Testing
          </List.Subheader>

          <List.Item
            title="Push Diagnostics"
            description="Check device, permission, token, and DB status"
            left={props => <List.Icon {...props} icon="stethoscope" color="#f59e0b" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleTestPushDiagnostics}
            style={{ backgroundColor: theme.colors.surface }}
          />

          <List.Item
            title="Register & Send Test Push"
            description="Request permission, register token, send local notification"
            left={props => <List.Icon {...props} icon="bell-ring-outline" color="#22c55e" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleRegisterAndTestPush}
            style={{ backgroundColor: theme.colors.surface }}
          />
        </List.Section>
        <Divider />

        {/* Testing Section */}
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
            Testing Tools
          </List.Subheader>

          <List.Item
            title="Reset Onboarding"
            description="Go through onboarding flow again"
            left={props => <List.Icon {...props} icon="reload" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleResetOnboarding}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="Sync & Refresh Offerings"
            description="Force refresh from RevenueCat servers"
            left={props => <List.Icon {...props} icon="refresh" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={async () => {
              try {
                console.log('🔄 Syncing purchases...');
                await syncPurchases();
                Alert.alert('Success', 'Offerings refreshed from server. Check offerings again.');
              } catch (error: any) {
                console.error('Error syncing:', error);
                Alert.alert('Error', `Failed to sync: ${error.message}`);
              }
            }}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="Check RevenueCat Offerings"
            description="Debug: Check available offerings"
            left={props => <List.Icon {...props} icon="package-variant" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleCheckOfferings}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="Test RevenueCat Paywall"
            description="Test the dynamic paywall"
            left={props => <List.Icon {...props} icon="credit-card" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleTestPaywall}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="Test Meta SDK Events"
            description="Debug Facebook/Meta attribution events"
            left={props => <List.Icon {...props} icon="facebook" color="#1877F2" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={openMetaTestSheet}
            style={{ backgroundColor: theme.colors.surface }}
          />
        </List.Section>
        <Divider />

        {/* Info Section */}
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
            Build Information
          </List.Subheader>
          
          <List.Item
            title="App Version"
            description="1.0.0"
            left={props => <List.Icon {...props} icon="information" color={theme.colors.primary} />}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="Build Environment"
            description={__DEV__ ? "Development" : "Production"}
            left={props => <List.Icon {...props} icon="code-tags" color={theme.colors.primary} />}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          {user && (
            <List.Item
              title="User ID"
              description={user.id}
              left={props => <List.Icon {...props} icon="account-key" color={theme.colors.primary} />}
              style={{ backgroundColor: theme.colors.surface }}
            />
          )}
        </List.Section>

        {/* Close Button */}
        <View style={styles.closeContainer}>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={styles.closeButton}
            icon="close"
          >
            Close
          </Button>
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
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  closeContainer: {
    padding: 16,
    marginTop: 24,
  },
  closeButton: {
    borderRadius: 8,
  },
});
