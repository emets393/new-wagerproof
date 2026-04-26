import React, { ReactNode, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useProAccess } from '@/hooks/useProAccess';
import { useMLBRegressionReport } from '@/hooks/useMLBRegressionReport';
import type {
  PitcherRegression, BattingRegression, BullpenFatigue, SuggestedPick,
  YesterdayRecap, CumulativeRecord, PerfectStorm, WeatherParkFlag, LRSplitEntry,
} from '@/hooks/useMLBRegressionReport';
import { useMLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import { useMLBSeriesSignals, type MLBSeriesSignal } from '@/hooks/useMLBSeriesSignals';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { useScroll } from '@/contexts/ScrollContext';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';

// ── Color tokens ────────────────────────────────────────────────
const WAGERPROOF_GREEN = '#00E676';
const WIN_GREEN = '#22c55e';
const LOSS_RED = '#ef4444';
const WARN_AMBER = '#f59e0b';
const NEUTRAL_GRAY = '#6b7280';
const ACCENT_BLUE = '#3b82f6';
const ACCENT_PURPLE = '#a855f7';
const ACCENT_INDIGO = '#6366f1';
const ACCENT_CYAN = '#06b6d4';
const ACCENT_YELLOW = '#eab308';
const ACCENT_ORANGE = '#f97316';

// ── Helpers ─────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function winPctColor(pct: number): string {
  if (pct >= 65) return WIN_GREEN;
  if (pct >= 55) return ACCENT_YELLOW;
  if (pct >= 50) return ACCENT_ORANGE;
  return LOSS_RED;
}

function severityColor(severity?: string): string {
  if (severity === 'severe') return LOSS_RED;
  if (severity === 'moderate') return WARN_AMBER;
  return WIN_GREEN;
}

function betTypeLabel(bt: string): string {
  const labels: Record<string, string> = {
    full_ml: 'Full ML', full_ou: 'Full O/U', f5_ml: 'F5 ML', f5_ou: 'F5 O/U',
  };
  return labels[bt] || bt;
}

// Picks a single representative weather icon from the flag strings.
function weatherIconForFlags(flags: string[]): keyof typeof MaterialCommunityIcons.glyphMap {
  const joined = flags.join(' ').toLowerCase();
  if (joined.includes('rain')) return 'weather-pouring';
  if (joined.includes('wind') && joined.includes('out')) return 'weather-windy-variant';
  if (joined.includes('wind')) return 'weather-windy';
  if (joined.includes('cold') || joined.includes('snow')) return 'snowflake';
  if (joined.includes('hot') || joined.includes('heat')) return 'white-balance-sunny';
  if (joined.includes('dome') || joined.includes('roof')) return 'home-roof';
  if (joined.includes('humid')) return 'water-percent';
  return 'weather-partly-cloudy';
}

// ── Shared primitives ───────────────────────────────────────────

