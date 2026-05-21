import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  Modal,
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
import Markdown from 'react-native-markdown-display';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { NoGamesTerminal } from '@/components/NoGamesTerminal';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useMLBLeagueBenchmarks } from '@/hooks/useMLBLeagueBenchmarks';
import {
  useMLBPitcherMatchupsReport,
  type MLBPitcherMatchupsReport,
  type PitcherReportHROpportunity,
  type PitcherReportPitchMatchup,
} from '@/hooks/useMLBPitcherMatchupsReport';
import { useProAccess } from '@/hooks/useProAccess';
import { useMLBPitcherMatchups } from '@/hooks/useMLBPitcherMatchups';
import type {
  BatterSplitRow,
  BatterVsArchetypeRow,
  BatterVsPitchTypeRow,
  PitcherArchetypeProfile,
  PitcherArsenalRow,
  PitcherBattedBallRow,
  PitcherMatchupSummary,
  TopPlayEntry,
  TopPlays,
} from '@/types/mlbPitcherMatchups';
import {
  ARCHETYPE_META,
  archetypeDescription,
  isDisplayArchetype,
} from '@/utils/mlbPitcherArchetypes';
import {
  bucketColors,
  getStatBucket,
  resolveBenchmark,
  type LeagueBenchmarks,
} from '@/utils/statShading';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';

const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';

const EMPTY_TOP_PLAYS: TopPlays = {
  hrThreats: [],
  hitLeans: [],
  hottestHitters: [],
  pitcherPlays: [],
  kProps: [],
};

const METRIC_HELP: Record<string, { title: string; body: string }> = {
  xwoba: {
    title: 'xwOBA',
    body: 'Expected weighted on-base average. It estimates offensive quality from strikeouts, walks, and quality of contact. Higher is better.',
  },
  avg: {
    title: 'AVG',
    body: 'Batting average: hits divided by at-bats. Higher is better, but it does not include walks or contact quality.',
  },
  obp: {
    title: 'OBP',
    body: 'On-base percentage. How often the hitter reaches base by hit, walk, or hit-by-pitch. Higher is better.',
  },
  slg: {
    title: 'SLG',
    body: 'Slugging percentage. Total bases per at-bat, so extra-base hits matter more. Higher is better for power.',
  },
  barrel_pct: {
    title: 'Barrel%',
    body: 'Share of batted balls hit with the best exit velocity and launch angle combinations. Higher is better for home-run upside.',
  },
  hard_hit_pct: {
    title: 'Hard-hit%',
    body: 'Share of batted balls hit 95+ mph. Higher means more authoritative contact.',
  },
  k_pct: {
    title: 'K%',
    body: 'Strikeout rate. For batters, lower is better because more balls are being put in play.',
  },
  bb_pct: {
    title: 'BB%',
    body: 'Walk rate. Higher usually means better plate discipline and more on-base chances.',
  },
  iso: {
    title: 'ISO',
    body: 'Isolated power. Slugging minus batting average, used to isolate extra-base power. Higher is better.',
  },
  avg_exit_velo: {
    title: 'Avg EV',
    body: 'Average exit velocity on batted balls. Higher means the hitter is making louder contact.',
  },
  pull_air_pct: {
    title: 'Pull-air%',
    body: 'Share of batted balls pulled in the air. Higher can signal home-run upside, especially with power hitters.',
  },
  hr_per_fb_pct: {
    title: 'HR/FB%',
    body: 'Home runs per fly ball. Higher means more fly balls are leaving the park.',
  },
};

function showMetricHelp(metricKey: string, event?: GestureResponderEvent) {
  event?.stopPropagation?.();
  const help = METRIC_HELP[metricKey];
  if (!help) return;
  Alert.alert(help.title, help.body);
}

function fmtRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  return Number(value).toFixed(3).replace(/^0/, '');
}

function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  return `${Number(value).toFixed(1).replace(/\.0$/, '')}%`;
}

function fmtSlash(batter: BatterSplitRow): string {
  return `${fmtRate(batter.avg)} / ${fmtRate(batter.obp)} / ${fmtRate(batter.slg)}`;
}

