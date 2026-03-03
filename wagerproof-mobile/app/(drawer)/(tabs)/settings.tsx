import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Application from 'expo-application';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useProAccess } from '@/hooks/useProAccess';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { RevenueCatPaywall } from '@/components/RevenueCatPaywall';
import { PAYWALL_PLACEMENTS } from '@/services/revenuecat';
import { useLearnWagerProof } from '@/contexts/LearnWagerProofContext';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  registerPushToken,
  deactivatePushTokens,
} from '@/services/notificationService';

type ActionRowProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  iconBackground: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightContent?: React.ReactNode;
  destructive?: boolean;
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
  destructive = false,
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
        <Text style={[styles.actionTitle, { color: titleColor }, destructive && styles.destructiveText]}>
          {title}
        </Text>
        {!!subtitle && <Text style={[styles.actionSubtitle, { color: subtitleColor }]}>{subtitle}</Text>}
      </View>

      <View style={styles.actionRight}>
        {rightContent ?? <MaterialCommunityIcons name="chevron-right" size={28} color={chevronColor} />}
      </View>
    </TouchableOpacity>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme } = useThemeContext();
  const { user, signOut, signingOut, deletingAccount } = useAuth();
  const { isPro, subscriptionType } = useProAccess();
  const { openCustomerCenter } = useRevenueCat();
  const { suggestionsEnabled, setSuggestionsEnabled, isDetached, dismissFloating } = useWagerBotSuggestion();
  const { openLearnSheet } = useLearnWagerProof();
  const [isOpeningCustomerCenter, setIsOpeningCustomerCenter] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  // Check notification permission status on mount
  useEffect(() => {
    getNotificationPermissionStatus().then((status) => {
      setNotificationsEnabled(status === 'granted');
      setNotificationsLoading(false);
    }).catch(() => setNotificationsLoading(false));
  }, []);

  const handleNotificationToggle = useCallback(async (value: boolean) => {
    if (value) {
      const status = await getNotificationPermissionStatus();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        if (user?.id) await registerPushToken(user.id);
      } else if (status === 'undetermined') {
        const result = await requestNotificationPermission();
        if (result === 'granted') {
          setNotificationsEnabled(true);
          if (user?.id) await registerPushToken(user.id);
        }
      } else {
        // denied — open system settings
        Alert.alert(
          'Notifications Disabled',
          'Push notifications are blocked by your device. Open Settings to enable them.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } else {
      // User wants to disable — deactivate tokens so they stop receiving
      setNotificationsEnabled(false);
      if (user?.id) await deactivatePushTokens(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isDetached) {
      dismissFloating();
    }
  }, [dismissFloating, isDetached]);

  useEffect(() => {
    return () => {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
    };
  }, []);

  const appVersion = useMemo(() => {
    const nativeVersion = Application.nativeApplicationVersion || '1.0.0';
    const buildVersion = Application.nativeBuildVersion;
    return buildVersion ? `${nativeVersion} (${buildVersion})` : nativeVersion;
  }, []);

  const pageBackground = isDark ? '#111111' : '#f3f0eb';
  const titleColor = isDark ? '#f8f4ef' : '#1e1e1f';
  const subtitleColor = isDark ? '#b8b2aa' : '#6f6a66';
  const switchTrackColors = isDark
    ? { false: '#4f4a45', true: '#f0c542' }
    : { false: '#cfc7bf', true: '#1f1f1f' };
  const switchThumbColor = isDark ? '#fffaf2' : '#ffffff';

  const handleVersionTap = () => {
    setTapCount((prev) => prev + 1);

    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }

    tapTimer.current = setTimeout(() => {
      setTapCount(0);
    }, 500);

    if (tapCount + 1 >= 2) {
      setTapCount(0);
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
      router.push('/(modals)/secret-settings');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
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
    } catch {
      Alert.alert('Error', 'Unable to open email app. Please email us at admin@wagerproof.bet');
    }
  };

  const handleOpenCustomerCenter = async () => {
    try {
      setIsOpeningCustomerCenter(true);
      await openCustomerCenter();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to open Customer Center';

      if (errorMessage.includes('not available') || errorMessage.includes('not configured')) {
        try {
          const fallbackUrl =
            Platform.OS === 'ios'
              ? 'https://apps.apple.com/account/subscriptions'
              : 'https://play.google.com/store/account/subscriptions';
          const canOpen = await Linking.canOpenURL(fallbackUrl);
          if (canOpen) {
            await Linking.openURL(fallbackUrl);
          } else {
            Alert.alert(
              'Manage Subscription',
              Platform.OS === 'ios'
                ? 'Open the App Store subscription manager from iPhone Settings.'
                : 'Open Google Play Store subscriptions to manage your plan.'
            );
          }
        } catch {
          Alert.alert(
            'Manage Subscription',
            Platform.OS === 'ios'
              ? 'Open the App Store subscription manager from iPhone Settings.'
              : 'Open Google Play Store subscriptions to manage your plan.'
          );
        }
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsOpeningCustomerCenter(false);
    }
  };

  const handleSubscriptionPress = () => {
    setPaywallVisible(true);
  };

  const handleOpenDeleteAccountTool = () => {
    router.back();
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        router.push('/(modals)/delete-account');
      }, 120);
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 120,
        }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
            <MaterialCommunityIcons name="chevron-left" size={38} color={titleColor} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: titleColor }]}>Settings</Text>
            <Text style={[styles.headerSubtitle, { color: subtitleColor }]}>
              Account, billing, preferences
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.pagePadding}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleSubscriptionPress}>
            <LinearGradient
            colors={isDark ? ['#b98300', '#d8a61b', '#f0c542'] : ['#efbe34', '#f3c43f', '#f7d768']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
            >
              <View style={styles.heroGlowOne} />
              <View style={styles.heroGlowTwo} />

              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>{isPro ? 'PRO MEMBER' : 'SPECIAL OFFER'}</Text>
                <Text style={styles.heroTitle}>
                  {isPro ? 'YOU ARE\nPRO' : 'GO PRO\nTODAY'}
                </Text>
                {!isPro && (
                  <View style={styles.heroBadgePill}>
                    <Text style={styles.heroBadgePillText}>Unlock premium picks</Text>
                  </View>
                )}
              </View>

              <View style={styles.heroArtwork}>
                <View style={styles.heroBadge}>
                  <MaterialCommunityIcons name={isPro ? 'crown' : 'gift'} size={46} color="#f08b00" />
                </View>
                <View style={styles.heroMiniBadge}>
                  <MaterialCommunityIcons name="star-four-points" size={18} color="#f08b00" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <SectionCard title="Membership">
            {user?.email && (
              <ActionRow
                icon="email-outline"
                iconColor="#eb7a00"
                iconBackground="#fff1e3"
                title="Email"
                subtitle={user.email}
              />
            )}
            <ActionRow
              icon="credit-card-outline"
              iconColor="#2a86ff"
              iconBackground="#edf5ff"
              title="Manage Subscription"
              subtitle={
                isPro
                  ? subscriptionType
                    ? `Active ${subscriptionType} membership`
                    : 'Billing, renewal, and plan details'
                  : 'View plans, billing, and upgrade options'
              }
              onPress={isPro ? handleOpenCustomerCenter : handleSubscriptionPress}
              rightContent={
                isOpeningCustomerCenter ? (
                  <ActivityIndicator size="small" color="#2a86ff" />
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={28} color="#b7b7b7" />
                )
              }
              last
            />
          </SectionCard>

          <SectionCard title="Preferences">
            <ActionRow
              icon="theme-light-dark"
              iconColor="#5f56d8"
              iconBackground="#f1efff"
              title="Dark Mode"
              subtitle={isDark ? 'Dark theme enabled' : 'Light theme enabled'}
              rightContent={
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={switchTrackColors}
                  thumbColor={switchThumbColor}
                />
              }
            />
            <ActionRow
              icon="robot-outline"
              iconColor="#2b9e76"
              iconBackground="#e9f8f2"
              title="WagerBot Suggestions"
              subtitle={suggestionsEnabled ? 'Proactive suggestions enabled' : 'Suggestions are off'}
              rightContent={
                <Switch
                  value={suggestionsEnabled}
                  onValueChange={setSuggestionsEnabled}
                  trackColor={switchTrackColors}
                  thumbColor={switchThumbColor}
                />
              }
            />
            <ActionRow
              icon="bell-outline"
              iconColor="#e65100"
              iconBackground="#fff3e0"
              title="Push Notifications"
              subtitle={notificationsEnabled ? 'Get notified when agent picks are ready' : 'Notifications are off'}
              rightContent={
                notificationsLoading ? (
                  <ActivityIndicator size="small" color="#e65100" />
                ) : (
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={handleNotificationToggle}
                    trackColor={switchTrackColors}
                    thumbColor={switchThumbColor}
                  />
                )
              }
            />
            {Platform.OS === 'ios' && (
              <ActionRow
                icon="widgets-outline"
                iconColor="#f08b00"
                iconBackground="#fff2de"
                title="iOS Home Screen Widget"
                subtitle="Add a quick access widget"
                onPress={() => router.push('/(modals)/ios-widget')}
                last
              />
            )}
            {Platform.OS !== 'ios' && (
              <ActionRow
                icon="information-outline"
                iconColor="#8b8b8b"
                iconBackground="#f4f1ec"
                title="App Version"
                subtitle={appVersion}
                onPress={handleVersionTap}
                last
              />
            )}
          </SectionCard>

          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(modals)/discord')}>
            <LinearGradient
              colors={isDark ? ['#5865f2', '#6573ff', '#7c88ff'] : ['#5b67f3', '#6f7cff', '#8d96ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.discordBanner}
            >
              <View style={styles.discordGlowOne} />
              <View style={styles.discordGlowTwo} />

              <View style={styles.heroCopy}>
                <Text style={styles.discordEyebrow}>COMMUNITY</Text>
                <Text style={styles.discordTitle}>JOIN OUR{'\n'}DISCORD</Text>
                <View style={styles.discordBadgePill}>
                  <Text style={styles.discordBadgePillText}>Get picks, updates, and live chat</Text>
                </View>
              </View>

              <View style={styles.heroArtwork}>
                <View style={styles.discordBadge}>
                  <MaterialCommunityIcons name="chat-processing-outline" size={42} color="#5865f2" />
                </View>
                <View style={styles.discordMiniBadge}>
                  <MaterialCommunityIcons name="message-flash-outline" size={16} color="#5865f2" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <SectionCard title="Community & Support">
            <ActionRow
              icon="chat-processing-outline"
              iconColor="#7289da"
              iconBackground="#eef1ff"
              title="Discord Channel"
              subtitle={isPro ? 'Join our community' : 'Member community access'}
              onPress={() => router.push('/(modals)/discord')}
            />
            <ActionRow
              icon="lightbulb-on-outline"
              iconColor="#55b13b"
              iconBackground="#eef9eb"
              title="Feature Requests"
              subtitle="Suggest something we should build next"
              onPress={() => router.push('/feature-requests')}
            />
            <ActionRow
              icon="school-outline"
              iconColor="#f08b00"
              iconBackground="#fff3df"
              title="Learn WagerProof"
              subtitle="Take a guided tour of the app"
              onPress={() => openLearnSheet()}
            />
            <ActionRow
              icon="email-outline"
              iconColor="#eb7a00"
              iconBackground="#fff1e3"
              title="Contact Us"
              subtitle="Reach support directly"
              onPress={handleContactUs}
              last
            />
          </SectionCard>

          <SectionCard title="Legal & Policies">
            <ActionRow
              icon="shield-half-full"
              iconColor="#f4a000"
              iconBackground="#fff6df"
              title="Privacy Policy"
              subtitle="How we collect and use data"
              onPress={() => Linking.openURL('https://wagerproof.bet/privacy-policy')}
            />
            <ActionRow
              icon="file-document-outline"
              iconColor="#f4a000"
              iconBackground="#fff6df"
              title="Terms of Use"
              subtitle="Service terms and billing rules"
              onPress={() => Linking.openURL('https://wagerproof.bet/terms-and-conditions')}
            />
            <ActionRow
              icon="information-outline"
              iconColor="#8b8b8b"
              iconBackground="#f4f1ec"
              title="App Version"
              subtitle={appVersion}
              onPress={handleVersionTap}
              last
            />
          </SectionCard>

          {user && (
            <>
              <SectionCard title="Account">
              <ActionRow
                icon="logout"
                iconColor="#d16a00"
                  iconBackground="#fff0e1"
                  title={signingOut ? 'Logging out...' : 'Log Out'}
                  subtitle="Sign out of this device"
                  onPress={handleLogout}
                  rightContent={
                    signingOut ? (
                      <ActivityIndicator size="small" color="#d16a00" />
                    ) : (
                      <MaterialCommunityIcons name="chevron-right" size={28} color="#b7b7b7" />
                    )
                  }
                  last
                />
              </SectionCard>
              <SectionCard title="Danger Zone">
                <ActionRow
                  icon="alert-octagon-outline"
                  iconColor="#dd4d3f"
                  iconBackground="#fff0ee"
                  title={deletingAccount ? 'Deleting account...' : 'Delete Account'}
                  subtitle="Opens the delete-account tool with swipe confirmation"
                  onPress={deletingAccount ? undefined : handleOpenDeleteAccountTool}
                  destructive
                  rightContent={
                    deletingAccount ? (
                      <ActivityIndicator size="small" color="#dd4d3f" />
                    ) : (
                      <MaterialCommunityIcons name="chevron-right" size={28} color="#b7b7b7" />
                    )
                  }
                  last
                />
              </SectionCard>
            </>
          )}
        </View>
      </ScrollView>

      <RevenueCatPaywall
        visible={paywallVisible}
        placementId={PAYWALL_PLACEMENTS.GENERIC_FEATURE}
        onClose={() => setPaywallVisible(false)}
        onPurchaseComplete={() => {
          setPaywallVisible(false);
          Alert.alert('Success', 'Welcome to WagerProof Pro.');
        }}
      />
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
  heroCard: {
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 132,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  heroGlowOne: {
    position: 'absolute',
    top: -18,
    right: 44,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroGlowTwo: {
    position: 'absolute',
    bottom: -30,
    right: -6,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#1c1c1d',
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 27,
    lineHeight: 28,
    color: '#151515',
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  heroBadgePill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgePillText: {
    color: '#ea7a00',
    fontSize: 12,
    fontWeight: '700',
  },
  heroArtwork: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    shadowColor: '#8f6100',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroMiniBadge: {
    position: 'absolute',
    top: 14,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discordBanner: {
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 132,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  discordGlowOne: {
    position: 'absolute',
    top: -18,
    right: 44,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  discordGlowTwo: {
    position: 'absolute',
    bottom: -30,
    right: -6,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  discordEyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#ffffff',
  },
  discordTitle: {
    marginTop: 6,
    fontSize: 27,
    lineHeight: 28,
    color: '#ffffff',
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  discordBadgePill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  discordBadgePillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  discordBadge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    shadowColor: '#27318f',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  discordMiniBadge: {
    position: 'absolute',
    top: 14,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionWrap: {
    gap: 12,
  },
  sectionTitle: {
    paddingHorizontal: 6,
    fontSize: 15,
    fontWeight: '700',
    color: '#6c6763',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
  },
  actionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ece7e1',
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
    color: '#232325',
  },
  actionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#7d7873',
  },
  actionRight: {
    minWidth: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  destructiveText: {
    color: '#dd4d3f',
  },
});
