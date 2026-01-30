import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useThemeContext } from '../contexts/ThemeContext';
import { AnalyticsProvider } from '../contexts/AnalyticsContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { NFLGameSheetProvider } from '../contexts/NFLGameSheetContext';
import { CFBGameSheetProvider } from '../contexts/CFBGameSheetContext';
import { NBAGameSheetProvider } from '../contexts/NBAGameSheetContext';
import { NCAABGameSheetProvider } from '../contexts/NCAABGameSheetContext';
import { NBABettingTrendsSheetProvider } from '../contexts/NBABettingTrendsSheetContext';
import { AdminModeProvider } from '../contexts/AdminModeContext';
import { EditorPickSheetProvider } from '../contexts/EditorPickSheetContext';
import { WagerBotChatSheetProvider } from '../contexts/WagerBotChatSheetContext';
import { WagerBotSuggestionProvider, useWagerBotSuggestion } from '../contexts/WagerBotSuggestionContext';
import { RevenueCatProvider, useRevenueCat } from '../contexts/RevenueCatContext';
import { OnboardingGuard } from '../components/OnboardingGuard';
import { NFLGameBottomSheet } from '../components/NFLGameBottomSheet';
import { CFBGameBottomSheet } from '../components/CFBGameBottomSheet';
import { NBAGameBottomSheet } from '../components/NBAGameBottomSheet';
import { NCAABGameBottomSheet } from '../components/NCAABGameBottomSheet';
import { NBABettingTrendsBottomSheet } from '../components/NBABettingTrendsBottomSheet';
import { WagerBotChatBottomSheet } from '../components/WagerBotChatBottomSheet';
import { EditorPickCreatorBottomSheet } from '../components/EditorPickCreatorBottomSheet';
import { FloatingAssistantBubble } from '../components/FloatingAssistantBubble';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { useOnGameSheetOpen, useGameSheetDetection } from '../hooks/useGameSheetDetection';
import { useAppReady } from '../hooks/useAppReady';
import { useNetworkState } from '../hooks/useNetworkState';
import { useEffect, useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Linking, Alert, Text } from 'react-native';
import Purchases, { WebPurchaseRedemptionResultType } from 'react-native-purchases';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync();

// Create a query client with optimized settings for slow networks
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed requests with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Keep data fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache data for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Use cached data when offline, refetch when online
      networkMode: 'offlineFirst',
      // Don't refetch on window focus by default (reduces unnecessary requests)
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
});

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
    currentPageContext,
    updateFloatingPosition,
    dismissFloating,
    requestMoreDetails,
    requestAnotherInsight,
    onGameSheetOpen,
    onGameSheetClose,
    initialBubbleDimensions,
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

  // Show action buttons when viewing a game OR on outliers page
  const showActionButtons = !!currentOpenGame || currentPageContext === 'outliers';

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
      hasGameContext={showActionButtons}
      initialDimensions={initialBubbleDimensions}
    />
  );
}

/**
 * Web Purchase Redemption Handler
 *
 * Handles RevenueCat web purchase redemption links (rc-ff2fe0e0af://)
 * When users complete a web purchase, they receive a redemption link that
 * opens the app and grants them their entitlements.
 */