// Pinned section header. Opaque bg so it covers scrolling content when sticky.
// paddingTop: insets.top keeps the title below the status bar when pinned at y=0.
function SectionHeader({
  icon, iconColor, title, rightSlot, topInset,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  title: string;
  rightSlot?: ReactNode;
  topInset: number;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  return (
    <View
      style={[
        styles.sectionHeader,
        {
          backgroundColor: theme.colors.background,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          paddingTop: topInset + 10,
        },
      ]}
    >
      <View style={[styles.sectionHeaderIconWrap, { backgroundColor: `${iconColor}22` }]}>
        <MaterialCommunityIcons name={icon} size={14} color={iconColor} />
      </View>
      <Text style={[styles.sectionHeaderTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
        {title}
      </Text>
      {rightSlot ? <View style={styles.sectionHeaderRight}>{rightSlot}</View> : null}
    </View>
  );
}

// Row with a colored left-edge bar + soft-fill content area.
// Used for picks, regression rows, bullpen rows, splits, storms.
function AccentBarRow({
  color, children, style,
}: {
  color: string;
  children: ReactNode;
  style?: any;
}) {
  const { isDark } = useThemeContext();
  const bg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  return (
    <View style={[styles.accentRow, { backgroundColor: bg }, style]}>
      <View style={[styles.accentBar, { backgroundColor: color }]} />
      <View style={styles.accentContent}>{children}</View>
    </View>
  );
}

function Stat({
  label, value, valueColor, flex,
}: {
  label: string;
  value: string;
  valueColor?: string;
  flex?: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: flex ?? 1, minWidth: 60 }}>
      <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: valueColor ?? theme.colors.onSurface }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StatRow({ children, style }: { children: ReactNode; style?: any }) {
  return <View style={[styles.statRow, style]}>{children}</View>;
}

// iOS-style segmented control. Active tab has a raised tile bg.
function SegmentedTabs<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  return (
    <View
      style={[
        styles.segmented,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
      ]}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(opt.value);
            }}
            style={[
              styles.segmentedTab,
              active && {
                backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                shadowColor: '#000',
                shadowOpacity: isDark ? 0.3 : 0.08,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentedText,
                {
                  color: active ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                  fontWeight: active ? '700' : '500',
                },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Pill({
  label, color, bg, small,
}: {
  label: string;
  color: string;
  bg: string;
  small?: boolean;
}) {
  return (
    <View
      style={[
        small ? styles.pillSmall : styles.pill,
        { backgroundColor: bg, borderColor: `${color}55` },
      ]}
    >
      <Text
        style={[small ? styles.pillTextSmall : styles.pillText, { color }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// Small inline group label: "DUE FOR NEGATIVE REGRESSION · 3"
function GroupLabel({
  label, count, color, note,
}: {
  label: string;
  count?: number;
  color?: string;
  note?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.groupLabelWrap}>
      <View style={styles.groupLabelRow}>
        {color ? <View style={[styles.groupLabelDot, { backgroundColor: color }]} /> : null}
        <Text style={[styles.groupLabelText, { color: color ?? theme.colors.onSurfaceVariant }]}>
          {label}
        </Text>
        {count != null ? (
          <Text style={[styles.groupLabelCount, { color: theme.colors.onSurfaceVariant }]}>
            {count}
          </Text>
        ) : null}
      </View>
      {note ? (
        <Text style={[styles.groupLabelNote, { color: theme.colors.onSurfaceVariant }]}>{note}</Text>
      ) : null}
    </View>
  );
}

// Large stat tile used in hero rows.
function HeroTile({
  label, primary, primaryColor, secondary, secondaryColor,
}: {
  label: string;
  primary: string;
  primaryColor?: string;
  secondary?: ReactNode;
  secondaryColor?: string;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  return (
    <View
      style={[
        styles.heroTile,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
      ]}
    >
      <Text style={[styles.heroTileLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.heroTilePrimary, { color: primaryColor ?? theme.colors.onSurface }]}>
        {primary}
      </Text>
      {secondary != null ? (
        <Text style={[styles.heroTileSecondary, { color: secondaryColor ?? theme.colors.onSurfaceVariant }]}>
          {secondary}
        </Text>
      ) : null}
    </View>
  );
}

// Wrapper for section bodies — horizontal edge padding + top/bottom breath.
function SectionBody({ children, style }: { children: ReactNode; style?: any }) {
  return <View style={[styles.sectionBody, style]}>{children}</View>;
}

// ── Section bodies ──────────────────────────────────────────────

// AI analysis — full-width markdown with no card container. Keeps blockquote highlight.
function NarrativeBody({ text }: { text: string }) {
  const { isDark } = useThemeContext();
  const theme = useTheme();
  return (
    <View style={styles.narrativeBody}>
      <Markdown
        style={{
          body: { color: theme.colors.onSurface, fontSize: 14, lineHeight: 21 },
          strong: { color: theme.colors.onSurface, fontWeight: '700' },
          heading1: { color: theme.colors.onSurface, fontSize: 19, fontWeight: '700', marginTop: 14, marginBottom: 8 },
          heading2: { color: theme.colors.onSurface, fontSize: 17, fontWeight: '700', marginTop: 12, marginBottom: 6 },
          heading3: { color: theme.colors.onSurface, fontSize: 15, fontWeight: '600', marginTop: 10, marginBottom: 4 },
          bullet_list: { marginVertical: 4 },
          list_item: { color: theme.colors.onSurface, fontSize: 14 },
          blockquote: {
            backgroundColor: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)',
            borderLeftColor: ACCENT_PURPLE,
            borderLeftWidth: 3,
            paddingLeft: 12,
            paddingVertical: 8,
            marginVertical: 10,
            borderRadius: 6,
          },
          hr: { backgroundColor: theme.colors.outlineVariant, height: 1, marginVertical: 14 },
          link: { color: ACCENT_PURPLE, textDecorationLine: 'underline' },
        }}
      >
        {text}
      </Markdown>
    </View>
  );
}

function RecapBody({
  recap, cumulative,
}: {
  recap: YesterdayRecap[];
  cumulative?: CumulativeRecord | null;
}) {
  const theme = useTheme();

  const wins = recap.filter(r => r.result === 'won').length;
  const losses = recap.filter(r => r.result === 'lost').length;
  const pushes = recap.filter(r => r.result === 'push').length;
  const total = wins + losses;
  const yPct = total > 0 ? (wins / total) * 100 : 0;
  const yRecord = pushes > 0 ? `${wins}-${losses}-${pushes}` : `${wins}-${losses}`;

  const cum = cumulative?.total;
  const cumRecord = cum ? (cum.pushes > 0 ? `${cum.wins}-${cum.losses}-${cum.pushes}` : `${cum.wins}-${cum.losses}`) : null;
  const cumUnits = cum?.units_won ?? 0;
  const cumRoi = cum?.roi_pct ?? 0;

  return (
    <SectionBody>
      <View style={styles.heroRow}>
        <HeroTile
          label="YESTERDAY"
          primary={yRecord}
          secondary={total > 0 ? `${yPct.toFixed(0)}% win rate` : 'No graded picks'}
          secondaryColor={total > 0 ? winPctColor(yPct) : undefined}
        />
        {cumRecord ? (
          <HeroTile
            label="ALL-TIME"
            primary={cumRecord}
            secondary={
              <Text>
                <Text style={{ color: cumUnits >= 0 ? WIN_GREEN : LOSS_RED }}>
                  {cumUnits >= 0 ? '+' : ''}{cumUnits.toFixed(2)}u
                </Text>
                {'  ·  '}
                <Text style={{ color: cumRoi >= 0 ? WIN_GREEN : LOSS_RED }}>
                  {cumRoi >= 0 ? '+' : ''}{cumRoi.toFixed(1)}%
                </Text>
              </Text>
            }
          />
        ) : null}
      </View>

      {recap.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          No picks graded yesterday.
        </Text>
      ) : (
        <View style={{ marginTop: 12, gap: 6 }}>
          {recap.map((r, i) => {
            const barColor = r.result === 'won' ? WIN_GREEN : r.result === 'lost' ? LOSS_RED : NEUTRAL_GRAY;
            return (
              <AccentBarRow key={i} color={barColor}>
                <View style={styles.recapRowInner}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.recapPick, { color: theme.colors.onSurface }]} numberOfLines={1}>
                      {r.pick}
                    </Text>
                    <Text
                      style={[styles.recapMatchup, { color: theme.colors.onSurfaceVariant }]}
                      numberOfLines={1}
                    >
                      {r.matchup}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.recapScore, { color: theme.colors.onSurface }]}>
                      {r.actual_score}
                    </Text>
                    <Text style={[styles.recapResult, { color: barColor }]}>
                      {r.result.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </AccentBarRow>
            );
          })}
        </View>
      )}
    </SectionBody>
  );
}

function AccuracyBody() {
  const { data: accuracy, isLoading } = useMLBBucketAccuracy();
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [activeTab, setActiveTab] = useState<'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou'>('full_ml');

  if (isLoading) {
    return (
      <SectionBody>
        <ActivityIndicator color={theme.colors.primary} />
      </SectionBody>
    );
  }
  if (!accuracy) return null;

  const betTypes = ['full_ml', 'full_ou', 'f5_ml', 'f5_ou'] as const;
  const activeData = accuracy[activeTab];
  const activeBuckets =
    activeData?.by_bucket?.filter(b => b.games >= 3).sort((a, b) => b.win_pct - a.win_pct) ?? [];

  return (
    <SectionBody>
      <View style={styles.accuracyGrid}>
        {betTypes.map(bt => {
          const data = accuracy[bt];
          if (!data) return null;
          const roi = data.overall.roi_pct ?? 0;
          const units = data.overall.units_won ?? 0;
          return (
            <View
              key={bt}
              style={[
                styles.accuracyTile,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
              ]}
            >
              <Text style={[styles.accuracyTileLabel, { color: theme.colors.onSurfaceVariant }]}>
                {betTypeLabel(bt).toUpperCase()}
              </Text>
              <Text style={[styles.accuracyTilePct, { color: winPctColor(data.overall.win_pct) }]}>
                {data.overall.win_pct}%
              </Text>
              <Text style={[styles.accuracyTileRecord, { color: theme.colors.onSurface }]}>
                {data.overall.wins}-{data.overall.games - data.overall.wins}
              </Text>
              <Text
                style={[
                  styles.accuracyTileRoi,
                  { color: roi >= 0 ? WIN_GREEN : LOSS_RED },
                ]}
              >
                {roi > 0 ? '+' : ''}{roi}%  ·  {units > 0 ? '+' : ''}{units}u
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: 14 }}>
        <SegmentedTabs
          options={betTypes.map(bt => ({ value: bt, label: betTypeLabel(bt) }))}
          value={activeTab}
          onChange={setActiveTab}
        />
      </View>

      {activeBuckets.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          No buckets with 3+ graded games yet.
        </Text>
      ) : (
        <View style={{ marginTop: 12 }}>
          <View style={styles.bucketHeaderRow}>
            <Text style={[styles.bucketHeaderCell, { color: theme.colors.onSurfaceVariant, flex: 2.2 }]}>
              BUCKET
            </Text>
            <Text style={[styles.bucketHeaderCell, { color: theme.colors.onSurfaceVariant, width: 62, textAlign: 'right' }]}>
              RECORD
            </Text>
            <Text style={[styles.bucketHeaderCell, { color: theme.colors.onSurfaceVariant, width: 48, textAlign: 'right' }]}>
              W%
            </Text>
            <Text style={[styles.bucketHeaderCell, { color: theme.colors.onSurfaceVariant, width: 56, textAlign: 'right' }]}>
              ROI
            </Text>
          </View>
          {activeBuckets.map((b, i) => {
            const label = [b.bucket, b.side, b.fav_dog, b.direction].filter(Boolean).join(' / ');
            const roi = b.roi_pct ?? 0;
            return (
              <View
                key={i}
                style={[
                  styles.bucketRow,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                ]}
              >
                <Text
                  style={[styles.bucketCell, { color: theme.colors.onSurface, flex: 2.2 }]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                <Text
                  style={[
                    styles.bucketCell,
                    { color: theme.colors.onSurfaceVariant, width: 62, textAlign: 'right' },
                  ]}
                >
                  {b.wins}-{b.games - b.wins}
                </Text>
                <Text
                  style={[
                    styles.bucketCell,
                    { color: winPctColor(b.win_pct), width: 48, textAlign: 'right', fontWeight: '700' },
                  ]}
                >
                  {b.win_pct}%
                </Text>
                <Text
                  style={[
                    styles.bucketCell,
                    { color: roi >= 0 ? WIN_GREEN : LOSS_RED, width: 56, textAlign: 'right', fontWeight: '600' },
                  ]}
                >
                  {roi > 0 ? '+' : ''}{roi}%
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </SectionBody>
  );
}

function PicksBody({ picks }: { picks: SuggestedPick[] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { data: bucketAccuracy } = useMLBBucketAccuracy();
  const perfectStormOverall = bucketAccuracy?.perfect_storm?.overall;

  if (!picks?.length) {
    return (
      <SectionBody>
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          No picks meet the confidence threshold for today's slate.
        </Text>
      </SectionBody>
    );
  }

  return (
    <SectionBody>
      <View style={{ gap: 10 }}>
        {picks.map((p, i) => {
          const confColor = p.confidence_at_suggestion === 'high' ? WIN_GREEN : WARN_AMBER;
          const timeLabel = p.game_time_et
            ? new Date(p.game_time_et).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'America/New_York',
              }) + ' ET'
            : null;
          const edgeStr = `${p.edge_at_suggestion > 0 ? '+' : ''}${p.edge_at_suggestion}${
            p.bet_type.includes('ml') ? '%' : ''
          }`;
          const isPerfectStorm = (p.edge_bucket || '').toLowerCase() === 'perfect_storm';
          const bucketPct = isPerfectStorm
            ? perfectStormOverall && perfectStormOverall.games > 0
              ? perfectStormOverall.win_pct
              : null
            : p.bucket_win_pct;

          return (
            <AccentBarRow
              key={i}
              color={confColor}
              style={{ opacity: p.locked ? 0.6 : 1 }}
            >
              <View style={styles.pickHeaderRow}>
                <Text
                  style={[styles.pickTitle, { color: theme.colors.onSurface }]}
                  numberOfLines={2}
                >
                  {p.pick}
                </Text>
                {timeLabel ? (
                  <View style={styles.pickTimeRow}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={12}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text style={[styles.pickTimeText, { color: theme.colors.onSurfaceVariant }]}>
                      {timeLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.pickMatchup, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                {p.away_team} @ {p.home_team}
              </Text>

              <StatRow style={{ marginTop: 10 }}>
                <Stat label="EDGE" value={edgeStr} />
                <Stat
                  label="BUCKET"
                  value={isPerfectStorm ? 'Perfect\nStorm' : p.edge_bucket}
                />
                <Stat
                  label="BUCKET W%"
                  value={bucketPct != null ? `${bucketPct}%` : 'N/A'}
                  valueColor={bucketPct != null ? winPctColor(bucketPct) : undefined}
                />
              </StatRow>

              {p.reasoning ? (
                <View
                  style={[
                    styles.reasoningQuote,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      borderLeftColor: confColor,
                    },
                  ]}
                >
                  <Text style={[styles.reasoningText, { color: theme.colors.onSurface }]}>
                    {p.reasoning}
                  </Text>
                </View>
              ) : null}

              <View style={styles.pickFooter}>
                <View style={[styles.pickBetTypeTag, { backgroundColor: `${confColor}1a` }]}>
                  <Text style={[styles.pickBetTypeText, { color: confColor }]}>
                    {betTypeLabel(p.bet_type)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.pickConfTag,
                    { backgroundColor: `${confColor}1a` },
                  ]}
                >
                  <Text style={[styles.pickConfText, { color: confColor }]}>
                    {p.confidence_at_suggestion.toUpperCase()} CONF
                  </Text>
                </View>
                {p.locked ? (
                  <View style={styles.lockedTag}>
                    <MaterialCommunityIcons name="lock" size={10} color={theme.colors.onSurfaceVariant} />
                    <Text style={[styles.lockedText, { color: theme.colors.onSurfaceVariant }]}>LOCKED</Text>
                  </View>
                ) : null}
              </View>
            </AccentBarRow>
          );
        })}
      </View>
    </SectionBody>
  );
}

function PitcherRow({ p }: { p: PitcherRegression }) {
  const theme = useTheme();
  const sev = severityColor(p.severity);
  const gap = p.era_minus_xfip;
  const gapColor = gap > 0.5 ? LOSS_RED : gap < -0.5 ? WIN_GREEN : undefined;
  const trendColor =
    p.trend_xfip != null
      ? p.trend_xfip > 0.3
        ? LOSS_RED
        : p.trend_xfip < -0.3
          ? WIN_GREEN
          : undefined
      : undefined;

  return (
    <AccentBarRow color={sev}>
      <View style={styles.rowHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {p.pitcher_name}
            <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>
              {'  '}{p.team_name}
            </Text>
          </Text>
          {p.opponent ? (
            <Text style={[styles.rowSubtitle, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
              vs {p.opponent}
            </Text>
          ) : null}
        </View>
        <Pill label={p.severity.toUpperCase()} color={sev} bg={`${sev}1a`} small />
      </View>
      <StatRow style={{ marginTop: 10 }}>
        <Stat label="ERA" value={p.era?.toFixed(2) ?? '-'} />
        <Stat label="xFIP" value={p.xfip?.toFixed(2) ?? '-'} />
        <Stat
          label="GAP"
          value={gap != null ? `${gap > 0 ? '+' : ''}${gap.toFixed(2)}` : '-'}
          valueColor={gapColor}
        />
        <Stat label="xwOBA" value={p.xwoba?.toFixed(3) ?? '-'} />
      </StatRow>
      <StatRow style={{ marginTop: 8 }}>
        <Stat label="WHIP" value={p.whip?.toFixed(2) ?? '-'} />
        <Stat label="K%" value={p.k_pct != null ? `${p.k_pct.toFixed(1)}%` : '-'} />
        <Stat label="BB%" value={p.bb_pct != null ? `${p.bb_pct.toFixed(1)}%` : '-'} />
        <Stat
          label="xFIP L3"
          value={
            p.trend_xfip != null
              ? `${p.trend_xfip > 0 ? '+' : ''}${p.trend_xfip.toFixed(2)}`
              : '-'
          }
          valueColor={trendColor}
        />
      </StatRow>
    </AccentBarRow>
  );
}

function PitcherRegressionBody({
  negative, positive,
}: {
  negative: PitcherRegression[];
  positive: PitcherRegression[];
}) {
  return (
    <SectionBody>
      {negative.length > 0 ? (
        <View style={{ gap: 8 }}>
          <GroupLabel
            label="DUE FOR NEGATIVE REGRESSION"
            count={negative.length}
            color={LOSS_RED}
            note="ERA too low vs xFIP — been lucky"
          />
          {negative.map((p, i) => <PitcherRow key={`neg-${i}`} p={p} />)}
        </View>
      ) : null}
      {positive.length > 0 ? (
        <View style={{ gap: 8, marginTop: negative.length > 0 ? 16 : 0 }}>
          <GroupLabel
            label="DUE FOR POSITIVE REGRESSION"
            count={positive.length}
            color={WIN_GREEN}
            note="ERA too high vs xFIP — been unlucky"
          />
          {positive.map((p, i) => <PitcherRow key={`pos-${i}`} p={p} />)}
        </View>
      ) : null}
    </SectionBody>
  );
}

function BattingRow({ t }: { t: BattingRegression }) {
  const theme = useTheme();
  const sev = severityColor(t.severity);
  const gap = t.woba_gap;
  const gapColor = gap != null ? (gap > 0.03 ? LOSS_RED : gap < -0.03 ? WIN_GREEN : undefined) : undefined;
  const trendColor =
    t.trend_xwobacon != null
      ? t.trend_xwobacon > 0.015
        ? WIN_GREEN
        : t.trend_xwobacon < -0.015
          ? LOSS_RED
          : undefined
      : undefined;

  return (
    <AccentBarRow color={sev}>
      <View style={styles.rowHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {t.team_name}
          </Text>
          <Text style={[styles.rowSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {t.games}G sample
          </Text>
        </View>
        {t.severity ? <Pill label={t.severity.toUpperCase()} color={sev} bg={`${sev}1a`} small /> : null}
      </View>
      <StatRow style={{ marginTop: 10 }}>
        <Stat label="wOBA" value={t.woba?.toFixed(3) ?? '-'} />
        <Stat label="BABIP" value={t.babip?.toFixed(3) ?? '-'} />
        <Stat label="xwOBACon" value={t.xwobacon?.toFixed(3) ?? '-'} />
        <Stat
          label="GAP"
          value={gap != null ? `${gap > 0 ? '+' : ''}${gap.toFixed(3)}` : '-'}
          valueColor={gapColor}
        />
      </StatRow>
      <StatRow style={{ marginTop: 8 }}>
        <Stat
          label="HH%"
          value={t.hard_hit_pct != null ? `${(t.hard_hit_pct * 100).toFixed(1)}%` : '-'}
        />
        <Stat
          label="BARREL%"
          value={t.barrel_pct != null ? `${(t.barrel_pct * 100).toFixed(1)}%` : '-'}
        />
        <Stat label="EV" value={t.avg_ev?.toFixed(1) ?? '-'} />
        <Stat
          label="xwC L5"
          value={
            t.trend_xwobacon != null
              ? `${t.trend_xwobacon > 0 ? '+' : ''}${t.trend_xwobacon.toFixed(3)}`
              : '-'
          }
          valueColor={trendColor}
        />
      </StatRow>
    </AccentBarRow>
  );
}

function BattingRegressionBody({
  heatUp, coolDown,
}: {
  heatUp: BattingRegression[];
  coolDown: BattingRegression[];
}) {
  return (
    <SectionBody>
      {heatUp.length > 0 ? (
        <View style={{ gap: 8 }}>
          <GroupLabel
            label="DUE TO HEAT UP"
            count={heatUp.length}
            color={WIN_GREEN}
            note="Low BABIP + strong contact quality"
          />
          {heatUp.map((t, i) => <BattingRow key={`heat-${i}`} t={t} />)}
        </View>
      ) : null}
      {coolDown.length > 0 ? (
        <View style={{ gap: 8, marginTop: heatUp.length > 0 ? 16 : 0 }}>
          <GroupLabel
            label="DUE TO COOL DOWN"
            count={coolDown.length}
            color={LOSS_RED}
            note="High BABIP + weak contact quality"
          />
          {coolDown.map((t, i) => <BattingRow key={`cool-${i}`} t={t} />)}
        </View>
      ) : null}
    </SectionBody>
  );
}

function BullpenBody({ bullpens }: { bullpens: BullpenFatigue[] }) {
  const theme = useTheme();
  if (!bullpens?.length) return null;
  return (
    <SectionBody>
      <View style={{ gap: 8 }}>
        {bullpens.map((b, i) => {
          const barColor = b.flag === 'overworked' ? LOSS_RED : WARN_AMBER;
          const trendColor =
            b.trend_bp_xfip != null
              ? b.trend_bp_xfip > 0
                ? LOSS_RED
                : WIN_GREEN
              : undefined;
          return (
            <AccentBarRow key={i} color={barColor}>
              <View style={styles.rowHead}>
                <Text style={[styles.rowTitle, { color: theme.colors.onSurface, flex: 1 }]} numberOfLines={1}>
                  {b.team_name}
                </Text>
                <Pill
                  label={b.flag === 'overworked' ? 'OVERWORKED' : 'DECLINING'}
                  color={barColor}
                  bg={`${barColor}1a`}
                  small
                />
              </View>
              <StatRow style={{ marginTop: 10 }}>
                <Stat
                  label="IP L3d"
                  value={b.bp_ip_last3d?.toFixed(1) ?? '-'}
                  valueColor={b.bp_ip_last3d >= 13 ? LOSS_RED : undefined}
                />
                <Stat
                  label="IP L5d"
                  value={b.bp_ip_last5d?.toFixed(1) ?? '-'}
                  valueColor={b.bp_ip_last5d >= 22 ? LOSS_RED : undefined}
                />
                <Stat label="SEASON xFIP" value={b.season_bp_xfip?.toFixed(2) ?? '-'} />
                <Stat
                  label="TREND xFIP"
                  value={
                    b.trend_bp_xfip != null
                      ? `${b.trend_bp_xfip > 0 ? '+' : ''}${b.trend_bp_xfip.toFixed(2)}`
                      : '-'
                  }
                  valueColor={trendColor}
                />
              </StatRow>
            </AccentBarRow>
          );
        })}
      </View>
    </SectionBody>
  );
}

function SplitRow({ s, notable }: { s: LRSplitEntry; notable: boolean }) {
  const theme = useTheme();
  const record =
    s.f5_ties > 0
      ? `F5 ${s.f5_wins}-${s.f5_losses}-${s.f5_ties}`
      : `F5 ${s.f5_wins}-${s.f5_losses}`;
  const winColor =
    s.f5_win_pct != null
      ? s.f5_win_pct >= 60
        ? WIN_GREEN
        : s.f5_win_pct <= 40
          ? LOSS_RED
          : theme.colors.onSurface
      : theme.colors.onSurface;
  return (
    <AccentBarRow color={notable ? ACCENT_INDIGO : 'transparent'}>
      <View style={styles.splitRowInner}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.splitTeam, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {s.team_name}
            <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '500' }}>
              {'  '}{s.facing}
            </Text>
          </Text>
          <Text style={[styles.splitOpp, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            vs {s.opponent_sp || s.opponent}
            {s.opponent_sp_hand ? ` (${s.opponent_sp_hand}HP)` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.splitRuns, { color: theme.colors.onSurface }]}>
            {s.avg_f5_runs} R/G
          </Text>
          <Text style={[styles.splitRecord, { color: winColor }]}>
            {record}
            {s.f5_win_pct != null ? `  ${s.f5_win_pct}%` : ''}
          </Text>
        </View>
      </View>
    </AccentBarRow>
  );
}

function LRSplitsBody({ splits }: { splits: LRSplitEntry[] }) {
  if (!splits?.length) return null;
  const notable = splits.filter(s => s.is_notable);
  const rest = splits.filter(s => !s.is_notable);
  return (
    <SectionBody>
      {notable.length > 0 ? (
        <View style={{ gap: 8 }}>
          <GroupLabel
            label="NOTABLE MATCHUPS"
            count={notable.length}
            color={ACCENT_INDIGO}
            note="Favorable or difficult splits worth flagging"
          />
          {notable.map((s, i) => <SplitRow key={`n-${i}`} s={s} notable />)}
        </View>
      ) : null}
      {rest.length > 0 ? (
        <View style={{ gap: 6, marginTop: notable.length > 0 ? 16 : 0 }}>
          <GroupLabel label="ALL OTHER SPLITS" count={rest.length} />
          {rest.map((s, i) => <SplitRow key={`r-${i}`} s={s} notable={false} />)}
        </View>
      ) : null}
    </SectionBody>
  );
}

function PerfectStormBody({ storms }: { storms: PerfectStorm[] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  if (!storms?.length) return null;
  return (
    <SectionBody>
      <View style={{ gap: 10 }}>
        {storms.map((s, i) => {
          const directionColor = s.direction.includes('RUNS') ? LOSS_RED : ACCENT_BLUE;
          return (
            <AccentBarRow key={i} color={ACCENT_YELLOW}>
              <View style={styles.rowHead}>
                <Text
                  style={[styles.rowTitle, { color: theme.colors.onSurface, flex: 1 }]}
                  numberOfLines={2}
                >
                  {s.matchup}
                </Text>
                <Pill
                  label={s.direction}
                  color={directionColor}
                  bg={`${directionColor}1a`}
                  small
                />
              </View>
              <View style={styles.stormScoreRow}>
                <MaterialCommunityIcons name="lightning-bolt" size={14} color={ACCENT_YELLOW} />
                <Text style={[styles.stormScore, { color: theme.colors.onSurface }]}>
                  {s.storm_score}<Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '500' }}>/10</Text>
                </Text>
                <Text style={[styles.stormScoreLabel, { color: theme.colors.onSurfaceVariant }]}>
                  storm score
                </Text>
              </View>
              <View
                style={[
                  styles.stormNarrative,
                  {
                    backgroundColor: isDark ? 'rgba(234,179,8,0.08)' : 'rgba(234,179,8,0.10)',
                    borderLeftColor: ACCENT_YELLOW,
                  },
                ]}
              >
                <Text style={[styles.stormNarrativeText, { color: theme.colors.onSurface }]}>
                  {s.narrative}
                </Text>
              </View>
            </AccentBarRow>
          );
        })}
      </View>
    </SectionBody>
  );
}

// G2/G3 series-position signals from the live mlb_game_signals view. Pulled
// independently of the regression report's external Python ETL so today's
// carryover/regression patterns are always current with the latest definitions.
function SeriesSignalsBody({ signals }: { signals: MLBSeriesSignal[] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  if (!signals?.length) return null;
  // Order: positive (back) signals first so users see actionable plays before fades.
  const positives = signals.filter(s => s.severity === 'positive');
  const negatives = signals.filter(s => s.severity === 'negative');
  const ordered = [...positives, ...negatives];
  return (
    <SectionBody>
      <View style={{ gap: 10 }}>
        {ordered.map((s, i) => {
          const positive = s.severity === 'positive';
          const accent = positive ? WIN_GREEN : LOSS_RED;
          const tint = positive ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)';
          return (
            <AccentBarRow key={`${s.game_pk}-${s.team_side}-${i}`} color={accent}>
              <View style={styles.rowHead}>
                <Text
                  style={[styles.rowTitle, { color: theme.colors.onSurface, flex: 1 }]}
                  numberOfLines={2}
                >
                  {s.matchup}
                </Text>
                <Pill
                  label={positive ? '★ BACK' : '⚠ FADE'}
                  color={accent}
                  bg={`${accent}26`}
                  small
                />
              </View>
              <View
                style={{
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: isDark ? tint : tint,
                  borderLeftWidth: 3,
                  borderLeftColor: accent,
                }}
              >
                <Text style={{ color: theme.colors.onSurface, fontSize: 13, lineHeight: 18 }}>
                  {s.message}
                </Text>
              </View>
            </AccentBarRow>
          );
        })}
      </View>
    </SectionBody>
  );
}

function WeatherBody({ flags }: { flags: WeatherParkFlag[] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  if (!flags?.length) return null;
  return (
    <SectionBody>
      <View style={{ gap: 8 }}>
        {flags.map((f, i) => {
          const icon = weatherIconForFlags(f.flags);
          return (
            <View
              key={i}
              style={[
                styles.weatherCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                },
              ]}
            >
              <View style={[styles.weatherIconWrap, { backgroundColor: `${ACCENT_CYAN}22` }]}>
                <MaterialCommunityIcons name={icon} size={22} color={ACCENT_CYAN} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.weatherMatchup, { color: theme.colors.onSurface }]} numberOfLines={1}>
                  {f.matchup}
                </Text>
                <Text style={[styles.weatherVenue, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                  {f.venue}
                </Text>
                <View style={styles.weatherFlagRow}>
                  {f.flags.map((fl, j) => (
                    <View
                      key={j}
                      style={[
                        styles.weatherFlagChip,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                      ]}
                    >
                      <Text style={[styles.weatherFlagText, { color: theme.colors.onSurface }]}>
                        {fl}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </SectionBody>
  );
}

// ── Main screen ─────────────────────────────────────────────────

export default function MLBRegressionReportScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: report, isLoading, error, refetch } = useMLBRegressionReport();
  // Series signals come from a live view independent of the regression-report ETL,
  // so today's G2/G3 carryover patterns appear here even when the LLM narrative
  // doesn't mention them.
  const { data: seriesSignals = [] } = useMLBSeriesSignals();
  const { isPro, isLoading: isProLoading } = useProAccess();
  const { refreshCustomerInfo } = useRevenueCat();
  const { scrollY } = useScroll();

  const HEADER_HEIGHT = 56;
  const TOTAL_HEADER_HEIGHT = insets.top + HEADER_HEIGHT;

  // Nav bar stays fixed. ScrollView is offset below it via marginTop so sticky
  // section headers pin flush with the bottom of the nav bar — not behind the
  // status bar. Trade-off: no fade-out animation on the nav, but sticky headers
  // land correctly on notched devices.
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

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
    router.back();
  };
  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refetch();
  };

  // Build children + stickyHeaderIndices dynamically so empty sections are skipped entirely.
  const children: ReactNode[] = [];
  const stickyHeaderIndices: number[] = [];

  if (report) {
    children.push(
      <View key="date-row" style={[styles.dateRow, { paddingTop: 14 }]}>
        <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
          {new Date(report.report_date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }).toUpperCase()}
        </Text>
      </View>,
    );

    const pushSection = (
      key: string,
      header: ReactNode,
      body: ReactNode,
    ) => {
      stickyHeaderIndices.push(children.length);
      children.push(header);
      children.push(body);
    };

    if (report.narrative_text) {
      pushSection(
        'ai',
        <SectionHeader
          key="ai-h"
          icon="lightning-bolt"
          iconColor={ACCENT_PURPLE}
          title="AI Analysis Summary"
          topInset={0}
        />,
        <NarrativeBody key="ai-b" text={report.narrative_text} />,
      );
    }

    if (report.yesterday_recap) {
      pushSection(
        'recap',
        <SectionHeader
          key="recap-h"
          icon="trophy"
          iconColor={ACCENT_YELLOW}
          title="Yesterday's Results"
          topInset={0}
        />,
        <RecapBody
          key="recap-b"
          recap={report.yesterday_recap}
          cumulative={report.cumulative_record}
        />,
      );
    }

    pushSection(
      'accuracy',
      <SectionHeader
        key="acc-h"
        icon="chart-bar"
        iconColor={ACCENT_BLUE}
        title="Model Accuracy"
        topInset={0}
      />,
      <AccuracyBody key="acc-b" />,
    );

    pushSection(
      'picks',
      <SectionHeader
        key="picks-h"
        icon="target"
        iconColor={WIN_GREEN}
        title="Today's Suggested Picks"
        rightSlot={
          report.suggested_picks?.length ? (
            <Text style={[styles.sectionHeaderCount, { color: theme.colors.onSurfaceVariant }]}>
              {report.suggested_picks.length}
            </Text>
          ) : undefined
        }
        topInset={0}
      />,
      <PicksBody key="picks-b" picks={report.suggested_picks} />,
    );

    const hasPitcherData =
      (report.pitcher_negative_regression?.length ?? 0) > 0 ||
      (report.pitcher_positive_regression?.length ?? 0) > 0;
    if (hasPitcherData) {
      pushSection(
        'pitchers',
        <SectionHeader
          key="pitch-h"
          icon="fire"
          iconColor={ACCENT_ORANGE}
          title="Starting Pitcher Regression"
          topInset={0}
        />,
        <PitcherRegressionBody
          key="pitch-b"
          negative={report.pitcher_negative_regression ?? []}
          positive={report.pitcher_positive_regression ?? []}
        />,
      );
    }

    const hasBattingData =
      (report.batting_heat_up?.length ?? 0) > 0 ||
      (report.batting_cool_down?.length ?? 0) > 0;
    if (hasBattingData) {
      pushSection(
        'batting',
        <SectionHeader
          key="bat-h"
          icon="trending-up"
          iconColor={ACCENT_BLUE}
          title="Team Batting Regression"
          topInset={0}
        />,
        <BattingRegressionBody
          key="bat-b"
          heatUp={report.batting_heat_up ?? []}
          coolDown={report.batting_cool_down ?? []}
        />,
      );
    }

    if (report.bullpen_fatigue?.length) {
      pushSection(
        'bullpen',
        <SectionHeader
          key="bp-h"
          icon="shield-outline"
          iconColor={ACCENT_PURPLE}
          title="Bullpen Fatigue & Trends"
          topInset={0}
        />,
        <BullpenBody key="bp-b" bullpens={report.bullpen_fatigue} />,
      );
    }

    if (report.lr_splits_today?.length) {
      pushSection(
        'splits',
        <SectionHeader
          key="lr-h"
          icon="target-variant"
          iconColor={ACCENT_INDIGO}
          title="L/R Pitcher Splits"
          topInset={0}
        />,
        <LRSplitsBody key="lr-b" splits={report.lr_splits_today} />,
      );
    }

    if (report.perfect_storm_matchups?.length) {
      pushSection(
        'storm',
        <SectionHeader
          key="ps-h"
          icon="weather-lightning"
          iconColor={ACCENT_YELLOW}
          title="Perfect Storm Matchups"
          topInset={0}
        />,
        <PerfectStormBody key="ps-b" storms={report.perfect_storm_matchups} />,
      );
    }

    if (seriesSignals.length) {
      pushSection(
        'series',
        <SectionHeader
          key="series-h"
          icon="target"
          iconColor={ACCENT_PURPLE}
          title="Series-Position Signals"
          topInset={0}
        />,
        <SeriesSignalsBody key="series-b" signals={seriesSignals} />,
      );
    }

    if (report.weather_park_flags?.length) {
      pushSection(
        'weather',
        <SectionHeader
          key="w-h"
          icon="weather-windy"
          iconColor={ACCENT_CYAN}
          title="Weather & Park Impact"
          topInset={0}
        />,
        <WeatherBody key="w-b" flags={report.weather_park_flags} />,
      );
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Fixed top nav. Sits above the ScrollView (which is offset below via marginTop),
          so sticky section headers pin to the bottom edge of this nav — not behind
          the status bar. */}
      <View
        style={[
          styles.navContainer,
          {
            height: TOTAL_HEADER_HEIGHT,
            paddingTop: insets.top,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <AndroidBlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.navBlur, { borderBottomColor: theme.colors.outlineVariant }]}
        >
          <View style={styles.navContent}>
            <TouchableOpacity onPress={handleBack} style={styles.navIconBtn}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.onSurface} />
            </TouchableOpacity>
            <View style={styles.navTitleWrap}>
              <Text style={[styles.navTitle, { color: theme.colors.onSurface }]}>
                MLB Regression Report
              </Text>
              {report ? (
                <Text style={[styles.navSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Updated {timeAgo(report.generated_at)}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={handleRefresh} style={styles.navIconBtn}>
              <MaterialCommunityIcons name="refresh" size={22} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
        </AndroidBlurView>
      </View>

      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={stickyHeaderIndices}
        style={{ marginTop: TOTAL_HEADER_HEIGHT }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ paddingTop: 80, alignItems: 'center' }}>
            <ActivityIndicator color={WAGERPROOF_GREEN} size="large" />
            <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
              Loading report…
            </Text>
          </View>
        ) : error ? (
          <View style={[styles.errorBox, { marginTop: 40 }]}>
            <MaterialCommunityIcons name="alert-circle" size={22} color={LOSS_RED} />
            <Text style={[styles.errorText, { color: theme.colors.onSurface }]}>
              Failed to load regression report.
            </Text>
          </View>
        ) : !report ? (
          <View style={[styles.errorBox, { marginTop: 40 }]}>
            <MaterialCommunityIcons name="information-outline" size={22} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.errorText, { color: theme.colors.onSurface }]}>
              No regression report available yet. Reports generate at 9 AM, 11 AM, and 4 PM ET.
            </Text>
          </View>
        ) : (
          children
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Top nav
  navContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
    // Shadow/elevation gives the nav a subtle edge when content scrolls below it
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  navBlur: { flex: 1, borderBottomWidth: 1 },
  navContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  navIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitleWrap: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 16, fontWeight: '700' },
  navSubtitle: { fontSize: 11, marginTop: 1 },

  // Loading / error
  loadingText: { marginTop: 12, fontSize: 13 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    marginHorizontal: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.20)',
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Date row
  dateRow: { paddingHorizontal: 16, paddingBottom: 4 },
  dateText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },

  // Sticky section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  sectionHeaderIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  sectionHeaderRight: { marginLeft: 'auto' },
  sectionHeaderCount: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Section body wrapper
  sectionBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },

  // Narrative
  narrativeBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },

  // Hero row (Recap hero)
  heroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroTile: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 80,
  },
  heroTileLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTilePrimary: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroTileSecondary: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },

  // Accent bar row — universal row primitive
  accentRow: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
  },
  accentBar: { width: 3 },
  accentContent: { flex: 1, padding: 12 },

  // Row head (title + optional right pill)
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSubtitle: { fontSize: 12, marginTop: 1 },

  // Stats
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Recap pick list
  recapRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recapPick: { fontSize: 13, fontWeight: '600' },
  recapMatchup: { fontSize: 11, marginTop: 1 },
  recapScore: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '600' },
  recapResult: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Accuracy tiles
  accuracyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accuracyTile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
  },
  accuracyTileLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  accuracyTilePct: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  accuracyTileRecord: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  accuracyTileRoi: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  // Segmented tabs
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    gap: 2,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentedText: { fontSize: 12 },

  // Bucket table
  bucketHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  bucketHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  bucketCell: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },

  // Picks
  pickHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  pickTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.1,
  },
  pickTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  pickTimeText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pickMatchup: { fontSize: 12, marginTop: 2 },
  reasoningQuote: {
    marginTop: 10,
    borderLeftWidth: 2,
    borderRadius: 6,
    paddingLeft: 10,
    paddingVertical: 8,
    paddingRight: 8,
  },
  reasoningText: { fontSize: 12, lineHeight: 17 },
  pickFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  pickBetTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pickBetTypeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pickConfTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pickConfText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  lockedText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Pills
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  pillSmall: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillTextSmall: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },

  // Group labels
  groupLabelWrap: { marginBottom: 2 },
  groupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupLabelDot: { width: 6, height: 6, borderRadius: 3 },
  groupLabelText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  groupLabelCount: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginLeft: 'auto',
  },
  groupLabelNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 3,
  },

  // Splits
  splitRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  splitTeam: { fontSize: 13, fontWeight: '700' },
  splitOpp: { fontSize: 11, marginTop: 1 },
  splitRuns: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  splitRecord: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },

  // Perfect Storm
  stormScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    marginBottom: 4,
  },
  stormScore: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  stormScoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stormNarrative: {
    marginTop: 6,
    borderLeftWidth: 2,
    borderRadius: 6,
    paddingLeft: 10,
    paddingVertical: 8,
    paddingRight: 8,
  },
  stormNarrativeText: { fontSize: 12, lineHeight: 17 },

  // Weather
  weatherCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    alignItems: 'flex-start',
  },
  weatherIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherMatchup: { fontSize: 14, fontWeight: '700' },
  weatherVenue: { fontSize: 12, marginTop: 1 },
  weatherFlagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  weatherFlagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  weatherFlagText: { fontSize: 10, fontWeight: '600' },

  // Empty
  emptyText: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
