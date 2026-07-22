import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Portal, Snackbar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMlbHistoricalAnalysis } from '@/hooks/useMlbHistoricalAnalysis';
import { useSaveSystem } from '@/hooks/useAnalysisSystems';
import { mlbLogoUrlFromAbbr } from '@/utils/mlbAbbrLogo';
import { SaveSystemDialog } from '@/components/mlb/SaveSystemDialog';
import { MySystemsSheet } from '@/components/mlb/MySystemsSheet';
import { SystemsLeaderboardBanner } from '@/components/mlb/SystemsLeaderboardBanner';
import { SystemsLeaderboardModal } from '@/components/mlb/SystemsLeaderboardModal';
import { verdictSideWord } from '@/services/analysisSystemsService';
import type { LeaderboardSystem, SavedSystemRow, SystemVerdict } from '@/services/analysisSystemsService';
import {
  MLB_BET_GROUPS,
  MLB_NO_ROI,
  MLB_SEASON_FLOOR,
  MLB_SEASON_MAX,
  MLB_VERB,
  defaultMlbFilters,
  mlbLineForBet,
  mlbSideLabel,
  mlbSignificance,
  mlbUpcomingChips,
  type MlbAnalysisBetType,
  type MlbAnalysisFilterState,
  type MlbPitcherOption,
} from '@/types/mlbHistoricalAnalysis';

const GREEN = '#22c55e';
const RED = '#ef4444';
const AMBER = '#f59e0b';

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant,
          borderColor: active ? theme.colors.primary : theme.colors.outline,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? theme.colors.onPrimary : theme.colors.onSurface },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TriToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const theme = useTheme();
  const opts: { l: string; v: boolean | null }[] = [
    { l: 'Any', v: null },
    { l: 'Yes', v: true },
    { l: 'No', v: false },
  ];
  return (
    <View style={styles.filterBlock}>
      <Text style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <View style={styles.rowWrap}>
        {opts.map(o => (
          <Chip key={o.l} label={o.l} active={value === o.v} onPress={() => onChange(o.v)} />
        ))}
      </View>
    </View>
  );
}

function RoiText({ roi, betType }: { roi: number | null | undefined; betType: string }) {
  const theme = useTheme();
  if (MLB_NO_ROI.has(betType)) {
    return <Text style={{ color: theme.colors.onSurfaceVariant }}>—</Text>;
  }
  if (roi == null) return <Text style={{ color: theme.colors.onSurfaceVariant }}>—</Text>;
  return (
    <Text style={{ color: roi >= 0 ? GREEN : RED, fontWeight: '600' }}>
      {roi >= 0 ? '+' : ''}{roi}% ROI
    </Text>
  );
}

export default function MLBHistoricalAnalysisScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    betType,
    setBetType,
    filters,
    setFilters,
    patchFilters,
    resetFilters,
    applyRestoredSystem,
    rpcFilters,
    data,
    upcoming,
    loading,
    isRefetching,
    weatherOnly,
    teamOptions,
    shownBars,
    applyTeamVsPitcher,
    searchPitchers,
  } = useMlbHistoricalAnalysis();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [breakdownTab, setBreakdownTab] = useState<'team' | 'venue'>('team');
  const [pitcherQ, setPitcherQ] = useState('');
  const [pitcherOpts, setPitcherOpts] = useState<MlbPitcherOption[]>([]);
  const [pitcherTarget, setPitcherTarget] = useState<'sp' | 'oppSp'>('oppSp');

  // Systems (save / my systems / leaderboard)
  const [saveOpen, setSaveOpen] = useState(false);
  const [mySystemsOpen, setMySystemsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [viewingSystem, setViewingSystem] = useState<{ name: string; username: string; verdict: SystemVerdict } | null>(null);
  const saveMutation = useSaveSystem();

  // Restore a saved system's filters + bet type onto the screen. Merge over
  // defaults so any keys missing from an older/cross-client snapshot fall back
  // safely instead of throwing.
  const applySystemFilters = (raw: Record<string, unknown>, savedBetType: string) => {
    const coerced =
      typeof raw === 'string'
        ? (() => {
            try {
              return JSON.parse(raw) as Record<string, unknown>;
            } catch {
              return {};
            }
          })()
        : raw && typeof raw === 'object'
          ? raw
          : {};
    const nextFilters = {
      ...defaultMlbFilters(),
      ...(coerced as Partial<MlbAnalysisFilterState>),
    };
    const nextBet = (savedBetType || betType) as MlbAnalysisBetType;
    applyRestoredSystem(nextFilters, nextBet);
  };

  const handleApplyMySystem = (row: SavedSystemRow) => {
    applySystemFilters(row.filters || {}, row.bet_type);
    setMySystemsOpen(false);
    setViewingSystem(
      row.verdict
        ? { name: row.name, username: 'you', verdict: row.verdict }
        : null,
    );
  };

  const handleApplyLeaderboardSystem = (sys: LeaderboardSystem) => {
    applySystemFilters(sys.filters || {}, sys.bet_type);
    setLeaderboardOpen(false);
    setViewingSystem({ name: sys.name, username: sys.username, verdict: sys.verdict });
  };

  const handleSaveSystem = (args: { name: string; verdict: SystemVerdict; isPublic: boolean }) => {
    saveMutation.mutate(
      {
        name: args.name,
        betType,
        filters,
        verdict: args.verdict,
        rpcFilters,
        isPublic: args.isPublic,
      },
      {
        onSuccess: () => {
          setSaveOpen(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSnackbar(
            args.isPublic
              ? 'System saved & shared — scoring for the leaderboard…'
              : 'System saved (private — turn Share on to list it)',
          );
        },
        onError: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setSnackbar("Couldn't save system, try again.");
        },
      },
    );
  };

  const activeChipCount = useMemo(() => {
    const d = filters;
    let n = 0;
    if (d.seasonMin !== MLB_SEASON_FLOOR || d.seasonMax !== MLB_SEASON_MAX) n++;
    if (d.teams.length) n++;
    if (d.opponents.length) n++;
    if (d.division !== null) n++;
    if (d.interleague !== null) n++;
    if (d.side !== 'any') n++;
    if (d.favDog !== 'any') n++;
    if (d.mlMin || d.mlMax) n++;
    if (d.totalMin != null || d.totalMax != null) n++;
    if (d.timeMin || d.timeMax) n++;
    if (d.dayOfWeek !== 'any') n++;
    if (d.doubleheader !== null) n++;
    if (d.seriesGameMin != null) n++;
    if (d.tripMin != null) n++;
    if (d.switchGame !== null) n++;
    if (d.sp.length || d.oppSp.length) n++;
    if (d.spHand !== 'any' || d.oppSpHand !== 'any') n++;
    if (d.bpIpMin != null || d.bpIpMax != null) n++;
    if (d.dome !== null) n++;
    if (d.pfRunsMin != null || d.pfRunsMax != null) n++;
    return n;
  }, [filters]);

  const onSearchPitchers = async (q: string) => {
    setPitcherQ(q);
    const opts = await searchPitchers(q);
    setPitcherOpts(opts.slice(0, 30));
  };

  const cov = data?.coverage;
  const overall = data?.overall;
  const surface = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? '#2c2c2e' : '#e5e7eb';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>MLB Historical Analysis</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Bet type → filters → results
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setFiltersOpen(true)}
          style={[styles.filterBtn, { backgroundColor: theme.colors.primaryContainer }]}
        >
          <MaterialCommunityIcons name="filter-variant" size={18} color={theme.colors.primary} />
          <Text style={[styles.filterBtnText, { color: theme.colors.primary }]}>
            Filters{activeChipCount ? ` (${activeChipCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Systems Leaderboard entry point */}
        <SystemsLeaderboardBanner onPress={() => setLeaderboardOpen(true)} />

        {/* Viewing-a-shared-system banner (after applying from the leaderboard) */}
        {viewingSystem && (
          <View style={[styles.viewingBanner, { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.viewingText, { color: theme.colors.onSurface }]}>
                {viewingSystem.username === 'you'
                  ? `Viewing your system ${viewingSystem.name} — bets ${verdictSideWord(viewingSystem.verdict)}.`
                  : `Viewing ${viewingSystem.name} by ${viewingSystem.username} — bets ${verdictSideWord(viewingSystem.verdict)}. Save your own copy to track it.`}
              </Text>
            </View>
            {user && viewingSystem.username !== 'you' && (
              <TouchableOpacity
                style={[styles.viewingSaveBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setSaveOpen(true)}
              >
                <Text style={{ color: theme.colors.onPrimary, fontWeight: '700', fontSize: 12 }}>Save</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setViewingSystem(null)} hitSlop={8} style={{ marginLeft: 6 }}>
              <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        )}

        {/* Save System / My Systems (signed-in only) */}
        {user && (
          <View style={styles.systemsActionRow}>
            <TouchableOpacity
              style={[styles.systemsBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSaveOpen(true);
              }}
            >
              <MaterialCommunityIcons name="content-save-outline" size={16} color={theme.colors.onPrimary} />
              <Text style={[styles.systemsBtnText, { color: theme.colors.onPrimary }]}>Save System</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.systemsBtnOutline, { borderColor: theme.colors.primary }]}
              onPress={() => setMySystemsOpen(true)}
            >
              <MaterialCommunityIcons name="bookmark-multiple-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.systemsBtnText, { color: theme.colors.primary }]}>My Systems</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bet types */}
        <View style={styles.section}>
          {MLB_BET_GROUPS.map(g => (
            <View key={g.group} style={{ marginBottom: 10 }}>
              <Text style={[styles.groupLabel, { color: theme.colors.onSurfaceVariant }]}>{g.group}</Text>
              <View style={styles.rowWrap}>
                {g.items.map(it => (
                  <Chip
                    key={it.key}
                    label={it.label}
                    active={betType === it.key}
                    onPress={() => setBetType(it.key)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Coverage */}
        <View style={[styles.card, { backgroundColor: surface, borderColor: border, opacity: isRefetching ? 0.55 : 1 }]}>
          <View style={styles.rowWrap}>
            <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.badgeText, { color: theme.colors.onSurface }]}>
                {cov
                  ? `${cov.n_bets} bets · ${cov.n_games} games · ${cov.season_min}–${cov.season_max}`
                  : loading ? 'Loading…' : 'No games match'}
              </Text>
            </View>
            {overall && overall.n > 0 && overall.n < 20 && (
              <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                <Text style={[styles.badgeText, { color: AMBER }]}>Small sample</Text>
              </View>
            )}
            {(loading || isRefetching) && <ActivityIndicator size="small" color={theme.colors.primary} />}
          </View>

          {loading && !data ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />
          ) : overall && overall.n > 0 ? (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.headline, { color: theme.colors.onSurface }]}>
                {(betType === 'total' || betType === 'f5_total') ? 'Games' : 'Teams'} {MLB_VERB[betType]}{' '}
                <Text style={{ color: theme.colors.primary }}>{overall.hit_pct}%</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '400', fontSize: 14 }}>
                  {' '}({overall.wins} of {overall.n})
                </Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <RoiText roi={overall.roi} betType={betType} />
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                  {(overall.hit_pct - (data?.baseline_pct ?? 0) >= 0 ? '+' : '')}
                  {(overall.hit_pct - (data?.baseline_pct ?? 0)).toFixed(1)} pts vs {data?.baseline_pct}% baseline
                  · {mlbSignificance(overall.n, overall.hit_pct)}
                </Text>
              </View>
            </View>
          ) : loading || isRefetching ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />
          ) : (
            <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              No games match these filters — try widening them.
            </Text>
          )}
        </View>

        {/* Bars */}
        {shownBars.length > 0 && (
          <View style={[styles.card, { backgroundColor: surface, borderColor: border, opacity: isRefetching ? 0.55 : 1 }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.onSurfaceVariant }]}>BREAKDOWN</Text>
            {shownBars.map(bar => (
              <View key={bar.dimension} style={{ marginTop: 12 }}>
                <Text style={[styles.dimLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {bar.dimension === 'over_under' ? 'Over / Under'
                    : bar.dimension === 'home_away' ? 'Home vs Away'
                      : bar.dimension === 'fav_dog' ? 'Favorite vs Underdog'
                        : bar.dimension}
                </Text>
                {bar.options.map(opt => (
                  <View key={opt.side} style={{ marginTop: 8 }}>
                    <View style={styles.barHeader}>
                      <Text style={[styles.barSide, { color: theme.colors.onSurface }]}>
                        {mlbSideLabel(betType, opt.side)}
                      </Text>
                      <Text style={{ color: opt.hit_pct >= 52.4 ? GREEN : theme.colors.onSurface, fontWeight: '700' }}>
                        {opt.hit_pct}%{' '}
                        <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '400', fontSize: 12 }}>
                          ({opt.wins} of {opt.n})
                        </Text>
                      </Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                      <View style={[styles.barFill, { width: `${Math.min(opt.hit_pct, 100)}%` }]} />
                      {data && (
                        <View style={[styles.barTick, { left: `${data.baseline_pct}%` }]} />
                      )}
                    </View>
                    <View style={styles.barFooter}>
                      <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
                        vs {data?.baseline_pct}% baseline
                      </Text>
                      <RoiText roi={opt.roi} betType={betType} />
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Breakdown tables */}
        {data && (
          <View style={[styles.card, { backgroundColor: surface, borderColor: border, opacity: isRefetching ? 0.55 : 1 }]}>
            <View style={styles.tabRow}>
              {(['team', 'venue'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setBreakdownTab(tab)}
                  style={[
                    styles.tab,
                    breakdownTab === tab && { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text style={{
                    color: breakdownTab === tab ? theme.colors.onPrimary : theme.colors.onSurface,
                    fontWeight: '600',
                    fontSize: 13,
                  }}>
                    {tab === 'team' ? 'By Team' : 'By Ballpark'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {(breakdownTab === 'team' ? data.by_team : data.by_venue).slice(0, 25).map((row, i) => {
              const label = breakdownTab === 'team' ? row.team : row.venue;
              return (
                <View key={`${label}-${i}`} style={[styles.breakdownRow, { borderBottomColor: border }]}>
                  {breakdownTab === 'team' && row.team ? (
                    <Image source={{ uri: mlbLogoUrlFromAbbr(row.team) }} style={styles.logo} />
                  ) : (
                    <View style={styles.logo} />
                  )}
                  <Text style={[styles.breakdownLabel, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {label}
                  </Text>
                  <Text style={[styles.nBadge, { color: theme.colors.onSurfaceVariant }]}>{row.n}g</Text>
                  <Text style={{
                    width: 48,
                    textAlign: 'right',
                    fontWeight: '700',
                    color: row.hit_pct > 52 ? GREEN : row.hit_pct < 48 ? RED : theme.colors.onSurface,
                  }}>
                    {row.hit_pct}%
                  </Text>
                  <View style={{ width: 64, alignItems: 'flex-end' }}>
                    <RoiText roi={row.roi} betType={betType} />
                  </View>
                </View>
              );
            })}
            {(breakdownTab === 'team' ? data.by_team : data.by_venue).length === 0 && (
              <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
                No results with enough games (min 3).
              </Text>
            )}
          </View>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <View style={[styles.card, { backgroundColor: surface, borderColor: border, borderColorPrimary: true } as any]}>
            <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
              TODAY&apos;S MATCHING GAMES ({upcoming.length})
            </Text>
            {weatherOnly && (
              <Text style={{ color: AMBER, fontSize: 11, marginBottom: 8 }}>
                Weather filters aren&apos;t applied to upcoming games.
              </Text>
            )}
            {upcoming.map((g, i) => (
              <View key={`${g.game_pk}-${g.team}-${i}`} style={[styles.upcomingRow, { borderColor: border }]}>
                <Image source={{ uri: mlbLogoUrlFromAbbr(g.team) }} style={styles.logo} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.upcomingMatchup, { color: theme.colors.onSurface }]}>{g.matchup}</Text>
                  <Text style={{ color: theme.colors.onSurface, fontSize: 12, fontWeight: '600' }}>
                    {mlbLineForBet(betType, g)}
                  </Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                    {[g.game_date, g.time_et ? `${g.time_et} ET` : ''].filter(Boolean).join(' · ')}
                  </Text>
                  <View style={[styles.rowWrap, { marginTop: 4 }]}>
                    {mlbUpcomingChips(g).map(chip => (
                      <TouchableOpacity
                        key={chip}
                        onPress={() => {
                          if (g.opp_sp_name && chip === g.opp_sp_name && g.opp_sp_id != null) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            applyTeamVsPitcher(g.team, {
                              id: g.opp_sp_id,
                              name: g.opp_sp_name,
                              hand: g.opp_sp_hand ?? null,
                              team: g.opponent,
                            });
                          }
                        }}
                        style={[styles.miniChip, { borderColor: border }]}
                      >
                        <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>{chip}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Filters modal */}
      <Modal visible={filtersOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: 12 }]}>
          <View style={[styles.header, { borderBottomColor: border }]}>
            <Text style={[styles.title, { color: theme.colors.onSurface, flex: 1 }]}>Filters</Text>
            <TouchableOpacity onPress={resetFilters} style={{ marginRight: 12 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFiltersOpen(false)}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>Scope</Text>
            <Text style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>
              Seasons {filters.seasonMin}–{filters.seasonMax}
            </Text>
            <View style={styles.rowWrap}>
              {[2023, 2024, 2025, 2026].map(y => (
                <Chip
                  key={y}
                  label={String(y)}
                  active={filters.seasonMin <= y && filters.seasonMax >= y}
                  onPress={() => patchFilters({ seasonMin: y, seasonMax: MLB_SEASON_MAX })}
                />
              ))}
            </View>

            <Text style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant, marginTop: 12 }]}>Team</Text>
            <View style={styles.rowWrap}>
              {teamOptions.slice(0, 30).map(t => (
                <Chip
                  key={t.abbr}
                  label={t.abbr}
                  active={filters.teams.includes(t.abbr)}
                  onPress={() => {
                    const teams = filters.teams.includes(t.abbr)
                      ? filters.teams.filter(x => x !== t.abbr)
                      : [...filters.teams, t.abbr];
                    patchFilters({ teams });
                  }}
                />
              ))}
            </View>

            <TriToggle label="Divisional" value={filters.division} onChange={v => patchFilters({ division: v })} />
            <TriToggle label="Interleague" value={filters.interleague} onChange={v => patchFilters({ interleague: v })} />

            <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>Price & Line</Text>
            <View style={styles.rowWrap}>
              {(['any', 'home', 'away'] as const).map(s => (
                <Chip key={s} label={s === 'any' ? 'Either side' : s === 'home' ? 'Home' : 'Away'}
                  active={filters.side === s} onPress={() => patchFilters({ side: s })} />
              ))}
            </View>
            <View style={[styles.rowWrap, { marginTop: 8 }]}>
              {(['any', 'favorite', 'underdog'] as const).map(s => (
                <Chip key={s} label={s === 'any' ? 'Any' : s === 'favorite' ? 'Favorites' : 'Underdogs'}
                  active={filters.favDog === s} onPress={() => patchFilters({ favDog: s })} />
              ))}
            </View>
            <View style={[styles.rowWrap, { marginTop: 8 }]}>
              {[
                { l: 'Heavy fav', min: '', max: '-180' },
                { l: 'Mod fav', min: '-179', max: '-135' },
                { l: 'Slight dog', min: '105', max: '135' },
                { l: 'Big dog', min: '150', max: '' },
              ].map(b => (
                <Chip key={b.l} label={b.l} active={filters.mlMin === b.min && filters.mlMax === b.max}
                  onPress={() => patchFilters({ mlMin: b.min, mlMax: b.max })} />
              ))}
            </View>

            <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>Game Time</Text>
            <View style={styles.rowWrap}>
              {[
                { l: 'Matinee', min: '', max: '14:59' },
                { l: 'Afternoon', min: '15:00', max: '17:59' },
                { l: 'Evening', min: '18:00', max: '20:59' },
                { l: 'Late', min: '21:00', max: '' },
              ].map(t => (
                <Chip key={t.l} label={t.l} active={filters.timeMin === t.min && filters.timeMax === t.max}
                  onPress={() => patchFilters({ timeMin: t.min, timeMax: t.max })} />
              ))}
            </View>

            <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>Schedule</Text>
            <View style={styles.rowWrap}>
              {([[1, 1, 'G1'], [2, 2, 'G2'], [3, 3, 'G3'], [4, 9, 'G4+']] as const).map(([lo, hi, l]) => (
                <Chip key={l} label={l}
                  active={filters.seriesGameMin === lo && filters.seriesGameMax === hi}
                  onPress={() => patchFilters(
                    filters.seriesGameMin === lo
                      ? { seriesGameMin: null, seriesGameMax: null }
                      : { seriesGameMin: lo, seriesGameMax: hi },
                  )}
                />
              ))}
            </View>
            <View style={[styles.rowWrap, { marginTop: 8 }]}>
              {([[1, 1, '1st trip'], [2, 2, '2nd trip'], [3, 9, '3rd+ trip']] as const).map(([lo, hi, l]) => (
                <Chip key={l} label={l}
                  active={filters.tripMin === lo && filters.tripMax === hi}
                  onPress={() => patchFilters(
                    filters.tripMin === lo
                      ? { tripMin: null, tripMax: null }
                      : { tripMin: lo, tripMax: hi },
                  )}
                />
              ))}
            </View>
            <TriToggle label="Switch game" value={filters.switchGame} onChange={v => patchFilters({ switchGame: v })} />

            <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>Pitching</Text>
            <View style={styles.rowWrap}>
              <Chip label="Own SP" active={pitcherTarget === 'sp'} onPress={() => setPitcherTarget('sp')} />
              <Chip label="Opp SP" active={pitcherTarget === 'oppSp'} onPress={() => setPitcherTarget('oppSp')} />
            </View>
            {(pitcherTarget === 'sp' ? filters.sp : filters.oppSp).map(p => (
              <View key={p.id} style={[styles.selectedPitcher, { borderColor: border }]}>
                <Text style={{ color: theme.colors.onSurface, flex: 1 }}>{p.name}{p.team ? ` (${p.team})` : ''}</Text>
                <Pressable onPress={() => {
                  const key = pitcherTarget;
                  patchFilters({ [key]: filters[key].filter(x => x.id !== p.id) } as Partial<MlbAnalysisFilterState>);
                }}>
                  <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
                </Pressable>
              </View>
            ))}
            <TextInput
              value={pitcherQ}
              onChangeText={onSearchPitchers}
              placeholder="Search pitchers…"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              style={[styles.input, { color: theme.colors.onSurface, borderColor: border, backgroundColor: surface }]}
            />
            {pitcherOpts.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.pitcherOpt, { borderBottomColor: border }]}
                onPress={() => {
                  const key = pitcherTarget;
                  const cur = filters[key];
                  if (cur.some(x => x.id === p.id)) return;
                  patchFilters({ [key]: [...cur, p] } as Partial<MlbAnalysisFilterState>);
                  setPitcherQ('');
                  setPitcherOpts([]);
                }}
              >
                <Text style={{ color: theme.colors.onSurface, fontWeight: '600' }}>{p.name}</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                  {[p.team, p.hand].filter(Boolean).join(' · ')}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={[styles.rowWrap, { marginTop: 8 }]}>
              {(['any', 'L', 'R'] as const).map(h => (
                <Chip key={h} label={h === 'any' ? 'Any hand' : `${h}HP`}
                  active={filters.oppSpHand === h} onPress={() => patchFilters({ oppSpHand: h })} />
              ))}
            </View>

            <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>Bullpen / Environment</Text>
            <View style={styles.rowWrap}>
              <Chip label="BP rested ≤6" active={filters.bpIpMax === 6}
                onPress={() => patchFilters({ bpIpMin: null, bpIpMax: 6 })} />
              <Chip label="BP gassed ≥12" active={filters.bpIpMin === 12}
                onPress={() => patchFilters({ bpIpMin: 12, bpIpMax: null })} />
            </View>
            <TriToggle label="Dome" value={filters.dome} onChange={v => patchFilters({ dome: v })} />
            <View style={styles.rowWrap}>
              <Chip label="Hitter park" active={filters.pfRunsMin === 103}
                onPress={() => patchFilters({ pfRunsMin: 103, pfRunsMax: null })} />
              <Chip label="Pitcher park" active={filters.pfRunsMax === 97}
                onPress={() => patchFilters({ pfRunsMin: null, pfRunsMax: 97 })} />
            </View>

            <TouchableOpacity
              onPress={() => setFiltersOpen(false)}
              style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={{ color: theme.colors.onPrimary, fontWeight: '700', fontSize: 16 }}>Apply filters</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Save this System (signed-in only) */}
      <SaveSystemDialog
        visible={saveOpen}
        onClose={() => setSaveOpen(false)}
        betType={betType}
        filters={filters}
        rpcFilters={rpcFilters}
        patchFilters={patchFilters}
        saving={saveMutation.isPending}
        onSave={handleSaveSystem}
      />

      {/* My Systems */}
      <MySystemsSheet
        visible={mySystemsOpen}
        onClose={() => setMySystemsOpen(false)}
        onApply={handleApplyMySystem}
      />

      {/* MLB Systems Leaderboard */}
      <SystemsLeaderboardModal
        visible={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        onApplySystem={handleApplyLeaderboardSystem}
      />

      <Portal>
        <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3500}>
          {snackbar || ''}
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  viewingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  viewingText: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  viewingSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  systemsActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  systemsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  systemsBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  systemsBtnText: { fontSize: 13, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { marginRight: 2 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterBtnText: { fontSize: 12, fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingTop: 14 },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  headline: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  empty: { textAlign: 'center', marginTop: 16, fontSize: 13 },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  dimLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barSide: { fontSize: 14, fontWeight: '600' },
  barTrack: { height: 8, borderRadius: 4, marginTop: 6, overflow: 'hidden', position: 'relative' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(34,197,94,0.5)', borderRadius: 4 },
  barTick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  barFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logo: { width: 22, height: 22, borderRadius: 11 },
  breakdownLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  nBadge: { fontSize: 11, width: 36, textAlign: 'right' },
  upcomingRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  upcomingMatchup: { fontSize: 14, fontWeight: '700' },
  miniChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 10,
  },
  filterBlock: { marginTop: 12 },
  filterLabel: { fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    fontSize: 14,
  },
  pitcherOpt: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedPitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  applyBtn: {
    marginTop: 24,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
});
