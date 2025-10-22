import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTheme, List, Switch, Divider, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettings } from '@/contexts/SettingsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function SecretSettingsScreen() {
  const theme = useTheme();
  const { useDummyData, setUseDummyData } = useSettings();
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
          
          <List.Item
            title="Use Dummy Data"
            description={useDummyData ? "Showing dummy data for testing" : "Using live data from API"}
            left={props => <List.Icon {...props} icon="test-tube" color={theme.colors.primary} />}
            right={() => (
              <Switch
                value={useDummyData}
                onValueChange={setUseDummyData}
                color={theme.colors.primary}
              />
            )}
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

