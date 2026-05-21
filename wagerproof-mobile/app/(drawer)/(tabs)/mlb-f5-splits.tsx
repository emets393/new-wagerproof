import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { NoGamesTerminal } from '@/components/NoGamesTerminal';
import { mlbLogoUrlFromAbbr } from '@/utils/mlbAbbrLogo';
import { useProAccess } from '@/hooks/useProAccess';
import { useMLBF5Splits } from '@/hooks/useMLBF5Splits';
import type { F5Game, F5SplitRow, PitchHand } from '@/types/mlbF5Splits';
import { SAMPLE_THRESHOLDS } from '@/types/mlbF5Splits';
import {
  findSplitRow,
  formatDiff,
  formatGameDate,
  formatGameTime,
  formatMoneyline,
  formatNumber,
  formatPct,
  pitchHandLabel,
  recordWithPct,
  splitIsShowable,
} from '@/utils/mlbF5Splits';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';

const GREEN = '#22c55e';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';

const F5_METRIC_HELP: Record<string, { title: string; body: string }> = {
  starting_pitcher: {
    title: 'Starting pitcher',
    body: 'The pitcher starting for each team tonight. Their throwing hand helps determine which team split is used.',
  },
  opposing_starter: {
    title: 'Opposing starter',
    body: 'The pitcher each offense is facing tonight. Away teams are evaluated by away games vs this pitcher hand; home teams by home games vs this pitcher hand.',
  },
  location: {
    title: 'Location',
    body: 'Shows whether each team is playing on the road or at home. F5 split records are separated by home/away context.',
  },
  split_record: {
    title: 'Split W-L',
    body: 'First-five inning win-loss-tie record in the matching split: team location plus opposing starter hand.',
  },
  ou_record: {
    title: 'O/U record',
    body: 'How often that team split went over or under the first-five total. The percent below shows over rate.',
  },
  split_runs_scored: {
    title: 'Split runs scored',
    body: 'Average runs scored in the first five innings for this exact split: home/away plus opposing starter hand.',
  },
  season_runs_scored: {
    title: 'Season runs scored',
    body: 'Team season average first-five runs scored across all games. Use it as the baseline for the split.',
  },
  scoring_delta: {
    title: 'Scoring delta',
    body: 'Difference between split first-five runs scored and season average. Positive means this split scores more than usual.',
  },
  runs_allowed: {
    title: 'Avg F5 runs allowed',
    body: 'Average first-five runs allowed when this team starts a pitcher with tonight’s starter hand. Lower is better.',
  },
  season_runs_allowed: {
    title: 'Season runs allowed',
    body: 'Team season average first-five runs allowed across all games. Use it as the baseline for the starter-hand split.',
  },
  allowed_delta: {
    title: 'Allowed delta',
    body: 'Difference between starter-hand split runs allowed and season average. Negative means this team allows fewer first-five runs in this setup.',
  },
};

function showF5MetricHelp(key: string) {
  const help = F5_METRIC_HELP[key];
  if (!help) return;
  Alert.alert(help.title, help.body);
}

function ValueText({
  value,
  color,
  small = false,
}: {
  value: string;
  color?: string;
  small?: boolean;
}) {
  const theme = useTheme();
  return (
    <Text style={[small ? styles.smallValue : styles.value, { color: color ?? theme.colors.onSurface }]}>
      {value}
    </Text>
  );
}

function SignedDiffText({ value, goodWhenNegative = false }: { value: number | null | undefined; goodWhenNegative?: boolean }) {
  const theme = useTheme();
  if (value == null || !Number.isFinite(Number(value))) {
    return <ValueText value="-" />;
  }
  const n = Number(value);
  const isGood = goodWhenNegative ? n < 0 : n > 0;
  const isBad = goodWhenNegative ? n > 0 : n < 0;
  const icon = n > 0 ? 'arrow-up' : n < 0 ? 'arrow-down' : 'minus';
  const color = isGood ? GREEN : isBad ? RED : theme.colors.onSurfaceVariant;
  return (
    <View style={styles.diffWrap}>
      <MaterialCommunityIcons name={icon as any} size={13} color={color} />
      <ValueText value={formatDiff(n)} color={color} />
    </View>
  );
}

