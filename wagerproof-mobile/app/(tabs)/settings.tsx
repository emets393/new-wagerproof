import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { useTheme, List, Switch, Divider, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeContext();
  const { user, signOut, signingOut } = useAuth();
  const { useDummyData, setUseDummyData } = useSettings();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [scoreboardEnabled, setScoreboardEnabled] = React.useState(true);
  const [tapCount, setTapCount] = React.useState(0);
  const tapTimer = React.useRef<NodeJS.Timeout | null>(null);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            // Navigation will be handled by route protection in _layout.tsx
          },
        },
      ]
    );
  };

  const handleContactUs = async () => {
    const email = 'admin@wagerproof.bet';
    const subject = 'Contact Us - WagerProof Mobile';
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open email app. Please email us at admin@wagerproof.bet');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open email app. Please email us at admin@wagerproof.bet');
    }
  };

  const handleFeatureRequest = () => {
    router.push('/feature-requests');
  };

  const handleVersionTap = () => {
    setTapCount(prev => prev + 1);
    
    // Clear existing timer
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }
    
    // Set new timer to reset tap count after 500ms
    tapTimer.current = setTimeout(() => {
      setTapCount(0);
    }, 500);
    
    // Check if we've reached double tap
    if (tapCount + 1 >= 2) {
      setTapCount(0);
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
      // Open secret settings
      router.push('/(modals)/secret-settings');
    }
  };

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="cog" size={32} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Settings
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 65 + insets.bottom + 20 }}>
        {/* Account Section */}
        {user && (
          <>
            <List.Section>
              <List.Item
                title={user.email || 'Not logged in'}
                description="Email"
                left={props => <List.Icon {...props} icon="account" color={theme.colors.primary} />}
                style={{ backgroundColor: theme.colors.surface }}
              />
            </List.Section>
            <Divider />
          </>
        )}

        {/* Preferences Section */}
        <List.Section>
          <List.Item
            title="Dark Mode"
            description={isDark ? "Dark theme enabled" : "Light theme enabled"}
            left={props => <List.Icon {...props} icon="theme-light-dark" color={theme.colors.primary} />}
            right={() => (
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                color={theme.colors.primary}
              />
            )}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="ScoreBoard"
            description={scoreboardEnabled ? "Enabled" : "Disabled"}
            left={props => <List.Icon {...props} icon="scoreboard" color={theme.colors.primary} />}
            right={() => (
              <Switch
                value={scoreboardEnabled}
                onValueChange={setScoreboardEnabled}
                color={theme.colors.primary}
              />
            )}
            style={{ backgroundColor: theme.colors.surface }}
          />
        </List.Section>
        <Divider />

        {/* Support Section */}
        <List.Section>
          <List.Item
            title="Contact Us"
            description="Send us feedback"
            left={props => <List.Icon {...props} icon="email" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleContactUs}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="Feature Requests"
            description="Suggest new features"
            left={props => <List.Icon {...props} icon="lightbulb-on" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleFeatureRequest}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="Discord Channel"
            description="Join our community"
            left={props => <List.Icon {...props} icon="chat" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              router.push('/(modals)/discord');
            }}
            style={{ backgroundColor: theme.colors.surface }}
          />
        </List.Section>
        <Divider />

        {/* About Section */}
        <List.Section>
          <List.Item
            title="App Version"
            description="1.0.0"
            left={props => <List.Icon {...props} icon="information" color={theme.colors.primary} />}
            onPress={handleVersionTap}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="Privacy Policy"
            description="View our privacy policy"
            left={props => <List.Icon {...props} icon="shield-lock" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              // Open privacy policy
              Alert.alert('Privacy Policy', 'Opening privacy policy...');
            }}
            style={{ backgroundColor: theme.colors.surface }}
          />
          
          <List.Item
            title="Terms & Conditions"
            description="View our terms"
            left={props => <List.Icon {...props} icon="file-document" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              // Open terms
              Alert.alert('Terms & Conditions', 'Opening terms and conditions...');
            }}
            style={{ backgroundColor: theme.colors.surface }}
          />
        </List.Section>

        {/* Logout Button */}
        {user && (
          <View style={styles.logoutContainer}>
            <Button
              mode="contained"
              onPress={handleLogout}
              style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
              labelStyle={{ color: theme.colors.onError }}
              icon="logout"
              loading={signingOut}
              disabled={signingOut}
            >
              {signingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </View>
        )}

        <View style={{ height: 40 }} />
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
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  logoutContainer: {
    padding: 16,
    marginTop: 24,
  },
  logoutButton: {
    borderRadius: 8,
  },
});

