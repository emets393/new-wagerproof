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
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings"
            options={{
              headerShown: false,
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
