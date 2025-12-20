import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Alert, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useRouter } from 'expo-router';
import WagerBotChat from '@/components/WagerBotChat';
import { fetchAndFormatGameContext } from '@/services/gameDataService';
import { useProAccess } from '@/hooks/useProAccess';

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

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark } = useThemeContext();
  const { setChatPageOpen } = useWagerBotSuggestion();
  const router = useRouter();
  const { isPro, isLoading: isProLoading } = useProAccess();

  const [gameContext, setGameContext] = useState<string>('');
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const chatRef = useRef<any>(null);

  // Scroll animation setup - disabled header collapsing for better UX
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_HEIGHT = insets.top + 8 + 44 + 12; // paddingTop + header content height + paddingBottom

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
      await RevenueCatUI.presentPaywall();
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
            backgroundColor: isDark ? '#000000' : theme.colors.background,
            paddingTop: insets.top + 8,
          }
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={28} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              WagerBot
            </Text>
            {/* Game Data Indicator - Green when data available, Gray when no data */}
            {!isLoadingContext && (
              <TouchableOpacity
                onPress={() => {
                  // Show info about game data status
                  const hasData = gameContext && gameContext.length > 0;
                  const title = hasData ? 'Game Data Active' : 'No Game Data';
                  const message = hasData 
                    ? 'I have access to today\'s betting lines, predictions, and game data!'
                    : 'No games available for today. I can still help with general betting questions.';
                  Alert.alert(title, message);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[
                  styles.dataIndicator,
                  { backgroundColor: gameContext && gameContext.length > 0 ? '#22c55e' : '#94a3b8' }
                ]} />
              </TouchableOpacity>
            )}
            {isLoadingContext && (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={() => chatRef.current?.toggleHistoryDrawer?.()}
              style={styles.headerIcon}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="history" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => chatRef.current?.clearChat?.()}
              style={styles.headerIcon}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="message-plus-outline" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
        </View>
        {contextError && (
          <Text style={[styles.contextWarning, { color: theme.colors.error }]}>
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
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  dataIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    padding: 4,
  },
  contextWarning: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
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

