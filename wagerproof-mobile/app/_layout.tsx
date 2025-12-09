import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useThemeContext } from '../contexts/ThemeContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { NFLGameSheetProvider } from '../contexts/NFLGameSheetContext';
import { CFBGameSheetProvider } from '../contexts/CFBGameSheetContext';
import { NBAGameSheetProvider } from '../contexts/NBAGameSheetContext';
import { NCAABGameSheetProvider } from '../contexts/NCAABGameSheetContext';
import { WagerBotChatSheetProvider } from '../contexts/WagerBotChatSheetContext';
import { WagerBotSuggestionProvider, useWagerBotSuggestion } from '../contexts/WagerBotSuggestionContext';
import { RevenueCatProvider } from '../contexts/RevenueCatContext';
import { OnboardingGuard } from '../components/OnboardingGuard';
import { NFLGameBottomSheet } from '../components/NFLGameBottomSheet';
import { CFBGameBottomSheet } from '../components/CFBGameBottomSheet';
import { NBAGameBottomSheet } from '../components/NBAGameBottomSheet';
import { NCAABGameBottomSheet } from '../components/NCAABGameBottomSheet';
import { WagerBotChatBottomSheet } from '../components/WagerBotChatBottomSheet';
import { FloatingAssistantBubble } from '../components/FloatingAssistantBubble';
import { useOnGameSheetOpen, useGameSheetDetection } from '../hooks/useGameSheetDetection';
import { useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

// Create a query client
const queryClient = new QueryClient();

/**
 * Floating Assistant Wrapper
 *
 * Renders the floating assistant bubble and handles navigation tracking
 * for auto-scanning when game sheets open/close.
 */
function FloatingAssistantWrapper() {
  const {
    isDetached,
    isVisible,
    isLoading,
    bubbleMode,
    currentSuggestion,
    floatingPosition,
    currentOpenGame,
    updateFloatingPosition,
    dismissFloating,
    requestMoreDetails,
    requestAnotherInsight,
    onGameSheetOpen,
    onGameSheetClose,
  } = useWagerBotSuggestion();

  const { isGameSheetOpen } = useGameSheetDetection();

  // Track game sheet state changes for onGameSheetClose
  useEffect(() => {
    if (!isGameSheetOpen && currentOpenGame) {
      onGameSheetClose();
    }
  }, [isGameSheetOpen, currentOpenGame, onGameSheetClose]);

  // Use the hook to detect when a game sheet opens
  useOnGameSheetOpen(
    useCallback((game, sport) => {
      onGameSheetOpen(game, sport);
    }, [onGameSheetOpen]),
    isDetached // Only track when in floating mode
  );

  // Only render when detached
  if (!isDetached) {
    return null;
  }

  return (
    <FloatingAssistantBubble
      visible={isVisible && isDetached}
      isScanning={bubbleMode === 'scanning' || isLoading}
      suggestion={currentSuggestion}
      position={floatingPosition}
      onPositionChange={updateFloatingPosition}
      onDismiss={dismissFloating}
      onTellMeMore={requestMoreDetails}
      onAnotherInsight={requestAnotherInsight}
      hasGameContext={!!currentOpenGame}
    />
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useThemeContext();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Don't redirect immediately - let OnboardingGuard handle it
      // This allows checking onboarding status first
      return;
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <OnboardingGuard>
      <>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(onboarding)"
            options={{
              headerShown: false,
              presentation: 'modal'
            }}
          />
          <Stack.Screen
            name="(modals)"
            options={{
              presentation: 'modal',
              headerShown: false
            }}
          />
        </Stack>
        <NFLGameBottomSheet />
        <CFBGameBottomSheet />
        <NBAGameBottomSheet />
        <NCAABGameBottomSheet />
        <WagerBotChatBottomSheet />
        {/* Floating assistant - renders above everything when detached */}
        <FloatingAssistantWrapper />
      </>
    </OnboardingGuard>
  );
}

function RootLayoutContent() {
  const { theme } = useThemeContext();

  // Hide Android navigation bar
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <SettingsProvider>
          <WagerBotSuggestionProvider>
            <AuthProvider>
              <RevenueCatProvider>
                <NFLGameSheetProvider>
                  <CFBGameSheetProvider>
                    <NBAGameSheetProvider>
                      <NCAABGameSheetProvider>
                        <WagerBotChatSheetProvider>
                          <RootNavigator />
                        </WagerBotChatSheetProvider>
                      </NCAABGameSheetProvider>
                    </NBAGameSheetProvider>
                  </CFBGameSheetProvider>
                </NFLGameSheetProvider>
              </RevenueCatProvider>
            </AuthProvider>
          </WagerBotSuggestionProvider>
        </SettingsProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
