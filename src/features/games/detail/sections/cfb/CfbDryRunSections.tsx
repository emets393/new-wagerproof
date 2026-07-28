import { useEffect, useMemo, useState } from 'react';
import { Chip, Tooltip } from '@heroui/react';
import {
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Flame,
  Info,
  Target,
  Trophy,
} from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import {
  displaySignalKeysFromPick,
  isBlanketSignalKey,
} from '../../../api/footballSlate';
import {
  formatSignalSeasonRecord,
  signalSeasonRecordClassName,
  type SignalPerformanceRow,
} from '@/utils/signalPerformance';
import {
  CollegeTeamMark,
  EmptyNote,
  MarketGapHeader,
  MarketGapRow,
  STACK,
  toNum,
} from './shared';
import {
  fetchFootballTeamTrends,
  sportsbookFallbackUrl,
  TeamTrendsStrip,
  type FootballSport,
  type FootballTeamTrend,
} from './FootballTeamTrends';
import { cfbDryRunPickHeadline, cfbDryRunSummaryHeadline } from '../../headlines/cfb';
import type { CFBPrediction } from '../../../api/cfbGames';
import type { NFLPrediction } from '../../../api/nflGames';
import type { GameFeedItem, TeamRef } from '../../../types';

/**
 * Football dry-run detail sections — slate summary + grouped prediction cards
 * from `*_dryrun_picks` (or fg_* synthesis when picks are empty) with visible
 * Supports / Contradicts signal chips under each market pick (native sheet
 * parity) + per-market team season trends.
 *
 * Used for both CFB and NFL after the 2026 cutover (tables keep the dryrun name
 * but hold the live current-week slate). Signal chips prefer picks.signal_keys;
 * when those are empty (projection-only markets) we fall back to
 * `{sport}_dryrun_flags` so detail matches the feed ⚡ N Signals badge.
 */

type SignalDefinition = {
  signal_key?: string | null;
  display_name?: string | null;
  definition?: string | null;
  why_it_works?: string | null;
  bet_direction?: string | null;
  typical_hit?: string | null;
};

type FootballDryRunPick = {
  id?: string | number;
  game_id: string;
  card_group?: string | null;
  sort_order?: number | null;
  pick_label?: string | null;
  pick_team?: string | null;
  pick_side?: string | null;
  model_number?: number | string | null;
  model_line?: number | string | null;
  vegas_line?: number | string | null;
  edge?: number | string | null;
  best_book?: string | null;
  best_book_logo?: string | null;
  best_book_name?: string | null;
  best_line?: number | string | null;
  best_odds?: number | string | null;
  conviction?: string | null;
  is_mammoth?: boolean | null;
  signal_keys?: string[] | string | null;
  /** NFL embeds support/counter stance on the pick; CFB resolves via defs. */
  signals?: Array<{
    key?: string | null;
    label?: string | null;
    stance?: string | null;
    tier?: string | null;
    action?: string | null;
  }> | null;
  has_play?: boolean | null;
  display_only?: boolean | null;
};

type ConvictionSummaryEntry = {
  card?: string;
  card_group?: string;
  conviction?: string;
  mammoth?: boolean;
  pick_label?: string;
};

/** Raw fields both sports expose on the feed row for the summary card. */
type FootballDryRunRaw = {
  game_id?: string | number | null;
  season?: number | null;
  mammoth?: boolean | null;
  conviction_tier?: string | null;
  conviction_summary?: ConvictionSummaryEntry[] | {
    plays?: ConvictionSummaryEntry[];
    top_card?: string;
    top_conviction?: string;
  } | null;
  pred_away_score?: number | null;
  pred_home_score?: number | null;
  home_spread?: number | null;
  over_line?: number | null;
  fg_spread_capped?: boolean | null;
  [key: string]: unknown;
};

function normalizeConvictionSummary(
  value: FootballDryRunRaw['conviction_summary'],
): ConvictionSummaryEntry[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.plays)) {
    return value.plays.map((play) => ({
      ...play,
      card: play.card || play.card_group,
    }));
  }
  if (value.top_card || value.top_conviction) {
    return [
      {
        card: value.top_card,
        conviction: value.top_conviction,
      },
    ];
  }
  return [];
}

const PICKS_TABLE: Record<FootballSport, string> = {
  cfb: 'cfb_dryrun_picks',
  nfl: 'nfl_dryrun_picks',
};

const FLAGS_TABLE: Record<FootballSport, string> = {
  cfb: 'cfb_dryrun_flags',
  nfl: 'nfl_dryrun_flags',
};

const SIGNAL_DEFS_TABLE: Record<FootballSport, string> = {
  cfb: 'cfb_signal_defs',
  nfl: 'nfl_signal_defs',
};

/** Game-level bet flag from `{sport}_dryrun_flags` (feed badge source of truth). */
type DryRunFlag = {
  game_id?: string | number | null;
  signal_key?: string | null;
  rule?: string | null;
  market?: string | null;
  side?: string | null;
  tier?: string | null;
  conviction?: string | null;
  line?: number | string | null;
  edge?: number | string | null;
};

function flagSignalKey(flag: DryRunFlag): string {
  return String(flag.signal_key || flag.rule || '').trim();
}

function normalizeFlagMarket(market?: string | null): string {
  const key = String(market || '').toLowerCase().trim();
  if (!key) return '';
  if (key.startsWith('team_total') || key === 'tt') return 'team_total';
  if (key === 'ml' || key === 'money_line') return 'moneyline';
  if (key === 'h1_moneyline' || key === 'h1_ml') return 'h1_ml';
  if (key === 'h1_ou' || key === 'h1_over_under') return 'h1_total';
  return key;
}

/**
 * Heuristic stance when attaching a game-level flag to a market pick that has
 * no explicit signal_keys / embedded stance (projection-only NFL cards).
 */