function fmtDelta(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  const n = Number(value);
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const diff = Date.now() - then;
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function mlbHeadshotUrl(playerId: number, size = 60): string {
  const id = Math.trunc(playerId);
  const generic = 'd_people:generic:headshot:67:current.png';
  return `https://img.mlbstatic.com/mlb-photos/image/upload/${generic}/w_${size},q_auto:best/v1/people/${id}/headshot/67/current`;
}

function abbrevPitchLabel(pitchType: string | null | undefined, label: string | null | undefined): string {
  const type = (pitchType ?? '').toUpperCase();
  const map: Record<string, string> = {
    FF: '4-Seam FB',
    SI: 'Sinker',
    FC: 'Cutter',
    SL: 'Slider',
    ST: 'Sweeper',
    CU: 'Curve',
    KC: 'Knuckle Curve',
    CH: 'Change',
    FS: 'Splitter',
    SV: 'Slurve',
  };
  const fallback = label ?? pitchType ?? 'Pitch';
  return map[type] ?? fallback.replace(/4-Seam Fastball/gi, '4-Seam FB');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type Trend = 'up' | 'down' | 'flat' | 'na';
type FocusedBatterTarget = { gamePk: number; playerId: number } | null;

function seasonFromDate(date: string | null | undefined): number | null {
  const year = Number((date ?? '').slice(0, 4));
  return Number.isFinite(year) && year > 2000 ? year : null;
}

function computeTrend(
  recent: number | null | undefined,
  season: number | null | undefined,
  higherIsBetter = true,
): Trend {
  if (recent == null || season == null || !Number.isFinite(Number(recent)) || !Number.isFinite(Number(season)) || Number(season) === 0) {
    return 'na';
  }
  const relChange = (Number(recent) - Number(season)) / Math.abs(Number(season));
  if (Math.abs(relChange) < 0.15) return 'flat';
  const isRawUp = relChange > 0;
  return isRawUp === higherIsBetter ? 'up' : 'down';
}

function trendArrow(trend: Trend): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  if (trend === 'flat') return '→';
  return '';
}

function trendColor(trend: Trend, fallback: string): string {
  if (trend === 'up') return GREEN;
  if (trend === 'down') return RED;
  return fallback;
}

function pitcherTags(
  battedBall: PitcherBattedBallRow | null,
  arsenal: PitcherArsenalRow[],
): Array<{ text: string; tone: 'good' | 'bad' | 'neutral' | 'warn' }> {
  const tags: Array<{ text: string; tone: 'good' | 'bad' | 'neutral' | 'warn' }> = [];
  if (battedBall && battedBall.batters_faced < 30) {
    tags.push({ text: `Limited sample (${battedBall.batters_faced} BF)`, tone: 'warn' });
  }

  const overallArsenal = arsenal.filter(p => (p.vs_batter_hand === 'A' || !p.vs_batter_hand) && (p.pitches_thrown ?? 0) >= 25);
  const usableArsenal = overallArsenal.length ? overallArsenal : arsenal.filter(p => (p.pitches_thrown ?? 0) >= 25);
  const wipeout = [...usableArsenal].sort((a, b) => (b.whiff_pct ?? 0) - (a.whiff_pct ?? 0))[0];
  const hittable = usableArsenal.find(p => (p.usage_pct ?? 0) >= 20 && (p.xwoba_allowed ?? 0) >= 0.370);
  const deep = usableArsenal.filter(p => (p.usage_pct ?? 0) >= 10).length >= 4;

  if (wipeout && (wipeout.whiff_pct ?? 0) >= 35) {
    tags.push({ text: `Wipeout ${abbrevPitchLabel(wipeout.pitch_type, wipeout.pitch_type_label)} (${fmtPct(wipeout.whiff_pct)} whiff)`, tone: 'good' });
  }
  if (hittable) {
    tags.push({ text: `Hittable ${abbrevPitchLabel(hittable.pitch_type, hittable.pitch_type_label)} (${fmtRate(hittable.xwoba_allowed)} xwOBA)`, tone: 'bad' });
  }
  if (deep) {
    tags.push({ text: 'Deep arsenal', tone: 'neutral' });
  }
  if ((battedBall?.k_pct ?? 0) >= 27) {
    tags.push({ text: `${fmtPct(battedBall?.k_pct)} K upside`, tone: 'good' });
  }
  if ((battedBall?.gb_pct ?? 0) >= 50) {
    tags.push({ text: 'Groundball profile', tone: 'good' });
  } else if ((battedBall?.fb_pct ?? 0) >= 42) {
    tags.push({ text: 'Flyball profile', tone: 'warn' });
  }

  return tags.slice(0, 4);
}

function countColdSignals(batter: BatterSplitRow, recent: NonNullable<BatterSplitRow['recent_form']>): number {
  const barrelDelta = (recent.barrel_pct ?? 0) - (batter.barrel_pct ?? 0);
  const hardHitDelta = (recent.hard_hit_pct ?? 0) - (batter.hard_hit_pct ?? 0);
  const xwobaDelta = (recent.xwoba ?? 0) - (batter.xwoba ?? 0);
  return [
    barrelDelta <= -5,
    hardHitDelta <= -8,
    xwobaDelta <= -0.05,
  ].filter(Boolean).length;
}

function batterInsightColor(tone: 'positive' | 'warn' | 'danger') {
  if (tone === 'positive') return GREEN;
  if (tone === 'warn') return AMBER;
  return RED;
}

function tagColors(tone: 'good' | 'bad' | 'neutral' | 'warn', fallback: string) {
  switch (tone) {
    case 'good':
      return { color: GREEN, borderColor: `${GREEN}80` };
    case 'bad':
      return { color: RED, borderColor: `${RED}80` };
    case 'warn':
      return { color: AMBER, borderColor: `${AMBER}80` };
    default:
      return { color: fallback, borderColor: 'rgba(148, 163, 184, 0.45)' };
  }
}

function topN(entries: TopPlayEntry[], minScore = 50): TopPlayEntry[] {
  return entries
    .filter(entry => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function hrThreatScore(batter: BatterSplitRow, pitcher: PitcherBattedBallRow | null): number {
  if (!pitcher || batter.pa < 20 || pitcher.batters_faced < 20) return 0;
  const power = (
    clamp(((batter.barrel_pct ?? 0) / 18) * 100, 0, 100) +
    clamp(((batter.pull_air_pct ?? 0) / 45) * 100, 0, 100) +
    clamp(((batter.iso ?? 0) / 0.25) * 100, 0, 100) +
    clamp(((batter.hr_per_fb_pct ?? 0) / 20) * 100, 0, 100)
  ) / 4;
  const vulnerability = (
    clamp(((pitcher.fb_pct ?? 0) / 45) * 100, 0, 100) +
    clamp(((pitcher.hr_per_fb_pct ?? 0) / 18) * 100, 0, 100)
  ) / 2;
  return Math.round(0.62 * power + 0.38 * vulnerability);
}

function hitLeanScore(batter: BatterSplitRow, pitcher: PitcherBattedBallRow | null): number {
  if (!pitcher || batter.pa < 20 || pitcher.batters_faced < 20) return 0;
  const recent = batter.recent_form;
  const blendedXwoba = recent?.xwoba != null && recent.pa >= 8
    ? (batter.xwoba ?? 0) * 0.7 + recent.xwoba * 0.3
    : batter.xwoba ?? 0;
  const contact = (
    clamp((blendedXwoba / 0.42) * 100, 0, 100) +
    clamp(((batter.hard_hit_pct ?? 0) / 50) * 100, 0, 100) +
    clamp((1 - ((batter.k_pct ?? 25) / 35)) * 100, 0, 100)
  ) / 3;
  const pitcherVuln = clamp((((pitcher.xwoba_allowed ?? pitcher.woba_allowed ?? 0.31) - 0.28) / 0.12) * 100, 0, 100);
  return Math.round(0.72 * contact + 0.28 * pitcherVuln);
}

function hotnessScore(batter: BatterSplitRow): number {
  const recent = batter.recent_form;
  if (!recent || recent.bbe < 8) return 0;
  const xwobaDelta = (recent.xwoba ?? batter.xwoba ?? 0) - (batter.xwoba ?? 0);
  const barrelDelta = (recent.barrel_pct ?? batter.barrel_pct ?? 0) - (batter.barrel_pct ?? 0);
  const hardHitDelta = (recent.hard_hit_pct ?? batter.hard_hit_pct ?? 0) - (batter.hard_hit_pct ?? 0);
  return Math.round(
    45 +
    clamp(xwobaDelta * 220, -20, 30) +
    clamp(barrelDelta * 1.5, -15, 20) +
    clamp(hardHitDelta * 0.8, -10, 15),
  );
}

function computeTopPlays(matchups: PitcherMatchupSummary[]): TopPlays {
  const hrThreats: TopPlayEntry[] = [];
  const hitLeans: TopPlayEntry[] = [];
  const hottestHitters: TopPlayEntry[] = [];
  const pitcherPlays: TopPlayEntry[] = [];
  const kProps: TopPlayEntry[] = [];

  const addBatterEntries = (
    batters: BatterSplitRow[],
    pitcher: PitcherBattedBallRow | null,
    pitcherName: string,
    pitcherHand: string | null,
    teamName: string,
    gamePk: number,
  ) => {
    for (const batter of batters) {
      if (!batter.has_split) continue;
      const hrScore = hrThreatScore(batter, pitcher);
      hrThreats.push({
        player_id: batter.batter_id,
        player_name: batter.batter_name,
        team_name: teamName,
        game_pk: gamePk,
        score: hrScore,
        context: `vs ${pitcherName} (${pitcherHand ?? '?'}HP)`,
        detail: `${fmtPct(batter.barrel_pct)} barrel · ${fmtPct(batter.pull_air_pct)} pull-air · ${fmtRate(batter.iso)} ISO`,
      });

      const hitScore = hitLeanScore(batter, pitcher);
      hitLeans.push({
        player_id: batter.batter_id,
        player_name: batter.batter_name,
        team_name: teamName,
        game_pk: gamePk,
        score: hitScore,
        context: `vs ${pitcherName} (${pitcherHand ?? '?'}HP)`,
        detail: `${fmtRate(batter.xwoba)} xwOBA · ${fmtPct(batter.hard_hit_pct)} hard-hit · ${fmtPct(batter.k_pct)} K`,
      });

      const hotScore = hotnessScore(batter);
      hottestHitters.push({
        player_id: batter.batter_id,
        player_name: batter.batter_name,
        team_name: teamName,
        game_pk: gamePk,
        score: hotScore,
        context: `L10 vs ${pitcherHand ?? '?'}HP`,
        detail: `L10 ${fmtRate(batter.recent_form?.xwoba)} xwOBA vs season ${fmtRate(batter.xwoba)}`,
      });
    }
  };

  for (const matchup of matchups) {
    const game = matchup.game;
    const awayPitcher = matchup.awayPitcher;
    const homePitcher = matchup.homePitcher;
    addBatterEntries(
      homePitcher?.topOpposingBatters ?? [],
      homePitcher?.battedBall ?? null,
      game.home_sp_name,
      game.home_sp_hand,
      game.away_team_name,
      game.game_pk,
    );
    addBatterEntries(
      awayPitcher?.topOpposingBatters ?? [],
      awayPitcher?.battedBall ?? null,
      game.away_sp_name,
      game.away_sp_hand,
      game.home_team_name,
      game.game_pk,
    );

    const pushPitcher = (
      pitcherId: number,
      pitcherName: string,
      teamName: string,
      opponentName: string,
      battedBall: PitcherBattedBallRow | null,
      opposingBatters: BatterSplitRow[],
      gamePk: number,
    ) => {
      if (!battedBall || battedBall.batters_faced < 20) return;
      const opposingWithSplits = opposingBatters.filter(b => b.has_split);
      const oppAvgXwoba = opposingWithSplits.length
        ? opposingWithSplits.reduce((sum, b) => sum + (b.xwoba ?? 0.32), 0) / opposingWithSplits.length
        : 0.32;
      const pitcherScore = Math.round(
        clamp((0.38 - (battedBall.xwoba_allowed ?? 0.34)) * 210, 0, 55) +
        clamp(((battedBall.k_pct ?? 0) - 18) * 1.2, 0, 25) +
        clamp((0.35 - oppAvgXwoba) * 100, 0, 20),
      );
      pitcherPlays.push({
        player_id: pitcherId,
        player_name: pitcherName,
        team_name: teamName,
        game_pk: gamePk,
        score: pitcherScore,
        context: `vs ${opponentName}`,
        detail: `${fmtRate(battedBall.xwoba_allowed)} xwOBA allowed · ${fmtPct(battedBall.k_pct)} K · ${battedBall.batters_faced} BF`,
      });

      const avgOppK = opposingWithSplits.length
        ? opposingWithSplits.reduce((sum, b) => sum + (b.k_pct ?? 20), 0) / opposingWithSplits.length
        : 20;
      const kScore = Math.round(
        clamp(((battedBall.k_pct ?? 0) - 18) * 2, 0, 55) +
        clamp((avgOppK - 19) * 2, 0, 35) +
        clamp((battedBall.batters_faced - 30) / 5, 0, 10),
      );
      kProps.push({
        player_id: pitcherId,
        player_name: pitcherName,
        team_name: teamName,
        game_pk: gamePk,
        score: kScore,
        context: `K prop lean vs ${opponentName}`,
        detail: `${fmtPct(battedBall.k_pct)} pitcher K · ${fmtPct(avgOppK)} opponent split K`,
      });
    };

    pushPitcher(
      game.away_sp_id,
      game.away_sp_name,
      game.away_team_name,
      game.home_team_name,
      awayPitcher?.battedBall ?? null,
      awayPitcher?.topOpposingBatters ?? [],
      game.game_pk,
    );
    pushPitcher(
      game.home_sp_id,
      game.home_sp_name,
      game.home_team_name,
      game.away_team_name,
      homePitcher?.battedBall ?? null,
      homePitcher?.topOpposingBatters ?? [],
      game.game_pk,
    );
  }

  return {
    hrThreats: topN(hrThreats, 50),
    hitLeans: topN(hitLeans, 50),
    hottestHitters: topN(hottestHitters, 60),
    pitcherPlays: topN(pitcherPlays, 50),
    kProps: topN(kProps, 50),
  };
}

function StatPill({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  return (
    <View style={[styles.statPill, { backgroundColor: isDark ? '#262626' : '#f3f4f6' }]}>
      <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{value}</Text>
    </View>
  );
}

function ArchetypeBadge({ archetype }: { archetype: PitcherArchetypeProfile | null }) {
  if (!archetype || !isDisplayArchetype(archetype.archetype)) return null;
  const meta = ARCHETYPE_META[archetype.archetype];
  return (
    <View style={[styles.archBadge, { borderColor: meta.color, backgroundColor: `${meta.color}20` }]}>
      <Text style={[styles.archBadgeText, { color: meta.color }]}>
        {meta.icon} {meta.label}
      </Text>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.detailStatCell}>
      <Text style={[styles.detailStatLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.detailStatValue, { color: theme.colors.onSurface }]}>{value}</Text>
    </View>
  );
}

function ShadedStatCell({
  label,
  value,
  raw,
  statKey,
  benchmarks,
  higherIsBetter = true,
  recentValue,
  recentFormatted,
}: {
  label: string;
  value: string;
  raw: number | null | undefined;
  statKey: string;
  benchmarks?: LeagueBenchmarks | null;
  higherIsBetter?: boolean;
  recentValue?: number | null;
  recentFormatted?: string;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const benchmark = resolveBenchmark(benchmarks, statKey);
  const bucket = benchmark && raw != null
    ? getStatBucket(raw, benchmark.p10, benchmark.p25, benchmark.p75, benchmark.p90, higherIsBetter)
    : null;
  const colors = bucketColors(bucket, isDark);
  const trend = computeTrend(recentValue, raw, higherIsBetter);
  const showRecent = recentValue != null && recentFormatted && trend !== 'na';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={(event) => showMetricHelp(statKey, event)}
      style={[styles.shadedStatCell, { backgroundColor: colors.bg, borderColor: colors.border }]}
    >
      <View style={styles.metricLabelRow}>
        <Text style={[styles.detailStatLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        {METRIC_HELP[statKey] ? (
          <MaterialCommunityIcons name="information-outline" size={10} color={theme.colors.onSurfaceVariant} />
        ) : null}
      </View>
      <Text style={[styles.shadedStatValue, { color: colors.text ?? theme.colors.onSurface }]}>{value}</Text>
      {showRecent ? (
        <Text style={[styles.recentMini, { color: trendColor(trend, theme.colors.onSurfaceVariant) }]}>
          L10 {recentFormatted} {trendArrow(trend)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function RecentTrendChip({
  label,
  seasonValue,
  recentValue,
  formatted,
  higherIsBetter = true,
}: {
  label: string;
  seasonValue: number | null | undefined;
  recentValue: number | null | undefined;
  formatted: (value: number | null | undefined) => string;
  higherIsBetter?: boolean;
}) {
  const theme = useTheme();
  const trend = computeTrend(recentValue, seasonValue, higherIsBetter);
  if (recentValue == null || trend === 'na') return null;

  const metricKey = {
    'xwOBA': 'xwoba',
    Barrel: 'barrel_pct',
    'Hard-hit': 'hard_hit_pct',
    'Avg EV': 'avg_exit_velo',
    K: 'k_pct',
    'Pull-air': 'pull_air_pct',
  }[label];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={(event) => metricKey ? showMetricHelp(metricKey, event) : undefined}
      style={[styles.recentTrendChip, { borderColor: trendColor(trend, theme.colors.outlineVariant) }]}
    >
      <Text style={[styles.recentTrendLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.recentTrendValue, { color: trendColor(trend, theme.colors.onSurface) }]}>
        {formatted(recentValue)} {trendArrow(trend)}
      </Text>
    </TouchableOpacity>
  );
}

function Last10Metrics({ batter }: { batter: BatterSplitRow }) {
  const theme = useTheme();
  const recent = batter.recent_form;
  if (!recent) return null;

  return (
    <View style={styles.last10Block}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.expandedTitle, { color: theme.colors.onSurface }]}>
          Last 10 vs {batter.vs_pitcher_hand}HP
        </Text>
        <Text style={[styles.last10Sample, { color: theme.colors.onSurfaceVariant }]}>
          {recent.pa} PA · {recent.bbe} BBE
        </Text>
      </View>
      <View style={styles.recentTrendGrid}>
        <RecentTrendChip label="xwOBA" seasonValue={batter.xwoba} recentValue={recent.xwoba} formatted={fmtRate} />
        <RecentTrendChip label="Barrel" seasonValue={batter.barrel_pct} recentValue={recent.barrel_pct} formatted={fmtPct} />
        <RecentTrendChip label="Hard-hit" seasonValue={batter.hard_hit_pct} recentValue={recent.hard_hit_pct} formatted={fmtPct} />
        <RecentTrendChip label="Avg EV" seasonValue={batter.avg_exit_velo} recentValue={recent.avg_exit_velo} formatted={value => value == null ? '-' : Number(value).toFixed(1)} />
        <RecentTrendChip label="K" seasonValue={batter.k_pct} recentValue={recent.k_pct} formatted={fmtPct} higherIsBetter={false} />
        <RecentTrendChip label="Pull-air" seasonValue={batter.pull_air_pct} recentValue={recent.pull_air_pct} formatted={fmtPct} />
      </View>
    </View>
  );
}

function VsArchetypeBlock({
  batter,
  archetype,
  row,
}: {
  batter: BatterSplitRow;
  archetype: PitcherArchetypeProfile | null;
  row?: BatterVsArchetypeRow;
}) {
  const theme = useTheme();
  if (!archetype || !isDisplayArchetype(archetype.archetype)) return null;
  const meta = ARCHETYPE_META[archetype.archetype];
  const small = (row?.pa ?? 0) > 0 && (row?.pa ?? 0) < 15;
  const xwobaDelta = row?.xwoba != null && batter.xwoba != null ? row.xwoba - batter.xwoba : null;
  const slgDelta = row?.slg != null && batter.slg != null ? row.slg - batter.slg : null;
  const hrDelta = row?.hr_per_pa != null && batter.hr_per_pa != null ? row.hr_per_pa - batter.hr_per_pa : null;

  return (
    <View style={styles.expandedSection}>
      <Text style={[styles.expandedTitle, { color: theme.colors.onSurface }]}>
        vs {archetype.archetype} Pitchers {meta.icon}
      </Text>
      <Text style={[styles.expandedHelp, { color: theme.colors.onSurfaceVariant }]}>
        All batters vs same-hand pitchers of this archetype.
      </Text>
      {!row || row.pa < 8 ? (
        <Text style={[styles.noDataText, { color: theme.colors.onSurfaceVariant }]}>
          Not enough data - only {row?.pa ?? 0} PA vs {archetype.archetype} {batter.vs_pitcher_hand}HP this season
        </Text>
      ) : (
        <>
          {small ? (
            <Text style={[styles.sampleWarning, { color: AMBER }]}>
              Small sample - only {row.pa} PA vs {archetype.archetype} {batter.vs_pitcher_hand}HP.
            </Text>
          ) : null}
          <View style={styles.detailGrid}>
            <StatCell label="PA" value={String(row.pa)} />
            <StatCell label="K%" value={fmtPct(row.k_pct)} />
            <StatCell label="AVG/OBP/SLG" value={`${fmtRate(row.avg)} / ${fmtRate(row.obp)} / ${fmtRate(row.slg)}`} />
            <StatCell label="xwOBA" value={fmtRate(row.xwoba)} />
            <StatCell label="Barrel%" value={fmtPct(row.barrel_pct)} />
            <StatCell label="Hard-hit%" value={fmtPct(row.hard_hit_pct)} />
          </View>
          <Text style={[styles.deltaLine, { color: theme.colors.onSurfaceVariant }]}>
            Compared to overall vs {batter.vs_pitcher_hand}HP: xwOBA {fmtDelta(xwobaDelta)} · SLG {fmtDelta(slgDelta)} · HR/PA {fmtDelta(hrDelta)}
          </Text>
        </>
      )}
    </View>
  );
}

function PitchMixBlock({
  pitcherName,
  pitcherHand,
  arsenal,
  rows,
}: {
  pitcherName: string;
  pitcherHand: string | null;
  arsenal: PitcherArsenalRow[];
  rows: BatterVsPitchTypeRow[];
}) {
  const theme = useTheme();
  const byPitch = new Map<string, PitcherArsenalRow>();
  for (const pitch of arsenal) {
    const existing = byPitch.get(pitch.pitch_type);
    if (!existing || pitch.vs_batter_hand === 'A' || (pitch.usage_pct ?? 0) > (existing.usage_pct ?? 0)) {
      byPitch.set(pitch.pitch_type, pitch);
    }
  }
  const relevantArsenal = [...byPitch.values()]
    .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0))
    .slice(0, 5);

  if (!relevantArsenal.length) return null;

  return (
    <View style={styles.expandedSection}>
      <Text style={[styles.expandedTitle, { color: theme.colors.onSurface }]}>
        vs {pitcherName}'s pitch mix (as a {pitcherHand}HP)
      </Text>
      <Text style={[styles.expandedHelp, { color: theme.colors.onSurfaceVariant }]}>
        Batter performance vs all {pitcherHand}HP on pitch types this starter throws.
      </Text>
      <View style={styles.pitchRows}>
        {relevantArsenal.map(pitch => {
          const row = rows.find(r => r.pitch_type === pitch.pitch_type);
          return (
            <View key={`${pitch.pitch_type}-${pitch.vs_batter_hand}`} style={styles.pitchRow}>
              <Text style={[styles.pitchName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {abbrevPitchLabel(pitch.pitch_type, pitch.pitch_type_label)}
              </Text>
              {row && row.pitches_seen >= 10 ? (
                <>
                  <Text style={[styles.pitchStat, { color: theme.colors.onSurfaceVariant }]}>{row.pitches_seen} seen</Text>
                  <Text style={[styles.pitchStat, { color: theme.colors.onSurfaceVariant }]}>AVG {fmtRate(row.avg)}</Text>
                  <Text style={[styles.pitchStat, { color: theme.colors.onSurfaceVariant }]}>SLG {fmtRate(row.slg)}</Text>
                  <Text style={[styles.pitchStat, { color: theme.colors.onSurfaceVariant }]}>xwOBA {fmtRate(row.xwoba)}</Text>
                </>
              ) : (
                <Text style={[styles.pitchStat, { color: theme.colors.onSurfaceVariant }]}>Not enough data</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PitcherTagChips({
  tags,
}: {
  tags: Array<{ text: string; tone: 'good' | 'bad' | 'neutral' | 'warn' }>;
}) {
  const theme = useTheme();
  if (!tags.length) return null;

  return (
    <View style={styles.pitcherTagRow}>
      {tags.map(tag => {
        const colors = tagColors(tag.tone, theme.colors.onSurfaceVariant);
        return (
          <Text key={tag.text} style={[styles.pitcherTag, colors]}>
            {tag.text}
          </Text>
        );
      })}
    </View>
  );
}

function PitcherArsenalSplitSection({
  title,
  rows,
}: {
  title: string;
  rows: PitcherArsenalRow[];
}) {
  const theme = useTheme();
  const sorted = [...rows]
    .filter(p => (p.pitches_thrown ?? 0) > 0)
    .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0));

  if (!sorted.length) return null;

  return (
    <View style={styles.pitcherArsenalSection}>
      <Text style={[styles.pitcherArsenalSectionTitle, { color: theme.colors.onSurfaceVariant }]}>
        {title}
      </Text>
      {sorted.map(pitch => {
        const vulnerable = (pitch.xwoba_allowed ?? 0) >= 0.370;
        return (
          <View key={`${title}-${pitch.pitch_type}-${pitch.vs_batter_hand}`} style={styles.pitcherArsenalRow}>
            <View style={styles.pitcherArsenalTitleRow}>
              <Text style={[styles.pitcherArsenalPitch, { color: theme.colors.onSurface }]}>
                {abbrevPitchLabel(pitch.pitch_type, pitch.pitch_type_label)}
              </Text>
              <Text style={[styles.pitcherArsenalSplit, { color: theme.colors.onSurfaceVariant }]}>
                {pitch.pitches_thrown} pitches
              </Text>
            </View>
            <View style={styles.pitcherArsenalStats}>
              <Text style={[styles.pitcherArsenalStat, { color: theme.colors.onSurfaceVariant }]}>
                Usage {fmtPct(pitch.usage_pct)}
              </Text>
              <Text style={[styles.pitcherArsenalStat, { color: theme.colors.onSurfaceVariant }]}>
                Velo {pitch.avg_velo?.toFixed(1) ?? '-'}
              </Text>
              <Text style={[styles.pitcherArsenalStat, { color: theme.colors.onSurfaceVariant }]}>
                Whiff {fmtPct(pitch.whiff_pct)}
              </Text>
              <Text style={[styles.pitcherArsenalStat, { color: vulnerable ? RED : theme.colors.onSurfaceVariant }]}>
                xwOBA {fmtRate(pitch.xwoba_allowed)}
              </Text>
              <Text style={[styles.pitcherArsenalStat, { color: theme.colors.onSurfaceVariant }]}>
                GB/FB {fmtPct(pitch.gb_pct)} / {fmtPct(pitch.fb_pct)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PitcherArsenalDetail({ arsenal }: { arsenal: PitcherArsenalRow[] }) {
  const theme = useTheme();
  const overall = arsenal.filter(p => p.vs_batter_hand === 'A' || !p.vs_batter_hand);
  const vsRhb = arsenal.filter(p => p.vs_batter_hand === 'R');
  const vsLhb = arsenal.filter(p => p.vs_batter_hand === 'L');
  const hasAny = [overall, vsRhb, vsLhb].some(rows => rows.some(p => (p.pitches_thrown ?? 0) > 0));

  if (!hasAny) {
    return (
      <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
        No pitch arsenal data available.
      </Text>
    );
  }

  return (
    <View style={styles.pitcherArsenalRows}>
      <PitcherArsenalSplitSection title="Overall" rows={overall} />
      <PitcherArsenalSplitSection title="vs RHB" rows={vsRhb} />
      <PitcherArsenalSplitSection title="vs LHB" rows={vsLhb} />
      <Text style={[styles.pitcherArsenalFootnote, { color: theme.colors.onSurfaceVariant }]}>
        Small pitch samples can swing quickly. Prioritize usage, whiff, and xwOBA allowed together.
      </Text>
    </View>
  );
}

function BatterChip({
  batter,
  pitcherName,
  pitcherHand,
  archetype,
  vsArchetype,
  arsenal,
  vsPitchRows,
  benchmarks,
  isFocused = false,
}: {
  batter: BatterSplitRow;
  pitcherName: string;
  pitcherHand: string | null;
  archetype: PitcherArchetypeProfile | null;
  vsArchetype?: BatterVsArchetypeRow;
  arsenal: PitcherArsenalRow[];
  vsPitchRows: BatterVsPitchTypeRow[];
  benchmarks?: LeagueBenchmarks | null;
  isFocused?: boolean;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [expanded, setExpanded] = useState(false);
  const recent = batter.recent_form;
  const xwobaDelta = recent?.xwoba != null && batter.xwoba != null ? recent.xwoba - batter.xwoba : null;
  const handLabel = batter.vs_pitcher_hand === 'R' ? 'right' : 'left';
  const hasEnough = batter.pa >= 30;
  const hasAnySplit = batter.pa > 0;
  const topPitch = [...vsPitchRows]
    .filter(row => row.pitches_seen >= 25 && (row.xwoba ?? 0) >= 0.400 && (row.slg ?? 0) >= 0.500)
    .sort((a, b) => (b.slg ?? 0) - (a.slg ?? 0))[0];
  const handArsenal = arsenal.filter(p => p.vs_batter_hand === pitcherHand || p.vs_batter_hand === 'A' || !p.vs_batter_hand);
  const wipeoutPitch = [...handArsenal]
    .filter(p => (p.pitches_thrown ?? 0) >= 25 && (p.whiff_pct ?? 0) >= 30 && (p.usage_pct ?? 0) >= 18)
    .sort((a, b) => (b.whiff_pct ?? 0) - (a.whiff_pct ?? 0))[0];
  const wipeoutVs = wipeoutPitch
    ? vsPitchRows.find(row => row.pitch_type === wipeoutPitch.pitch_type)
    : undefined;
  const archMeta = archetype && isDisplayArchetype(archetype.archetype) ? ARCHETYPE_META[archetype.archetype] : null;
  const archDelta = vsArchetype?.xwoba != null && batter.xwoba != null ? vsArchetype.xwoba - batter.xwoba : null;
  const chips: Array<{ text: string; tone: 'positive' | 'warn' | 'danger' }> = [
    topPitch ? { text: `⚔️ Crushes ${topPitch.pitch_type_label || topPitch.pitch_type} (${fmtRate(topPitch.slg)} SLG)`, tone: 'positive' } : null,
    archMeta && archDelta != null && archDelta >= 0.05
      ? { text: `${archMeta.icon} Crushes ${archetype!.archetype} (+${Math.round(archDelta * 1000)} xwOBA pts)`, tone: 'positive' }
      : null,
    archMeta && archDelta != null && archDelta <= -0.05 && (vsArchetype?.pa ?? 0) >= 8
      ? { text: `${archMeta.icon} Struggles vs ${archetype!.archetype} (${Math.round(archDelta * 1000)} xwOBA pts)`, tone: 'danger' }
      : null,
    wipeoutPitch && wipeoutVs && (wipeoutVs.pitches_seen ?? 0) >= 20 && (wipeoutVs.whiff_pct ?? 0) >= 35 && (batter.k_pct ?? 0) >= 25
      ? { text: `🚫 Whiffs vs ${wipeoutPitch.pitch_type_label || wipeoutPitch.pitch_type} (${fmtPct(wipeoutVs.whiff_pct)})`, tone: 'warn' }
      : null,
    wipeoutPitch && wipeoutVs && (wipeoutVs.pitches_seen ?? 0) >= 20 && (wipeoutVs.k_pct ?? 0) >= 35
      ? { text: `😬 ${fmtPct(wipeoutVs.k_pct)} K vs ${wipeoutPitch.pitch_type_label || wipeoutPitch.pitch_type}`, tone: 'warn' }
      : null,
    batter.barrel_pct != null && batter.barrel_pct >= 12
      ? { text: `💪 Barrel ${fmtPct(batter.barrel_pct)}`, tone: 'positive' }
      : null,
    batter.xwoba != null && batter.xwoba >= 0.37
      ? { text: `🔥 ${fmtRate(batter.xwoba)} xwOBA`, tone: 'positive' }
      : null,
    batter.xwoba != null && batter.xwoba <= 0.285 && batter.pa >= 20
      ? { text: `❄️ ${fmtRate(batter.xwoba)} xwOBA vs ${batter.vs_pitcher_hand}HP`, tone: 'warn' }
      : null,
    xwobaDelta != null && xwobaDelta >= 0.03
      ? { text: `📈 L10 +${xwobaDelta.toFixed(3)}`, tone: 'positive' }
      : null,
    recent && recent.bbe >= 8 && countColdSignals(batter, recent) >= 2
      ? { text: '🥶 Cold L10 contact', tone: 'danger' }
      : null,
  ].filter(Boolean) as Array<{ text: string; tone: 'positive' | 'warn' | 'danger' }>;

  useEffect(() => {
    if (isFocused) setExpanded(true);
  }, [isFocused]);

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => setExpanded(prev => !prev)}
      style={[
        styles.batterChip,
        {
          backgroundColor: isFocused ? `${GREEN}16` : isDark ? '#202020' : '#f8fafc',
          borderColor: isFocused ? GREEN : theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.batterTopRow}>
        <Image source={{ uri: mlbHeadshotUrl(batter.batter_id, 60) }} style={styles.headshot} />
        <View style={styles.batterMain}>
          <View style={styles.batterHeader}>
            <Text style={[styles.batterName, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {batter.batting_order ? `${batter.batting_order}. ` : ''}{batter.batter_name}
            </Text>
            <Text style={[styles.batterHand, { color: theme.colors.onSurfaceVariant }]}>
              {batter.bat_side ?? '-'} {batter.position ? `· ${batter.position}` : ''}
            </Text>
          </View>
          {hasAnySplit ? (
            <Text style={[styles.batterMeta, { color: theme.colors.onSurfaceVariant }]}>
              vs {handLabel}: {batter.pa} PA · AVG/OBP/SLG {fmtSlash(batter)} · {fmtRate(batter.xwoba)} xwOBA
            </Text>
          ) : (
            <Text style={[styles.batterMeta, { color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }]}>
              Not enough data this season vs {batter.vs_pitcher_hand}HP
            </Text>
          )}
          {chips.length ? (
            <View style={styles.insightChipRow}>
              {chips.map(chip => (
                <Text
                  key={chip.text}
                  style={[
                    styles.insightChip,
                    {
                      borderColor: batterInsightColor(chip.tone),
                      color: batterInsightColor(chip.tone),
                    },
                  ]}
                >
                  {chip.text}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-down' : 'chevron-right'}
          size={22}
          color={theme.colors.onSurfaceVariant}
        />
      </View>

      {expanded && hasAnySplit ? (
        <View style={styles.batterExpanded}>
          <View style={styles.expandedSection}>
            <Text style={[styles.expandedTitle, { color: theme.colors.onSurface }]}>
              Full split vs {batter.vs_pitcher_hand}HP this season ({batter.pa} PA)
            </Text>
            {!hasEnough ? (
              <Text style={[styles.sampleWarning, { color: AMBER }]}>
                Smaller sample than the website's main confidence gate (30 PA). Showing available split data.
              </Text>
            ) : null}
            <View style={styles.priorityStatGrid}>
              <ShadedStatCell label="xwOBA" value={fmtRate(batter.xwoba)} raw={batter.xwoba} statKey="xwoba" benchmarks={benchmarks} recentValue={recent?.xwoba} recentFormatted={fmtRate(recent?.xwoba)} />
              <ShadedStatCell label="AVG" value={fmtRate(batter.avg)} raw={batter.avg} statKey="avg" benchmarks={benchmarks} />
              <ShadedStatCell label="OBP" value={fmtRate(batter.obp)} raw={batter.obp} statKey="obp" benchmarks={benchmarks} />
              <ShadedStatCell label="SLG" value={fmtRate(batter.slg)} raw={batter.slg} statKey="slg" benchmarks={benchmarks} />
              <ShadedStatCell label="Barrel" value={fmtPct(batter.barrel_pct)} raw={batter.barrel_pct} statKey="barrel_pct" benchmarks={benchmarks} recentValue={recent?.barrel_pct} recentFormatted={fmtPct(recent?.barrel_pct)} />
              <ShadedStatCell label="Hard-hit" value={fmtPct(batter.hard_hit_pct)} raw={batter.hard_hit_pct} statKey="hard_hit_pct" benchmarks={benchmarks} recentValue={recent?.hard_hit_pct} recentFormatted={fmtPct(recent?.hard_hit_pct)} />
            </View>
            <View style={styles.secondaryStatRow}>
              <ShadedStatCell label="K" value={fmtPct(batter.k_pct)} raw={batter.k_pct} statKey="k_pct" benchmarks={benchmarks} higherIsBetter={false} recentValue={recent?.k_pct} recentFormatted={fmtPct(recent?.k_pct)} />
              <ShadedStatCell label="BB" value={fmtPct(batter.bb_pct)} raw={batter.bb_pct} statKey="bb_pct" benchmarks={benchmarks} />
              <ShadedStatCell label="ISO" value={fmtRate(batter.iso)} raw={batter.iso} statKey="iso" benchmarks={benchmarks} />
              <ShadedStatCell label="Avg EV" value={batter.avg_exit_velo?.toFixed(1) ?? '-'} raw={batter.avg_exit_velo} statKey="avg_exit_velo" benchmarks={benchmarks} recentValue={recent?.avg_exit_velo} recentFormatted={recent?.avg_exit_velo != null ? recent.avg_exit_velo.toFixed(1) : undefined} />
              <ShadedStatCell label="Pull-air" value={fmtPct(batter.pull_air_pct)} raw={batter.pull_air_pct} statKey="pull_air_pct" benchmarks={benchmarks} recentValue={recent?.pull_air_pct} recentFormatted={fmtPct(recent?.pull_air_pct)} />
              <ShadedStatCell label="HR/FB" value={fmtPct(batter.hr_per_fb_pct)} raw={batter.hr_per_fb_pct} statKey="hr_per_fb_pct" benchmarks={benchmarks} />
            </View>
            <View style={styles.compactBattedBallRow}>
              <Text style={[styles.compactBattedBallText, { color: theme.colors.onSurfaceVariant }]}>
                Batted-ball: GB {fmtPct(batter.gb_pct)} · FB {fmtPct(batter.fb_pct)} · LD {fmtPct(batter.ld_pct)} · Pull/Oppo {fmtPct(batter.pull_pct)} / {fmtPct(batter.oppo_pct)}
              </Text>
            </View>
          </View>
          <Last10Metrics batter={batter} />
          <VsArchetypeBlock batter={batter} archetype={archetype} row={vsArchetype} />
          <PitchMixBlock
            pitcherName={pitcherName}
            pitcherHand={pitcherHand}
            arsenal={arsenal}
            rows={vsPitchRows}
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function TopPlayCard({
  entry,
  onPress,
}: {
  entry: TopPlayEntry;
  onPress?: (entry: TopPlayEntry) => void;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={() => onPress?.(entry)}
      style={[styles.topPlayCard, { backgroundColor: isDark ? '#181818' : '#ffffff', borderColor: theme.colors.outlineVariant }]}
    >
      <View style={styles.topPlayHeader}>
        <Text style={[styles.topPlayName, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {entry.player_name}
        </Text>
        <Text style={[styles.scorePill, { backgroundColor: entry.score >= 75 ? GREEN : AMBER }]}>
          {entry.score}
        </Text>
      </View>
      <Text style={[styles.topPlayContext, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
        {entry.team_name} · {entry.context}
      </Text>
      <Text style={[styles.topPlayDetail, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
        {entry.detail}
      </Text>
    </TouchableOpacity>
  );
}

function TopPlaySection({
  title,
  emoji,
  entries,
  emptyText,
  onEntryPress,
}: {
  title: string;
  emoji: string;
  entries: TopPlayEntry[];
  emptyText: string;
  onEntryPress?: (entry: TopPlayEntry) => void;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  return (
    <View style={styles.topPlaySection}>
      <Text style={[styles.topPlayTitle, { color: theme.colors.onSurface }]}>
        {emoji} {title}
      </Text>
      {entries.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topPlayScroll}>
          {entries.map(entry => (
            <TopPlayCard key={`${title}-${entry.player_id}-${entry.game_pk}`} entry={entry} onPress={onEntryPress} />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.emptyTopPlayCard, { backgroundColor: isDark ? '#181818' : '#ffffff', borderColor: theme.colors.outlineVariant }]}>
          <Text style={[styles.emptyTopPlayText, { color: theme.colors.onSurfaceVariant }]}>
            {emptyText}
          </Text>
        </View>
      )}
    </View>
  );
}

function TopPlaysSummary({
  topPlays,
  onEntryPress,
}: {
  topPlays: TopPlays;
  onEntryPress?: (entry: TopPlayEntry) => void;
}) {
  return (
    <View style={styles.topSummaryWrap}>
      <TopPlaySection
        title="Hottest hitters"
        emoji="🔥"
        entries={topPlays.hottestHitters}
        emptyText="No L10 heat scores over threshold yet."
        onEntryPress={onEntryPress}
      />
      <TopPlaySection
        title="HR threats"
        emoji="💣"
        entries={topPlays.hrThreats}
        emptyText="No HR threats over threshold yet."
        onEntryPress={onEntryPress}
      />
      <TopPlaySection
        title="Hit leans"
        emoji="🎯"
        entries={topPlays.hitLeans}
        emptyText="No hit leans over threshold yet."
        onEntryPress={onEntryPress}
      />
      <TopPlaySection
        title="Pitcher plays"
        emoji="🥊"
        entries={topPlays.pitcherPlays}
        emptyText="No pitcher plays over threshold yet."
        onEntryPress={onEntryPress}
      />
      <TopPlaySection
        title="K props"
        emoji="⚡"
        entries={topPlays.kProps}
        emptyText="No K prop leans over threshold yet."
        onEntryPress={onEntryPress}
      />
    </View>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <View style={[styles.errorCard, { backgroundColor: isDark ? '#181818' : '#ffffff', borderColor: RED }]}>
      <MaterialCommunityIcons name="alert-circle-outline" size={24} color={RED} />
      <Text style={[styles.errorTitle, { color: theme.colors.onSurface }]}>
        Could not load pitcher matchups
      </Text>
      <Text style={[styles.errorBody, { color: theme.colors.onSurfaceVariant }]}>
        {message}
      </Text>
    </View>
  );
}

function PitcherPanel({
  pitcherId,
  team,
  pitcherName,
  hand,
  archetype,
  battedBall,
  arsenal = [],
  topBatters = [],
  vsPitchByBatter = {},
  vsArchetypeByBatter = {},
  benchmarksByHand,
  focusedPlayerId,
}: {
  pitcherId: number;
  team: string;
  pitcherName: string;
  hand: string | null;
  archetype: PitcherArchetypeProfile | null;
  battedBall: PitcherBattedBallRow | null;
  arsenal?: PitcherArsenalRow[];
  topBatters?: BatterSplitRow[];
  vsPitchByBatter?: Record<number, BatterVsPitchTypeRow[]>;
  vsArchetypeByBatter?: Record<number, BatterVsArchetypeRow>;
  benchmarksByHand?: Partial<Record<'R' | 'L', LeagueBenchmarks>>;
  focusedPlayerId?: number | null;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [expanded, setExpanded] = useState(false);
  const smallSample = (battedBall?.batters_faced ?? 0) > 0 && (battedBall?.batters_faced ?? 0) < 30;
  const tags = pitcherTags(battedBall, arsenal);
  const topPitches = [...arsenal]
    .filter(p => (p.vs_batter_hand === 'A' || !p.vs_batter_hand) && (p.pitches_thrown ?? 0) >= 25)
    .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0))
    .slice(0, 3);

  return (
    <View style={[styles.pitcherPanel, { backgroundColor: isDark ? '#171717' : '#ffffff', borderColor: theme.colors.outlineVariant }]}>
      <TouchableOpacity activeOpacity={0.84} onPress={() => setExpanded(prev => !prev)}>
        <View style={styles.pitcherHeader}>
          <Image source={{ uri: mlbHeadshotUrl(pitcherId, 72) }} style={styles.pitcherHeadshot} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.teamLabel, { color: theme.colors.onSurfaceVariant }]}>{team}</Text>
            <Text style={[styles.pitcherName, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {pitcherName} {hand ? `(${hand}HP)` : ''}
            </Text>
            <Text style={[styles.pitcherTapHint, { color: theme.colors.onSurfaceVariant }]}>
              Tap for arsenal
            </Text>
          </View>
          <View style={styles.pitcherHeaderRight}>
            <ArchetypeBadge archetype={archetype} />
            <MaterialCommunityIcons
              name={expanded ? 'chevron-down' : 'chevron-right'}
              size={22}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        </View>
      </TouchableOpacity>

      {archetype && isDisplayArchetype(archetype.archetype) ? (
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          {archetypeDescription(archetype.archetype)}
        </Text>
      ) : null}

      {smallSample ? (
        <Text style={[styles.sampleWarning, { color: AMBER }]}>
          Limited sample: {battedBall?.batters_faced} batters faced this season.
        </Text>
      ) : null}

      <View style={styles.statGrid}>
        <StatPill label="xwOBA allowed" value={fmtRate(battedBall?.xwoba_allowed)} />
        <StatPill label="K / BB" value={`${fmtPct(battedBall?.k_pct)} / ${fmtPct(battedBall?.bb_pct)}`} />
        <StatPill label="GB / FB" value={`${fmtPct(battedBall?.gb_pct)} / ${fmtPct(battedBall?.fb_pct)}`} />
        <StatPill label="HR/FB" value={fmtPct(battedBall?.hr_per_fb_pct)} />
      </View>

      <PitcherTagChips tags={tags} />

      {topPitches.length ? (
        <Text style={[styles.pitcherTopPitches, { color: theme.colors.onSurfaceVariant }]}>
          Top pitches: {topPitches.map(p => `${abbrevPitchLabel(p.pitch_type, p.pitch_type_label)} ${Math.round(p.usage_pct ?? 0)}%`).join(' · ')}
        </Text>
      ) : null}

      {expanded ? (
        <View style={styles.pitcherExpanded}>
          <Text style={[styles.expandedTitle, { color: theme.colors.onSurface }]}>
            Pitch Arsenal
          </Text>
          <PitcherArsenalDetail arsenal={arsenal} />
        </View>
      ) : null}

      <Text style={[styles.subhead, { color: theme.colors.onSurfaceVariant }]}>
        Opposing lineup bats vs this hand
      </Text>
      {topBatters.length ? (
        <View style={{ gap: 6 }}>
          {topBatters.map(batter => (
            <BatterChip
              key={batter.batter_id}
              batter={batter}
              pitcherName={pitcherName}
              pitcherHand={hand}
              archetype={archetype}
              vsArchetype={vsArchetypeByBatter?.[batter.batter_id]}
              arsenal={arsenal}
              vsPitchRows={vsPitchByBatter?.[batter.batter_id] ?? []}
              benchmarks={benchmarksByHand?.[batter.vs_pitcher_hand] ?? null}
              isFocused={focusedPlayerId === batter.batter_id}
            />
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          Lineup or batter splits not available yet.
        </Text>
      )}
    </View>
  );
}

function MatchupCard({
  matchup,
  benchmarksByHand,
  focusedTarget,
  onLayout,
}: {
  matchup: PitcherMatchupSummary;
  benchmarksByHand?: Partial<Record<'R' | 'L', LeagueBenchmarks>>;
  focusedTarget?: FocusedBatterTarget;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  const game = matchup.game;
  const awayPitcher = matchup.awayPitcher;
  const homePitcher = matchup.homePitcher;
  const focusedPlayerId = focusedTarget?.gamePk === game.game_pk ? focusedTarget.playerId : null;
  return (
    <View style={styles.matchupWrap} onLayout={onLayout}>
      <Text style={[styles.matchupTitle, { color: theme.colors.onSurface }]}>
        {game.away_abbr} @ {game.home_abbr}
      </Text>
      <Text style={[styles.matchupSubtitle, { color: theme.colors.onSurfaceVariant }]}>
        {game.away_team_name} at {game.home_team_name}
      </Text>
      <PitcherPanel
        pitcherId={game.away_sp_id}
        team={game.away_abbr}
        pitcherName={game.away_sp_name}
        hand={game.away_sp_hand}
        archetype={awayPitcher?.archetype ?? null}
        battedBall={awayPitcher?.battedBall ?? null}
        arsenal={awayPitcher?.arsenal ?? []}
        topBatters={awayPitcher?.topOpposingBatters ?? []}
        vsPitchByBatter={awayPitcher?.batterVsPitchByBatter ?? {}}
        vsArchetypeByBatter={awayPitcher?.batterVsArchetypeByBatter ?? {}}
        benchmarksByHand={benchmarksByHand}
        focusedPlayerId={focusedPlayerId}
      />
      <PitcherPanel
        pitcherId={game.home_sp_id}
        team={game.home_abbr}
        pitcherName={game.home_sp_name}
        hand={game.home_sp_hand}
        archetype={homePitcher?.archetype ?? null}
        battedBall={homePitcher?.battedBall ?? null}
        arsenal={homePitcher?.arsenal ?? []}
        topBatters={homePitcher?.topOpposingBatters ?? []}
        vsPitchByBatter={homePitcher?.batterVsPitchByBatter ?? {}}
        vsArchetypeByBatter={homePitcher?.batterVsArchetypeByBatter ?? {}}
        benchmarksByHand={benchmarksByHand}
        focusedPlayerId={focusedPlayerId}
      />
    </View>
  );
}

function matchupLabel(matchup: PitcherMatchupSummary): string {
  const game = matchup.game;
  return `${game.away_abbr} @ ${game.home_abbr}`;
}

function formatGameDateTime(game: PitcherMatchupSummary['game']): string {
  const parts: string[] = [];
  const rawTime = game.game_time_et ?? '';
  const timestampLike = rawTime.includes('T');
  const date = timestampLike
    ? new Date(rawTime)
    : game.official_date
      ? new Date(`${game.official_date}T12:00:00`)
      : null;

  if (date && !Number.isNaN(date.getTime())) {
    parts.push(date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    }));
  }

  if (timestampLike) {
    const time = new Date(rawTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    });
    parts.push(`${time} ET`);
  } else if (rawTime) {
    parts.push(`${rawTime.replace(/\s*ET$/i, '')} ET`);
  }

  return parts.join(' · ');
}

function MatchupFilterButton({
  selectedLabel,
  onPress,
}: {
  selectedLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      style={[
        styles.matchupFilterButton,
        {
          backgroundColor: isDark ? '#181818' : '#ffffff',
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.matchupFilterTextWrap}>
        <Text style={[styles.matchupFilterEyebrow, { color: theme.colors.onSurfaceVariant }]}>
          Showing
        </Text>
        <Text style={[styles.matchupFilterLabel, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {selectedLabel}
        </Text>
      </View>
      <View style={[styles.matchupFilterIcon, { backgroundColor: `${GREEN}18` }]}>
        <MaterialCommunityIcons name="filter-variant" size={20} color={GREEN} />
      </View>
    </TouchableOpacity>
  );
}

function MatchupFilterModal({
  visible,
  matchups,
  selectedGamePk,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  matchups: PitcherMatchupSummary[];
  selectedGamePk: number | null;
  onSelect: (gamePk: number | null) => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const choose = (gamePk: number | null) => {
    onSelect(gamePk);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={onDismiss}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.matchupFilterSheet,
            {
              backgroundColor: isDark ? '#171717' : '#ffffff',
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.matchupFilterSheetHeader}>
            <Text style={[styles.matchupFilterSheetTitle, { color: theme.colors.onSurface }]}>
              Filter Matchups
            </Text>
            <TouchableOpacity onPress={onDismiss} style={styles.matchupFilterClose}>
              <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => choose(null)}
            style={[
              styles.matchupFilterOption,
              {
                borderColor: selectedGamePk == null ? GREEN : theme.colors.outlineVariant,
                backgroundColor: selectedGamePk == null ? `${GREEN}12` : 'transparent',
              },
            ]}
          >
            <Text style={[styles.matchupFilterOptionTitle, { color: theme.colors.onSurface }]}>
              All games
            </Text>
            <Text style={[styles.matchupFilterOptionMeta, { color: theme.colors.onSurfaceVariant }]}>
              Show every pitcher matchup
            </Text>
          </TouchableOpacity>

          <ScrollView style={styles.matchupFilterOptions} showsVerticalScrollIndicator={false}>
            {matchups.map(matchup => {
              const selected = selectedGamePk === matchup.game.game_pk;
              return (
                <TouchableOpacity
                  key={matchup.game.game_pk}
                  activeOpacity={0.82}
                  onPress={() => choose(matchup.game.game_pk)}
                  style={[
                    styles.matchupFilterOption,
                    {
                      borderColor: selected ? GREEN : theme.colors.outlineVariant,
                      backgroundColor: selected ? `${GREEN}12` : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.matchupFilterOptionTitle, { color: theme.colors.onSurface }]}>
                    {matchupLabel(matchup)}
                  </Text>
                  <Text style={[styles.matchupFilterOptionMeta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                    {matchup.game.away_sp_name} vs {matchup.game.home_sp_name}
                  </Text>
                  <Text style={[styles.matchupFilterOptionTime, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                    {formatGameDateTime(matchup.game)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function reportTeaser(report: MLBPitcherMatchupsReport | null): string {
  if (!report) return 'Report not yet generated - check back closer to first pitch';
  const topPlays = report.top_plays ?? {};
  const hr = topPlays.hr_opportunities?.[0];
  if (hr?.batter) return `Top HR spot: ${hr.batter}${hr.vs ? ` vs ${hr.vs}` : ''}`;
  const hot = topPlays.hottest_batters?.[0];
  if (hot?.batter) return `Hot bat: ${hot.batter}${hot.matchup ? ` - ${hot.matchup}` : ''}`;
  const notable = topPlays.notable_pitch_matchups?.length ?? 0;
  if (notable > 0) return `${notable} notable pitch matchups`;
  return 'Daily AI breakdown of hitter, pitcher, and pitch-mix edges';
}

function PreliminaryChip({ status }: { status: string | null | undefined }) {
  if (status === 'confirmed') return null;
  return (
    <Text style={styles.preliminaryChip}>
      Preliminary - projected lineups
    </Text>
  );
}

function PitcherMatchupsReportCard({
  report,
  isLoading,
  onPress,
}: {
  report: MLBPitcherMatchupsReport | null | undefined;
  isLoading: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const disabled = isLoading || !report;

  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.84}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.reportCard,
        {
          backgroundColor: isDark ? '#181818' : '#ffffff',
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.reportCardTopRow}>
        <View style={[styles.reportIconWrap, { backgroundColor: `${GREEN}18` }]}>
          <MaterialCommunityIcons name="baseball" size={22} color={GREEN} />
        </View>
        <View style={styles.reportCardText}>
          <Text style={[styles.reportCardTitle, { color: theme.colors.onSurface }]}>
            Today's Pitcher Matchups Report
          </Text>
          {isLoading ? (
            <View style={styles.reportLoadingRow}>
              <ActivityIndicator size="small" color={GREEN} />
              <Text style={[styles.reportCardMeta, { color: theme.colors.onSurfaceVariant }]}>
                Loading report...
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.reportCardTeaser, { color: report ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
                {reportTeaser(report ?? null)}
              </Text>
              {report ? (
                <Text style={[styles.reportCardMeta, { color: theme.colors.onSurfaceVariant }]}>
                  Updated {timeAgo(report.generated_at)}
                </Text>
              ) : null}
            </>
          )}
        </View>
        {report ? (
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
        ) : null}
      </View>
      {report ? (
        <View style={styles.reportChipRow}>
          <PreliminaryChip status={report.lineups_status} />
          <Text style={[styles.reportGamesChip, { color: theme.colors.onSurfaceVariant, borderColor: theme.colors.outlineVariant }]}>
            {report.games_count} games
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function ScorePill({ score }: { score: number | null | undefined }) {
  const n = Number(score ?? 0);
  const bg = n >= 80 ? GREEN : n >= 65 ? AMBER : '#64748b';
  return (
    <Text style={[styles.reportScorePill, { backgroundColor: bg }]}>
      {Number.isFinite(n) && n > 0 ? Math.round(n) : '-'}
    </Text>
  );
}

function ReportRow({
  title,
  meta,
  score,
  tone = 'neutral',
  limited,
}: {
  title: string;
  meta?: string;
  score?: number | null;
  tone?: 'hitter' | 'pitcher' | 'neutral';
  limited?: boolean | null;
}) {
  const theme = useTheme();
  const borderColor = tone === 'hitter' ? `${GREEN}80` : tone === 'pitcher' ? `${RED}80` : theme.colors.outlineVariant;
  return (
    <View style={[styles.reportRow, { borderColor }]}>
      <View style={styles.reportRowHeader}>
        <Text style={[styles.reportRowTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
          {title}
        </Text>
        {score != null ? <ScorePill score={score} /> : null}
      </View>
      {meta ? (
        <Text style={[styles.reportRowMeta, { color: theme.colors.onSurfaceVariant }]}>{meta}</Text>
      ) : null}
      {limited ? <Text style={styles.reportLimitedTag}>limited</Text> : null}
    </View>
  );
}

function HRReportSection({ items }: { items: PitcherReportHROpportunity[] | undefined }) {
  if (!items?.length) return null;
  return (
    <View style={styles.reportStructuredSection}>
      <Text style={styles.reportStructuredTitle}>HR Opportunities</Text>
      {items.slice(0, 8).map((item, idx) => (
        <ReportRow
          key={`${item.batter}-${idx}`}
          title={`${item.batter}${item.vs ? ` vs ${item.vs}` : ''}`}
          meta={`${item.matchup ?? item.team ?? ''}${item.l10_xwoba != null ? ` · L10 xwOBA ${fmtRate(item.l10_xwoba)}` : ''}`}
          score={item.hr_score}
          tone="hitter"
          limited={item.limited_sample}
        />
      ))}
    </View>
  );
}

function HottestBatsSection({ items }: { items: PitcherReportHROpportunity[] | undefined }) {
  if (!items?.length) return null;
  return (
    <View style={styles.reportStructuredSection}>
      <Text style={styles.reportStructuredTitle}>Hottest Bats</Text>
      {items.slice(0, 8).map((item, idx) => (
        <ReportRow
          key={`${item.batter}-${idx}`}
          title={item.batter}
          meta={`L10 xwOBA ${fmtRate(item.l10_xwoba)}${item.matchup ? ` · ${item.matchup}` : ''}`}
          score={item.hr_score}
          tone="hitter"
          limited={item.limited_sample}
        />
      ))}
    </View>
  );
}

function PitchMatchupsSection({ items }: { items: PitcherReportPitchMatchup[] | undefined }) {
  if (!items?.length) return null;
  return (
    <View style={styles.reportStructuredSection}>
      <Text style={styles.reportStructuredTitle}>Pitch Matchups</Text>
      {items.slice(0, 10).map((item, idx) => {
        const hitterFav = item.type !== 'pitcher';
        const title = hitterFav
          ? `${item.batter ?? 'Batter'} vs ${item.opp_pitcher ?? 'pitcher'} ${item.pitch ?? ''}`
          : `${item.opp_pitcher ?? 'Pitcher'} ${item.pitch ?? ''} vs ${item.batter ?? 'batter'}`;
        const meta = hitterFav
          ? `${fmtPct(item.usage)} usage · ${fmtRate(item.xwoba)} xwOBA`
          : `${fmtPct(item.usage)} usage · ${fmtPct(item.whiff)} whiff`;
        return (
          <ReportRow
            key={`${title}-${idx}`}
            title={title}
            meta={`${meta}${item.matchup ? ` · ${item.matchup}` : ''}`}
            tone={hitterFav ? 'hitter' : 'pitcher'}
            limited={item.limited}
          />
        );
      })}
    </View>
  );
}

function PitcherMatchupsReportSheet({
  visible,
  report,
  onDismiss,
}: {
  visible: boolean;
  report: MLBPitcherMatchupsReport | null | undefined;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const topPlays = report?.top_plays ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.reportSheetBackdrop}>
        <View
          style={[
            styles.reportSheet,
            {
              backgroundColor: theme.colors.background,
              paddingTop: insets.top + 12,
            },
          ]}
        >
          <View style={[styles.reportSheetHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
            <View style={styles.reportSheetTitleWrap}>
              <Text style={[styles.reportSheetTitle, { color: theme.colors.onSurface }]}>
                Pitcher Matchups Report
              </Text>
              <Text style={[styles.reportSheetSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                {report?.report_date ?? ''}
              </Text>
              <PreliminaryChip status={report?.lineups_status} />
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.reportSheetClose}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.reportSheetScroll}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }}
            showsVerticalScrollIndicator={false}
          >
            {report?.narrative_text ? (
              <Markdown
                style={{
                  body: { color: theme.colors.onSurface, fontSize: 14, lineHeight: 21 },
                  strong: { color: theme.colors.onSurface, fontWeight: '800' },
                  heading1: { color: theme.colors.onSurface, fontSize: 20, fontWeight: '900', marginTop: 14, marginBottom: 8 },
                  heading2: { color: theme.colors.onSurface, fontSize: 17, fontWeight: '900', marginTop: 12, marginBottom: 6 },
                  heading3: { color: theme.colors.onSurface, fontSize: 15, fontWeight: '800', marginTop: 10, marginBottom: 4 },
                  bullet_list: { marginVertical: 4 },
                  ordered_list: { marginVertical: 4 },
                  list_item: { color: theme.colors.onSurface, fontSize: 14 },
                  blockquote: {
                    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.08)',
                    borderLeftColor: GREEN,
                    borderLeftWidth: 3,
                    paddingLeft: 12,
                    paddingVertical: 8,
                    marginVertical: 10,
                    borderRadius: 6,
                  },
                  hr: { backgroundColor: theme.colors.outlineVariant, height: 1, marginVertical: 14 },
                  link: { color: GREEN, textDecorationLine: 'underline' },
                }}
              >
                {report.narrative_text}
              </Markdown>
            ) : null}

            {topPlays ? (
              <View style={styles.reportStructuredWrap}>
                <HRReportSection items={topPlays.hr_opportunities} />
                <HottestBatsSection items={topPlays.hottest_batters} />
                <PitchMatchupsSection items={topPlays.notable_pitch_matchups} />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function MLBPitcherMatchupsScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const matchupOffsetsRef = useRef(new Map<number, number>());
  const [focusedTarget, setFocusedTarget] = useState<FocusedBatterTarget>(null);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const { data: matchups = [], isLoading, error, refetch } = useMLBPitcherMatchups();
  const { data: report = null, isLoading: isReportLoading, refetch: refetchReport } = useMLBPitcherMatchupsReport();
  const benchmarkSeason = useMemo(() => seasonFromDate(matchups[0]?.game?.official_date), [matchups]);
  const { data: benchmarksByHand = {} } = useMLBLeagueBenchmarks(benchmarkSeason);
  const { isPro, isLoading: isProLoading } = useProAccess();
  const { refreshCustomerInfo } = useRevenueCat();
  const filteredMatchups = useMemo(
    () => selectedGamePk == null ? matchups : matchups.filter(matchup => matchup.game.game_pk === selectedGamePk),
    [matchups, selectedGamePk],
  );
  const selectedMatchup = useMemo(
    () => matchups.find(matchup => matchup.game.game_pk === selectedGamePk) ?? null,
    [matchups, selectedGamePk],
  );
  const selectedLabel = selectedMatchup ? matchupLabel(selectedMatchup) : 'All games';

  useEffect(() => {
    if (!isProLoading && !isPro) {
      presentPaywallForPlacementIfNeeded(ENTITLEMENT_IDENTIFIER, PAYWALL_PLACEMENTS.GENERIC_FEATURE)
        .then(result => {
          if (didPaywallGrantEntitlement(result)) return refreshCustomerInfo();
        })
        .catch(err => console.error('Error presenting paywall:', err));
    }
  }, [isPro, isProLoading, refreshCustomerInfo]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(drawer)/(tabs)' as any);
    }
  };

  const handleFilterSelect = (gamePk: number | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGamePk(gamePk);
    setFocusedTarget(null);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 60);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.navContainer, { height: insets.top + 56, paddingTop: insets.top }]}>
        <AndroidBlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.navBlur, { borderBottomColor: theme.colors.outlineVariant }]}
        >
          <TouchableOpacity onPress={handleBack} style={styles.navButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.navTitleWrap}>
            <Text style={[styles.navTitle, { color: theme.colors.onSurface }]}>Pitcher Matchups</Text>
            <Text style={[styles.navSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Archetypes, pitcher profile, top bats
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              refetch();
              refetchReport();
            }}
            style={styles.navButton}
          >
            <MaterialCommunityIcons name="refresh" size={22} color={theme.colors.onSurface} />
          </TouchableOpacity>
        </AndroidBlurView>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ marginTop: insets.top + 56 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={GREEN} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && matchups.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
              Loading pitcher matchups...
            </Text>
          </View>
        ) : error ? (
          <ErrorState error={error} />
        ) : matchups.length === 0 ? (
          <NoGamesTerminal context="feed_mlb" />
        ) : (
          <>
            <PitcherMatchupsReportCard
              report={report}
              isLoading={isReportLoading}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setReportVisible(true);
              }}
            />
            <MatchupFilterButton
              selectedLabel={selectedLabel}
              onPress={() => setFilterVisible(true)}
            />
            <View style={{ gap: 18 }}>
              {filteredMatchups.map(matchup => (
                <MatchupCard
                  key={matchup.game.game_pk}
                  matchup={matchup}
                  benchmarksByHand={benchmarksByHand}
                  focusedTarget={focusedTarget}
                  onLayout={(event) => {
                    matchupOffsetsRef.current.set(matchup.game.game_pk, event.nativeEvent.layout.y);
                  }}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <MatchupFilterModal
        visible={filterVisible}
        matchups={matchups}
        selectedGamePk={selectedGamePk}
        onSelect={handleFilterSelect}
        onDismiss={() => setFilterVisible(false)}
      />
      <PitcherMatchupsReportSheet
        visible={reportVisible}
        report={report}
        onDismiss={() => setReportVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  navBlur: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleWrap: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 17, fontWeight: '800' },
  navSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { fontSize: 13, fontWeight: '600' },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 8,
    alignItems: 'flex-start',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  errorBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  reportCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  reportCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCardText: {
    flex: 1,
    minWidth: 0,
  },
  reportCardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  reportCardTeaser: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  reportCardMeta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  reportLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  reportChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  preliminaryChip: {
    overflow: 'hidden',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${AMBER}80`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: AMBER,
    fontSize: 10,
    fontWeight: '900',
  },
  reportGamesChip: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '900',
  },
  reportSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    height: '94%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  reportSheetHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  reportSheetTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  reportSheetTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  reportSheetSubtitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  reportSheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportSheetScroll: {
    flex: 1,
  },
  reportStructuredWrap: {
    gap: 14,
    marginTop: 8,
  },
  reportStructuredSection: {
    gap: 8,
  },
  reportStructuredTitle: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reportRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
  },
  reportRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportRowTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  reportScorePill: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  reportRowMeta: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 5,
  },
  reportLimitedTag: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: `${AMBER}22`,
    color: AMBER,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 6,
  },
  matchupFilterButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchupFilterTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  matchupFilterEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  matchupFilterLabel: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  matchupFilterIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  matchupFilterSheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  matchupFilterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  matchupFilterSheetTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  matchupFilterClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchupFilterOptions: {
    maxHeight: 420,
  },
  matchupFilterOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  matchupFilterOptionTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  matchupFilterOptionMeta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  matchupFilterOptionTime: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 5,
  },
  topSummaryWrap: {
    gap: 12,
    marginBottom: 18,
  },
  topPlaySection: {
    gap: 8,
  },
  topPlayTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  topPlayScroll: {
    gap: 10,
    paddingRight: 12,
  },
  topPlayCard: {
    width: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  topPlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topPlayName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  scorePill: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  topPlayContext: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  topPlayDetail: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    marginTop: 4,
  },
  emptyTopPlayCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  emptyTopPlayText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  matchupWrap: { gap: 10 },
  matchupTitle: { fontSize: 19, fontWeight: '900' },
  matchupSubtitle: { fontSize: 12, fontWeight: '600', marginTop: -6 },
  pitcherPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  pitcherHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pitcherHeadshot: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#334155',
  },
  pitcherHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  teamLabel: { fontSize: 11, fontWeight: '800' },
  pitcherName: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  pitcherTapHint: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  archBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 148,
  },
  archBadgeText: { fontSize: 11, fontWeight: '900' },
  description: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  sampleWarning: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  pitcherTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pitcherTag: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '900',
  },
  pitcherTopPitches: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  pitcherExpanded: {
    gap: 9,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.28)',
  },
  pitcherArsenalRows: {
    gap: 12,
  },
  pitcherArsenalSection: {
    gap: 7,
  },
  pitcherArsenalSectionTitle: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    color: GREEN,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pitcherArsenalRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.24)',
    paddingBottom: 8,
  },
  pitcherArsenalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pitcherArsenalPitch: {
    fontSize: 12,
    fontWeight: '900',
  },
  pitcherArsenalSplit: {
    fontSize: 10,
    fontWeight: '800',
  },
  pitcherArsenalStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pitcherArsenalStat: {
    fontSize: 10,
    fontWeight: '800',
  },
  pitcherArsenalFootnote: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    width: '48%',
    borderRadius: 12,
    padding: 10,
  },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontWeight: '900', marginTop: 3 },
  subhead: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  batterChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  batterTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headshot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#334155',
  },
  batterMain: {
    flex: 1,
    minWidth: 0,
  },
  batterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batterName: { flex: 1, fontSize: 13, fontWeight: '800' },
  batterHand: { fontSize: 10, fontWeight: '800' },
  batterMeta: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  insightChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  insightChip: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '800',
  },
  batterExpanded: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.28)',
  },
  expandedSection: {
    gap: 7,
    marginTop: 4,
    marginBottom: 12,
  },
  expandedTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  expandedHelp: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailStatCell: {
    width: '31%',
    minWidth: 88,
  },
  detailStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  detailStatValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  priorityStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  shadedStatCell: {
    width: '31%',
    minWidth: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  shadedStatValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  recentMini: {
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
  compactBattedBallRow: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
  },
  compactBattedBallText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  last10Block: {
    gap: 7,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  last10Sample: {
    fontSize: 10,
    fontWeight: '800',
  },
  recentTrendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recentTrendChip: {
    width: '48.5%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  recentTrendLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  recentTrendValue: {
    fontSize: 10,
    fontWeight: '900',
    flexShrink: 0,
  },
  noDataText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  deltaLine: {
    borderRadius: 10,
    padding: 9,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  pitchRows: {
    gap: 7,
  },
  pitchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.24)',
  },
  pitchName: {
    minWidth: 70,
    fontSize: 11,
    fontWeight: '900',
  },
  pitchStat: {
    fontSize: 10,
    fontWeight: '700',
  },
  batterStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  batterStat: {
    fontSize: 11,
    fontWeight: '800',
  },
  recentLine: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyText: { fontSize: 12, fontWeight: '600', fontStyle: 'italic' },
});
