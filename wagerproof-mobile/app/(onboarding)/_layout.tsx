import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}

