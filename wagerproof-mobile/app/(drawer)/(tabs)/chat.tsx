import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Alert, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useRouter } from 'expo-router';
import WagerBotChat from '@/components/WagerBotChat';
import { fetchAndFormatGameContext } from '@/services/gameDataService';
import { useProAccess } from '@/hooks/useProAccess';

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

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark } = useThemeContext();
  const { setChatPageOpen } = useWagerBotSuggestion();
  const { refreshCustomerInfo } = useRevenueCat();
  const router = useRouter();
  const { isPro, isLoading: isProLoading } = useProAccess();

  const [gameContext, setGameContext] = useState<string>('');
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const chatRef = useRef<any>(null);

  // Scroll animation setup - disabled header collapsing for better UX
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_HEIGHT = insets.top + 8 + 56 + 8; // paddingTop + header content height + paddingBottom

  // Hide suggestion bubble when chat screen is open and prevent new ones
  useEffect(() => {
    setChatPageOpen(true);
    return () => {
      setChatPageOpen(false);
    };
  }, [setChatPageOpen]);

  // Fetch game data on mount
  useEffect(() => {
    loadGameContext();
  }, []);

  const loadGameContext = async () => {
    try {
      setIsLoadingContext(true);
      setContextError(null);
      console.log('🔄 Loading game context for WagerBot...');
      
      const context = await fetchAndFormatGameContext();
      setGameContext(context);
      
      console.log('✅ Game context loaded successfully');
      console.log('📊 Context length:', context.length, 'characters');
      console.log('📊 Context preview (first 300 chars):', context.substring(0, 300));
      
      if (!context || context.length === 0) {
        console.warn('⚠️ WARNING: Game context is empty! AI will not have game data.');
        setContextError('No game data available at this time.');
      }
    } catch (error) {
      console.error('❌ Error loading game context:', error);
      setContextError('Failed to load game data. Chat will work without game context.');
      // Don't block chat from loading - it can still work without context
    } finally {
      setIsLoadingContext(false);
    }
  };

  // Show loading while checking auth
  if (!user) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
          Loading...
        </Text>
      </View>
    );
  }

  const handleBack = () => {
    // Navigate back to feed
    router.back();
  };

  const handleUnlockPress = async () => {
    if (!RevenueCatUI) {
      console.warn('RevenueCatUI not available');
      return;
    }
    try {
      const result = await RevenueCatUI.presentPaywall();
      
      // If user made a purchase or restored, refresh entitlements
      if (PAYWALL_RESULT && (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED)) {
        console.log('🔄 Purchase/restore detected, refreshing customer info...');
        await refreshCustomerInfo();
        console.log('✅ Customer info refreshed - entitlements should now be active');
      }
    } catch (error) {
      console.error('Error presenting paywall:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : theme.colors.background }]}>
      {/* Fixed Header with Back Button - Always visible for better accessibility */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
          }
        ]}
      >
        <View pointerEvents="none" style={styles.headerFx}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient
            colors={['rgba(8,8,8,0.74)', 'rgba(8,8,8,0.46)', 'rgba(8,8,8,0.18)', 'rgba(8,8,8,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={handleBack}
            style={styles.sideButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: '#ffffff' }]}>
              WagerBot
            </Text>
            {!isLoadingContext && (
              <Text style={styles.subtitle}>
                {gameContext && gameContext.length > 0 ? 'Extended' : 'General'}
              </Text>
            )}
            {isLoadingContext && (
              <ActivityIndicator size="small" color="#ffffff" />
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={() => chatRef.current?.toggleHistoryDrawer?.()}
              style={styles.sideButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="history" size={21} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => chatRef.current?.clearChat?.()}
              style={styles.sideButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="message-plus-outline" size={21} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
        {contextError && (
          <Text style={[styles.contextWarning, { color: 'rgba(255,255,255,0.72)' }]}>
            {contextError}
          </Text>
        )}
      </View>

      {/* Chat Component or Locked State (only show locked when loading is complete) */}
      {isProLoading || isPro ? (
        <View style={styles.chatContainer}>
          <WagerBotChat
            ref={chatRef}
            userId={user.id}
            userEmail={user.email || ''}
            gameContext={gameContext}
            onRefresh={loadGameContext}
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
              { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)' }
            ]}
            onPress={handleUnlockPress}
            activeOpacity={0.8}
          >
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
                PRO
              </Text>
            </View>

            <MaterialCommunityIcons
              name="robot"
              size={64}
              color={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)'}
              style={styles.lockedRobotIcon}
            />

            <MaterialCommunityIcons
              name="lock"
              size={32}
              color={isDark ? '#ffffff' : '#1f2937'}
            />

            <Text style={[styles.lockedTitle, { color: isDark ? '#ffffff' : '#1f2937' }]}>
              WagerBot Pro
            </Text>

            <Text style={[styles.lockedSubtitle, { color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }]}>
              Get unlimited AI-powered betting analysis and insights
            </Text>

            <View style={[
              styles.unlockButton,
              { backgroundColor: isDark ? '#f59e0b' : '#d97706' }
            ]}>
              <Text style={styles.unlockButtonText}>Unlock with Pro</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingBottom: 8,
    paddingHorizontal: 16,
    overflow: 'visible',
  },
  headerFx: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: -4,
    zIndex: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    zIndex: 2,
  },
  sideButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 16, 16, 0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  titleContainer: {
    position: 'absolute',
    left: 84,
    right: 146,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  contextWarning: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    zIndex: 2,
  },
  chatContainer: {
    flex: 1,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
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
  proText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  lockedRobotIcon: {
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  lockedSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  unlockButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  unlockButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