function flagSupportsPick(
  flag: DryRunFlag,
  row: FootballDryRunPick,
  away: TeamRef,
  home: TeamRef,
): boolean {
  const hay = `${flag.side || ''} ${flag.rule || ''} ${flag.signal_key || ''}`.toUpperCase();
  const pickSide = String(row.pick_side || '').toUpperCase();
  const pickLabel = String(row.pick_label || '').toUpperCase();
  const pickTeam = String(row.pick_team || '').toUpperCase();

  if (pickSide === 'OVER' || pickLabel.includes('OVER')) {
    if (hay.includes('UNDER')) return false;
    if (hay.includes('OVER')) return true;
  }
  if (pickSide === 'UNDER' || pickLabel.includes('UNDER')) {
    if (hay.includes('OVER') && !hay.includes('UNDER')) return false;
    if (hay.includes('UNDER')) return true;
  }

  const awayTokens = [away.abbrev, away.name].filter(Boolean).map((t) => t.toUpperCase());
  const homeTokens = [home.abbrev, home.name].filter(Boolean).map((t) => t.toUpperCase());
  const mentionsAway = awayTokens.some((t) => hay.includes(t));
  const mentionsHome = homeTokens.some((t) => hay.includes(t));
  const flagHome =
    hay.includes('HOME') && !hay.includes('FADE HOME')
      ? true
      : hay.includes('AWAY') && !hay.includes('FADE AWAY')
        ? false
        : mentionsHome && !mentionsAway
          ? true
          : mentionsAway && !mentionsHome
            ? false
            : null;
  const pickHome =
    pickSide === 'HOME'
      ? true
      : pickSide === 'AWAY'
        ? false
        : pickTeam && homeTokens.some((t) => pickTeam.includes(t) || t.includes(pickTeam))
          ? true
          : pickTeam && awayTokens.some((t) => pickTeam.includes(t) || t.includes(pickTeam))
            ? false
            : pickLabel && homeTokens.some((t) => pickLabel.includes(t))
              ? true
              : pickLabel && awayTokens.some((t) => pickLabel.includes(t))
                ? false
                : null;

  if (flagHome !== null && pickHome !== null) return flagHome === pickHome;
  if (hay.includes('FADE HOME') && pickHome === true) return false;
  if (hay.includes('FADE AWAY') && pickHome === false) return false;
  return true;
}

const CARD_LABELS: Record<string, string> = {
  spread: 'Spread',
  total: 'Total',
  team_total: 'Team Totals',
  moneyline: 'Moneyline',
  h1_spread: '1H Spread',
  h1_total: '1H Total',
  h1_ml: '1H Moneyline',
};

/** One plain-language line per market group, so no card is unlabelled. */
const CARD_SUBTITLES: Record<string, string> = {
  spread: 'Where the model’s full-game spread sits against the book’s.',
  total: 'Where the model’s full-game total sits against the book’s.',
  team_total: 'Points the model expects from each team on its own, versus the posted team totals.',
  moneyline: 'Straight-up winner, priced against the book’s moneyline.',
  h1_spread: 'First-half spread only — the model prices halves separately from the full game.',
  h1_total: 'First-half total only — the model prices halves separately from the full game.',
  h1_ml: 'First-half winner only — the model prices halves separately from the full game.',
};

const CARD_ORDER = ['spread', 'total', 'team_total', 'moneyline', 'h1_spread', 'h1_total', 'h1_ml'];

const normalizeCardGroup = (group?: string | null): string => {
  const key = (group || 'other').toLowerCase();
  if (key.startsWith('team_total')) return 'team_total';
  if (key === 'ml') return 'moneyline';
  if (key === 'h1_moneyline') return 'h1_ml';
  return key;
};

const formatNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
};

const formatSigned = (value: number | null): string => {
  if (value === null) return '-';
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
};

/** Match a dry-run pick to home/away (native sheet team header parity). */
function resolvePickTeam(
  row: FootballDryRunPick,
  away: TeamRef,
  home: TeamRef,
): TeamRef | null {
  const pickTeam = String(row.pick_team || '').trim();
  const matches = (team: TeamRef, raw: string) => {
    const u = raw.toUpperCase();
    const name = team.name.toUpperCase();
    const abbrev = team.abbrev.toUpperCase();
    return (
      u === name ||
      u === abbrev ||
      name.includes(u) ||
      u.includes(name) ||
      u.includes(abbrev)
    );
  };

  if (pickTeam) {
    const homeHit = matches(home, pickTeam);
    const awayHit = matches(away, pickTeam);
    if (homeHit && !awayHit) return home;
    if (awayHit && !homeHit) return away;
    if (homeHit) return home;
    if (awayHit) return away;
  }

  const cardGroup = String(row.card_group || '').toLowerCase();
  if (cardGroup.includes('home')) return home;
  if (cardGroup.includes('away')) return away;

  const side = String(row.pick_side || '').toUpperCase();
  if (side === 'HOME') return home;
  if (side === 'AWAY') return away;

  return null;
}

/** Native-style TT header: "KC Over 24.5" instead of a bare Over/Under or full name. */
function teamTotalDisplayLabel(row: FootballDryRunPick, team: TeamRef): string {
  const sideHay = `${row.pick_side || ''} ${row.pick_label || ''}`.toUpperCase();
  const direction = sideHay.includes('UNDER')
    ? 'Under'
    : sideHay.includes('OVER')
      ? 'Over'
      : null;
  const line = toNum(row.best_line) ?? toNum(row.vegas_line);
  if (direction && line !== null) {
    return `${team.abbrev} ${direction} ${formatNumber(line)}`;
  }
  if (direction) {
    return `${team.abbrev} ${direction}`;
  }
  const model = toNum(row.model_line) ?? toNum(row.model_number);
  if (model !== null) {
    return `${team.abbrev} proj ${formatNumber(model)}`;
  }
  return row.pick_label || team.abbrev;
}

/**
 * When `*_dryrun_picks` is empty (CFB Weeks 1–3 by design; occasional NFL gaps),
 * still surface FG spread/total from the slate row — same source of truth as the
 * native sheet's marketRows built from `fg_*`.
 */
