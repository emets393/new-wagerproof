import { Stack } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';

export default function ModalsLayout() {
  const { theme } = useThemeContext();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="discord" />
      <Stack.Screen name="ios-widget" />
      <Stack.Screen name="secret-settings" />
    </Stack>
  );
}
