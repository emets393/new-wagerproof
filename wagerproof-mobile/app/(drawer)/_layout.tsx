import { Slot, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'react-native-drawer-layout';
import { useState, createContext, useContext, useEffect } from 'react';
import { useTheme } from 'react-native-paper';
import { Linking, Platform } from 'react-native';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useTopAgentsWidgetSync } from '@/hooks/useTopAgentsWidgetSync';
import SideMenu from '@/components/SideMenu';
import { LearnWagerProofProvider } from '@/contexts/LearnWagerProofContext';
import { LearnWagerProofBottomSheet } from '@/components/learn-wagerproof/LearnWagerProofBottomSheet';

const DrawerContext = createContext<{ open: () => void; close: () => void } | null>(null);

export const useDrawer = () => {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within DrawerLayout');
  }
  return context;
};

export default function DrawerLayout() {
  const theme = useTheme();
  const router = useRouter();
  const { isDark } = useThemeContext();
  const { isDetached, dismissFloating } = useWagerBotSuggestion();
  const [open, setOpen] = useState(false);
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
            router.push('/(drawer)/(tabs)/feed');
            break;
          default:
            // Default to feed if unknown path
            router.push('/(drawer)/(tabs)/feed');
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

  const handleOpen = () => {
    console.log('Opening drawer');
    // Dismiss floating assistant bubble when drawer opens
    if (isDetached) {
      dismissFloating();
    }
    setOpen(true);
  };
  
  const handleClose = () => {
    console.log('Closing drawer');
    setOpen(false);
  };
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LearnWagerProofProvider>
        <DrawerContext.Provider value={{ open: handleOpen, close: handleClose }}>
          <Drawer
            open={open}
            onOpen={() => {
              // Sync state when drawer opens via swipe
              if (!open) {
                // Dismiss floating assistant bubble when drawer opens via swipe
                if (isDetached) {
                  dismissFloating();
                }
                setOpen(true);
              }
            }}
            onClose={() => {
              // Sync state when drawer closes
              setOpen(false);
            }}
            drawerType="front"
            renderDrawerContent={() => (
              <AndroidBlurView
                intensity={80}
                tint={isDark ? 'dark' : 'light'}
                style={{ flex: 1, width: '100%' }}
              >
                <SideMenu onClose={handleClose} />
              </AndroidBlurView>
            )}
            drawerStyle={{
              backgroundColor: 'transparent',
              width: '80%',
            }}
            swipeEnabled={true}
            swipeEdgeWidth={50}
          >
            <Slot />
          </Drawer>
          <LearnWagerProofBottomSheet />
        </DrawerContext.Provider>
      </LearnWagerProofProvider>
    </GestureHandlerRootView>
  );
}
