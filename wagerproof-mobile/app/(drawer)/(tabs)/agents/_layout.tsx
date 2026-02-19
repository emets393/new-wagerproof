import { Stack } from 'expo-router';
import { useThemeContext } from '@/contexts/ThemeContext';

export default function AgentsLayout() {
  const { isDark } = useThemeContext();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? '#000000' : '#ffffff' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create"
        options={{
          headerShown: true,
          presentation: 'card',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="public"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
