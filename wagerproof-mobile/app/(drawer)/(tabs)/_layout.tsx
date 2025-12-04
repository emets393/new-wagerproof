import { Tabs, usePathname, useRouter, useSegments } from 'expo-router';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { ScrollProvider, useScroll } from '@/contexts/ScrollContext';
import { Animated, TouchableOpacity, Text, StyleSheet, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '@/contexts/ThemeContext';
import { LiveScoreTicker } from '@/components/LiveScoreTicker';
import { useLiveScores } from '@/hooks/useLiveScores';
import { BlurView } from 'expo-blur';

function FloatingTabBar() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { scrollYClamped } = useScroll();
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasLiveGames } = useLiveScores();
  
  const tabs = [
    { name: 'index', path: '/(drawer)/(tabs)/', title: 'Feed', icon: 'home' },
    { name: 'picks', path: '/(drawer)/(tabs)/picks', title: 'Picks', icon: 'star' },
  ];

  // Calculate collapsible height (must match the feed screen)
  const HEADER_HEIGHT = insets.top + 36 + 16; // Safe area + title padding
  const PILLS_HEIGHT = 72;
  const TOTAL_COLLAPSIBLE_HEIGHT = HEADER_HEIGHT + PILLS_HEIGHT;
  const LIVE_TICKER_HEIGHT = hasLiveGames ? 64 : 0; // 40px ticker + 12px top + 12px bottom padding
  const TAB_BAR_BASE_HEIGHT = 65;
  const TAB_BAR_HEIGHT = TAB_BAR_BASE_HEIGHT + insets.bottom + LIVE_TICKER_HEIGHT;

  // Simple scroll-based animations for feed screen only
  const tabBarTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [0, TAB_BAR_HEIGHT + 20],
    extrapolate: 'clamp',
  });

  const tabBarOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.floatingTabBar,
        {
          transform: [{ translateY: tabBarTranslate }],
          opacity: tabBarOpacity,
          height: TAB_BAR_HEIGHT,
        },
      ]}
    >
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blurContainer,
          {
            borderTopColor: theme.colors.outlineVariant,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* Live Ticker at top of tab bar */}
        {hasLiveGames && (
          <View style={styles.liveTickerContainer}>
            <LiveScoreTicker onNavigateToScoreboard={() => router.push('/(modals)/scoreboard')} />
          </View>
        )}
        
        {/* Tab buttons */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => {
            // Normalize both pathname and tab path by removing trailing slashes
            const normalizedPathname = pathname.replace(/\/$/, '');
            const normalizedTabPath = tab.path.replace(/\/$/, '');
            
            // Determine if this tab is active using both pathname and segments for reliability
            let isActive = false;
            if (tab.name === 'index') {
              // For Feed tab: check if we're on the root tabs route
              // Using segments: should be ['(drawer)', '(tabs)'] or ['(drawer)', '(tabs)', 'index']
              // Using pathname: should match /(drawer)/(tabs) (with or without trailing slash)
              const isRootTabsRoute = normalizedPathname === normalizedTabPath 
                || normalizedPathname === '/(drawer)/(tabs)';
              const segmentsMatch = (segments.length === 2 
                && segments[0] === '(drawer)' 
                && segments[1] === '(tabs)')
                || (segments.length === 3 
                  && segments[0] === '(drawer)' 
                  && segments[1] === '(tabs)' 
                  && segments[2] === 'index');
              const isNotOtherTab = !normalizedPathname.includes('/picks')
                && !normalizedPathname.includes('/chat')
                && !normalizedPathname.includes('/feature-requests')
                && !normalizedPathname.includes('/settings');
              isActive = (isRootTabsRoute || segmentsMatch) && isNotOtherTab;
            } else {
              // For other tabs: check if pathname matches or segments include the tab name
              const pathnameMatches = normalizedPathname === normalizedTabPath 
                || normalizedPathname.includes(`/${tab.name}`);
              const segmentsMatch = segments.includes(tab.name);
              isActive = pathnameMatches || segmentsMatch;
            }
            
            // Force green color for active tabs
            const color = isActive ? '#00E676' : theme.colors.onSurfaceVariant;

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
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 12,
    zIndex: 1000,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    flexDirection: 'column',
    borderTopWidth: 1,
    width: '100%',
    height: '100%',
  },
  liveTickerContainer: {
    width: '100%',
    height: 64,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 65,
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
            <MaterialCommunityIcons name="home" size={size} color={color} />
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
          href: null, // Chat is now accessed via bottom sheet from header
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
        name="feature-requests"
        options={{
          title: 'Features',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="lightbulb-on" size={size} color={color} />
          ),
          href: null, // Hide from tab bar
        }}
      />
      {/* Settings removed from tabs as it's now in drawer */}
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