function sampleSuffix(row: F5SplitRow | null): string {
  if (!row) return '';
  if (row.games < SAMPLE_THRESHOLDS.SMALL) return ` (${row.games}g*)`;
  return ` (${row.games}g)`;
}

function sampleText(row: F5SplitRow | null): string | undefined {
  if (!row) return undefined;
  return row.games < SAMPLE_THRESHOLDS.SMALL ? `${row.games} games · small sample` : `${row.games} games`;
}

function StatCompareRow({
  label,
  helpKey,
  away,
  home,
  awayColor,
  homeColor,
  awaySub,
  homeSub,
}: {
  label: string;
  helpKey?: string;
  away: string | React.ReactNode;
  home: string | React.ReactNode;
  awayColor?: string;
  homeColor?: string;
  awaySub?: string;
  homeSub?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.compareRow, { borderTopColor: theme.colors.outlineVariant }]}>
      <View style={styles.compareSide}>
        {typeof away === 'string' ? <ValueText value={away} color={awayColor} /> : away}
        {awaySub ? <Text style={[styles.compareSubtext, { color: theme.colors.onSurfaceVariant }]}>{awaySub}</Text> : null}
      </View>
      <TouchableOpacity
        activeOpacity={helpKey ? 0.75 : 1}
        onPress={helpKey ? () => showF5MetricHelp(helpKey) : undefined}
        style={styles.compareLabelWrap}
      >
        <Text style={[styles.compareLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        {helpKey ? (
          <MaterialCommunityIcons name="information-outline" size={11} color={theme.colors.onSurfaceVariant} />
        ) : null}
      </TouchableOpacity>
      <View style={styles.compareSide}>
        {typeof home === 'string' ? <ValueText value={home} color={homeColor} /> : home}
        {homeSub ? <Text style={[styles.compareSubtext, { color: theme.colors.onSurfaceVariant }]}>{homeSub}</Text> : null}
      </View>
    </View>
  );
}

function betterHigherColors(away: number | null | undefined, home: number | null | undefined) {
  if (away == null || home == null || away === home) return {};
  return away > home ? { awayColor: GREEN, homeColor: RED } : { awayColor: RED, homeColor: GREEN };
}

function betterLowerColors(away: number | null | undefined, home: number | null | undefined) {
  if (away == null || home == null || away === home) return {};
  return away < home ? { awayColor: GREEN, homeColor: RED } : { awayColor: RED, homeColor: GREEN };
}

function defenseFor(split: F5SplitRow | null, ownHand: PitchHand) {
  if (!split || (ownHand !== 'R' && ownHand !== 'L')) return null;
  const games = ownHand === 'R' ? split.games_with_own_rhp : split.games_with_own_lhp;
  const avgRa = ownHand === 'R' ? split.avg_f5_ra_when_own_rhp : split.avg_f5_ra_when_own_lhp;
  const diff = ownHand === 'R' ? split.ra_diff_vs_season_when_own_rhp : split.ra_diff_vs_season_when_own_lhp;
  if (!splitIsShowable(games) || avgRa == null || diff == null) return null;
  return { games, avgRa, diff };
}