function synthesizeFgMarketPicks(
  game: GameFeedItem<FootballDryRunRaw>,
): FootballDryRunPick[] {
  const raw = game.raw;
  const picks: FootballDryRunPick[] = [];
  const homeSpread = toNum(raw.home_spread ?? raw.fg_spread_close);
  const modelSpread = toNum(raw.pred_spread ?? raw.fg_pred_spread);
  const spreadEdge = toNum(raw.home_spread_diff ?? raw.fg_spread_edge);
  const spreadSide = String(raw.fg_spread_pick ?? '').trim().toUpperCase();
  const total = toNum(raw.over_line ?? raw.fg_total_close);
  const modelTotal = toNum(raw.pred_total ?? raw.pred_over_line ?? raw.fg_pred_total);
  const totalEdge = toNum(raw.over_line_diff ?? raw.fg_total_edge);
  const totalSide = String(raw.fg_total_pick ?? '').trim().toUpperCase();

  if (homeSpread !== null || modelSpread !== null) {
    const pickHome =
      spreadSide === 'HOME' ||
      (!spreadSide && (spreadEdge === null || spreadEdge >= 0));
    const team = pickHome ? game.homeTeam : game.awayTeam;
    const vegas = pickHome ? homeSpread : homeSpread !== null ? -homeSpread : null;
    const model = pickHome
      ? modelSpread
      : modelSpread !== null
        ? -modelSpread
        : null;
    picks.push({
      game_id: String(raw.game_id ?? ''),
      card_group: 'spread',
      sort_order: 1,
      pick_label: `${team.abbrev} ${formatSigned(vegas)}`,
      pick_team: team.name,
      pick_side: pickHome ? 'HOME' : 'AWAY',
      model_line: model,
      vegas_line: vegas,
      edge: pickHome ? spreadEdge : spreadEdge !== null ? -spreadEdge : null,
      has_play: false,
      display_only: true,
    });
  }

  if (total !== null || modelTotal !== null) {
    const isUnder = totalSide === 'UNDER';
    const isOver = totalSide === 'OVER';
    const lean =
      isOver || isUnder
        ? totalSide
        : totalEdge !== null && totalEdge !== 0
          ? totalEdge > 0
            ? 'OVER'
            : 'UNDER'
          : modelTotal !== null && total !== null
            ? modelTotal >= total
              ? 'OVER'
              : 'UNDER'
            : 'OVER';
    picks.push({
      game_id: String(raw.game_id ?? ''),
      card_group: 'total',
      sort_order: 2,
      pick_label: `${lean} ${formatNumber(total)}`,
      pick_side: lean,
      model_line: modelTotal,
      vegas_line: total,
      edge: totalEdge,
      has_play: false,
      display_only: true,
    });
  }

  const homeMl = toNum(raw.home_ml ?? raw.fg_ml_home_close);
  const awayMl = toNum(raw.away_ml ?? raw.fg_ml_away_close);
  const predHome = toNum(raw.pred_home_score);
  const predAway = toNum(raw.pred_away_score);
  if (homeMl !== null || awayMl !== null) {
    const homeWins =
      predHome !== null && predAway !== null ? predHome >= predAway : (toNum(raw.fg_home_win_prob) ?? 0.5) >= 0.5;
    const team = homeWins ? game.homeTeam : game.awayTeam;
    picks.push({
      game_id: String(raw.game_id ?? ''),
      card_group: 'moneyline',
      sort_order: 4,
      pick_label: `${team.abbrev} ML`,
      pick_team: team.name,
      pick_side: homeWins ? 'HOME' : 'AWAY',
      vegas_line: homeWins ? homeMl : awayMl,
      has_play: false,
      display_only: true,
    });
  }

  return picks;
}

/** Best-book mark with onError → favicon → letter fallback (native SportsbookLogoView). */
function SportsbookMark({
  logo,
  bookKey,
  bookName,
}: {
  logo?: string | null;
  bookKey?: string | null;
  bookName?: string | null;
}) {
  const [stage, setStage] = useState<'primary' | 'fallback' | 'letter'>('primary');
  const fallback = sportsbookFallbackUrl(bookKey, bookName);
  const letter = String((bookName || bookKey || 'B').trim().charAt(0) || 'B').toUpperCase();

  useEffect(() => {
    setStage('primary');
  }, [logo, bookKey, bookName]);

  if (stage === 'letter' || (!logo && !fallback)) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded bg-foreground text-[9px] font-black text-background">
        {letter}
      </span>
    );
  }

  const src = stage === 'primary' && logo ? logo : fallback!;
  return (
    <img
      src={src}
      alt={bookName || bookKey || 'book'}
      className="h-4 w-4 rounded object-contain"
      onError={() => {
        if (stage === 'primary' && fallback) setStage('fallback');
        else setStage('letter');
      }}
    />
  );
}

type ChipTone = 'default' | 'primary' | 'success' | 'warning';

/** Conviction tiers, warmest at the top. Mammoth is the model's highest tier. */
const CONVICTION_TONE: Record<string, ChipTone> = {
  mammoth: 'warning',
  high: 'success',
  med: 'primary',
  low: 'default',
  lean: 'default',
};

const CONVICTION_LABEL: Record<string, string> = {
  mammoth: 'Mammoth',
  high: 'Strong',
  med: 'Medium',
  low: 'Low',
  lean: 'Lean',
};

/**
 * The Edge column's own value for a row. Prefer deriving it so the row's three
 * numbers can't visibly disagree; the stored `edge` only fills in when one of the
 * two lines is missing. Shared with the card headline so both quote one number.
 *
 * `display_only` must NOT suppress this — projection-only rows (synthesized FG
 * markets, NFL totals/1H/TT without a priced play) still publish model + Vegas
 * lines, and the Disagreement bar is the whole point of showing both.
 */
function resolveRowGap(row: FootballDryRunPick | undefined): number | null {
  if (!row) return null;
  const model = toNum(row.model_line) ?? toNum(row.model_number);
  const vegas = toNum(row.vegas_line);
  // Moneyline rows store win-prob in model_number and price elsewhere — don't
  // subtract a probability from an American-odds vegas_line if one sneaks in.
  const group = normalizeCardGroup(row.card_group);
  if (group === 'moneyline' || group === 'h1_ml') return toNum(row.edge);
  if (model !== null && vegas !== null) return model - vegas;
  return toNum(row.edge);
}

function convictionKey(conviction?: string | null, isMammoth?: boolean | null): string | null {
  if (isMammoth) return 'mammoth';
  const key = (conviction || '').toLowerCase();
  return key in CONVICTION_TONE ? key : conviction ? 'lean' : null;
}

function ConvictionChip({
  conviction,
  isMammoth,
  suffix,
}: {
  conviction?: string | null;
  isMammoth?: boolean | null;
  /** Market name appended on the slate summary ("Mammoth: spread"). */
  suffix?: string;
}) {
  const key = convictionKey(conviction, isMammoth);
  if (!key) return null;
  return (
    <Chip
      size="sm"
      variant="flat"
      color={CONVICTION_TONE[key]}
      startContent={key === 'mammoth' ? <Flame className="ml-1.5 h-3 w-3" aria-hidden /> : undefined}
      classNames={{ content: 'text-[11px] font-semibold capitalize' }}
    >
      {CONVICTION_LABEL[key]}
      {suffix ? `: ${suffix}` : ''}
    </Chip>
  );
}