function WebPurchaseRedemptionHandler() {
  const { refreshCustomerInfo } = useRevenueCat();
  const isProcessingRef = useRef(false);

  const handleRedemptionUrl = useCallback(async (url: string) => {
    // Prevent duplicate processing
    if (isProcessingRef.current) return;

    // Only handle on native platforms
    if (Platform.OS === 'web') return;

    // Check if this is a web purchase redemption URL
    if (!url.includes('redeem_web_purchase')) return;

    isProcessingRef.current = true;

    try {
      const webPurchaseRedemption = await Purchases.parseAsWebPurchaseRedemption(url);

      if (webPurchaseRedemption) {
        const result = await Purchases.redeemWebPurchase(webPurchaseRedemption);

        switch (result.result) {
          case WebPurchaseRedemptionResultType.SUCCESS:
            // Refresh customer info to update entitlements
            await refreshCustomerInfo();
            Alert.alert(
              'Purchase Activated!',
              'Your WagerProof Pro subscription has been activated. Enjoy full access to all features!',
              [{ text: 'OK' }]
            );
            break;

          case WebPurchaseRedemptionResultType.ERROR:
            Alert.alert(
              'Activation Failed',
              'There was an error activating your purchase. Please try again or contact support.',
              [{ text: 'OK' }]
            );
            break;

          case WebPurchaseRedemptionResultType.INVALID_TOKEN:
            Alert.alert(
              'Invalid Link',
              'This activation link is invalid. Please check your email for a valid link.',
              [{ text: 'OK' }]
            );
            break;

          case WebPurchaseRedemptionResultType.PURCHASE_BELONGS_TO_OTHER_USER:
            Alert.alert(
              'Already Claimed',
              'This purchase has already been claimed by another account.',
              [{ text: 'OK' }]
            );
            break;

          case WebPurchaseRedemptionResultType.EXPIRED:
            Alert.alert(
              'Link Expired',
              `This activation link has expired. A new link has been sent to ${result.obfuscatedEmail}. Please check your email.`,
              [{ text: 'OK' }]
            );
            break;
        }
      }
    } catch (error) {
      console.error('Error processing web purchase redemption:', error);
      Alert.alert(
        'Activation Error',
        'An unexpected error occurred. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      isProcessingRef.current = false;
    }
  }, [refreshCustomerInfo]);

  useEffect(() => {
    // Skip on web platform
    if (Platform.OS === 'web') return;

    // Handle cold start - app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleRedemptionUrl(url);
      }
    });

    // Handle warm start - app receives deep link while running
    const subscription = Linking.addEventListener('url', (event) => {
      handleRedemptionUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleRedemptionUrl]);

  // This component doesn't render anything
  return null;
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useThemeContext();
  const { isSlowConnection, isConnected } = useNetworkState();

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
        {/* Show slow connection feedback */}
        {(isSlowConnection || !isConnected) && (
          <Text style={[styles.slowConnectionText, { color: theme.colors.onSurfaceVariant }]}>
            {!isConnected
              ? 'No internet connection. Checking for cached session...'
              : 'Connecting... This may take a moment.'}
          </Text>
        )}
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

// #region agent log
const debugLog = (location: string, message: string, data: any = {}, hypothesisId: string = 'H3') => {
  fetch('http://127.0.0.1:7243/ingest/d951aa23-37db-46ab-80d8-615d2da9aa8b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location,message,data:{...data,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',hypothesisId})}).catch(()=>{});
};
// #endregion

function RootLayoutContent() {
  const { theme } = useThemeContext();
  const [showSplash, setShowSplash] = useState(true);

  // Use the unified app ready hook instead of arbitrary timer
  // This ensures splash hides when auth and RevenueCat are actually ready
  const { isReady: appIsReady, isSlowLoad } = useAppReady();

  // Hide Android navigation bar
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }
  }, []);

  // Log when app becomes ready
  useEffect(() => {
    if (appIsReady) {
      console.log('🚀 App: Ready to hide splash');
      // #region agent log
      debugLog('_layout.tsx:appIsReady', 'App is ready, should hide splash', { showSplash });
      // #endregion
    }
  }, [appIsReady, showSplash]);

  // #region agent log
  useEffect(() => {
    debugLog('_layout.tsx:showSplashChange', 'showSplash state changed', { showSplash, appIsReady });
  }, [showSplash, appIsReady]);
  // #endregion

  const handleSplashComplete = useCallback(() => {
    // #region agent log
    debugLog('_layout.tsx:handleSplashComplete', 'Setting showSplash to false', { appIsReady });
    // #endregion
    setShowSplash(false);
  }, [appIsReady]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <SettingsProvider>
          <WagerBotSuggestionProvider>
            <AdminModeProvider>
              <EditorPickSheetProvider>
                <NFLGameSheetProvider>
                  <CFBGameSheetProvider>
                    <NBAGameSheetProvider>
                      <NCAABGameSheetProvider>
                        <NBABettingTrendsSheetProvider>
                          <WagerBotChatSheetProvider>
                            <RootNavigator />
                            <WebPurchaseRedemptionHandler />
                            <EditorPickCreatorBottomSheet />
                            <NBABettingTrendsBottomSheet />
                          </WagerBotChatSheetProvider>
                        </NBABettingTrendsSheetProvider>
                      </NCAABGameSheetProvider>
                    </NBAGameSheetProvider>
                  </CFBGameSheetProvider>
                </NFLGameSheetProvider>
              </EditorPickSheetProvider>
            </AdminModeProvider>
          </WagerBotSuggestionProvider>
        </SettingsProvider>
      </PaperProvider>
      {showSplash && (
        <AnimatedSplash
          isReady={appIsReady}
          onAnimationComplete={handleSplashComplete}
        />
      )}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AnalyticsProvider>
            <RevenueCatProvider>
              <RootLayoutContent />
            </RevenueCatProvider>
          </AnalyticsProvider>
        </AuthProvider>
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
  slowConnectionText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    opacity: 0.7,
  },
});
