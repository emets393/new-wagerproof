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
import { WagerBotChatBottomSheet } from '../components/WagerBotChatBottomSheet';
import { EditorPickCreatorBottomSheet } from '../components/EditorPickCreatorBottomSheet';
import { FloatingAssistantBubble } from '../components/FloatingAssistantBubble';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { useOnGameSheetOpen, useGameSheetDetection } from '../hooks/useGameSheetDetection';
import { useEffect, useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Linking, Alert } from 'react-native';
import Purchases, { WebPurchaseRedemptionResultType } from 'react-native-purchases';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync();

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
  const [showSplash, setShowSplash] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);

  // Hide Android navigation bar
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }
  }, []);

  // Mark app as ready after a short delay to allow initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppIsReady(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <SettingsProvider>
          <WagerBotSuggestionProvider>
            <AuthProvider>
              <RevenueCatProvider>
                <AdminModeProvider>
                  <EditorPickSheetProvider>
                    <NFLGameSheetProvider>
                      <CFBGameSheetProvider>
                        <NBAGameSheetProvider>
                          <NCAABGameSheetProvider>
                            <WagerBotChatSheetProvider>
                              <RootNavigator />
                              <WebPurchaseRedemptionHandler />
                              <EditorPickCreatorBottomSheet />
                            </WagerBotChatSheetProvider>
                          </NCAABGameSheetProvider>
                        </NBAGameSheetProvider>
                      </CFBGameSheetProvider>
                    </NFLGameSheetProvider>
                  </EditorPickSheetProvider>
                </AdminModeProvider>
              </RevenueCatProvider>
            </AuthProvider>
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