/**
 * Slate summary: how hard the model likes this game, its projected final score,
 * and where its spread/total land against the book.
 */
export function FootballDryRunSummarySection({
  game,
  sport: _sport,
}: {
  game: GameFeedItem<FootballDryRunRaw>;
  sport: FootballSport;
}) {
  const prediction = game.raw;
  const convictionSummary = normalizeConvictionSummary(prediction.conviction_summary);

  const isMammothCard = Boolean(
    prediction.mammoth ||
      convictionSummary.some((entry) => entry.mammoth || entry.conviction === 'mammoth')
  );
  const mammothMarkets = convictionSummary
    .filter((entry) => entry.mammoth || entry.conviction === 'mammoth')
    .map((entry) => (entry.card || 'pick').replace(/_/g, ' '));

  const predAway = toNum(prediction.pred_away_score);
  const predHome = toNum(prediction.pred_home_score);
  const hasScore = predAway !== null && predHome !== null;
  // Prefer score-derived lines so spread + total reconcile with the projected
  // final; fall back to the dryrun fair lines when scores aren't on the row yet.
  const modelHomeSpread = hasScore
    ? predAway - predHome
    : toNum(prediction.pred_spread) ?? toNum(prediction.fg_pred_spread);
  const modelTotal = hasScore
    ? predAway + predHome
    : toNum(prediction.pred_total) ??
      toNum(prediction.pred_over_line) ??
      toNum(prediction.fg_pred_total);
  const vegasHomeSpread =
    toNum(prediction.home_spread) ??
    toNum(prediction.fg_spread_close) ??
    game.lines.homeSpread ??
    null;
  const vegasTotal =
    toNum(prediction.over_line) ??
    toNum(prediction.fg_total_close) ??
    game.lines.total ??
    null;
  const homeWins = hasScore && predHome >= predAway;

  const spreadCapped = prediction.fg_spread_capped === true;
  const spreadGap =
    modelHomeSpread !== null && vegasHomeSpread !== null ? modelHomeSpread - vegasHomeSpread : null;
  const totalGap = modelTotal !== null && vegasTotal !== null ? modelTotal - vegasTotal : null;

  return (
    <WidgetCard
      icon={<Trophy />}
      title="Slate Summary"
      headline={
        cfbDryRunSummaryHeadline({
          hasScore,
          predAway,
          predHome,
          awayAbbrev: game.awayTeam.abbrev,
          homeAbbrev: game.homeTeam.abbrev,
          homeWins,
          spreadGap,
          totalGap,
          spreadCapped,
          isMammothCard,
          mammothMarkets,
          playMarketCount: convictionSummary.length,
        }) ?? undefined
      }
      subtitle="How hard the model likes this game, the score it projects, and where that lands against the book."
      className="@xl:col-span-2"
    >
      <div className={STACK}>
        {(isMammothCard || convictionSummary.length > 0 || Boolean(prediction.conviction_tier)) && (
          <div className="flex flex-col gap-2">
            {isMammothCard && (
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  Mammoth Play
                </span>
                <span className="min-w-0 truncate text-[11px] capitalize text-muted-foreground">
                  {mammothMarkets.length > 0
                    ? mammothMarkets.join(' · ')
                    : 'Highest-conviction tier on this slate'}
                </span>
              </div>
            )}
            {convictionSummary.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {convictionSummary.map((entry, index) => (
                  <ConvictionChip
                    key={`${entry.card}-${index}`}
                    conviction={entry.conviction}
                    isMammoth={entry.mammoth}
                    suffix={(entry.card || 'pick').replace(/_/g, ' ')}
                  />
                ))}
              </div>
            ) : (
              prediction.conviction_tier && (
                <div className="flex flex-wrap gap-1.5">
                  <ConvictionChip conviction={String(prediction.conviction_tier)} />
                </div>
              )
            )}
          </div>
        )}

        {hasScore && (
          <ProjectedScore
            away={game.awayTeam}
            home={game.homeTeam}
            awayScore={predAway}
            homeScore={predHome}
            homeWins={homeWins}
          />
        )}

        {(modelHomeSpread !== null || modelTotal !== null) && (
          <div className="border-t border-black/5 pt-2 dark:border-white/10">
            <MarketGapHeader />
            <MarketGapRow
              label={`Spread (${game.homeTeam.abbrev})`}
              model={modelHomeSpread}
              vegas={vegasHomeSpread}
            />
            <MarketGapRow label="Total" model={modelTotal} vegas={vegasTotal} />
          </div>
        )}

        {!hasScore && modelHomeSpread === null && (
          <EmptyNote>No projected score on this slate row yet.</EmptyNote>
        )}
      </div>
    </WidgetCard>
  );
}

export function CfbDryRunSummarySection({ game }: { game: GameFeedItem<CFBPrediction> }) {
  return <FootballDryRunSummarySection game={game as GameFeedItem<FootballDryRunRaw>} sport="cfb" />;
}

export function NflDryRunSummarySection({ game }: { game: GameFeedItem<NFLPrediction> }) {
  return <FootballDryRunSummarySection game={game as GameFeedItem<FootballDryRunRaw>} sport="nfl" />;
}

/**
 * Projected final score with each team's share of the projected points as a
 * divided bar in the clubs' own colours. The projected winner keeps full
 * opacity and a check; the other side dims to keep the read instant.
 */
