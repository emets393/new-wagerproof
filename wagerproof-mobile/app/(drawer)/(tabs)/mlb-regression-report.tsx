import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, ScrollView } from 'react-native';
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
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { useScroll } from '@/contexts/ScrollContext';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';

const WAGERPROOF_GREEN = '#00E676';

// ── Helpers ──────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function winPctColor(pct: number): string {
  if (pct >= 65) return '#22c55e';
  if (pct >= 55) return '#eab308';
  if (pct >= 50) return '#f97316';
  return '#ef4444';
}

function severityBgColor(severity: string | undefined, isDark: boolean): { bg: string; border: string } {
  if (severity === 'severe') return { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)' };
  if (severity === 'moderate') return { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' };
  return { bg: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.25)' };
}

function severityBadgeColor(severity: string | undefined): string {
  if (severity === 'severe') return '#ef4444';
  if (severity === 'moderate') return '#f59e0b';
  return '#22c55e';
}

function betTypeLabel(bt: string): string {
  const labels: Record<string, string> = {
    full_ml: 'Full ML', full_ou: 'Full O/U', f5_ml: 'F5 ML', f5_ou: 'F5 O/U',
  };
  return labels[bt] || bt;
}

// ── Reusable UI ─────────────────────────────────────────────────

function SectionCard({
  icon, iconColor, title, subtitle, children,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: isDark ? '#2a2a2a' : '#e8e8e8' }]}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>{title}</Text>
      </View>
      {subtitle ? <Text style={[styles.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function Collapsible({
  title, defaultOpen = true, color, countBadge, children,
}: {
  title: string;
  defaultOpen?: boolean;
  color?: string;
  countBadge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen(!open); }}
        style={styles.collapseTrigger}
        activeOpacity={0.7}
      >
        <Text style={[styles.collapseTitle, { color: color || theme.colors.onSurface }]}>{title}</Text>
        {countBadge}
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.onSurfaceVariant}
          style={{ marginLeft: 'auto' }}
        />
      </TouchableOpacity>
      {open ? <View style={{ marginTop: 8 }}>{children}</View> : null}
    </View>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function StatCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor || theme.colors.onSurface }]}>{value}</Text>
    </View>
  );
}

// ── Section components ──────────────────────────────────────────

function NarrativeSection({ text }: { text: string }) {
  const { isDark } = useThemeContext();
  const theme = useTheme();
  return (
    <SectionCard icon="lightning-bolt" iconColor="#a855f7" title="AI Analysis Summary">
      <Markdown
        style={{
          body: { color: theme.colors.onSurface, fontSize: 13, lineHeight: 19 },
          strong: { color: theme.colors.onSurface, fontWeight: '700' },
          heading1: { color: theme.colors.onSurface, fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 6 },
          heading2: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 6 },
          heading3: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 4 },
          bullet_list: { marginVertical: 4 },
          list_item: { color: theme.colors.onSurface, fontSize: 13 },
          blockquote: {
            backgroundColor: isDark ? 'rgba(168,85,247,0.10)' : 'rgba(168,85,247,0.06)',
            borderLeftColor: '#a855f7', borderLeftWidth: 3,
            paddingLeft: 10, paddingVertical: 6, marginVertical: 8, borderRadius: 4,
          },
          hr: { backgroundColor: theme.colors.outlineVariant, height: 1, marginVertical: 12 },
        }}
      >
        {text}
      </Markdown>
    </SectionCard>
  );
}

