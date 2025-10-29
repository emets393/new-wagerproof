import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useThemeContext } from '../contexts/ThemeContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { NFLGameSheetProvider } from '../contexts/NFLGameSheetContext';
import { CFBGameSheetProvider } from '../contexts/CFBGameSheetContext';
import { OnboardingGuard } from '../components/OnboardingGuard';
import { NFLGameBottomSheet } from '../components/NFLGameBottomSheet';
import { CFBGameBottomSheet } from '../components/CFBGameBottomSheet';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

// Create a query client
const queryClient = new QueryClient();

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
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
      </>
    </OnboardingGuard>
  );
}

function RootLayoutContent() {
  const { theme } = useThemeContext();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <SettingsProvider>
          <AuthProvider>
            <NFLGameSheetProvider>
              <CFBGameSheetProvider>
                <RootNavigator />
              </CFBGameSheetProvider>
            </NFLGameSheetProvider>
          </AuthProvider>
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
