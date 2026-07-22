import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useSystemsLeaderboard } from '@/hooks/useAnalysisSystems';
import {
  sampleBadge,
  verdictLabel,
  mlbFilterChipLabels,
  isHotLast10,
  isColdLast10,
  systemTemperature,
  type LeaderboardSystem,
  type SystemRecord,
} from '@/services/analysisSystemsService';

const GREEN = '#22c55e';
const RED = '#ef4444';
const ICE = '#38bdf8';
const GOLD = '#f59e0b';
const MLB_ACCENT = '#002D72';

function recordText(rec: SystemRecord | null): string {
  if (!rec) return '—';
  if (!rec.n) return '0-0 so far';
  const base = `${rec.wins}-${rec.losses}`;
  return rec.pushes > 0 ? `${base}-${rec.pushes}` : base;
}

type SortMode = 'bestROI' | 'bestRecord' | 'mostUnits' | 'hottestStreak';

const SORT_OPTIONS: { id: SortMode; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: 'bestROI', label: 'Best ROI', icon: 'chart-line' },
  { id: 'bestRecord', label: 'Best record', icon: 'percent' },
  { id: 'mostUnits', label: 'Most units', icon: 'lightning-bolt' },
  { id: 'hottestStreak', label: 'Hottest streak', icon: 'fire' },
];

function streakHeat(sys: LeaderboardSystem): number {
  const s = sys.streak;
  if (!s || s.kind !== 'win') return 0;
  return s.len;
}

function sortSystems(systems: LeaderboardSystem[], mode: SortMode): LeaderboardSystem[] {
  const rows = [...systems];
  switch (mode) {
    case 'bestROI':
      return rows; // RPC default
    case 'bestRecord':
      return rows.sort((a, b) => (b.all_time?.hit_pct ?? -1) - (a.all_time?.hit_pct ?? -1));
    case 'mostUnits':
      return rows.sort((a, b) => (b.all_time?.units ?? -Infinity) - (a.all_time?.units ?? -Infinity));
    case 'hottestStreak':
      return rows.sort((a, b) => streakHeat(b) - streakHeat(a));
  }
}

interface SystemsLeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  onApplySystem: (system: LeaderboardSystem) => void;
}