function defenseSubtext(row: F5SplitRow | null, ownHand: PitchHand): string | undefined {
  if (!row || (ownHand !== 'R' && ownHand !== 'L')) return undefined;
  const games = ownHand === 'R' ? row.games_with_own_rhp : row.games_with_own_lhp;
  if (!splitIsShowable(games)) return undefined;
  return `${games}g with ${ownHand === 'R' ? 'right' : 'left'}-handed starter`;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function TeamLogo({ abbr }: { abbr: string }) {
  const theme = useTheme();
  const logoUrl = mlbLogoUrlFromAbbr(abbr);
  if (!logoUrl) {
    return (
      <View style={[styles.teamLogoFallback, { borderColor: theme.colors.outlineVariant }]}>
        <Text style={[styles.teamLogoFallbackText, { color: theme.colors.onSurface }]}>{abbr}</Text>
      </View>
    );
  }
  return <Image source={{ uri: logoUrl }} style={styles.teamLogo} resizeMode="contain" />;
}

function PitcherLine({
  name,
  hand,
  align,
}: {
  name: string | null;
  hand: PitchHand;
  align: 'left' | 'right';
}) {
  const theme = useTheme();
  return (
    <Text
      style={[
        styles.pitcherLine,
        { color: theme.colors.onSurfaceVariant, textAlign: align },
      ]}
      numberOfLines={1}
    >
      {name || 'Starter TBD'} {hand ? `(${pitchHandLabel(hand)})` : ''}
    </Text>
  );
}

function F5GameCard({ game, lookup }: { game: F5Game; lookup: Map<string, F5SplitRow> }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const awaySplit = findSplitRow(lookup, game.away_abbr, 'away', game.home_sp_hand);
  const homeSplit = findSplitRow(lookup, game.home_abbr, 'home', game.away_sp_hand);
  const awayOk = splitIsShowable(awaySplit?.games);
  const homeOk = splitIsShowable(homeSplit?.games);
  const awayDefense = defenseFor(awaySplit, game.away_sp_hand);
  const homeDefense = defenseFor(homeSplit, game.home_sp_hand);
  const recordColors = betterHigherColors(awaySplit?.f5_win_pct, homeSplit?.f5_win_pct);
  const overColors = betterHigherColors(awaySplit?.f5_over_pct, homeSplit?.f5_over_pct);
  const runsColors = betterHigherColors(awaySplit?.avg_f5_rs, homeSplit?.avg_f5_rs);
  const seasonRunsColors = betterHigherColors(awaySplit?.season_avg_f5_rs, homeSplit?.season_avg_f5_rs);
  const defenseColors = betterLowerColors(awayDefense?.avgRa, homeDefense?.avgRa);
  const seasonDefenseColors = betterLowerColors(awaySplit?.season_avg_f5_ra, homeSplit?.season_avg_f5_ra);
  const awayQualifier = `${game.away_abbr} away vs ${pitchHandLabel(game.home_sp_hand)}`;
  const homeQualifier = `${game.home_abbr} home vs ${pitchHandLabel(game.away_sp_hand)}`;

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#171717' : '#ffffff', borderColor: theme.colors.outlineVariant }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.cardDate, { color: theme.colors.onSurfaceVariant }]}>
            {formatGameDate(game.official_date)} - {formatGameTime(game.game_time_et)}
          </Text>
          <Text style={[styles.matchupTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {game.away_abbr} @ {game.home_abbr}
          </Text>
        </View>
        <View style={[styles.totalPill, { backgroundColor: isDark ? '#262626' : '#f3f4f6' }]}>
          <Text style={[styles.totalPillText, { color: theme.colors.onSurfaceVariant }]}>
            F5 O/U {game.f5_total_line ?? '-'}
          </Text>
        </View>
      </View>
      {game.venue_name || game.total_line != null ? (
        <Text style={[styles.venueLine, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
          {game.venue_name ?? 'Venue TBD'}{game.total_line != null ? ` · Game total ${game.total_line}` : ''}
        </Text>
      ) : null}

      <View style={styles.teamsRow}>
        <View style={styles.teamBlock}>
          <TeamLogo abbr={game.away_abbr} />
          <PitcherLine name={game.away_sp_name} hand={game.away_sp_hand} align="left" />
          <ValueText value={`F5 ML ${formatMoneyline(game.f5_away_ml)}`} color={BLUE} small />
        </View>
        <MaterialCommunityIcons name="at" size={18} color={theme.colors.onSurfaceVariant} />
        <View style={styles.teamBlockRight}>
          <TeamLogo abbr={game.home_abbr} />
          <PitcherLine name={game.home_sp_name} hand={game.home_sp_hand} align="right" />
          <ValueText value={`F5 ML ${formatMoneyline(game.f5_home_ml)}`} color={BLUE} small />
        </View>
      </View>

      {(game.home_sp_hand === 'L' || game.away_sp_hand === 'L') ? (
        <Text style={[styles.caveat, { color: AMBER }]}>
          * LHP split samples can be thin early in the season. Small samples show real data with caution.
        </Text>
      ) : null}

      <SectionTitle title="⚾ Tonight's pitching matchup" />
      <StatCompareRow
        label="⚾ Starting pitcher"
        helpKey="starting_pitcher"
        away={`${game.away_sp_name ?? 'TBD'}${game.away_sp_hand ? ` (${pitchHandLabel(game.away_sp_hand)})` : ''}`}
        home={`${game.home_sp_name ?? 'TBD'}${game.home_sp_hand ? ` (${pitchHandLabel(game.home_sp_hand)})` : ''}`}
      />
      <StatCompareRow
        label="🎯 Opposing starter"
        helpKey="opposing_starter"
        away={`${game.home_sp_name ?? 'TBD'}${game.home_sp_hand ? ` (${pitchHandLabel(game.home_sp_hand)})` : ''}`}
        home={`${game.away_sp_name ?? 'TBD'}${game.away_sp_hand ? ` (${pitchHandLabel(game.away_sp_hand)})` : ''}`}
      />
      <StatCompareRow label="📍 Location" helpKey="location" away="On the Road" home="At Home" />

      <SectionTitle
        title="🔥 First-five offensive performance"
        subtitle={`${awayQualifier} · ${homeQualifier}`}
      />

      <StatCompareRow
        label="📊 Split W-L"
        helpKey="split_record"
        away={awayOk ? recordWithPct(awaySplit) : 'Not enough'}
        home={homeOk ? recordWithPct(homeSplit) : 'Not enough'}
        awaySub={awayOk ? sampleText(awaySplit) : undefined}
        homeSub={homeOk ? sampleText(homeSplit) : undefined}
        awayColor={recordColors.awayColor}
        homeColor={recordColors.homeColor}
      />
      <StatCompareRow
        label="📈 O/U record"
        helpKey="ou_record"
        away={awayOk ? awaySplit!.f5_ou_record : '-'}
        home={homeOk ? homeSplit!.f5_ou_record : '-'}
        awaySub={awayOk ? `${formatPct(awaySplit?.f5_over_pct)} over` : undefined}
        homeSub={homeOk ? `${formatPct(homeSplit?.f5_over_pct)} over` : undefined}
        awayColor={overColors.awayColor}
        homeColor={overColors.homeColor}
      />
      <StatCompareRow
        label="⚡ Split runs scored"
        helpKey="split_runs_scored"
        away={awayOk ? formatNumber(awaySplit?.avg_f5_rs) : '-'}
        home={homeOk ? formatNumber(homeSplit?.avg_f5_rs) : '-'}
        awaySub={awayOk ? sampleText(awaySplit) : undefined}
        homeSub={homeOk ? sampleText(homeSplit) : undefined}
        awayColor={runsColors.awayColor}
        homeColor={runsColors.homeColor}
      />
      <StatCompareRow
        label="📅 Season runs scored"
        helpKey="season_runs_scored"
        away={awayOk ? formatNumber(awaySplit?.season_avg_f5_rs) : '-'}
        home={homeOk ? formatNumber(homeSplit?.season_avg_f5_rs) : '-'}
        awaySub="all games"
        homeSub="all games"
        awayColor={seasonRunsColors.awayColor}
        homeColor={seasonRunsColors.homeColor}
      />
      <StatCompareRow
        label="↔️ Scoring delta"
        helpKey="scoring_delta"
        away={awaySplit ? <SignedDiffText value={awaySplit.rs_diff_vs_season} /> : '-'}
        home={homeSplit ? <SignedDiffText value={homeSplit.rs_diff_vs_season} /> : '-'}
        awaySub="split vs season"
        homeSub="split vs season"
      />
      <SectionTitle
        title="🛡️ First-five defensive performance"
        subtitle="Own starter hand · green = fewer runs allowed"
      />
      <StatCompareRow
        label="🛡️ Avg F5 runs allowed"
        helpKey="runs_allowed"
        away={awayDefense ? `${formatNumber(awayDefense.avgRa)} (${formatDiff(awayDefense.diff)})` : '-'}
        home={homeDefense ? `${formatNumber(homeDefense.avgRa)} (${formatDiff(homeDefense.diff)})` : '-'}
        awaySub={defenseSubtext(awaySplit, game.away_sp_hand)}
        homeSub={defenseSubtext(homeSplit, game.home_sp_hand)}
        awayColor={defenseColors.awayColor}
        homeColor={defenseColors.homeColor}
      />
      <StatCompareRow
        label="📅 Season runs allowed"
        helpKey="season_runs_allowed"
        away={awayOk ? formatNumber(awaySplit?.season_avg_f5_ra) : '-'}
        home={homeOk ? formatNumber(homeSplit?.season_avg_f5_ra) : '-'}
        awaySub="all games"
        homeSub="all games"
        awayColor={seasonDefenseColors.awayColor}
        homeColor={seasonDefenseColors.homeColor}
      />
      <StatCompareRow
        label="↔️ Allowed delta"
        helpKey="allowed_delta"
        away={awayDefense ? <SignedDiffText value={awayDefense.diff} goodWhenNegative /> : '-'}
        home={homeDefense ? <SignedDiffText value={homeDefense.diff} goodWhenNegative /> : '-'}
        awaySub="split vs season"
        homeSub="split vs season"
      />
    </View>
  );
}

export default function MLBF5SplitsScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { games, splitLookup, isLoading, error, refetch } = useMLBF5Splits();
  const { isPro, isLoading: isProLoading } = useProAccess();
  const { refreshCustomerInfo } = useRevenueCat();

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
            <Text style={[styles.navTitle, { color: theme.colors.onSurface }]}>MLB F5 Splits</Text>
            <Text style={[styles.navSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Home/away offense vs starter hand
            </Text>
          </View>
          <TouchableOpacity onPress={refetch} style={styles.navButton}>
            <MaterialCommunityIcons name="refresh" size={22} color={theme.colors.onSurface} />
          </TouchableOpacity>
        </AndroidBlurView>
      </View>

      <ScrollView
        style={{ marginTop: insets.top + 56 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={GREEN} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.explainer, { backgroundColor: isDark ? '#1d2633' : '#eef5ff', borderColor: BLUE }]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={BLUE} />
          <Text style={[styles.explainerText, { color: theme.colors.onSurface }]}>
            These use `mv_mlb_f5_team_splits`: the away team is judged by away games vs tonight's
            opposing starter hand, and the home team by home games vs tonight's opposing starter hand.
          </Text>
        </View>

        {isLoading && games.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
              Loading F5 splits...
            </Text>
          </View>
        ) : error ? (
          <NoGamesTerminal context="feed_mlb" />
        ) : games.length === 0 ? (
          <NoGamesTerminal context="feed_mlb" />
        ) : (
          <View style={{ gap: 12 }}>
            {games.map(game => (
              <F5GameCard key={game.game_pk} game={game} lookup={splitLookup} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  navTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  navSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  explainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  explainerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  matchupTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  totalPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  totalPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  venueLine: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 10,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  teamBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  teamBlockRight: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  teamLogo: {
    width: 46,
    height: 46,
    marginBottom: 4,
  },
  teamLogoFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  teamLogoFallbackText: {
    fontSize: 12,
    fontWeight: '900',
  },
  teamAbbr: {
    fontSize: 16,
    fontWeight: '900',
  },
  pitcherLine: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  smallValue: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  caveat: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  compareRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compareSide: {
    flex: 1,
    alignItems: 'center',
  },
  compareSubtext: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  compareLabelWrap: {
    width: 116,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  compareLabel: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  value: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  diffWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  sectionTitleWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
    paddingTop: 12,
    marginTop: 12,
    alignItems: 'center',
    gap: 3,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
