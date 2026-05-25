import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { NoGamesTerminal } from '@/components/NoGamesTerminal';
import { PropMatchupCard } from '@/components/mlb/player-props/PropMatchupCard';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useProAccess } from '@/hooks/useProAccess';
import { useMLBPitcherMatchups } from '@/hooks/useMLBPitcherMatchups';
import { fetchMLBPlayerPropsL10 } from '@/hooks/useMLBPlayerPropsL10';
import {
  formatPropLine,
  marketLabel,
  topPropPlaysAcrossGames,
} from '@/utils/mlbPlayerProps';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';

const BRAND = '#22c55e';

export default function MLBPitcherMatchupsScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPro, isLoading: proLoading } = useProAccess();
  const { refreshCustomerInfo } = useRevenueCat();

  const { data: summaries = [], isLoading, isError, refetch, isRefetching } = useMLBPitcherMatchups();

  const [propsByGame, setPropsByGame] = useState<Map<number, MlbPlayerPropRow[]>>(new Map());
  const [propsLoading, setPropsLoading] = useState(false);

  const loadAllProps = useCallback(async () => {
    if (!summaries.length) {
      setPropsByGame(new Map());
      return;
    }
    setPropsLoading(true);
    try {
      const results = await Promise.all(
        summaries.map(async s => ({
          pk: s.game.game_pk,
          props: await fetchMLBPlayerPropsL10(s.game.game_pk),
        })),
      );
      const map = new Map<number, MlbPlayerPropRow[]>();
      for (const r of results) map.set(r.pk, r.props);
      setPropsByGame(map);
    } finally {
      setPropsLoading(false);
    }
  }, [summaries]);

  useEffect(() => {
    if (isPro && summaries.length) loadAllProps();
  }, [isPro, summaries, loadAllProps]);

  useEffect(() => {
    if (proLoading || isPro) return;
    (async () => {
      const result = await presentPaywallForPlacementIfNeeded(
        ENTITLEMENT_IDENTIFIER,
        PAYWALL_PLACEMENTS.GENERIC_FEATURE,
      );
      if (didPaywallGrantEntitlement(result)) {
        await refreshCustomerInfo();
      }
    })();
  }, [proLoading, isPro, refreshCustomerInfo]);

  const topPlays = useMemo(() => {
    const entries = summaries.map(s => ({
      gamePk: s.game.game_pk,
      props: propsByGame.get(s.game.game_pk) ?? [],
    }));
    return topPropPlaysAcrossGames(entries, 8);
  }, [summaries, propsByGame]);

  const gameByPk = useMemo(
    () => new Map(summaries.map(s => [s.game.game_pk, s.game])),
    [summaries],
  );

  const onRefresh = useCallback(async () => {
    await refetch();
    if (isPro) await loadAllProps();
  }, [refetch, loadAllProps, isPro]);

  const bg = isDark ? theme.colors.background : '#f8fafc';

  if (!isPro && !proLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: bg }]}>
        <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: theme.colors.onSurface }]}>Player Prop Matchups</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={BRAND} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <AndroidBlurView
        style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: theme.colors.outlineVariant }]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.navText}>
          <Text style={[styles.navTitle, { color: theme.colors.onSurface }]}>Player Prop Matchups</Text>
          <Text style={[styles.navSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Lines · L10 hit rates · contextual splits
          </Text>
        </View>
      </AndroidBlurView>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || propsLoading}
            onRefresh={onRefresh}
            tintColor={BRAND}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={BRAND} size="large" />
            <Text style={{ color: theme.colors.onSurfaceVariant }}>Loading matchups…</Text>
          </View>
        ) : isError ? (
          <NoGamesTerminal context="feed_mlb" />
        ) : summaries.length === 0 ? (
          <NoGamesTerminal context="feed_mlb" />
        ) : (
          <>
            {topPlays.length > 0 ? (
              <View
                style={[
                  styles.topRail,
                  {
                    backgroundColor: isDark ? '#1a2e1f' : '#ecfdf5',
                    borderColor: isDark ? '#22543d' : '#bbf7d0',
                  },
                ]}
              >
                <Text style={[styles.topRailTitle, { color: theme.colors.onSurface }]}>
                  🔥 Top Prop Plays
                </Text>
                {topPlays.map(play => {
                  const g = gameByPk.get(play.gamePk);
                  return (
                    <Text
                      key={`${play.gamePk}-${play.playerId}-${play.market}`}
                      style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, marginBottom: 4 }}
                    >
                      <Text style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                        {play.playerName}
                      </Text>
                      {' · '}
                      {marketLabel(play.market)} O {formatPropLine(play.line)} ·{' '}
                      <Text style={{ color: BRAND, fontWeight: '700' }}>
                        {play.l10Over}/{play.l10Games}
                      </Text>{' '}
                      L10
                      {g ? ` · ${g.away_abbr} @ ${g.home_abbr}` : ''}
                    </Text>
                  );
                })}
              </View>
            ) : null}

            {summaries.map(summary => (
              <PropMatchupCard key={summary.game.game_pk} summary={summary} isDark={isDark} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, justifyContent: 'center' },
  navText: { flex: 1 },
  navTitle: { fontSize: 17, fontWeight: '800' },
  navSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  scroll: { padding: 16, paddingTop: 12 },
  loadingWrap: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  topRail: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  topRailTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
});
