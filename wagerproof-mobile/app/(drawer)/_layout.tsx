import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { useTopAgentsWidgetSync } from '@/hooks/useTopAgentsWidgetSync';
import { LearnWagerProofProvider } from '@/contexts/LearnWagerProofContext';
import { LearnWagerProofBottomSheet } from '@/components/learn-wagerproof/LearnWagerProofBottomSheet';

export default function DrawerLayout() {
  const router = useRouter();
  useTopAgentsWidgetSync();

  // Handle deep links from iOS widget
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log('Widget deep link received:', url);

      // Handle wagerproof:// scheme from widget
      if (url.startsWith('wagerproof://')) {
        const path = url.replace('wagerproof://', '');

        switch (path) {
          case 'picks':
            router.push('/(drawer)/(tabs)/picks');
            break;
          case 'agents':
            router.push('/(drawer)/(tabs)/agents');
            break;
          case 'outliers':
            router.push('/(drawer)/(tabs)/outliers');
            break;
          case 'feed':
            router.push('/(drawer)/(tabs)');
            break;
          default:
            // Default to feed if unknown path
            router.push('/(drawer)/(tabs)');
        }
      }
    };

    // Check for initial URL (app opened via widget)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LearnWagerProofProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            // SDK 54+ react-native-screens defaults — every push-screen below
            // overrides these per-screen. Setting them here keeps the global
            // shell consistent and means individual `<Stack.Screen options>`
            // calls in each screen file own the title / right buttons.
            headerLargeTitle: false,
            headerBlurEffect: 'systemMaterial',
            headerTransparent: false,
            headerShadowVisible: false,
            headerBackTitle: 'Back',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings"
            options={{
              // Native iOS large-title nav bar — mirrors Honeydew SettingsView's
              // `.navigationTitle("Settings") + .navigationBarTitleDisplayMode(.large)`.
              // The title sits big below the chrome on initial paint and
              // shrinks into the inline slot as the user scrolls.
              //
              // DO NOT set `headerStyle.backgroundColor` or
              // `headerLargeStyle.backgroundColor` — that overrides the
              // system blur backdrop. Leaving them unset lets iOS apply the
              // automatic transparent-at-top → blurred-on-scroll transition.
              headerShown: true,
              headerLargeTitle: true,
              headerTitle: 'Settings',
              headerTintColor: '#ffffff',
              headerLargeTitleStyle: { color: '#ffffff' },
              headerTitleStyle: { color: '#ffffff' },
              headerBlurEffect: 'systemMaterialDark',
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 220,
            }}
          />
          <Stack.Screen
            name="wagerbot-voice"
            options={{
              // Voice screen owns its full-bleed UI — no native header.
              headerShown: false,
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 220,
            }}
          />
          <Stack.Screen
            name="wagerbot-chat"
            options={{
              // Chat uses the iOS-native inline title pattern (see Honeydew's
              // ChatV3View). `headerTransparent: true` + a dark blur effect
              // lets messages scroll under the chrome with a system blur,
              // matching the iMessage / Honeydew chat feel.
              headerShown: true,
              headerTitle: 'WagerBot',
              headerTransparent: true,
              headerBlurEffect: 'systemUltraThinMaterialDark',
              headerTintColor: '#ffffff',
              headerTitleStyle: { color: '#ffffff' },
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 220,
            }}
          />
        </Stack>
        <LearnWagerProofBottomSheet />
      </LearnWagerProofProvider>
    </GestureHandlerRootView>
  );
}