function ProjectedScore({
  away,
  home,
  awayScore,
  homeScore,
  homeWins,
}: {
  away: TeamRef;
  home: TeamRef;
  awayScore: number;
  homeScore: number;
  homeWins: boolean;
}) {
  const total = awayScore + homeScore;
  const awayShare = total > 0 ? (awayScore / total) * 100 : 50;
  const homeShare = 100 - awayShare;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <CollegeTeamMark team={away} size={28} dimmed={homeWins} />
          <span className={cn('text-lg font-bold tabular-nums', homeWins ? 'text-muted-foreground' : 'text-foreground')}>
            {away.abbrev} {awayScore.toFixed(1)}
          </span>
          {!homeWins && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {homeWins && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className={cn('text-lg font-bold tabular-nums', homeWins ? 'text-foreground' : 'text-muted-foreground')}>
            {homeScore.toFixed(1)} {home.abbrev}
          </span>
          <CollegeTeamMark team={home} size={28} dimmed={!homeWins} />
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Projected ${away.abbrev} ${awayScore.toFixed(1)}, ${home.abbrev} ${homeScore.toFixed(1)}`}
      >
        <div
          style={{ width: `${awayShare}%`, backgroundColor: away.colors.primary }}
          className={cn('transition-opacity', homeWins && 'opacity-35')}
        />
        <div
          style={{ width: `${homeShare}%`, backgroundColor: home.colors.primary }}
          className={cn('transition-opacity', !homeWins && 'opacity-35')}
        />
      </div>
    </div>
  );
}

/**
 * Grouped prediction cards from `*_dryrun_picks` with signal convictions and
 * per-market team season trends. When picks are empty (CFB Weeks 1–3), FG
 * spread/total are synthesized from the slate row so the board still matches
 * the native sheet.
 */
export function FootballDryRunPicksSection({
  game,
  sport,
}: {
  game: GameFeedItem<FootballDryRunRaw>;
  sport: FootballSport;
}) {
  const prediction = game.raw;
  const gameId = prediction?.game_id != null ? String(prediction.game_id) : '';
  const [picks, setPicks] = useState<FootballDryRunPick[]>([]);
  const [gameFlags, setGameFlags] = useState<DryRunFlag[]>([]);
  const [signalDefs, setSignalDefs] = useState<Record<string, SignalDefinition>>({});
  const [signalPerformance, setSignalPerformance] = useState<Record<string, SignalPerformanceRow>>({});
  const [teamTrends, setTeamTrends] = useState<Record<string, FootballTeamTrend>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;

    const fetchPicks = async () => {
      setLoading(true);
      setError(null);
      try {
        const season = Number(prediction?.season) || new Date().getFullYear();
        const week = toNum(prediction?.week);
        let flagsQuery = collegeFootballSupabase
          .from(FLAGS_TABLE[sport])
          .select('game_id,signal_key,rule,market,side,tier,conviction,line,edge')
          .eq('game_id', gameId);
        if (Number.isFinite(season)) flagsQuery = flagsQuery.eq('season', season);
        if (week !== null) flagsQuery = flagsQuery.eq('week', week);

        const [
          { data: pickRows, error: picksError },
          { data: flagRows, error: flagsError },
          { data: defsRows, error: defsError },
          { data: perfRows, error: perfError },
          trends,
        ] = await Promise.all([
          collegeFootballSupabase
            .from(PICKS_TABLE[sport])
            .select('*')
            .eq('game_id', gameId)
            .order('sort_order', { ascending: true }),
          flagsQuery,
          collegeFootballSupabase.from(SIGNAL_DEFS_TABLE[sport]).select('*'),
          collegeFootballSupabase
            .from('signal_performance')
            .select('*')
            .eq('sport', sport)
            .eq('season', season),
          fetchFootballTeamTrends({
            sport,
            season,
            away: game.awayTeam,
            home: game.homeTeam,
            client: collegeFootballSupabase,
          }).catch((err) => {
            debug.error(`Error loading ${sport} team trends:`, err);
            return {} as Record<string, FootballTeamTrend>;
          }),
        ]);

        if (cancelled) return;

        // Only picks are required for the market board. Flags/defs/perf must
        // soft-fail — otherwise we wipe the same signals the feed ⚡ badge shows.
        if (picksError) throw picksError;
        if (flagsError) debug.warn(`Error loading ${sport} dry-run flags:`, flagsError.message);
        if (defsError) debug.warn(`Error loading ${sport} signal defs:`, defsError.message);
        if (perfError) debug.warn(`Error loading ${sport} signal performance:`, perfError.message);

        const defsByKey = (defsRows || []).reduce<Record<string, SignalDefinition>>((acc, row: SignalDefinition) => {
          if (row.signal_key) acc[row.signal_key] = row;
          return acc;
        }, {});

        const perfByKey = (perfRows || []).reduce<Record<string, SignalPerformanceRow>>((acc, row: SignalPerformanceRow) => {
          if (row.signal_key) acc[row.signal_key] = row;
          return acc;
        }, {});

        // Same non-blanket set the feed badge counts from flags_* / n_flags_*.
        const loadedFlags = ((flagRows || []) as DryRunFlag[]).filter((flag) => {
          const key = flagSignalKey(flag);
          return key.length > 0 && !isBlanketSignalKey(sport, key);
        });

        const loaded = (pickRows || []) as FootballDryRunPick[];
        setPicks(loaded.length > 0 ? loaded : synthesizeFgMarketPicks(game));
        setGameFlags(loadedFlags);
        setSignalDefs(defsByKey);
        setSignalPerformance(perfByKey);
        setTeamTrends(trends);
      } catch (err) {
        if (cancelled) return;
        debug.error(`Error loading ${sport} dry-run picks:`, err);
        setError(err instanceof Error ? err.message : `Unable to load ${sport.toUpperCase()} picks`);
        // Still try to show FG markets + empty trend shells on hard failure.
        // Keep any flags already set — don't erase feed-badge parity.
        setPicks(synthesizeFgMarketPicks(game));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPicks();
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on identity fields — not the whole game object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, sport, prediction?.season, prediction?.week, game.awayTeam.abbrev, game.homeTeam.abbrev, game.awayTeam.name, game.homeTeam.name]);

  const groupedPicks = useMemo(() => {
    const groups = picks.reduce<Record<string, FootballDryRunPick[]>>((acc, pick) => {
      const group = normalizeCardGroup(pick.card_group);
      acc[group] = acc[group] || [];
      acc[group].push(pick);
      return acc;
    }, {});

    return CARD_ORDER.map((group) => ({ group, rows: groups[group] || [] })).filter(({ rows }) => rows.length > 0);
  }, [picks]);

  const pickSignalKeySet = useMemo(() => {
    const keys = new Set<string>();
    for (const pick of picks) {
      for (const key of displaySignalKeysFromPick(sport, pick.signal_keys)) {
        keys.add(key);
      }
    }
    return keys;
  }, [picks, sport]);

  const gameHasFlagSignals = gameFlags.length > 0;

  /** Flags not already rendered via pick.signal_keys (avoid duplicate chips). */
  const orphanFlags = useMemo(() => {
    if (!gameHasFlagSignals) return [];
    return gameFlags.filter((flag) => !pickSignalKeySet.has(flagSignalKey(flag)));
  }, [gameFlags, gameHasFlagSignals, pickSignalKeySet]);

  const flagsByMarket = useMemo(() => {
    const map = new Map<string, DryRunFlag[]>();
    for (const flag of orphanFlags) {
      const market = normalizeFlagMarket(flag.market);
      if (!market) continue;
      const list = map.get(market) || [];
      list.push(flag);
      map.set(market, list);
    }
    return map;
  }, [orphanFlags]);

  /** Flags whose market doesn't match any rendered card group — show in a list. */
  const unattachedFlags = useMemo(() => {
    const rendered = new Set(groupedPicks.map(({ group }) => group));
    return orphanFlags.filter((flag) => {
      const market = normalizeFlagMarket(flag.market);
      return !market || !rendered.has(market);
    });
  }, [orphanFlags, groupedPicks]);

  if (loading) {
    return (
      <WidgetCard
        icon={<Target />}
        title="Prediction Cards"
        subtitle="Every market the model priced for this game."
        className="@xl:col-span-2"
      >
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </WidgetCard>
    );
  }

  if (error && groupedPicks.length === 0) {
    return (
      <WidgetCard
        icon={<Target />}
        title="Prediction Cards"
        subtitle="Every market the model priced for this game."
        className="@xl:col-span-2"
      >
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </WidgetCard>
    );
  }

  if (groupedPicks.length === 0) {
    return (
      <WidgetCard
        icon={<Target />}
        title="Prediction Cards"
        subtitle="Every market the model priced for this game."
        className="@xl:col-span-2"
      >
        <EmptyNote>
          {sport === 'cfb'
            ? 'No FG lines on this slate row yet.'
            : 'No prediction cards found for this game yet.'}
        </EmptyNote>
        {gameHasFlagSignals && (
          <GameLevelSignalList
            flags={gameFlags}
            signalDefs={signalDefs}
            signalPerformance={signalPerformance}
          />
        )}
        <TeamTrendsStrip
          cardGroup="spread"
          away={game.awayTeam}
          home={game.homeTeam}
          trendsByKey={teamTrends}
          sport={sport}
        />
        <TeamTrendsStrip
          cardGroup="total"
          away={game.awayTeam}
          home={game.homeTeam}
          trendsByKey={teamTrends}
          sport={sport}
        />
      </WidgetCard>
    );
  }

  return (
    <>
      {/* No standalone "Signal convictions" card — chips only under each market. */}
      {groupedPicks.map(({ group, rows }) => {
        // Leftover flags with no market key ride on the first card so they
        // still appear under a market instead of a duplicate top section.
        const marketFlags = flagsByMarket.get(group) || [];
        const extras =
          group === groupedPicks[0]?.group && unattachedFlags.length > 0
            ? unattachedFlags
            : [];
        const fallbackFlags = extras.length > 0 ? [...marketFlags, ...extras] : marketFlags;
        return (
          <PredictionGroupCard
            key={`${gameId}-${group}`}
            group={group}
            rows={rows}
            signalDefs={signalDefs}
            signalPerformance={signalPerformance}
            fallbackFlags={fallbackFlags}
            away={game.awayTeam}
            home={game.homeTeam}
            trendsByKey={teamTrends}
            sport={sport}
          />
        );
      })}
    </>
  );
}

export function CfbDryRunPicksSection({ game }: { game: GameFeedItem<CFBPrediction> }) {
  return <FootballDryRunPicksSection game={game as GameFeedItem<FootballDryRunRaw>} sport="cfb" />;
}

export function NflDryRunPicksSection({ game }: { game: GameFeedItem<NFLPrediction> }) {
  return <FootballDryRunPicksSection game={game as GameFeedItem<FootballDryRunRaw>} sport="nfl" />;
}


function PredictionGroupCard({
  group,
  rows,
  signalDefs,
  signalPerformance,
  fallbackFlags,
  away,
  home,
  trendsByKey,
  sport,
}: {
  group: string;
  rows: FootballDryRunPick[];
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
  /** Game-level flags for this market when pick.signal_keys are empty. */
  fallbackFlags: DryRunFlag[];
  away: TeamRef;
  home: TeamRef;
  trendsByKey: Record<string, FootballTeamTrend>;
  sport: FootballSport;
}) {
  const Icon = group.includes('spread') ? Target
    : group.includes('total') ? BarChart3
    : group.includes('moneyline') || group.includes('ml') ? CircleDollarSign
    : group.includes('h1') ? Clock3
    : Trophy;

  const playCount = rows.filter((row) => row.has_play).length;

  // Speak for the surfaced play when there is one; rows are already sort_order'd,
  // so falling back to the first row matches what the reader sees at the top.
  const lead = rows.find((row) => row.has_play) ?? rows[0];
  const leadConvictionKey = lead ? convictionKey(lead.conviction, lead.is_mammoth) : null;
  const leadGap = resolveRowGap(lead);
  // Attach orphan game flags to the lead row only so multi-row markets
  // (team totals) don't duplicate the same chips under every side.
  const leadIndex = lead ? rows.indexOf(lead) : 0;

  return (
    <WidgetCard
      icon={<Icon />}
      title={CARD_LABELS[group] || group}
      headline={
        cfbDryRunPickHeadline({
          marketLabel: CARD_LABELS[group] || group,
          rowCount: rows.length,
          playCount,
          allDisplayOnly: rows.length > 0 && rows.every((row) => row.display_only),
          leadPickLabel: lead?.pick_label ?? null,
          leadConvictionLabel: leadConvictionKey ? CONVICTION_LABEL[leadConvictionKey] : null,
          leadGap,
        }) ?? undefined
      }
      subtitle={CARD_SUBTITLES[group] ?? 'How the model priced this market against the book.'}
      accessory={
        playCount > 0 ? (
          <Chip size="sm" variant="flat" color="primary" classNames={{ content: 'text-[11px] font-semibold' }}>
            {playCount} pick{playCount === 1 ? '' : 's'}
          </Chip>
        ) : undefined
      }
    >
      {/* Hairlines between picks — the card is already the surface. */}
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {rows.map((row, index) => (
          <PickRow
            key={`${row.id || row.pick_label || group}-${index}`}
            row={row}
            sport={sport}
            signalDefs={signalDefs}
            signalPerformance={signalPerformance}
            fallbackFlags={index === leadIndex ? fallbackFlags : []}
            away={away}
            home={home}
          />
        ))}
      </div>
      <TeamTrendsStrip
        cardGroup={group}
        away={away}
        home={home}
        trendsByKey={trendsByKey}
        sport={sport}
        pickTeams={rows.map((r) => r.pick_team)}
      />
    </WidgetCard>
  );
}

function PickRow({
  row,
  sport,
  signalDefs,
  signalPerformance,
  fallbackFlags,
  away,
  home,
}: {
  row: FootballDryRunPick;
  sport: FootballSport;
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
  fallbackFlags: DryRunFlag[];
  away: TeamRef;
  home: TeamRef;
}) {
  // Prefer picks.signal_keys (joined to defs). When empty — common on
  // projection-only NFL cards — fall back to matching game-level flags so
  // detail chips match the feed ⚡ N Signals count.
  const signalKeys = displaySignalKeysFromPick(sport, row.signal_keys);
  const useFlagFallback = signalKeys.length === 0 && fallbackFlags.length > 0;
  const model = toNum(row.model_line) ?? toNum(row.model_number);
  const vegas = toNum(row.vegas_line);
  const gap = resolveRowGap(row);
  const group = normalizeCardGroup(row.card_group);
  // Native sheets hide model-vs-Vegas for moneylines (odds ≠ a line).
  const showGapRow = group !== 'moneyline' && group !== 'h1_ml';
  // Team totals are two O/U rows — logo + abbrev make home vs away obvious
  // (native NFL/CFB sheet parity via CollegeTeamMark / game feed TeamRef logos).
  const pickTeam = group === 'team_total' ? resolvePickTeam(row, away, home) : null;
  const pickLabel =
    pickTeam != null
      ? teamTotalDisplayLabel(row, pickTeam)
      : row.pick_label || 'Projection only';
  const gapLabel = pickTeam?.abbrev || 'Line';

  return (
    <div className={cn('flex flex-col gap-2 py-3 first:pt-0 last:pb-0', row.display_only && 'opacity-70')}>
      {/* The pick first and largest; everything under it is the case for it. */}
      <div className="flex items-center gap-2.5">
        {pickTeam ? <CollegeTeamMark team={pickTeam} size={28} /> : null}
        <div className="flex min-w-0 flex-col">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {row.display_only ? 'Projection only' : row.has_play ? 'Surfaced pick' : 'Informational'}
          </span>
          <span
            className="truncate text-lg font-bold leading-tight tracking-tight text-foreground"
            title={pickTeam ? `${pickTeam.name} team total` : undefined}
          >
            {pickLabel}
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!row.display_only && (
            <ConvictionChip conviction={row.conviction} isMammoth={row.is_mammoth} />
          )}
          {(row.best_book_logo || row.best_book_name || row.best_book) && (
            <Tooltip
              content={`Best available price: ${row.best_book_name || row.best_book || 'book'}`}
              size="sm"
              delay={200}
            >
              <span className="flex items-center gap-1.5">
                <SportsbookMark
                  logo={row.best_book_logo}
                  bookKey={row.best_book}
                  bookName={row.best_book_name}
                />
                <span className="text-[12px] font-bold tabular-nums text-foreground">
                  {formatNumber(row.best_line)}
                  {row.best_odds ? ` (${row.best_odds})` : ''}
                </span>
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {showGapRow && (model !== null || vegas !== null) && (
        <div>
          {/* Captions repeat per pick rather than once per card so a row is never
              three unlabelled numbers when you scroll into the middle of a card. */}
          <MarketGapHeader />
          <MarketGapRow label={gapLabel} model={model} vegas={vegas} gap={gap} format={formatNumber} />
        </div>
      )}

      {/* Always-visible Supports / Contradicts chips — native sheet parity.
          Collapsed "Signal convictions" disclosures made these easy to miss. */}
      {useFlagFallback ? (
        <FlagSignalGroups
          flags={fallbackFlags}
          row={row}
          away={away}
          home={home}
          signalDefs={signalDefs}
          signalPerformance={signalPerformance}
        />
      ) : (
        <PickSignalGroups
          signalKeys={signalKeys}
          row={row}
          signalDefs={signalDefs}
          signalPerformance={signalPerformance}
        />
      )}
    </div>
  );
}

type ResolvedSignal = {
  key: string;
  displayName: string;
  stance: 'support' | 'counter';
  action?: string;
  embeddedLabel?: string;
};

function resolvePickSignals(
  signalKeys: string[],
  row: FootballDryRunPick,
  signalDefs: Record<string, SignalDefinition>,
): ResolvedSignal[] {
  return signalKeys.map((key) => {
    const embedded = (row.signals || []).find((s) => s.key === key);
    const def = signalDefs[key];
    const rawStance = (embedded?.stance || '').toLowerCase();
    const stance: 'support' | 'counter' =
      rawStance === 'counter' || rawStance === 'contradict' ? 'counter' : 'support';
    return {
      key,
      displayName: def?.display_name || embedded?.label || embedded?.action || key,
      stance,
      action: embedded?.action || embedded?.team || def?.bet_direction || undefined,
      embeddedLabel: embedded?.label || embedded?.action || undefined,
    };
  });
}

function resolveFlagSignals(
  flags: DryRunFlag[],
  row: FootballDryRunPick,
  away: TeamRef,
  home: TeamRef,
  signalDefs: Record<string, SignalDefinition>,
): ResolvedSignal[] {
  const seen = new Set<string>();
  const resolved: ResolvedSignal[] = [];
  for (const flag of flags) {
    const key = flagSignalKey(flag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const def = signalDefs[key];
    resolved.push({
      key,
      displayName: def?.display_name || key,
      stance: flagSupportsPick(flag, row, away, home) ? 'support' : 'counter',
      action: flag.side || def?.bet_direction || undefined,
      embeddedLabel: flag.side || undefined,
    });
  }
  return resolved;
}

/**
 * Native-parity signal strip under each market pick: Supports / Contradicts
 * chip grids, tap a chip for definition + season record.
 */
function PickSignalGroups({
  signalKeys,
  row,
  signalDefs,
  signalPerformance,
}: {
  signalKeys: string[];
  row: FootballDryRunPick;
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
}) {
  return (
    <ResolvedSignalGroups
      resolved={resolvePickSignals(signalKeys, row, signalDefs)}
      signalDefs={signalDefs}
      signalPerformance={signalPerformance}
    />
  );
}

function FlagSignalGroups({
  flags,
  row,
  away,
  home,
  signalDefs,
  signalPerformance,
}: {
  flags: DryRunFlag[];
  row: FootballDryRunPick;
  away: TeamRef;
  home: TeamRef;
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
}) {
  return (
    <ResolvedSignalGroups
      resolved={resolveFlagSignals(flags, row, away, home, signalDefs)}
      signalDefs={signalDefs}
      signalPerformance={signalPerformance}
    />
  );
}

function ResolvedSignalGroups({
  resolved,
  signalDefs,
  signalPerformance,
}: {
  resolved: ResolvedSignal[];
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const supporting = resolved.filter((s) => s.stance !== 'counter');
  const contradicting = resolved.filter((s) => s.stance === 'counter');
  const selected = resolved.find((s) => s.key === selectedKey);

  if (resolved.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 border-t border-black/5 pt-2 dark:border-white/10">
      {supporting.length > 0 && (
        <SignalChipGroup
          title="Supports this pick"
          signals={supporting}
          muted={false}
          selectedKey={selectedKey}
          onSelect={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
        />
      )}
      {contradicting.length > 0 && (
        <SignalChipGroup
          title="Contradicts this pick"
          signals={contradicting}
          muted
          selectedKey={selectedKey}
          onSelect={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
        />
      )}
      {selected && (
        <SignalDetail
          signalKey={selected.key}
          signal={signalDefs[selected.key]}
          performance={signalPerformance[signalDefs[selected.key]?.signal_key || selected.key]}
          stance={selected.stance}
          embeddedLabel={selected.embeddedLabel}
        />
      )}
    </div>
  );
}

/** Flat list when flags have no matching market card (or picks haven't loaded). */
function GameLevelSignalList({
  flags,
  signalDefs,
  signalPerformance,
}: {
  flags: DryRunFlag[];
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const resolved = useMemo(() => {
    const seen = new Set<string>();
    const out: ResolvedSignal[] = [];
    for (const flag of flags) {
      const key = flagSignalKey(flag);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const def = signalDefs[key];
      out.push({
        key,
        displayName: def?.display_name || key,
        stance: 'support',
        action: flag.side || def?.bet_direction || undefined,
        embeddedLabel: flag.side || undefined,
      });
    }
    return out;
  }, [flags, signalDefs]);
  const selected = resolved.find((s) => s.key === selectedKey);

  if (resolved.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <SignalChipGroup
        title="Signals on this game"
        signals={resolved}
        muted={false}
        selectedKey={selectedKey}
        onSelect={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
      />
      {selected && (
        <SignalDetail
          signalKey={selected.key}
          signal={signalDefs[selected.key]}
          performance={signalPerformance[signalDefs[selected.key]?.signal_key || selected.key]}
          stance={undefined}
          embeddedLabel={selected.embeddedLabel}
        />
      )}
    </div>
  );
}

function SignalChipGroup({
  title,
  signals,
  muted,
  selectedKey,
  onSelect,
}: {
  title: string;
  signals: ResolvedSignal[];
  muted: boolean;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={cn(
          'text-[9px] font-black uppercase tracking-wide',
          muted ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
        )}
      >
        {title}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {signals.map((signal) => {
          const active = selectedKey === signal.key;
          return (
            <button
              key={signal.key}
              type="button"
              onClick={() => onSelect(signal.key)}
              aria-expanded={active}
              className={cn(
                'flex max-w-full items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left transition-colors',
                muted
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                  : 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200',
                active && (muted ? 'ring-1 ring-amber-500/60' : 'ring-1 ring-blue-500/60'),
              )}
            >
              <Info className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-black leading-tight">
                  {signal.displayName}
                </span>
                {signal.action && (
                  <span className="block truncate text-[8px] font-bold leading-tight opacity-70">
                    {signal.action}
                  </span>
                )}
              </span>
              <ChevronRight
                className={cn(
                  'ml-0.5 h-3 w-3 shrink-0 opacity-60 transition-transform',
                  active && 'rotate-90',
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One signal, flat: what it is, why it works, and its two records side by side. */
function SignalDetail({
  signalKey,
  signal,
  performance,
  stance,
  embeddedLabel,
}: {
  signalKey: string;
  signal: SignalDefinition | undefined;
  performance: SignalPerformanceRow | undefined;
  stance?: 'support' | 'counter';
  embeddedLabel?: string;
}) {
  const seasonRecord = formatSignalSeasonRecord(performance);

  return (
    <div className="border-t border-black/5 pt-2 dark:border-white/10">
      <div className="flex items-center gap-1.5">
        <div className="text-[11px] font-bold text-foreground">{signal?.display_name || embeddedLabel || signalKey}</div>
        {stance && (
          <Chip
            size="sm"
            variant="flat"
            color={stance === 'support' ? 'primary' : 'warning'}
            classNames={{ content: 'text-[10px] font-semibold capitalize' }}
          >
            {stance === 'support' ? 'Supports' : 'Contradicts'}
          </Chip>
        )}
      </div>
      {signal?.definition && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{signal.definition}</p>
      )}
      {signal?.why_it_works && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Why it works:</span> {signal.why_it_works}
        </p>
      )}
      {signal?.bet_direction && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Direction:</span> {signal.bet_direction}
        </p>
      )}

      {/* Two records, two columns — the backtest and the live season are
          different claims and reading them stacked invited conflating them. */}
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Backtest
          </div>
          <div className="text-sm font-bold tabular-nums text-foreground">
            {signal?.typical_hit || '—'}
          </div>
          <div className="text-[10px] leading-snug text-muted-foreground/80">Multi-season</div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-primary">This season</div>
          <div
            className={cn(
              'text-sm font-bold tabular-nums',
              signalSeasonRecordClassName(seasonRecord.tone),
              seasonRecord.isSmallSample && 'opacity-90',
            )}
          >
            {seasonRecord.detail}
          </div>
          <div className="text-[10px] leading-snug text-muted-foreground/80">Live graded</div>
        </div>
      </div>
    </div>
  );
}
