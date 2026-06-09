import { Stack } from 'expo-router';

// Per-tab Stack for Scoreboard. Same dark-chrome contract as the other
// tabs so the system handles large-title shrink + Liquid Glass toolbar
// items uniformly.
export default function ScoreboardStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: false,
        headerBlurEffect: 'systemUltraThinMaterialDark',
        headerStyle: { backgroundColor: '#000000' },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerTintColor: '#ffffff',
        headerTitleStyle: { color: '#ffffff' },
        headerLargeTitleStyle: { color: '#ffffff' },
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: '#000000' },
      }}
    />
  );
}
