import { Tabs, usePathname, useRouter } from 'expo-router';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { ScrollProvider, useScroll } from '@/contexts/ScrollContext';
import { Animated, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '@/contexts/ThemeContext';

function FloatingTabBar() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { scrollYClamped } = useScroll();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tabs = [
    { name: 'index', path: '/', title: 'Feed', icon: 'view-dashboard' },
    { name: 'chat', path: '/chat', title: 'Chat', icon: 'message-text' },
    { name: 'picks', path: '/picks', title: 'Picks', icon: 'star' },
    { name: 'settings', path: '/settings', title: 'Settings', icon: 'cog' },
  ];

  // Calculate collapsible height (must match the feed screen)
  const HEADER_HEIGHT = insets.top + 36 + 16; // Safe area + title padding
  const PILLS_HEIGHT = 72;
  const TOTAL_COLLAPSIBLE_HEIGHT = HEADER_HEIGHT + PILLS_HEIGHT;
  const TAB_BAR_BASE_HEIGHT = 65;
  const TAB_BAR_HEIGHT = TAB_BAR_BASE_HEIGHT + insets.bottom;

  // Tab bar translates down as user scrolls up
  const tabBarTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [0, TAB_BAR_HEIGHT + 20], // Extra pixels to ensure it's fully hidden
    extrapolate: 'clamp',
  });

  // Tab bar opacity fades out progressively
  const tabBarOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Hide tab bar completely when on chat screen
  const isChatScreen = pathname === '/chat' || pathname.startsWith('/chat');

  if (isChatScreen) {
    return null; // Don't render tab bar on chat screen
  }

  return (
    <Animated.View
      style={[
        styles.floatingTabBar,
        {
          transform: [{ translateY: tabBarTranslate }],
          opacity: tabBarOpacity,
          backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
          borderTopColor: theme.colors.outlineVariant,
          height: TAB_BAR_HEIGHT,
          paddingBottom: insets.bottom,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.5 : 0.15,
          shadowRadius: 12,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.path || pathname.startsWith(`/${tab.name}`);
        const color = isActive ? theme.colors.primary : theme.colors.onSurfaceVariant;

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabButton}
            onPress={() => router.push(tab.path as any)}
          >
            <MaterialCommunityIcons name={tab.icon as any} size={24} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{tab.title}</Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    elevation: 12,
    zIndex: 1000,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
});

function TabsContent() {
  const theme = useTheme();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarStyle: {
            display: 'none', // Hide the default tab bar
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="message-text" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="picks"
        options={{
          title: 'Picks',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="star" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    <FloatingTabBar />
    </>
  );
}

export default function TabsLayout() {
  return (
    <ScrollProvider>
      <TabsContent />
    </ScrollProvider>
  );
}

