import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useTheme, List, Switch, Divider, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getOfferingById, getAllOfferings, syncPurchases } from '@/services/revenuecat';

// Import RevenueCatUI for presenting paywalls
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    RevenueCatUI = purchasesUI.default;
    PAYWALL_RESULT = purchasesUI.PAYWALL_RESULT;
  }
} catch (error: any) {
  console.warn('Could not load react-native-purchases-ui:', error.message);
}

export default function SecretSettingsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
    console.log('RevenueCatUI available:', !!RevenueCatUI);
    console.log('PAYWALL_RESULT available:', !!PAYWALL_RESULT);

    if (!RevenueCatUI) {
      console.error('❌ RevenueCatUI is null');
      Alert.alert(
        'Not Available',
        'RevenueCat UI is not available. Make sure you are running on a physical device or simulator (not web) and the app has been rebuilt with native modules.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // First, fetch the specific "default" offering
      console.log('📦 Fetching offering with identifier "default"...');
      const defaultOffering = await getOfferingById('default');
      console.log('"default" offering:', defaultOffering);
      
      if (!defaultOffering) {
        console.error('❌ Offering "default" not found!');
        Alert.alert(
          'Offering Not Found',
          'The offering named "default" could not be found. Make sure you have created an offering with identifier "default" in your RevenueCat dashboard.'
        );
        return;
      }
      
      console.log('✅ Offering "default" details:', {
        identifier: defaultOffering.identifier,
        serverDescription: defaultOffering.serverDescription,
        availablePackages: defaultOffering.availablePackages?.length || 0,
      });
      
      console.log('🚀 Calling RevenueCatUI.presentPaywall() with "default" offering...');
      
      // Present paywall for the specific "default" offering using the official API
      const paywallResult = await RevenueCatUI.presentPaywall({
        offering: defaultOffering
      });
      
      console.log('✅ Paywall completed with result:', paywallResult);
      console.log('Result type:', typeof paywallResult);
      
      // Log all PAYWALL_RESULT values for debugging
      if (PAYWALL_RESULT) {
        console.log('Available PAYWALL_RESULT values:', {
          PURCHASED: PAYWALL_RESULT.PURCHASED,
          RESTORED: PAYWALL_RESULT.RESTORED,
          CANCELLED: PAYWALL_RESULT.CANCELLED,
          NOT_PRESENTED: PAYWALL_RESULT.NOT_PRESENTED,
          ERROR: PAYWALL_RESULT.ERROR,
        });
      }

      // Handle the result
      switch (paywallResult) {
        case PAYWALL_RESULT.PURCHASED:
          console.log('✅ User completed purchase');
          Alert.alert('Success', 'Purchase completed!');
          break;
        case PAYWALL_RESULT.RESTORED:
          console.log('✅ User restored purchases');
          Alert.alert('Success', 'Purchases restored!');
          break;
        case PAYWALL_RESULT.CANCELLED:
          console.log('ℹ️ User cancelled the paywall');
          // Don't show an alert for cancellation, it's expected behavior
          break;
        case PAYWALL_RESULT.NOT_PRESENTED:
          console.error('❌ Paywall was not presented');
          Alert.alert(
            'Paywall Not Shown',
            'The paywall could not be presented. This usually means:\n\n1. No offerings are configured in RevenueCat dashboard\n2. The offering has no paywall attached\n3. Network connectivity issues\n\nCheck the console logs for more details.'
          );
          break;
        case PAYWALL_RESULT.ERROR:
          console.error('❌ Paywall returned ERROR result');
          Alert.alert('Error', 'An error occurred while presenting the paywall. Check console logs for details.');
          break;
        default:
          console.warn('⚠️ Unknown paywall result:', paywallResult);
          Alert.alert('Info', `Paywall completed with result: ${paywallResult}`);
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
        {/* Developer Section */}
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
            Developer Options
          </List.Subheader>
          
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

