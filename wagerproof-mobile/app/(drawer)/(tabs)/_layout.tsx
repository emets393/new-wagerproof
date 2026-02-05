import { Tabs, usePathname, useRouter, useSegments } from 'expo-router';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect, useRef, useCallback } from 'react';
import { ScrollProvider, useScroll } from '@/contexts/ScrollContext';
import { Animated, TouchableOpacity, Text, StyleSheet, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { WagerBotSuggestionBubble } from '@/components/WagerBotSuggestionBubble';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { useNBAGameSheet } from '@/contexts/NBAGameSheetContext';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';
import { useLiveScores } from '@/hooks/useLiveScores';
import { PickDetailSheetProvider } from '@/contexts/PickDetailSheetContext';
import { PickDetailBottomSheet } from '@/components/PickDetailBottomSheet';

function LiveIndicator() {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const animatedOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const animatedScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  return (
    <View style={styles.liveIndicatorContainer}>
      <Animated.View
        style={[
          styles.liveIndicatorPulse,
          {
            opacity: animatedOpacity,
            transform: [{ scale: animatedScale }],
          },
        ]}
      />
      <View style={styles.liveIndicatorDot} />
    </View>
  );
}

function FloatingTabBar() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { scrollYClamped } = useScroll();
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasLiveGames } = useLiveScores();
  
  // Hide tab bar on chat screen and agent sub-screens (create, detail, settings)
  const isOnChatScreen = pathname.includes('/chat') || segments.includes('chat');
  const isOnAgentSubScreen = pathname.includes('/agents/create')
    || pathname.includes('/agents/public')
    || (pathname.includes('/agents/') && pathname !== '/(drawer)/(tabs)/agents' && pathname !== '/(drawer)/(tabs)/agents/');
  if (isOnChatScreen || isOnAgentSubScreen) {
    return null;
  }
  
  const tabs = [
    { name: 'index', path: '/(drawer)/(tabs)/', title: 'Games', icon: 'trophy' },
    { name: 'agents', path: '/(drawer)/(tabs)/agents', title: 'Agents', icon: 'brain' },
    { name: 'outliers', path: '/(drawer)/(tabs)/outliers', title: 'Outliers', icon: 'chart-line' },
    { name: 'scoreboard', path: '/(drawer)/(tabs)/scoreboard', title: 'Scores', icon: 'scoreboard' },
  ];

  // Calculate collapsible height (must match the feed screen)
  const HEADER_HEIGHT = insets.top + 36 + 16; // Safe area + title padding
  const PILLS_HEIGHT = 72;
  const TOTAL_COLLAPSIBLE_HEIGHT = HEADER_HEIGHT + PILLS_HEIGHT;
  const TAB_BAR_BASE_HEIGHT = 65;
  const TAB_BAR_HEIGHT = TAB_BAR_BASE_HEIGHT + insets.bottom;

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
      <AndroidBlurView
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
                && !normalizedPathname.includes('/settings')
                && !normalizedPathname.includes('/outliers')
                && !normalizedPathname.includes('/scoreboard')
                && !normalizedPathname.includes('/agents')
                && !normalizedPathname.includes('/learn');
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
                <View style={styles.tabIconContainer}>
                  <MaterialCommunityIcons name={tab.icon as any} size={24} color={color} />
                  {tab.name === 'scoreboard' && hasLiveGames && <LiveIndicator />}
                </View>
                <Text style={[styles.tabLabel, { color }]}>{tab.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </AndroidBlurView>
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
  tabIconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  liveIndicatorContainer: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 10,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveIndicatorPulse: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00E676',
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
});

function TabsContent() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Game sheet contexts for opening game details
  const { openGameSheet: openNFLGameSheet } = useNFLGameSheet();
  const { openGameSheet: openCFBGameSheet } = useCFBGameSheet();
  const { openGameSheet: openNBAGameSheet } = useNBAGameSheet();
  const { openGameSheet: openNCAABGameSheet } = useNCAABGameSheet();

  // WagerBot suggestion bubble state
  const {
    isVisible: suggestionVisible,
    bubbleMode,
    currentSuggestion,
    currentGameId,
    currentSport: suggestionSport,
    isDetached,
    dismissSuggestion,
    scanCurrentPage,
    openChat,
    detachBubble,
    findGameById,
  } = useWagerBotSuggestion();

  // Handle suggestion tap - open game details sheet
  const handleSuggestionTap = useCallback((gameId: string, sport: string) => {
    console.log('🤖 Suggestion tapped, opening game:', gameId, sport);

    // Find the game from WagerBot's stored game data
    const game = findGameById(gameId);

    if (!game) {
      console.log('🤖 Game not found:', gameId);
      return;
    }

    // Open the appropriate game sheet based on sport
    switch (sport) {
      case 'nfl':
        openNFLGameSheet(game as any);
        break;
      case 'cfb':
        openCFBGameSheet(game as any);
        break;
      case 'nba':
        openNBAGameSheet(game as any);
        break;
      case 'ncaab':
        openNCAABGameSheet(game as any);
        break;
      default:
        console.log('🤖 Unknown sport:', sport);
    }
  }, [findGameById, openNFLGameSheet, openCFBGameSheet, openNBAGameSheet, openNCAABGameSheet]);

  // Determine current sport based on pathname (for bubble display)
  const getCurrentSport = () => {
    if (pathname.includes('/nfl')) return 'nfl';
    if (pathname.includes('/cfb')) return 'cfb';
    if (pathname.includes('/nba')) return 'nba';
    if (pathname.includes('/ncaab')) return 'ncaab';
    return 'nfl'; // default
  };

  // Check if on scoreboard page to hide scan feature
  const isOnScoreboard = pathname.includes('/scoreboard');

  return (
    <>
      {/* WagerBot Suggestion Bubble - Available on all tab pages */}
      {/* Hide attached bubble when in detached/floating mode */}
      {!isDetached && (
        <WagerBotSuggestionBubble
          visible={suggestionVisible}
          mode={bubbleMode}
          suggestion={currentSuggestion}
          gameId={currentGameId}
          sport={suggestionSport || getCurrentSport()}
          onDismiss={dismissSuggestion}
          onTap={handleSuggestionTap}
          onScanPage={scanCurrentPage}
          onOpenChat={() => {
            openChat();
            router.push('/chat' as any);
          }}
          onDetach={(x, y) => detachBubble(x, y)}
          hideScanPage={isOnScoreboard}
        />
      )}
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
          title: 'Games',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="trophy" size={size} color={color} />
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
          href: null, // Moved to drawer, Agents tab replaces it
        }}
      />
      <Tabs.Screen
        name="outliers"
        options={{
          title: 'Outliers',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-line" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scoreboard"
        options={{
          title: 'Scores',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="scoreboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: 'Agents',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="brain" size={size} color={color} />
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
          href: null, // Chat is now accessed via navigation from header
          presentation: 'modal', // Present as modal for bottom-to-top animation
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
      <PickDetailSheetProvider>
        <TabsContent />
        {/* Wrap in View with higher zIndex to appear above FloatingTabBar (zIndex: 1000) */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, pointerEvents: 'box-none' }}>
          <PickDetailBottomSheet />
        </View>
      </PickDetailSheetProvider>
    </ScrollProvider>
  );
}
