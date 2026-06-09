import React, { useCallback } from 'react';
import { NativeTabs, Icon, Label, Badge, VectorIcon } from 'expo-router/unstable-native-tabs';
import { useRouter, usePathname } from 'expo-router';
import { Platform, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScrollProvider } from '@/contexts/ScrollContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { useNBAGameSheet } from '@/contexts/NBAGameSheetContext';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';
import { useMLBGameSheet } from '@/contexts/MLBGameSheetContext';
import { useLiveScores } from '@/hooks/useLiveScores';
import { WagerBotSuggestionBubble } from '@/components/WagerBotSuggestionBubble';
import { PickDetailSheetProvider } from '@/contexts/PickDetailSheetContext';
import { PickDetailBottomSheet } from '@/components/PickDetailBottomSheet';

// Native UITabBar via expo-router's `unstable-native-tabs`. Replaces the
// hand-rolled FloatingTabBar (BlurView + Animated + custom active-state
// matching) with the platform-native bottom bar so we get:
//   - System Liquid Glass / translucency for free on iOS 26
//   - SF Symbols with `selected` variant (filled-on-active for free)
//   - Native badge rendering for the "live games" dot on Scores
//   - Proper accessibility traits + reduce-motion handling
//
// In SDK 54 the API uses standalone `Icon`, `Label`, `Badge` children
// (not dotted on `Trigger`). The dotted shape `NativeTabs.Trigger.Icon`
// lands in SDK 56 — easy migration when we upgrade.

function TabsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasLiveGames } = useLiveScores();

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

  const { openGameSheet: openNFLGameSheet } = useNFLGameSheet();
  const { openGameSheet: openCFBGameSheet } = useCFBGameSheet();
  const { openGameSheet: openNBAGameSheet } = useNBAGameSheet();
  const { openGameSheet: openNCAABGameSheet } = useNCAABGameSheet();
  const { openGameSheet: openMLBGameSheet } = useMLBGameSheet();

  const handleSuggestionTap = useCallback((gameId: string, sport: string) => {
    const game = findGameById(gameId);
    if (!game) return;
    switch (sport) {
      case 'nfl': openNFLGameSheet(game as any); break;
      case 'cfb': openCFBGameSheet(game as any); break;
      case 'nba': openNBAGameSheet(game as any); break;
      case 'ncaab': openNCAABGameSheet(game as any); break;
      case 'mlb': openMLBGameSheet(game as any); break;
    }
  }, [findGameById, openNFLGameSheet, openCFBGameSheet, openNBAGameSheet, openNCAABGameSheet, openMLBGameSheet]);

  const getCurrentSport = (): 'nfl' | 'cfb' | 'nba' | 'ncaab' => {
    if (pathname.includes('/cfb')) return 'cfb';
    if (pathname.includes('/nba')) return 'nba';
    if (pathname.includes('/ncaab')) return 'ncaab';
    return 'nfl';
  };

  const isOnScoreboard = pathname.includes('/scoreboard');

  return (
    <>
      {!isDetached && (
        <WagerBotSuggestionBubble
          visible={suggestionVisible}
          mode={bubbleMode}
          suggestion={currentSuggestion}
          gameId={currentGameId}
          sport={(suggestionSport as any) || getCurrentSport()}
          onDismiss={dismissSuggestion}
          onTap={handleSuggestionTap}
          onScanPage={scanCurrentPage}
          onOpenChat={() => {
            openChat();
            router.push('/wagerbot-chat' as any);
          }}
          onDetach={(x, y) => detachBubble(x, y)}
          hideScanPage={isOnScoreboard}
        />
      )}

      <NativeTabs
        tintColor="#00E676"
        // iOS 26: collapse the tab bar into a pill on downward scroll,
        // expand on scroll-up. No-op on iOS <26 / Android.
        minimizeBehavior={Platform.OS === 'ios' ? 'onScrollDown' : undefined}
      >
        <NativeTabs.Trigger name="index">
          <Label>Games</Label>
          <Icon
            sf={{ default: 'trophy', selected: 'trophy.fill' }}
            drawable="emoji_events"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="agents">
          <Label>Agents</Label>
          <Icon
            sf={{ default: 'brain', selected: 'brain.fill' }}
            // Android: route to MaterialCommunityIcons since "brain" isn't a
            // stock drawable resource and Material Symbols don't have a clean
            // match. `androidSrc` is the cross-platform companion to `sf` —
            // unlike `src`, it can coexist with an iOS `sf` declaration.
            androidSrc={<VectorIcon family={MaterialCommunityIcons} name="brain" />}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="outliers">
          <Label>Alerts</Label>
          <Icon
            sf={{ default: 'bell.badge', selected: 'bell.badge.fill' }}
            androidSrc={<VectorIcon family={MaterialCommunityIcons} name="bell-alert-outline" />}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="scoreboard">
          <Label>Scores</Label>
          <Icon
            sf={{ default: 'sportscourt', selected: 'sportscourt.fill' }}
            androidSrc={<VectorIcon family={MaterialCommunityIcons} name="scoreboard" />}
          />
          {/* Native badge surfaces the "live games right now" indicator.
              The SDK 54 Badge requires a string child — we use "•" so the
              badge renders as a compact dot rather than empty space. */}
          {hasLiveGames ? <Badge>•</Badge> : null}
        </NativeTabs.Trigger>

        {/* Hidden routes — expo-router still owns them as tab children so
            navigation works, but `hidden` keeps them out of the bar. */}
        <NativeTabs.Trigger name="picks" hidden />
        <NativeTabs.Trigger name="chat" hidden />
        <NativeTabs.Trigger name="voice-chat" hidden />
        <NativeTabs.Trigger name="roast" hidden />
        <NativeTabs.Trigger name="feature-requests" hidden />
        <NativeTabs.Trigger name="mlb-betting-trends" hidden />
        <NativeTabs.Trigger name="mlb-regression-report" hidden />
        <NativeTabs.Trigger name="nba-betting-trends" hidden />
        <NativeTabs.Trigger name="nba-model-accuracy" hidden />
        <NativeTabs.Trigger name="ncaab-betting-trends" hidden />
        <NativeTabs.Trigger name="ncaab-model-accuracy" hidden />
      </NativeTabs>
    </>
  );
}

export default function TabsLayout() {
  return (
    <ScrollProvider>
      <PickDetailSheetProvider>
        <TabsContent />
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, pointerEvents: 'box-none' }}
        >
          <PickDetailBottomSheet />
        </View>
      </PickDetailSheetProvider>
    </ScrollProvider>
  );
}
