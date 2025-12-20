import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { useTheme, Card, Button as PaperButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProAccess } from '@/hooks/useProAccess';
import { useThemeContext } from '@/contexts/ThemeContext';

// Import RevenueCatUI for presenting paywalls
let RevenueCatUI: any = null;
try {
  if (Platform.OS !== 'web') {
    const purchasesUI = require('react-native-purchases-ui');
    RevenueCatUI = purchasesUI.default;
  }
} catch (error: any) {
  console.warn('Could not load react-native-purchases-ui:', error.message);
}

const { width } = Dimensions.get('window');

export default function DiscordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPro, isLoading } = useProAccess();
  const { isDark } = useThemeContext();
  const discordInviteUrl = "https://discord.gg/gwy9y7XSDV";

  const handleJoinDiscord = async () => {
    try {
      const supported = await Linking.canOpenURL(discordInviteUrl);
      if (supported) {
        await Linking.openURL(discordInviteUrl);
      }
    } catch (error) {
      console.error('Error opening Discord link:', error);
    }
  };

  const handleUnlockPress = async () => {
    if (!RevenueCatUI) {
      console.warn('RevenueCatUI not available');
      return;
    }
    try {
      await RevenueCatUI.presentPaywall();
    } catch (error) {
      console.error('Error presenting paywall:', error);
    }
  };

  // Show locked state for non-pro users (after loading completes)
  if (!isLoading && !isPro) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header with close button */}
        <LinearGradient
          colors={['rgba(34, 211, 95, 0.1)', 'transparent']}
          style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={28} color={theme.colors.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
              Discord
            </Text>
            <View style={{ width: 28 }} />
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Discord Logo Header */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#5865F2', '#7289DA']}
              style={styles.logoCircle}
            >
              <MaterialCommunityIcons name="chat" size={60} color="white" />
            </LinearGradient>
            <Text style={[styles.mainTitle, { color: theme.colors.onSurface }]}>
              Join Our Discord Community
            </Text>
          </View>

          {/* Locked Main Card */}
          <Card style={[styles.mainCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.mainCardContent}>
              {/* Pro Badge */}
              <View style={[
                styles.proBadge,
                { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(217, 119, 6, 0.15)' }
              ]}>
                <MaterialCommunityIcons
                  name="crown"
                  size={16}
                  color={isDark ? '#f59e0b' : '#d97706'}
                />
                <Text style={[styles.proText, { color: isDark ? '#f59e0b' : '#d97706' }]}>
                  PRO FEATURE
                </Text>
              </View>

              <View style={[styles.iconCircle, { backgroundColor: 'rgba(34, 211, 95, 0.15)' }]}>
                <MaterialCommunityIcons name="shield-check" size={48} color="#22D35F" />
              </View>

              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                Unlock our private Discord server!
              </Text>

              <Text style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}>
                Get instant alerts for Editors Picks on your phone, and share betting insights, strategies, and analysis with the community.
              </Text>

              <TouchableOpacity
                onPress={handleUnlockPress}
                activeOpacity={0.8}
                style={styles.joinButtonContainer}
              >
                <LinearGradient
                  colors={['#f59e0b', '#d97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.joinButton}
                >
                  <MaterialCommunityIcons name="lock-open" size={24} color="white" />
                  <Text style={styles.joinButtonText}>
                    Unlock with Pro
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Card.Content>
          </Card>

          {/* Feature Cards - Show benefits */}
          <View style={styles.featuresContainer}>
            <Card style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.featureCardContent}>
                <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(34, 211, 95, 0.15)' }]}>
                  <MaterialCommunityIcons name="account-group" size={32} color="#22D35F" />
                </View>
                <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>
                  Active Community
                </Text>
                <Text style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Connect with subscribers who share your passion for smart betting
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.featureCardContent}>
                <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(34, 211, 95, 0.15)' }]}>
                  <MaterialCommunityIcons name="bell-ring" size={32} color="#22D35F" />
                </View>
                <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>
                  Push Notifications
                </Text>
                <Text style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Get instant Editors Picks alerts sent directly to your phone
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.featureCardContent}>
                <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(34, 211, 95, 0.15)' }]}>
                  <MaterialCommunityIcons name="shield-lock" size={32} color="#22D35F" />
                </View>
                <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>
                  Exclusive Access
                </Text>
                <Text style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Subscriber-only channels with premium content and analysis
                </Text>
              </Card.Content>
            </Card>
          </View>

          {/* Footer Text */}
          <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
            By joining our Discord server, you agree to follow our community guidelines and Discord's Terms of Service
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with close button */}
      <LinearGradient
        colors={['rgba(34, 211, 95, 0.1)', 'transparent']}
        style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" size={28} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            Discord
          </Text>
          <View style={{ width: 28 }} />
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Discord Logo Header */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#5865F2', '#7289DA']}
            style={styles.logoCircle}
          >
            <MaterialCommunityIcons name="chat" size={60} color="white" />
          </LinearGradient>
          <Text style={[styles.mainTitle, { color: theme.colors.onSurface }]}>
            Join Our Discord Community
          </Text>
        </View>

        {/* Main Card */}
        <Card style={[styles.mainCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.mainCardContent}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(34, 211, 95, 0.15)' }]}>
              <MaterialCommunityIcons name="shield-check" size={48} color="#22D35F" />
            </View>

            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
              As a member of the WagerProof community, you have access to our private Discord server!
            </Text>

            <Text style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}>
              Click below to join other community members! Enable notifications to receive instant alerts for Editors Picks on your phone, and share betting insights, strategies, and analysis with the community.
            </Text>

            <TouchableOpacity 
              onPress={handleJoinDiscord}
              activeOpacity={0.8}
              style={styles.joinButtonContainer}
            >
              <LinearGradient
                colors={['#5865F2', '#7289DA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.joinButton}
              >
                <MaterialCommunityIcons name="chat" size={24} color="white" />
                <Text style={styles.joinButtonText}>
                  Join Exclusive Discord Community
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Feature Cards */}
        <View style={styles.featuresContainer}>
          <Card style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.featureCardContent}>
              <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(34, 211, 95, 0.15)' }]}>
                <MaterialCommunityIcons name="account-group" size={32} color="#22D35F" />
              </View>
              <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>
                Active Community
              </Text>
              <Text style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>
                Connect with subscribers who share your passion for smart betting
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.featureCardContent}>
              <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(34, 211, 95, 0.15)' }]}>
                <MaterialCommunityIcons name="bell-ring" size={32} color="#22D35F" />
              </View>
              <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>
                Push Notifications
              </Text>
              <Text style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>
                Get instant Editors Picks alerts sent directly to your phone
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.featureCardContent}>
              <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(34, 211, 95, 0.15)' }]}>
                <MaterialCommunityIcons name="shield-lock" size={32} color="#22D35F" />
              </View>
              <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>
                Exclusive Access
              </Text>
              <Text style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>
                Subscriber-only channels with premium content and analysis
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Footer Text */}
        <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
          By joining our Discord server, you agree to follow our community guidelines and Discord's Terms of Service
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#5865F2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 40,
  },
  mainCard: {
    borderRadius: 16,
    marginBottom: 24,
    elevation: 4,
  },
  mainCardContent: {
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 30,
  },
  cardDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  joinButtonContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#5865F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  featuresContainer: {
    gap: 16,
    marginBottom: 24,
  },
  featureCard: {
    borderRadius: 12,
    elevation: 2,
  },
  featureCardContent: {
    padding: 20,
    alignItems: 'center',
  },
  featureIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 16,
  },
  proText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

