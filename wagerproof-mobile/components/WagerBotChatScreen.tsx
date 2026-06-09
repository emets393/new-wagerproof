import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useRouter, Stack } from 'expo-router';
import WagerBotChat from '@/components/WagerBotChat';
import { useProAccess } from '@/hooks/useProAccess';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';

export function WagerBotChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark } = useThemeContext();
  const { setChatPageOpen } = useWagerBotSuggestion();
  const { refreshCustomerInfo } = useRevenueCat();
  const router = useRouter();
  const { isPro, isLoading: isProLoading } = useProAccess();

  const chatRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  // Native UINavigationBar height (44pt inline) + top safe area. Used to
  // offset the message list so the first message doesn't render under the
  // blurred chrome. Honeydew's ChatV3View doesn't need this because its
  // List is anchored by NavigationStack; here the chat is a custom Animated
  // FlatList that needs an explicit top inset.
  const NAV_BAR_HEIGHT = 44;
  const HEADER_HEIGHT = insets.top + NAV_BAR_HEIGHT;

  useEffect(() => {
    setChatPageOpen(true);
    return () => {
      setChatPageOpen(false);
    };
  }, [setChatPageOpen]);

  if (!user) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>Loading...</Text>
      </View>
    );
  }

  const handleBack = () => router.back();

  const handleUnlockPress = async () => {
    try {
      const result = await presentPaywallForPlacementIfNeeded(
        ENTITLEMENT_IDENTIFIER,
        PAYWALL_PLACEMENTS.GENERIC_FEATURE,
      );
      if (didPaywallGrantEntitlement(result)) {
        await refreshCustomerInfo();
      }
    } catch (error) {
      console.error('Error presenting paywall:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : theme.colors.background }]}>
      {/* Native iOS inline-title chrome (Honeydew ChatV3View pattern):
          translucent UltraThinMaterialDark blur + auto back chevron + two
          right-aligned UIBarButtonItems (History, New chat). The previous
          hand-rolled BlurView + LinearGradient + circle buttons is gone. */}
      <Stack.Screen
        options={{
          headerTitle: 'WagerBot',
          headerRight: () => (
            <View style={styles.toolbarGroup}>
              <TouchableOpacity
                onPress={() => chatRef.current?.toggleHistoryDrawer?.()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Chat history"
              >
                <MaterialCommunityIcons name="history" size={22} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => chatRef.current?.handleNewChat?.()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="New chat"
              >
                <MaterialCommunityIcons name="message-plus-outline" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {isProLoading || isPro ? (
        <View style={styles.chatContainer}>
          <WagerBotChat
            ref={chatRef}
            userId={user.id}
            userEmail={user.email || ''}
            onBack={handleBack}
            scrollY={scrollY}
            headerHeight={HEADER_HEIGHT}
          />
        </View>
      ) : (
        <View style={styles.lockedContainer}>
          <TouchableOpacity
            style={[
              styles.lockedContent,
              { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)' },
            ]}
            onPress={handleUnlockPress}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.proBadge,
                { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(217, 119, 6, 0.15)' },
              ]}
            >
              <MaterialCommunityIcons name="crown" size={16} color={isDark ? '#f59e0b' : '#d97706'} />
              <Text style={[styles.proText, { color: isDark ? '#f59e0b' : '#d97706' }]}>PRO</Text>
            </View>
            <MaterialCommunityIcons
              name="robot"
              size={64}
              color={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)'}
              style={styles.lockedRobotIcon}
            />
            <MaterialCommunityIcons name="lock" size={32} color={isDark ? '#ffffff' : '#1f2937'} />
            <Text style={[styles.lockedTitle, { color: isDark ? '#ffffff' : '#1f2937' }]}>
              WagerBot Pro
            </Text>
            <Text
              style={[
                styles.lockedSubtitle,
                { color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' },
              ]}
            >
              Get unlimited AI-powered betting analysis and insights
            </Text>
            <View style={[styles.unlockButton, { backgroundColor: isDark ? '#f59e0b' : '#d97706' }]}>
              <Text style={styles.unlockButtonText}>Unlock with Pro</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16 },
  // Native nav-bar trailing button group — matches Honeydew's
  // `ToolbarItemGroup(placement: .topBarTrailing)` shape (two icons, equal
  // spacing). On iOS 26 the system wraps each item in its own glass capsule.
  toolbarGroup: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chatContainer: { flex: 1 },
  lockedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  lockedContent: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    maxWidth: 320,
    width: '100%',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 24,
  },
  proText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  lockedRobotIcon: { marginBottom: 16 },
  lockedTitle: { fontSize: 24, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  lockedSubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  unlockButton: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  unlockButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
