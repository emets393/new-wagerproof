import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider, useThemeContext } from '../contexts/ThemeContext';

// Create a query client
const queryClient = new QueryClient();

function RootLayoutContent() {
  const { theme } = useThemeContext();

  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="(modals)" 
            options={{ 
              presentation: 'modal',
              headerShown: false 
            }} 
          />
        </Stack>
      </AuthProvider>
    </PaperProvider>
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

