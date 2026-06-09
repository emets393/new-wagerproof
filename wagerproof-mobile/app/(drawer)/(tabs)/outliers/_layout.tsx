import { Stack } from 'expo-router';

// Per-tab Stack for Outliers (Alerts). Identical chrome contract to the
// Games tab so the system handles large-title shrink, Liquid Glass toolbar
// items, and back-chevron handling on any push from here.
export default function OutliersStackLayout() {
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