function RecapSection({ recap, cumulative }: { recap: YesterdayRecap[]; cumulative?: CumulativeRecord | null }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  if (!recap?.length) return null;
  const wins = recap.filter(r => r.result === 'won').length;
  const losses = recap.filter(r => r.result === 'lost').length;
  const pushes = recap.filter(r => r.result === 'push').length;
  const total = wins + losses;
  const pct = total > 0 ? (wins / total * 100).toFixed(1) : '0.0';

  const cum = cumulative?.total;
  const cumRecord = cum ? (cum.pushes > 0 ? `${cum.wins}-${cum.losses}-${cum.pushes}` : `${cum.wins}-${cum.losses}`) : null;
  const cumUnits = cum?.units_won ?? 0;
  const cumRoi = cum?.roi_pct ?? 0;

  return (
    <SectionCard icon="trophy" iconColor="#eab308" title="Yesterday's Results">
      <View style={styles.recapHeaderRow}>
        <Pill
          label={`${wins}-${losses}${pushes ? `-${pushes}P` : ''} (${pct}%)`}
          color={theme.colors.onSurface}
          bg={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        />
      </View>
      {cumRecord && (
        <View style={styles.recapCumulativeRow}>
          <Text style={[styles.cumulativeLabel, { color: theme.colors.onSurfaceVariant }]}>All-time:</Text>
          <Text style={[styles.cumulativeValue, { color: theme.colors.onSurface }]}>{cumRecord}</Text>
          <Text style={[styles.cumulativeValue, { color: cumUnits >= 0 ? '#22c55e' : '#ef4444' }]}>
            {cumUnits >= 0 ? '+' : ''}{cumUnits.toFixed(2)}u
          </Text>
          <Text style={[styles.cumulativeValue, { color: cumRoi >= 0 ? '#22c55e' : '#ef4444' }]}>
            {cumRoi >= 0 ? '+' : ''}{cumRoi.toFixed(1)}% ROI
          </Text>
        </View>
      )}
      <View style={{ marginTop: 8 }}>
        {recap.map((r, i) => {
          const resultColor = r.result === 'won' ? '#22c55e' : r.result === 'lost' ? '#ef4444' : '#6b7280';
          return (
            <View key={i} style={[styles.recapRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.recapPick, { color: theme.colors.onSurface }]} numberOfLines={1}>{r.pick}</Text>
                <Text style={[styles.recapMatchup, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>{r.matchup}</Text>
              </View>
              <Text style={[styles.recapScore, { color: theme.colors.onSurfaceVariant }]}>{r.actual_score}</Text>
              <Pill label={r.result.toUpperCase()} color="#fff" bg={resultColor} />
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}

function AccuracyDashboardSection() {
  const { data: accuracy, isLoading } = useMLBBucketAccuracy();
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [activeTab, setActiveTab] = useState<'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou'>('full_ml');

  if (isLoading) {
    return (
      <SectionCard icon="chart-bar" iconColor="#3b82f6" title="Model Accuracy">
        <ActivityIndicator color={theme.colors.primary} />
      </SectionCard>
    );
  }
  if (!accuracy) return null;

  const betTypes = ['full_ml', 'full_ou', 'f5_ml', 'f5_ou'] as const;
  const activeData = accuracy[activeTab];
  const activeBuckets = activeData?.by_bucket?.filter(b => b.games >= 3).sort((a, b) => b.win_pct - a.win_pct) ?? [];

  return (
    <SectionCard icon="chart-bar" iconColor="#3b82f6" title="Model Accuracy">
      <View style={styles.accuracyGrid}>
        {betTypes.map(bt => {
          const data = accuracy[bt];
          if (!data) return null;
          const roi = data.overall.roi_pct ?? 0;
          const units = data.overall.units_won ?? 0;
          return (
            <View key={bt} style={[styles.accuracyCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
              <Text style={[styles.accuracyCardLabel, { color: theme.colors.onSurfaceVariant }]}>{betTypeLabel(bt)}</Text>
              <Text style={[styles.accuracyCardPct, { color: winPctColor(data.overall.win_pct) }]}>{data.overall.win_pct}%</Text>
              <Text style={[styles.accuracyCardRecord, { color: theme.colors.onSurfaceVariant }]}>
                {data.overall.wins}-{data.overall.games - data.overall.wins}
              </Text>
              <Text style={[styles.accuracyCardRoi, { color: roi >= 0 ? '#22c55e' : '#ef4444' }]}>
                ROI {roi > 0 ? '+' : ''}{roi}% ({units > 0 ? '+' : ''}{units}u)
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.tabRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
        {betTypes.map(bt => (
          <TouchableOpacity
            key={bt}
            onPress={() => setActiveTab(bt)}
            style={[
              styles.tabPill,
              activeTab === bt && { backgroundColor: isDark ? '#2a2a2a' : '#fff' },
            ]}
          >
            <Text style={[styles.tabPillText, { color: activeTab === bt ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
              {betTypeLabel(bt)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {activeBuckets.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No buckets with 3+ games yet</Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          <View style={[styles.bucketRow, styles.bucketHeaderRow]}>
            <Text style={[styles.bucketCellLabel, { color: theme.colors.onSurfaceVariant, flex: 2 }]}>Bucket</Text>
            <Text style={[styles.bucketCellLabel, { color: theme.colors.onSurfaceVariant, flex: 1, textAlign: 'center' }]}>Record</Text>
            <Text style={[styles.bucketCellLabel, { color: theme.colors.onSurfaceVariant, flex: 1, textAlign: 'center' }]}>Win%</Text>
            <Text style={[styles.bucketCellLabel, { color: theme.colors.onSurfaceVariant, flex: 1, textAlign: 'right' }]}>ROI%</Text>
          </View>
          {activeBuckets.map((b, i) => {
            const label = [b.bucket, b.side, b.fav_dog, b.direction].filter(Boolean).join(' / ');
            const roi = b.roi_pct ?? 0;
            return (
              <View key={i} style={[styles.bucketRow, { borderBottomColor: isDark ? '#222' : '#eee' }]}>
                <Text style={[styles.bucketCell, { color: theme.colors.onSurface, flex: 2 }]}>{label}</Text>
                <Text style={[styles.bucketCell, { color: theme.colors.onSurfaceVariant, flex: 1, textAlign: 'center' }]}>
                  {b.wins}-{b.games - b.wins}
                </Text>
                <Text style={[styles.bucketCell, { color: winPctColor(b.win_pct), flex: 1, textAlign: 'center', fontWeight: '700' }]}>
                  {b.win_pct}%
                </Text>
                <Text style={[styles.bucketCell, { color: roi >= 0 ? '#22c55e' : '#ef4444', flex: 1, textAlign: 'right', fontWeight: '600' }]}>
                  {roi > 0 ? '+' : ''}{roi}%
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </SectionCard>
  );
}

function PicksSection({ picks }: { picks: SuggestedPick[] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  if (!picks?.length) {
    return (
      <SectionCard icon="target" iconColor="#22c55e" title="Today's Suggested Picks">
        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          No picks meet the confidence threshold for today's slate.
        </Text>
      </SectionCard>
    );
  }
  return (
    <SectionCard icon="target" iconColor="#22c55e" title="Today's Suggested Picks" subtitle={`${picks.length} plays`}>
      {picks.map((p, i) => {
        const confColor = p.confidence_at_suggestion === 'high' ? '#22c55e' : '#f59e0b';
        const timeLabel = p.game_time_et
          ? new Date(p.game_time_et).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'
          : null;
        return (
          <View
            key={i}
            style={[
              styles.pickCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderColor: p.locked ? (isDark ? '#333' : '#ccc') : 'rgba(168,85,247,0.3)',
                opacity: p.locked ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.pickCardHeader}>
              <Text style={[styles.pickTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>{p.pick}</Text>
              <Pill label={p.confidence_at_suggestion.toUpperCase()} color="#fff" bg={confColor} />
            </View>
            <View style={styles.pickMeta}>
              <Text style={[styles.pickMetaText, { color: theme.colors.onSurfaceVariant }]}>
                {p.away_team} @ {p.home_team}
              </Text>
              {timeLabel ? (
                <View style={styles.pickTimeRow}>
                  <MaterialCommunityIcons name="clock-outline" size={12} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.pickMetaText, { color: theme.colors.onSurfaceVariant }]}>{timeLabel}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.pickStats}>
              <StatCell label="Edge" value={`${p.edge_at_suggestion > 0 ? '+' : ''}${p.edge_at_suggestion}${p.bet_type.includes('ml') ? '%' : ''}`} />
              <StatCell label="Bucket" value={p.edge_bucket} />
              {(p.edge_bucket || '').toLowerCase() === 'perfect_storm' ? (
                <StatCell label="Bucket W%" value="N/A" />
              ) : (
                <StatCell label="Bucket W%" value={`${p.bucket_win_pct}%`} valueColor={winPctColor(p.bucket_win_pct)} />
              )}
            </View>
            {p.reasoning ? (
              <Text style={[styles.pickReasoning, { color: theme.colors.onSurfaceVariant }]}>{p.reasoning}</Text>
            ) : null}
            <Text style={[styles.pickSuggestedAt, { color: theme.colors.onSurfaceVariant }]}>
              {betTypeLabel(p.bet_type)}{p.locked ? ' · LOCKED' : ''}
            </Text>
          </View>
        );
      })}
    </SectionCard>
  );
}

function PitcherRow({ p }: { p: PitcherRegression }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const sev = severityBgColor(p.severity, isDark);
  const gap = p.era_minus_xfip;
  const gapColor = gap > 0.5 ? '#ef4444' : gap < -0.5 ? '#22c55e' : theme.colors.onSurface;
  return (
    <View style={[styles.dataRow, { backgroundColor: sev.bg, borderColor: sev.border }]}>
      <View style={styles.dataRowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.dataRowTitle, { color: theme.colors.onSurface }]}>
            {p.pitcher_name} <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>({p.team_name})</Text>
          </Text>
          {p.opponent ? (
            <Text style={[styles.dataRowSubtitle, { color: theme.colors.onSurfaceVariant }]}>vs {p.opponent}</Text>
          ) : null}
        </View>
        <Pill label={p.severity.toUpperCase()} color="#fff" bg={severityBadgeColor(p.severity)} />
      </View>
      <View style={styles.statGrid}>
        <StatCell label="ERA" value={p.era?.toFixed(2) ?? '-'} />
        <StatCell label="xFIP" value={p.xfip?.toFixed(2) ?? '-'} />
        <StatCell label="Gap" value={`${gap > 0 ? '+' : ''}${gap?.toFixed(2)}`} valueColor={gapColor} />
        <StatCell label="xwOBA" value={p.xwoba?.toFixed(3) ?? '-'} />
        <StatCell label="WHIP" value={p.whip?.toFixed(2) ?? '-'} />
        <StatCell label="K%" value={p.k_pct != null ? `${p.k_pct.toFixed(1)}%` : '-'} />
        <StatCell label="BB%" value={p.bb_pct != null ? `${p.bb_pct.toFixed(1)}%` : '-'} />
        <StatCell
          label="xFIP L3"
          value={p.trend_xfip != null ? `${p.trend_xfip > 0 ? '+' : ''}${p.trend_xfip.toFixed(2)}` : '-'}
          valueColor={p.trend_xfip != null ? (p.trend_xfip > 0.3 ? '#ef4444' : p.trend_xfip < -0.3 ? '#22c55e' : undefined) : undefined}
        />
      </View>
    </View>
  );
}

function PitcherRegressionSection({ negative, positive }: { negative: PitcherRegression[]; positive: PitcherRegression[] }) {
  const theme = useTheme();
  if (!negative.length && !positive.length) return null;
  return (
    <SectionCard icon="fire" iconColor="#f97316" title="Starting Pitcher Regression">
      {negative.length > 0 && (
        <Collapsible
          title={`Due for Negative Regression (${negative.length})`}
          color="#ef4444"
          defaultOpen={true}
        >
          <Text style={[styles.inlineNote, { color: theme.colors.onSurfaceVariant }]}>ERA too low vs xFIP — been lucky</Text>
          {negative.map((p, i) => <PitcherRow key={i} p={p} />)}
        </Collapsible>
      )}
      {positive.length > 0 && (
        <Collapsible
          title={`Due for Positive Regression (${positive.length})`}
          color="#22c55e"
          defaultOpen={true}
        >
          <Text style={[styles.inlineNote, { color: theme.colors.onSurfaceVariant }]}>ERA too high vs xFIP — been unlucky</Text>
          {positive.map((p, i) => <PitcherRow key={i} p={p} />)}
        </Collapsible>
      )}
    </SectionCard>
  );
}

function BattingRow({ t }: { t: BattingRegression }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const sev = severityBgColor(t.severity, isDark);
  const gap = t.woba_gap;
  const gapColor = gap != null ? (gap > 0.03 ? '#ef4444' : gap < -0.03 ? '#22c55e' : theme.colors.onSurface) : theme.colors.onSurface;
  return (
    <View style={[styles.dataRow, { backgroundColor: sev.bg, borderColor: sev.border }]}>
      <View style={styles.dataRowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.dataRowTitle, { color: theme.colors.onSurface }]}>{t.team_name}</Text>
          <Text style={[styles.dataRowSubtitle, { color: theme.colors.onSurfaceVariant }]}>{t.games}G</Text>
        </View>
        {t.severity ? <Pill label={t.severity.toUpperCase()} color="#fff" bg={severityBadgeColor(t.severity)} /> : null}
      </View>
      <View style={styles.statGrid}>
        <StatCell label="wOBA" value={t.woba?.toFixed(3) ?? '-'} />
        <StatCell label="BABIP" value={t.babip?.toFixed(3) ?? '-'} />
        <StatCell label="xwOBACon" value={t.xwobacon?.toFixed(3) ?? '-'} />
        <StatCell label="Gap" value={gap != null ? `${gap > 0 ? '+' : ''}${gap.toFixed(3)}` : '-'} valueColor={gapColor} />
        <StatCell label="HH%" value={t.hard_hit_pct != null ? `${(t.hard_hit_pct * 100).toFixed(1)}%` : '-'} />
        <StatCell label="Barrel%" value={t.barrel_pct != null ? `${(t.barrel_pct * 100).toFixed(1)}%` : '-'} />
        <StatCell label="EV" value={t.avg_ev?.toFixed(1) ?? '-'} />
        <StatCell
          label="xwC L5"
          value={t.trend_xwobacon != null ? `${t.trend_xwobacon > 0 ? '+' : ''}${t.trend_xwobacon.toFixed(3)}` : '-'}
          valueColor={t.trend_xwobacon != null ? (t.trend_xwobacon > 0.015 ? '#22c55e' : t.trend_xwobacon < -0.015 ? '#ef4444' : undefined) : undefined}
        />
      </View>
    </View>
  );
}

function BattingRegressionSection({ heatUp, coolDown }: { heatUp: BattingRegression[]; coolDown: BattingRegression[] }) {
  const theme = useTheme();
  if (!heatUp.length && !coolDown.length) return null;
  return (
    <SectionCard icon="trending-up" iconColor="#3b82f6" title="Team Batting Regression">
      {heatUp.length > 0 && (
        <Collapsible title={`Due to Heat Up (${heatUp.length})`} color="#22c55e" defaultOpen={true}>
          <Text style={[styles.inlineNote, { color: theme.colors.onSurfaceVariant }]}>Low BABIP + high contact quality</Text>
          {heatUp.map((t, i) => <BattingRow key={i} t={t} />)}
        </Collapsible>
      )}
      {coolDown.length > 0 && (
        <Collapsible title={`Due to Cool Down (${coolDown.length})`} color="#ef4444" defaultOpen={true}>
          <Text style={[styles.inlineNote, { color: theme.colors.onSurfaceVariant }]}>High BABIP + weak contact quality</Text>
          {coolDown.map((t, i) => <BattingRow key={i} t={t} />)}
        </Collapsible>
      )}
    </SectionCard>
  );
}

function BullpenFatigueSection({ bullpens }: { bullpens: BullpenFatigue[] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  if (!bullpens?.length) return null;
  return (
    <SectionCard icon="shield-outline" iconColor="#a855f7" title="Bullpen Fatigue & Trends">
      {bullpens.map((b, i) => (
        <View
          key={i}
          style={[
            styles.dataRow,
            {
              backgroundColor: b.flag === 'overworked' ? 'rgba(239,68,68,0.08)' : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
              borderColor: b.flag === 'overworked' ? 'rgba(239,68,68,0.25)' : (isDark ? '#2a2a2a' : '#e8e8e8'),
            },
          ]}
        >
          <View style={styles.dataRowHeader}>
            <Text style={[styles.dataRowTitle, { color: theme.colors.onSurface, flex: 1 }]}>{b.team_name}</Text>
            <Pill
              label={b.flag === 'overworked' ? 'OVERWORKED' : 'DECLINING'}
              color="#fff"
              bg={b.flag === 'overworked' ? '#ef4444' : '#f59e0b'}
            />
          </View>
          <View style={styles.statGrid}>
            <StatCell
              label="IP L3d"
              value={b.bp_ip_last3d?.toFixed(1) ?? '-'}
              valueColor={b.bp_ip_last3d >= 13 ? '#ef4444' : undefined}
            />
            <StatCell
              label="IP L5d"
              value={b.bp_ip_last5d?.toFixed(1) ?? '-'}
              valueColor={b.bp_ip_last5d >= 22 ? '#ef4444' : undefined}
            />
            <StatCell label="Season xFIP" value={b.season_bp_xfip?.toFixed(2) ?? '-'} />
            <StatCell
              label="Trend xFIP"
              value={b.trend_bp_xfip != null ? `${b.trend_bp_xfip > 0 ? '+' : ''}${b.trend_bp_xfip.toFixed(2)}` : '-'}
              valueColor={b.trend_bp_xfip != null ? (b.trend_bp_xfip > 0 ? '#ef4444' : '#22c55e') : undefined}
            />
          </View>
        </View>
      ))}
    </SectionCard>
  );
}

function LRSplitsSection({ splits }: { splits: LRSplitEntry[] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  if (!splits?.length) return null;
  const notable = splits.filter(s => s.is_notable);
  const rest = splits.filter(s => !s.is_notable);

  const renderSplitRow = (s: LRSplitEntry, i: number, notable: boolean) => {
    const record = s.f5_ties > 0 ? `F5: ${s.f5_wins}-${s.f5_losses}-${s.f5_ties}` : `F5: ${s.f5_wins}-${s.f5_losses}`;
    const winColor = s.f5_win_pct != null ? (s.f5_win_pct >= 60 ? '#22c55e' : s.f5_win_pct <= 40 ? '#ef4444' : theme.colors.onSurfaceVariant) : theme.colors.onSurfaceVariant;
    return (
      <View
        key={i}
        style={[
          styles.splitRow,
          {
            backgroundColor: notable
              ? (isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.08)')
              : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
            borderColor: notable ? 'rgba(99,102,241,0.30)' : 'transparent',
            borderWidth: notable ? 1 : 0,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.splitTeam, { color: theme.colors.onSurface }]}>
            {s.team_name} <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>{s.facing}</Text>
          </Text>
          <Text style={[styles.splitOpp, { color: theme.colors.onSurfaceVariant }]}>
            vs {s.opponent_sp || s.opponent} ({s.opponent_sp_hand}HP)
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.splitRuns, { color: theme.colors.onSurface }]}>{s.avg_f5_runs} F5 R/G</Text>
          <Text style={[styles.splitRecord, { color: winColor }]}>
            {record}{s.f5_win_pct != null ? ` (${s.f5_win_pct}%)` : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SectionCard
      icon="target-variant"
      iconColor="#6366f1"
      title="L/R Pitcher Splits"
      subtitle="How teams perform vs LHP/RHP this season"
    >
      {notable.length > 0 && (
        <>
          <Text style={[styles.inlineHeader, { color: theme.colors.onSurfaceVariant }]}>NOTABLE MATCHUPS</Text>
          {notable.map((s, i) => renderSplitRow(s, i, true))}
        </>
      )}
      {rest.length > 0 && (
        <Collapsible title={`All splits (${rest.length} more)`} defaultOpen={false}>
          {rest.map((s, i) => renderSplitRow(s, i, false))}
        </Collapsible>
      )}
    </SectionCard>
  );
}

function PerfectStormSection({ storms }: { storms: PerfectStorm[] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  if (!storms?.length) return null;
  return (
    <SectionCard icon="lightning-bolt" iconColor="#eab308" title="Perfect Storm Matchups">
      {storms.map((s, i) => (
        <View
          key={i}
          style={[
            styles.dataRow,
            {
              backgroundColor: isDark ? 'rgba(234,179,8,0.08)' : 'rgba(234,179,8,0.10)',
              borderColor: 'rgba(234,179,8,0.30)',
            },
          ]}
        >
          <View style={styles.dataRowHeader}>
            <Text style={[styles.dataRowTitle, { color: theme.colors.onSurface, flex: 1 }]}>{s.matchup}</Text>
            <Pill
              label={s.direction}
              color="#fff"
              bg={s.direction.includes('RUNS') ? '#ef4444' : '#3b82f6'}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 6 }}>
            <Pill label={`Score ${s.storm_score}/10`} color={theme.colors.onSurface} bg={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} />
          </View>
          <Text style={[styles.pickReasoning, { color: theme.colors.onSurfaceVariant }]}>{s.narrative}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

function WeatherSection({ flags }: { flags: WeatherParkFlag[] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  if (!flags?.length) return null;
  return (
    <SectionCard icon="weather-windy" iconColor="#06b6d4" title="Weather & Park Impact">
      {flags.map((f, i) => (
        <View
          key={i}
          style={[
            styles.dataRow,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? '#2a2a2a' : '#e8e8e8' },
          ]}
        >
          <Text style={[styles.dataRowTitle, { color: theme.colors.onSurface }]}>{f.matchup}</Text>
          <Text style={[styles.dataRowSubtitle, { color: theme.colors.onSurfaceVariant }]}>{f.venue}</Text>
          <View style={styles.flagRow}>
            {f.flags.map((fl, j) => (
              <Pill key={j} label={fl} color={theme.colors.onSurface} bg={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} />
            ))}
          </View>
        </View>
      ))}
    </SectionCard>
  );
}

// ── Main screen ─────────────────────────────────────────────────

export default function MLBRegressionReportScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: report, isLoading, error, refetch } = useMLBRegressionReport();
  const { isPro, isLoading: isProLoading } = useProAccess();
  const { refreshCustomerInfo } = useRevenueCat();
  const { scrollY, scrollYClamped } = useScroll();

  const HEADER_HEIGHT = 56;
  const TOTAL_HEADER_HEIGHT = insets.top + HEADER_HEIGHT;
  const headerTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_HEADER_HEIGHT],
    outputRange: [0, -TOTAL_HEADER_HEIGHT],
    extrapolate: 'clamp',
  });
  const headerOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_HEADER_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true });

  useEffect(() => {
    if (!isProLoading && !isPro) {
      presentPaywallForPlacementIfNeeded(ENTITLEMENT_IDENTIFIER, PAYWALL_PLACEMENTS.GENERIC_FEATURE)
        .then((result) => {
          if (didPaywallGrantEntitlement(result)) return refreshCustomerInfo();
        })
        .catch(err => console.error('Error presenting paywall:', err));
    }
  }, [isPro, isProLoading, refreshCustomerInfo]);

  const handleBack = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); };
  const handleRefresh = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refetch(); };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Animated header */}
      <Animated.View style={[
        styles.headerContainer,
        {
          transform: [{ translateY: headerTranslate }],
          opacity: headerOpacity,
          height: TOTAL_HEADER_HEIGHT,
          paddingTop: insets.top,
        },
      ]}>
        <AndroidBlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.headerBlur, { borderBottomColor: theme.colors.outlineVariant }]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleBack} style={styles.headerIconBtn}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.onSurface} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>MLB Regression Report</Text>
              {report ? (
                <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Updated {timeAgo(report.generated_at)}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={handleRefresh} style={styles.headerIconBtn}>
              <MaterialCommunityIcons name="refresh" size={22} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
        </AndroidBlurView>
      </Animated.View>

      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: TOTAL_HEADER_HEIGHT + 8,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={WAGERPROOF_GREEN} size="large" />
            <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>Loading report…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle" size={22} color="#ef4444" />
            <Text style={[styles.errorText, { color: theme.colors.onSurface }]}>
              Failed to load regression report.
            </Text>
          </View>
        ) : !report ? (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="information-outline" size={22} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.errorText, { color: theme.colors.onSurface }]}>
              No regression report available yet. Reports generate at 9 AM, 11 AM, and 4 PM ET.
            </Text>
          </View>
        ) : (
          <>
            {/* Report date header */}
            <View style={{ paddingHorizontal: 4, marginBottom: 12 }}>
              <Text style={[styles.reportDate, { color: theme.colors.onSurfaceVariant }]}>
                {new Date(report.report_date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                })}
              </Text>
            </View>

            {report.narrative_text ? <NarrativeSection text={report.narrative_text} /> : null}
            <RecapSection recap={report.yesterday_recap} cumulative={report.cumulative_record} />
            <AccuracyDashboardSection />
            <PicksSection picks={report.suggested_picks} />
            <PitcherRegressionSection
              negative={report.pitcher_negative_regression}
              positive={report.pitcher_positive_regression}
            />
            <BattingRegressionSection
              heatUp={report.batting_heat_up}
              coolDown={report.batting_cool_down}
            />
            <BullpenFatigueSection bullpens={report.bullpen_fatigue} />
            <LRSplitsSection splits={report.lr_splits_today} />
            <PerfectStormSection storms={report.perfect_storm_matchups} />
            <WeatherSection flags={report.weather_park_flags} />
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  headerBlur: {
    flex: 1,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.20)',
    marginTop: 40,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  reportDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginBottom: 8,
  },
  collapseTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  collapseTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  recapHeaderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  recapCumulativeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cumulativeLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cumulativeValue: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  recapPick: {
    fontSize: 13,
    fontWeight: '600',
  },
  recapMatchup: {
    fontSize: 11,
    marginTop: 1,
  },
  recapScore: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  accuracyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  accuracyCard: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  accuracyCardLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  accuracyCardPct: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  accuracyCardRecord: {
    fontSize: 11,
    marginTop: 2,
  },
  accuracyCardRoi: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    gap: 2,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  bucketHeaderRow: {
    borderBottomColor: 'transparent',
  },
  bucketCell: {
    fontSize: 12,
  },
  bucketCellLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  emptyText: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  pickCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  pickCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  pickTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  pickMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pickMetaText: {
    fontSize: 12,
  },
  pickTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickStats: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  pickReasoning: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  pickSuggestedAt: {
    fontSize: 10,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  statCell: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 3,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    textAlign: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 4,
    rowGap: 6,
    marginTop: 4,
  },
  dataRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  dataRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dataRowTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  dataRowSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  inlineNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  inlineHeader: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    gap: 8,
  },
  splitTeam: {
    fontSize: 13,
    fontWeight: '600',
  },
  splitOpp: {
    fontSize: 11,
    marginTop: 1,
  },
  splitRuns: {
    fontSize: 13,
    fontWeight: '700',
  },
  splitRecord: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  flagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
});