/** Full-screen "MLB Systems Leaderboard". Numbers are grader-computed — never recomputed here. */
export function SystemsLeaderboardModal({ visible, onClose, onApplySystem }: SystemsLeaderboardModalProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { data: systems, isLoading } = useSystemsLeaderboard('mlb', 50, { enabled: visible });
  const [sort, setSort] = useState<SortMode>('bestROI');

  const sorted = useMemo(
    () => (systems ? sortSystems(systems, sort) : []),
    [systems, sort],
  );

  const surface = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? '#2c2c2e' : '#e5e7eb';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: border }]}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>MLB Systems Leaderboard</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={theme.colors.primary} />
          ) : !systems || systems.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              Only shared MLB systems with 10+ games of history appear here. Save a system, turn Share on, and check back once it has enough matching games.
            </Text>
          ) : (
            <>
              <Text style={[styles.sortLabel, { color: theme.colors.onSurfaceVariant }]}>SORT BY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow}>
                {SORT_OPTIONS.map(opt => {
                  const selected = sort === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSort(opt.id);
                      }}
                      style={[
                        styles.sortChip,
                        {
                          backgroundColor: selected ? MLB_ACCENT : isDark ? '#2c2c2e' : '#f3f4f6',
                          borderColor: selected ? MLB_ACCENT : border,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={opt.icon}
                        size={14}
                        color={selected ? '#fff' : theme.colors.onSurface}
                      />
                      <Text
                        style={[
                          styles.sortChipText,
                          { color: selected ? '#fff' : theme.colors.onSurface },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {sorted.map((sys, i) => {
                const at = sys.all_time;
                const roi = at?.roi;
                const units = at?.units;
                const badge = sampleBadge(at?.n);
                const last10 = sys.last10;
                const streak = sys.streak;
                const showStreak = streak && streak.len >= 3;
                const temp = systemTemperature(streak, last10);
                const hotL10 = isHotLast10(last10);
                const coldL10 = isColdLast10(last10);
                const accent =
                  temp === 'fire' ? GREEN : temp === 'ice' ? ICE : roi != null && roi >= 0 ? GREEN : GOLD;
                const chips = mlbFilterChipLabels(sys.filters as Record<string, unknown>);

                return (
                  <TouchableOpacity
                    key={sys.system_id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: surface,
                        borderColor: temp === 'fire' ? 'rgba(34,197,94,0.35)' : temp === 'ice' ? 'rgba(56,189,248,0.4)' : border,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onApplySystem(sys);
                    }}
                  >
                    <View style={[styles.accentBar, { backgroundColor: accent }]} />
                    <View style={styles.cardBody}>
                      <View style={styles.cardHeader}>
                        <View
                          style={[
                            styles.rankBadge,
                            {
                              backgroundColor:
                                i === 0 ? GOLD : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : MLB_ACCENT,
                            },
                          ]}
                        >
                          <Text style={styles.rankText}>#{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {sys.name}
                          </Text>
                          <Text style={[styles.username, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                            by {sys.username}
                          </Text>
                        </View>
                        {badge && (
                          <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <Text style={[styles.badgeText, { color: theme.colors.onSurface }]}>{badge}</Text>
                          </View>
                        )}
                        {temp === 'fire' && <Text style={styles.tempEmoji}>🔥</Text>}
                        {temp === 'ice' && <Text style={styles.tempEmoji}>❄️</Text>}
                      </View>

                      <Text style={[styles.betLine, { color: theme.colors.onSurfaceVariant }]}>
                        {verdictLabel(sys.verdict)} · {(sys.bet_type || '').toUpperCase()}
                      </Text>

                      <View style={[styles.statsBox, { backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)' }]}>
                        <Text style={[styles.timeframeLabel, { color: theme.colors.onSurfaceVariant }]}>
                          IN FILTER'S TIMEFRAME
                        </Text>
                        <View style={styles.statsRow}>
                          <Text style={[styles.recordBig, { color: theme.colors.onSurface }]}>{recordText(at)}</Text>
                          <Text
                            style={[
                              styles.stat,
                              { color: roi == null ? theme.colors.onSurfaceVariant : roi >= 0 ? GREEN : RED },
                            ]}
                          >
                            {roi == null ? '— ROI' : `${roi >= 0 ? '+' : ''}${roi}% ROI`}
                          </Text>
                          {units != null && (
                            <Text style={[styles.stat, { color: units >= 0 ? GREEN : RED }]}>
                              {units >= 0 ? '+' : ''}{units}u
                            </Text>
                          )}
                        </View>
                      </View>

                      <Text style={[styles.subStat, { color: theme.colors.onSurfaceVariant }]}>
                        This season{sys.season_label ? ` (${sys.season_label})` : ''}: {recordText(sys.current_season)}
                      </Text>

                      <View style={styles.formRow}>
                        {last10 && last10.n > 0 && (
                          <View
                            style={[
                              styles.formChip,
                              {
                                backgroundColor: hotL10
                                  ? 'rgba(34,197,94,0.16)'
                                  : coldL10
                                    ? 'rgba(56,189,248,0.16)'
                                    : theme.colors.surfaceVariant,
                              },
                            ]}
                          >
                            {hotL10 ? <Text>🔥 </Text> : coldL10 ? <Text>❄️ </Text> : null}
                            <View style={styles.dots}>
                              {last10.results.slice(0, 10).map((r, idx) => (
                                <View
                                  key={idx}
                                  style={[styles.dot, { backgroundColor: r ? GREEN : RED }]}
                                />
                              ))}
                            </View>
                            <Text
                              style={[
                                styles.last10Text,
                                { color: hotL10 ? GREEN : coldL10 ? ICE : theme.colors.onSurfaceVariant },
                              ]}
                            >
                              {last10.wins}/{last10.n}
                            </Text>
                          </View>
                        )}
                        {showStreak && (
                          <View
                            style={[
                              styles.streakChip,
                              {
                                backgroundColor:
                                  streak!.kind === 'win' ? 'rgba(34,197,94,0.15)' : 'rgba(56,189,248,0.15)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.streakText,
                                { color: streak!.kind === 'win' ? GREEN : ICE },
                              ]}
                            >
                              {streak!.kind === 'win'
                                ? `🔥 ${streak!.len} straight`
                                : `❄️ ${streak!.len} straight misses`}
                            </Text>
                          </View>
                        )}
                      </View>

                      {chips.length > 0 && (
                        <View style={styles.chipWrap}>
                          {chips.map(label => (
                            <View
                              key={label}
                              style={[styles.filterChip, { backgroundColor: isDark ? 'rgba(0,45,114,0.35)' : 'rgba(0,45,114,0.1)' }]}
                            >
                              <Text style={[styles.filterChipText, { color: theme.colors.onSurface }]}>{label}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '800' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 20, paddingHorizontal: 20 },
  sortLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  sortRow: { marginBottom: 14, flexGrow: 0 },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  sortChipText: { fontSize: 12, fontWeight: '600' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  name: { fontSize: 15, fontWeight: '700' },
  username: { fontSize: 12, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  tempEmoji: { fontSize: 18 },
  betLine: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  statsBox: { borderRadius: 12, padding: 10, marginBottom: 8 },
  timeframeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  recordBig: { fontSize: 20, fontWeight: '800' },
  stat: { fontSize: 14, fontWeight: '700' },
  subStat: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  formChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 10, borderRadius: 3 },
  last10Text: { fontSize: 11, fontWeight: '700' },
  streakChip: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14 },
  streakText: { fontSize: 11, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  filterChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  filterChipText: { fontSize: 10, fontWeight: '600' },
});
