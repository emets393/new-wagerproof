import { Stack } from 'expo-router';

// Per-tab Stack for the Games tab. Without this wrapper the screen mounts
// directly inside `NativeTabs` and there's nowhere for iOS to attach the
// system UINavigationBar. Mirrors Honeydew's `NavigationStack` wrapping each
// tab in MainTabView so every screen can opt into native chrome (large title
// shrink-on-scroll, Liquid Glass toolbar items, native UISearchController,
// auto back-chevron handling for pushed children).
//
// Screen-level options (title text, header buttons, search bar config) live
// on each child screen via `<Stack.Screen options={...} />` so they can pull
// from local state. The defaults here apply to everything pushed onto this
// stack from the Games tab.
export default function GamesStackLayout() {
  return (
    <Stack
      screenOptions={{
        // Solid dark chrome — `headerTransparent: false` makes iOS reserve
        // the header space in the screen layout so content (and our
        // segmented sport switcher) doesn't bleed under the title. The
        // dark backgroundColor forces a dark appearance regardless of the
        // system's light/dark setting; pairing with the dark blur effect
        // gives the system-material look once the user scrolls.
        headerTransparent: false,
        headerBlurEffect: 'systemUltraThinMaterialDark',
        headerStyle: { backgroundColor: '#000000' },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerTintColor: '#ffffff',
        headerTitleStyle: { color: '#ffffff' },
        headerLargeTitleStyle: { color: '#ffffff' },
        // iOS 26 wraps toolbar items in Liquid Glass capsules automatically.
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: '#000000' },
      }}
    />
  );
}
