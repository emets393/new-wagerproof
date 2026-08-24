import { useEffect, useMemo, useState } from 'react';
import { Chip, Tooltip } from '@heroui/react';
import {
  ArrowDown,
  ArrowUp,
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
import { type SignalPerformanceRow } from '@/utils/signalPerformance';
import {
  CollegeTeamMark,
  EmptyNote,
  MarketGapHeader,
  MarketGapRow,
  STACK,
  toNum,
} from './shared';
import {
  CFB_EDGE_SCALE,
  ModelEdgeRail,
  MoneylineEdgeBar,
  NFL_EDGE_SCALE,
  SpreadCoverBar,
  breakEvenPercent,
  type EdgeScale,
} from '../../charts';
import { PickSignalsSection, SignalBacktestChart } from '../../signals';
import {
  BestBookChip,
  fetchCfbSportsbookOdds,
  fetchNflSportsbookOdds,
  formatSignedLine,
  marketFromFootballPick,
  quotesForMarket,
  useSportsbookPreference,
  type SportsbookGameOdds,
} from '../../sportsbooks';
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
 * Football slate detail sections — score-only slate summary + grouped
 * prediction cards from `*_slate_picks` (or fg_* synthesis when picks are empty)
 * with spread/total/moneyline edge charts on those cards, visible Supports /
 * Contradicts signal chips under each market pick (native sheet parity) +
 * per-market team season trends.
 *
 * Used for both CFB and NFL. The market cards' model numbers must equal the
 * `*_slate_games` header's; a divergence means the picks table is stale and is
 * fixed in the generator, never papered over here. Signal chips prefer
 * picks.signal_keys; when those are empty (projection-only markets) we fall back
 * to `{sport}_slate_flags` so detail matches the feed ⚡ N Signals badge.
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
  /** Moneyline rows put the model's WIN PROBABILITY (0-1) here, not a line. */
  model_number?: number | string | null;
  model_line?: number | string | null;
  vegas_line?: number | string | null;
  /** American price at the close. Moneyline rows only — `vegas_line` is a line. */
  vegas_price?: number | string | null;
  edge?: number | string | null;
  best_book?: string | null;
  best_book_logo?: string | null;
  best_book_name?: string | null;
  best_line?: number | string | null;
  best_odds?: number | string | null;
  conviction?: string | null;
  is_mammoth?: boolean | null;
  signal_keys?: string[] | string | null;
  /** Signals that fired AGAINST this card's pick — must render, labeled Contradicts. */
  counter_signal_keys?: string[] | string | null;
  /** NFL embeds support/counter stance on the pick; CFB resolves via defs. */
  signals?: Array<{
    key?: string | null;
    label?: string | null;
    team?: string | null;
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
  cfb: 'cfb_slate_picks',
  nfl: 'nfl_slate_picks',
};

const FLAGS_TABLE: Record<FootballSport, string> = {
  cfb: 'cfb_slate_flags',
  nfl: 'nfl_slate_flags',
};

// Per-sport: `rule` exists ONLY on nfl_slate_flags. A shared select with `rule` made
// PostgREST 42703 the ENTIRE CFB flags query (silently — debug.warn only), so CFB
// gameFlags had always been empty and no flag data ever reached the signal chips.
const FLAGS_SELECT: Record<FootballSport, string> = {
  cfb: 'game_id,signal_key,market,side,tier,conviction,line,edge,bet_team,bet_direction,bet_line',
  nfl: 'game_id,signal_key,rule,market,side,tier,conviction,line,edge,bet_team,bet_direction,bet_line',
};

const SIGNAL_DEFS_TABLE: Record<FootballSport, string> = {
  cfb: 'cfb_signal_defs',
  nfl: 'nfl_signal_defs',
};

/** Game-level bet flag from `{sport}_slate_flags` (feed badge source of truth). */
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
  /** Structured bet direction from the generator (2026-08-10): exact team to bet,
      over/under, and the signed line for THAT bet — render these, never parse text. */
  bet_team?: string | null;
  bet_direction?: string | null;
  bet_line?: number | string | null;
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

/**
 * College spreads blow out further than pro ones, so the two sports sharing this
 * file do NOT share a spread window. Totals band identically.
 */
const EDGE_SCALE_BY_SPORT: Record<FootballSport, EdgeScale> = {
  nfl: NFL_EDGE_SCALE,
  cfb: CFB_EDGE_SCALE,
};

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

/** Static def copy that is not a per-game pick (e.g. "Side indicated by the rule"). */
function isGenericBetDirection(value?: string | null): boolean {
  const text = String(value || '')
    .trim()
    .toLowerCase();
  if (!text) return true;
  return (
    text === 'side indicated by the rule' ||
    text === 'follow the indicated side' ||
    text.startsWith('side indicated')
  );
}

function matchTeamToken(token: string, away: TeamRef, home: TeamRef): TeamRef | null {
  const u = token.trim().toUpperCase();
  if (!u) return null;
  // Prefer exact abbrev so short tokens like "NE" don't false-match inside "NEW YORK".
  if (u === home.abbrev.toUpperCase()) return home;
  if (u === away.abbrev.toUpperCase()) return away;

  const hit = (team: TeamRef) => {
    const name = team.name.toUpperCase();
    return u === name || name.startsWith(`${u} `) || name.startsWith(`${u}-`);
  };
  const homeHit = hit(home);
  const awayHit = hit(away);
  if (homeHit && !awayHit) return home;
  if (awayHit && !homeHit) return away;
  if (homeHit) return home;
  if (awayHit) return away;
  return null;
}

/**
 * Expand a pipeline side label like "MIN -1.5" / "OVER 44.5" / "MIN TT OVER 24.5"
 * into pick_label-style copy ("Minnesota Vikings -1.5").
 */
function expandSignalSideLabel(side: string, away: TeamRef, home: TeamRef): string {
  const trimmed = side.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(/\s+/);
  const first = parts[0] || '';
  const upper = first.toUpperCase();

  if (upper === 'OVER' || upper === 'UNDER') {
    const dir = upper === 'OVER' ? 'Over' : 'Under';
    const rest = parts.slice(1).join(' ');
    return rest ? `${dir} ${rest}` : dir;
  }

  if (upper === '1H' && parts.length >= 2) {
    const dirTok = parts[1].toUpperCase();
    if (dirTok === 'OVER' || dirTok === 'UNDER') {
      const dir = dirTok === 'OVER' ? 'Over' : 'Under';
      const rest = parts.slice(2).join(' ');
      return rest ? `1H ${dir} ${rest}` : `1H ${dir}`;
    }
  }

  const team = matchTeamToken(first, away, home);
  if (!team) return trimmed;
  const rest = parts.slice(1).join(' ').trim();
  if (!rest) return team.name;

  const ttMatch = rest.match(/^TT\s+(OVER|UNDER)\s+(.+)$/i);
  if (ttMatch) {
    const dir = ttMatch[1].toUpperCase() === 'OVER' ? 'Over' : 'Under';
    return `${team.name} ${dir} ${ttMatch[2]}`;
  }

  return `${team.name} ${rest}`;
}

function parseSignalHomeAway(hay?: string | null): boolean | null {
  const text = String(hay || '').toLowerCase();
  if (!text) return null;
  if (/\bhome\b/.test(text) && !/\bfade home\b/.test(text)) return true;
  if (/\baway\b/.test(text) && !/\bfade away\b/.test(text)) return false;
  return null;
}

function pickRowIsHome(row: FootballDryRunPick, away: TeamRef, home: TeamRef): boolean | null {
  const side = String(row.pick_side || '').toUpperCase();
  if (side === 'HOME') return true;
  if (side === 'AWAY') return false;
  const team = resolvePickTeam(row, away, home);
  if (team === home) return true;
  if (team === away) return false;
  return null;
}

function orientedSpreadLine(
  row: FootballDryRunPick,
  signalIsHome: boolean | null,
  away: TeamRef,
  home: TeamRef,
): number | null {
  const line = toNum(row.best_line) ?? toNum(row.vegas_line);
  if (line === null) return null;
  const pickHome = pickRowIsHome(row, away, home);
  if (signalIsHome === null || pickHome === null) return line;
  return signalIsHome === pickHome ? line : -line;
}

/**
 * Concrete Direction copy for the rule-detail panel — signal's indicated pick,
 * not the surfaced card pick (important for contradict chips).
 */
function resolveSignalDirectionDisplay({
  sideLabel,
  action,
  team,
  betDirection,
  betTeam,
  betOU,
  betLine,
  flagMarket,
  row,
  away,
  home,
}: {
  sideLabel?: string | null;
  action?: string | null;
  team?: string | null;
  betDirection?: string | null;
  /** Structured fields from the flag row — highest priority, no parsing. */
  betTeam?: string | null;
  betOU?: string | null;
  betLine?: number | string | null;
  flagMarket?: string | null;
  row?: FootballDryRunPick | null;
  away?: TeamRef | null;
  home?: TeamRef | null;
}): string | null {
  // Structured fast-path: the generator already computed the exact bet
  // (team + signed line, or over/under + line). Everything below is legacy
  // heuristics for rows that predate the bet_* columns.
  const structTeam = (betTeam || '').trim();
  const structOU = (betOU || '').trim().toLowerCase();
  const structLine = toNum(betLine);
  if (structTeam || structOU === 'over' || structOU === 'under') {
    const mkt = String(flagMarket || '').toLowerCase();
    const pre = mkt.startsWith('h1_') ? '1H ' : '';
    const ouWord = structOU === 'over' ? 'Over' : structOU === 'under' ? 'Under' : '';
    if (structTeam && ouWord) {
      return `${structTeam} ${ouWord}${structLine !== null ? ` ${formatNumber(structLine)}` : ''}`;
    }
    if (ouWord) {
      return `${pre}${ouWord}${structLine !== null ? ` ${formatNumber(structLine)}` : ''}`;
    }
    if (mkt === 'moneyline') return `${structTeam} ML`;
    return `${pre}${structTeam}${structLine !== null ? ` ${formatSigned(structLine)}` : ''}`;
  }

  if (sideLabel?.trim() && away && home) {
    return expandSignalSideLabel(sideLabel, away, home);
  }
  if (sideLabel?.trim()) return sideLabel.trim();

  const teamName = (team || '').trim() || (() => {
    const act = String(action || '').trim();
    const paren = act.match(/^(.*?)\s*\((?:home|away)(?:\s*1h)?\)\s*$/i);
    return paren ? paren[1].trim() : '';
  })();

  const group = row ? normalizeCardGroup(row.card_group) : '';
  const signalHome =
    parseSignalHomeAway(action) ??
    (teamName && away && home
      ? matchTeamToken(teamName.split(/\s+/)[0] || teamName, away, home) === home
        ? true
        : matchTeamToken(teamName.split(/\s+/)[0] || teamName, away, home) === away
          ? false
          : null
      : null);

  if (row && away && home && teamName && (group === 'spread' || group === 'h1_spread')) {
    const line = orientedSpreadLine(row, signalHome, away, home);
    if (line !== null) {
      const half = group === 'h1_spread' ? ' 1H' : '';
      return `${teamName}${half} ${formatSigned(line)}`;
    }
  }

  if (row && (group === 'total' || group === 'h1_total')) {
    const hay = `${sideLabel || ''} ${action || ''} ${betDirection || ''}`.toUpperCase();
    const dir = hay.includes('UNDER') ? 'Under' : hay.includes('OVER') ? 'Over' : null;
    const line = toNum(row.best_line) ?? toNum(row.vegas_line);
    if (dir && line !== null) {
      return group === 'h1_total' ? `1H ${dir} ${formatNumber(line)}` : `${dir} ${formatNumber(line)}`;
    }
    if (dir) return group === 'h1_total' ? `1H ${dir}` : dir;
  }

  if (row && group === 'team_total' && teamName) {
    const hay = `${sideLabel || ''} ${action || ''} ${betDirection || ''}`.toUpperCase();
    const dir = hay.includes('UNDER') ? 'Under' : hay.includes('OVER') ? 'Over' : null;
    const line = toNum(row.best_line) ?? toNum(row.vegas_line);
    if (dir && line !== null) return `${teamName} ${dir} ${formatNumber(line)}`;
    if (dir) return `${teamName} ${dir}`;
  }

  if (row && (group === 'moneyline' || group === 'h1_ml') && teamName) {
    return group === 'h1_ml' ? `${teamName} 1H ML` : teamName;
  }

  if (action?.trim() && !isGenericBetDirection(action)) return action.trim();
  if (betDirection?.trim() && !isGenericBetDirection(betDirection)) return betDirection.trim();
  return null;
}

/** Match a dry-run pick to home/away (native sheet team header parity). */
function resolvePickTeam(
  row: FootballDryRunPick,
  away: TeamRef,
  home: TeamRef,
): TeamRef | null {
  const matches = (team: TeamRef, raw: string) => {
    const u = raw.toUpperCase().trim();
    if (!u) return false;
    const name = team.name.toUpperCase();
    const abbrev = team.abbrev.toUpperCase();
    // "New England" must hit "New England Patriots"; avoid abbrev false
    // positives inside longer words by preferring word-boundary abbrev checks.
    if (u === name || u === abbrev) return true;
    if (name.startsWith(u) || u.startsWith(name) || name.includes(u) || u.includes(name)) {
      return true;
    }
    const abbrevRe = new RegExp(`(^|[^A-Z0-9])${abbrev}([^A-Z0-9]|$)`);
    return abbrevRe.test(u);
  };

  const pickFromCandidates = (raw: string): TeamRef | null => {
    const homeHit = matches(home, raw);
    const awayHit = matches(away, raw);
    if (homeHit && !awayHit) return home;
    if (awayHit && !homeHit) return away;
    if (homeHit) return home;
    if (awayHit) return away;
    return null;
  };

  const pickTeam = String(row.pick_team || '').trim();
  if (pickTeam) {
    const hit = pickFromCandidates(pickTeam);
    if (hit) return hit;
  }

  // Surfaced labels like "New England +4.5" / "NE -3" often carry the side
  // when pick_team is blank or stale.
  const pickLabel = String(row.pick_label || '').trim();
  if (pickLabel) {
    const labelTeam = pickLabel.replace(/\s*[+-]?\d+(?:\.\d+)?\s*$/, '').trim();
    const hit = pickFromCandidates(labelTeam || pickLabel);
    if (hit) return hit;
  }

  const cardGroup = String(row.card_group || '').toLowerCase();
  if (cardGroup.includes('home')) return home;
  if (cardGroup.includes('away')) return away;

  const side = String(row.pick_side || '').toUpperCase();
  if (side === 'HOME') return home;
  if (side === 'AWAY') return away;

  return null;
}

/** Over / Under direction for totals (and TT labels that carry O/U). */
function resolveOuDirection(row: FootballDryRunPick): 'over' | 'under' | null {
  const hay = `${row.pick_side || ''} ${row.pick_label || ''}`.toUpperCase();
  if (/\bUNDER\b/.test(hay)) return 'under';
  if (/\bOVER\b/.test(hay)) return 'over';
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
    const fgHomeWinProb = toNum(raw.fg_home_win_prob);
    const homeWins =
      predHome !== null && predAway !== null ? predHome >= predAway : (fgHomeWinProb ?? 0.5) >= 0.5;
    const team = homeWins ? game.homeTeam : game.awayTeam;
    const price = homeWins ? homeMl : awayMl;
    picks.push({
      game_id: String(raw.game_id ?? ''),
      card_group: 'moneyline',
      sort_order: 4,
      pick_label: `${team.abbrev} ML`,
      pick_team: team.name,
      pick_side: homeWins ? 'HOME' : 'AWAY',
      vegas_line: price,
      // Same shape a real picks row uses: probability in model_number, American
      // price in vegas_price, so the synthesized card gets the same edge bar.
      model_number: fgHomeWinProb === null ? null : homeWins ? fgHomeWinProb : 1 - fgHomeWinProb,
      vegas_price: price,
      has_play: false,
      display_only: true,
    });
  }

  return picks;
}

/** Home-side spread + total from the slate row — same numbers the summary headline uses. */
type SlateMarketLines = {
  modelHomeSpread: number | null;
  vegasHomeSpread: number | null;
  modelTotal: number | null;
  vegasTotal: number | null;
};

function slateMarketLines(game: GameFeedItem<FootballDryRunRaw>): SlateMarketLines {
  const raw = game.raw;
  const predAway = toNum(raw.pred_away_score);
  const predHome = toNum(raw.pred_home_score);
  const hasScore = predAway !== null && predHome !== null;
  return {
    modelHomeSpread: hasScore
      ? predAway - predHome
      : toNum(raw.pred_spread) ?? toNum(raw.fg_pred_spread),
    vegasHomeSpread:
      toNum(raw.home_spread) ?? toNum(raw.fg_spread_close) ?? game.lines.homeSpread ?? null,
    modelTotal: hasScore
      ? predAway + predHome
      : toNum(raw.pred_total) ?? toNum(raw.pred_over_line) ?? toNum(raw.fg_pred_total),
    vegasTotal: toNum(raw.over_line) ?? toNum(raw.fg_total_close) ?? game.lines.total ?? null,
  };
}

function pickSideFromHome(homeValue: number | null, pickIsHome: boolean): number | null {
  if (homeValue === null) return null;
  return pickIsHome ? homeValue : -homeValue;
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
  // Moneyline rows store win-prob in model_number and the price in vegas_price —
  // never subtract a probability from an American-odds vegas_line.
  const group = normalizeCardGroup(row.card_group);
  if (group === 'moneyline' || group === 'h1_ml') {
    const ml = moneylineRowOutcome(row);
    // Percentage POINTS of win probability, not points of line. The card that
    // reads this must say so — see `leadGapKind` on cfbDryRunPickHeadline.
    return ml ? ml.edge : toNum(row.edge);
  }
  if (model !== null && vegas !== null) return model - vegas;
  return toNum(row.edge);
}

/**
 * The moneyline row as a price-vs-probability comparison, or null when the row
 * carries no usable price (Weeks 1-3 synthesis without a win probability, or a
 * market the pipeline priced without publishing the close).
 *
 * `vegas_price` is preferred over `best_odds` for the same reason the spread bar
 * plots `vegas_line`: the card's headline is written against the CLOSE, and a
 * best-shopped price would make the bar and the sentence quote different edges.
 */
function moneylineRowOutcome(row: FootballDryRunPick) {
  const price = toNum(row.vegas_price) ?? toNum(row.best_odds);
  const probability = toNum(row.model_number);
  if (price === null || price === 0) return null;
  if (probability === null || probability <= 0 || probability >= 1) return null;
  return {
    price,
    probability,
    edge: probability * 100 - breakEvenPercent(price),
  };
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
 * Slate summary: conviction + projected final. Spread / total / moneyline
 * charts live on the market cards below — same split as the native sheet's
 * Score Prediction widget vs. the pick cards.
 */
export function FootballDryRunSummarySection({
  game,
  sport,
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
  const { modelHomeSpread, vegasHomeSpread, modelTotal, vegasTotal } = slateMarketLines(game);
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
      subtitle="How hard the model likes this game, and the score it projects."
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

        {sport === 'nfl' && !hasScore && (
          <PendingMarketState marketLabel="this matchup" />
        )}
        {sport === 'cfb' && !hasScore && (
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
  const [bookOdds, setBookOdds] = useState<SportsbookGameOdds | null>(null);
  const { selectedKeys } = useSportsbookPreference();

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    const kickoff = String(
      (prediction as { kickoff?: string | null } | undefined)?.kickoff || game.timeSortKey || '',
    );
    const fetchOdds =
      sport === 'nfl'
        ? fetchNflSportsbookOdds({
            gameId,
            awayTeam: game.awayTeam.name,
            homeTeam: game.homeTeam.name,
            kickoff,
          })
        : fetchCfbSportsbookOdds({
            gameId,
            awayTeam: game.awayTeam.name,
            homeTeam: game.homeTeam.name,
            kickoff,
          });
    fetchOdds
      .then((odds) => {
        if (!cancelled) setBookOdds(odds);
      })
      .catch(() => {
        if (!cancelled) setBookOdds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, sport, game.awayTeam.name, game.homeTeam.name, game.timeSortKey, prediction]);

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
          .select(FLAGS_SELECT[sport])
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
      for (const key of displaySignalKeysFromPick(sport, pick.counter_signal_keys)) {
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
            away={game.awayTeam}
            home={game.homeTeam}
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

  const slateLines = slateMarketLines(game);

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
            lookupFlags={gameFlags}
            earlyWeek={(toNum(prediction?.week) ?? 99) <= 3}
            away={game.awayTeam}
            home={game.homeTeam}
            trendsByKey={teamTrends}
            sport={sport}
            bookOdds={bookOdds}
            selectedBookKeys={selectedKeys}
            slateLines={slateLines}
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
  lookupFlags,
  earlyWeek,
  away,
  home,
  trendsByKey,
  sport,
  bookOdds,
  selectedBookKeys,
  slateLines,
}: {
  group: string;
  rows: FootballDryRunPick[];
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
  /** Game-level flags for this market when pick.signal_keys are empty. */
  fallbackFlags: DryRunFlag[];
  /** ALL game flags — the structured bet_* lookup. fallbackFlags is orphans-only
      (flags no pick references), so keyed signals never matched it (2026-08-10). */
  lookupFlags?: DryRunFlag[];
  /** Weeks 1-3: display model is a preseason blend — headline explains why no play. */
  earlyWeek?: boolean;
  away: TeamRef;
  home: TeamRef;
  trendsByKey: Record<string, FootballTeamTrend>;
  sport: FootballSport;
  bookOdds: SportsbookGameOdds | null;
  selectedBookKeys: Set<string>;
  slateLines: SlateMarketLines;
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
          marketLineOnly:
            rows.length > 0 &&
            rows.every((row) => row.display_only && row.model_number == null && row.vegas_line != null),
          leadPickLabel: lead?.pick_label ?? null,
          leadConvictionLabel: leadConvictionKey ? CONVICTION_LABEL[leadConvictionKey] : null,
          leadGap,
          // Moneyline gaps are percentage points of win rate, not points of line.
          leadGapKind: group === 'moneyline' || group === 'h1_ml' ? 'winRate' : 'line',
          earlyWeek,
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
            lookupFlags={lookupFlags}
            away={away}
            home={home}
            bookOdds={bookOdds}
            selectedBookKeys={selectedBookKeys}
            slateLines={slateLines}
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
  lookupFlags,
  away,
  home,
  bookOdds,
  selectedBookKeys,
  slateLines,
}: {
  row: FootballDryRunPick;
  sport: FootballSport;
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
  fallbackFlags: DryRunFlag[];
  /** ALL game flags for the structured bet_* lookup (fallbackFlags = orphans only). */
  lookupFlags?: DryRunFlag[];
  away: TeamRef;
  home: TeamRef;
  bookOdds: SportsbookGameOdds | null;
  selectedBookKeys: Set<string>;
  slateLines: SlateMarketLines;
}) {
  // Prefer picks.signal_keys (joined to defs). When empty — common on
  // projection-only NFL cards — fall back to matching game-level flags so
  // detail chips match the feed ⚡ N Signals count.
  const signalKeys = displaySignalKeysFromPick(sport, row.signal_keys);
  // Owner rule 2026-08-07: signals firing AGAINST the pick render too ("Contradicts this
  // pick"), never hidden. iOS wired this 2026-08-08; web missed it (OSU-Tulsa: 5 flags,
  // 4 chips — ret_prod_edge backed the other side and vanished).
  const counterKeys = displaySignalKeysFromPick(sport, row.counter_signal_keys).filter(
    (k) => !signalKeys.includes(k),
  );
  const useFlagFallback = signalKeys.length === 0 && counterKeys.length === 0 && fallbackFlags.length > 0;
  const gap = resolveRowGap(row);
  const group = normalizeCardGroup(row.card_group);
  const scale = EDGE_SCALE_BY_SPORT[sport];

  const isSpreadChart = group === 'spread' || group === 'h1_spread';
  const isTotalChart = group === 'total' || group === 'h1_total';
  const isMoneyline = group === 'moneyline' || group === 'h1_ml';
  const moneyline = isMoneyline ? moneylineRowOutcome(row) : null;
  const isTotalMarket = group === 'total' || group === 'h1_total';
  const isTeamSidedMarket =
    group === 'team_total' ||
    group === 'spread' ||
    group === 'h1_spread' ||
    group === 'moneyline' ||
    group === 'h1_ml';
  const pickTeam = isTeamSidedMarket ? resolvePickTeam(row, away, home) : null;
  const spreadTeam = isSpreadChart ? pickTeam ?? resolvePickTeam(row, away, home) : null;

  let model = toNum(row.model_line) ?? toNum(row.model_number);
  // Prefer the close the headline is written against; `best_line` only fills in
  // when the pick row never stored a close. FG spread/total then fall back to
  // the slate row so these cards get the cover bar / rail instead of the old
  // disagreement table.
  let vegas = toNum(row.vegas_line) ?? toNum(row.best_line);
  if (group === 'spread') {
    const sideTeam = spreadTeam ?? pickTeam;
    if (sideTeam) {
      const pickHome = sideTeam === home;
      if (vegas === null) vegas = pickSideFromHome(slateLines.vegasHomeSpread, pickHome);
      if (model === null) model = pickSideFromHome(slateLines.modelHomeSpread, pickHome);
    }
  } else if (group === 'total') {
    if (vegas === null) vegas = slateLines.vegasTotal;
    if (model === null) model = slateLines.modelTotal;
  }

  const chartRendered =
    ((isSpreadChart || isTotalChart) && model !== null && vegas !== null) || moneyline !== null;
  // Team totals sit around 24 points where a game total sits at 45, and nothing
  // upstream calibrates them, so they keep the compact table row rather than
  // borrowing the game-total bands and calling every 3-point gap a lean. A
  // spread/total row missing one of its two numbers lands here too.
  const showGapRow = !isMoneyline && !chartRendered;
  const marketPending = sport === 'nfl' && model === null && vegas === null && moneyline === null;
  const ouDirection = isTotalMarket || group === 'team_total' ? resolveOuDirection(row) : null;
  const pickLabel =
    group === 'team_total' && pickTeam != null
      ? teamTotalDisplayLabel(row, pickTeam)
      : row.pick_label || 'Projection only';
  const gapLabel = pickTeam?.abbrev || 'Line';

  return (
    <div className={cn('flex flex-col gap-2 py-3 first:pt-0 last:pb-0', row.display_only && 'opacity-70')}>
      {/* The pick first and largest; everything under it is the case for it. */}
      <div className="flex items-center gap-2.5">
        {pickTeam ? (
          <CollegeTeamMark team={pickTeam} size={28} />
        ) : ouDirection ? (
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              ouDirection === 'over'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                : 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
            )}
            aria-hidden
          >
            {ouDirection === 'over' ? (
              <ArrowUp className="h-4 w-4" strokeWidth={2.75} />
            ) : (
              <ArrowDown className="h-4 w-4" strokeWidth={2.75} />
            )}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {row.display_only
              ? row.model_number == null && row.vegas_line != null
                ? 'Market line'
                : 'Projection only'
              : row.has_play
                ? 'Surfaced pick'
                : 'Informational'}
          </span>
          <span
            className={cn(
              'truncate text-lg font-bold leading-tight tracking-tight',
              ouDirection === 'over'
                ? 'text-emerald-700 dark:text-emerald-300'
                : ouDirection === 'under'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-foreground',
            )}
            title={
              pickTeam
                ? group === 'team_total'
                  ? `${pickTeam.name} team total`
                  : pickTeam.name
                : undefined
            }
          >
            {pickLabel}
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!row.display_only && (
            <ConvictionChip conviction={row.conviction} isMammoth={row.is_mammoth} />
          )}
          {(() => {
            const market = marketFromFootballPick(row.card_group, row.pick_side, sport);
            const board = market && bookOdds ? quotesForMarket(bookOdds, market) : null;
            if (board && board.quotes.length > 0) {
              return (
                <BestBookChip
                  quotes={board}
                  selectedBookKeys={selectedBookKeys}
                  marketTitle={CARD_LABELS[group] || group}
                  selectionTitle={pickLabel}
                  formatLine={(line) =>
                    isSpreadChart ? formatSignedLine(line) : formatNumber(line)
                  }
                />
              );
            }
            if (row.best_book_logo || row.best_book_name || row.best_book) {
              return (
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
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* `model_line` is the pick team's fair SPREAD, so it is negated exactly
          once, here, to become the margin the bar plots. */}
      {isSpreadChart && model !== null && vegas !== null && (
        <SpreadCoverBar
          line={vegas}
          modelMargin={-model}
          scale={scale}
          pickAbbrev={spreadTeam?.abbrev}
          opponentAbbrev={spreadTeam ? (spreadTeam === home ? away : home).abbrev : undefined}
        />
      )}

      {isTotalChart && model !== null && vegas !== null && (
        <ModelEdgeRail market={vegas} model={model} scale={scale} />
      )}

      {/* A price IS a required win rate, so the moneyline card can ask the same
          question as the spread card. `model_number` is a 0-1 probability on
          these rows, never a line. */}
      {moneyline && (
        <MoneylineEdgeBar
          price={moneyline.price}
          modelProbability={moneyline.probability}
          scale={scale}
          teamAbbrev={resolvePickTeam(row, away, home)?.abbrev}
        />
      )}

      {/* Whatever is left — team totals, and any market whose chart inputs are
          incomplete — keeps the compact table row. Captions repeat per pick so a
          row is never three unlabelled numbers mid-card. Moneylines are excluded
          outright: `vegas_line` is a line and `model_number` a probability, so
          subtracting them would print a meaningless gap. */}
      {/* model==null && vegas!=null = a bare market line (early 1H) — the OURS/EDGE
          dashes read as broken, so the gap table only renders with a model number. */}
      {showGapRow && model !== null && (
        <div>
          <MarketGapHeader />
          <MarketGapRow
            label={gapLabel}
            model={model}
            vegas={vegas}
            gap={gap}
            format={formatNumber}
            missingVegasLabel={sport === 'nfl' ? 'TBD' : undefined}
          />
        </div>
      )}

      {marketPending && (
        <PendingMarketState marketLabel={(CARD_LABELS[group] || group).toLowerCase()} />
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
          counterKeys={counterKeys}
          row={row}
          away={away}
          home={home}
          signalDefs={signalDefs}
          signalPerformance={signalPerformance}
          flags={lookupFlags ?? fallbackFlags}
        />
      )}
    </div>
  );
}

function PendingMarketState({ marketLabel }: { marketLabel: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1" role="status">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" aria-hidden />
      </span>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Market data is still taking shape.</span>{' '}
        WagerProof&apos;s projection and the Vegas line for {marketLabel} will appear here as soon as they&apos;re available.
      </p>
    </div>
  );
}

type ResolvedSignal = {
  key: string;
  displayName: string;
  stance: 'support' | 'counter';
  action?: string;
  embeddedLabel?: string;
  /** Concrete pick string for the Direction row (team + line when known). */
  direction?: string;
  /** Structured render hints: team logo next to the Direction, green arrow for O/U. */
  betLogo?: string | null;
  betOU?: 'over' | 'under';
};

function resolvePickSignals(
  signalKeys: string[],
  row: FootballDryRunPick,
  away: TeamRef,
  home: TeamRef,
  signalDefs: Record<string, SignalDefinition>,
  flagsByKey?: Record<string, DryRunFlag>,
  counterKeys?: string[],
): ResolvedSignal[] {
  const counters: ResolvedSignal[] = (counterKeys || []).map((key) => {
    const flag = flagsByKey?.[key];
    const def = signalDefs[key];
    return {
      key,
      displayName: def?.display_name || key,
      stance: 'counter' as const,
      action: flag?.side || def?.bet_direction || undefined,
      embeddedLabel: flag?.side || undefined,
      betLogo: betTeamLogo(flag?.bet_team, away, home),
      betOU: normalizedBetOU(flag?.bet_direction),
      direction:
        resolveSignalDirectionDisplay({
          sideLabel: flag?.side,
          action: flag?.side,
          betDirection: def?.bet_direction,
          betTeam: flag?.bet_team,
          betOU: flag?.bet_direction,
          betLine: flag?.bet_line,
          flagMarket: flag?.market,
          row,
          away,
          home,
        }) || undefined,
    };
  });
  return signalKeys.map((key) => {
    const embedded = (row.signals || []).find((s) => s.key === key);
    const flag = flagsByKey?.[key];
    const def = signalDefs[key];
    const rawStance = (embedded?.stance || '').toLowerCase();
    const stance: 'support' | 'counter' =
      rawStance === 'counter' || rawStance === 'contradict' ? 'counter' : 'support';
    const action = embedded?.action || embedded?.team || def?.bet_direction || undefined;
    return {
      key,
      displayName: def?.display_name || embedded?.label || embedded?.action || key,
      stance,
      action,
      embeddedLabel: embedded?.label || embedded?.action || undefined,
      betLogo: betTeamLogo(flag?.bet_team, away, home),
      betOU: normalizedBetOU(flag?.bet_direction),
      direction:
        resolveSignalDirectionDisplay({
          sideLabel: embedded?.label,
          action: embedded?.action || embedded?.team,
          team: embedded?.team,
          betDirection: def?.bet_direction,
          betTeam: flag?.bet_team,
          betOU: flag?.bet_direction,
          betLine: flag?.bet_line,
          flagMarket: flag?.market,
          row,
          away,
          home,
        }) || undefined,
    };
  }).concat(counters);
}

/** Logo for the structured bet_team, matched against the two TeamRefs. */
function betTeamLogo(betTeam: string | null | undefined, away: TeamRef | null, home: TeamRef | null): string | null {
  const t = (betTeam || '').trim().toUpperCase();
  if (!t) return null;
  // Exact name, abbrev, or containment either way — NFL flags store the full
  // "Kansas City Chiefs" while the TeamRef name may be city or nickname.
  const hit = (team: TeamRef | null): boolean => {
    if (!team) return false;
    const name = team.name.toUpperCase();
    const ab = team.abbrev.toUpperCase();
    return name === t || ab === t || t.includes(name) || name.includes(t);
  };
  if (hit(home)) return home!.logoUrl;
  if (hit(away)) return away!.logoUrl;
  return null;
}

function normalizedBetOU(v: string | null | undefined): 'over' | 'under' | undefined {
  const s = (v || '').trim().toLowerCase();
  return s === 'over' || s === 'under' ? s : undefined;
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
      betLogo: betTeamLogo(flag.bet_team, away, home),
      betOU: normalizedBetOU(flag.bet_direction),
      direction:
        resolveSignalDirectionDisplay({
          sideLabel: flag.side,
          action: flag.side,
          betDirection: def?.bet_direction,
          betTeam: flag.bet_team,
          betOU: flag.bet_direction,
          betLine: flag.bet_line,
          flagMarket: flag.market,
          row,
          away,
          home,
        }) || undefined,
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
  counterKeys,
  row,
  away,
  home,
  signalDefs,
  signalPerformance,
  flags,
}: {
  signalKeys: string[];
  /** Signals that fired against the pick — rendered under Contradicts. */
  counterKeys?: string[];
  row: FootballDryRunPick;
  away: TeamRef;
  home: TeamRef;
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
  /** Flag rows for this game — carry the structured bet_* fields per signal key. */
  flags?: DryRunFlag[];
}) {
  const flagsByKey = useMemo(() => {
    const map: Record<string, DryRunFlag> = {};
    for (const f of flags || []) {
      const k = flagSignalKey(f);
      if (k && !map[k]) map[k] = f;
    }
    return map;
  }, [flags]);
  return (
    <ResolvedSignalGroups
      resolved={resolvePickSignals(signalKeys, row, away, home, signalDefs, flagsByKey, counterKeys)}
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

  // Supporting first, then contradicting — a reader scans for what backs the
  // pick before what argues with it, and the amber pills group at the end.
  const ordered = [...supporting, ...contradicting];

  return (
    <div className="flex flex-col gap-2.5 border-t border-black/5 pt-2 dark:border-white/10">
      <PickSignalsSection
        signals={ordered.map((signal) => ({
          key: signal.key,
          title: signal.displayName,
          contradicts: signal.stance === 'counter',
        }))}
        selectedKey={selectedKey}
        onSelect={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
      />
      {selected && (
        <SignalDetail
          signalKey={selected.key}
          signal={signalDefs[selected.key]}
          performance={signalPerformance[signalDefs[selected.key]?.signal_key || selected.key]}
          stance={selected.stance}
          embeddedLabel={selected.embeddedLabel}
          direction={selected.direction}
          betLogo={selected.betLogo}
          betOU={selected.betOU}
        />
      )}
    </div>
  );
}

/** Flat list when flags have no matching market card (or picks haven't loaded). */
function GameLevelSignalList({
  flags,
  away,
  home,
  signalDefs,
  signalPerformance,
}: {
  flags: DryRunFlag[];
  away: TeamRef;
  home: TeamRef;
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
        betLogo: betTeamLogo(flag.bet_team, away, home),
        betOU: normalizedBetOU(flag.bet_direction),
        direction:
          resolveSignalDirectionDisplay({
            sideLabel: flag.side,
            action: flag.side,
            betDirection: def?.bet_direction,
            betTeam: flag.bet_team,
            betOU: flag.bet_direction,
            betLine: flag.bet_line,
            flagMarket: flag.market,
            away,
            home,
          }) || undefined,
      });
    }
    return out;
  }, [flags, signalDefs, away, home]);
  const selected = resolved.find((s) => s.key === selectedKey);

  if (resolved.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <PickSignalsSection
        title="Signals on this game"
        signals={resolved.map((signal) => ({
          key: signal.key,
          title: signal.displayName,
          // No pick to argue with at game level, so nothing is a counter.
          contradicts: false,
        }))}
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
          direction={selected.direction}
          betLogo={selected.betLogo}
          betOU={selected.betOU}
        />
      )}
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
  direction,
  betLogo,
  betOU,
}: {
  signalKey: string;
  signal: SignalDefinition | undefined;
  performance: SignalPerformanceRow | undefined;
  stance?: 'support' | 'counter';
  embeddedLabel?: string;
  /** Concrete per-game pick; falls back to non-generic def bet_direction. */
  direction?: string;
  /** Structured render hints: bet team's logo, green arrow for over/under. */
  betLogo?: string | null;
  betOU?: 'over' | 'under';
}) {
  const directionText =
    direction?.trim() ||
    (signal?.bet_direction && !isGenericBetDirection(signal.bet_direction)
      ? signal.bet_direction.trim()
      : null);

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
      {directionText && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Direction:</span>
          {betLogo && (
            <img src={betLogo} alt="" className="h-4 w-4 shrink-0 object-contain" />
          )}
          {betOU === 'over' && <ArrowUp className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="over" />}
          {betOU === 'under' && <ArrowDown className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="under" />}
          <span className={cn(betLogo || betOU ? 'font-semibold text-foreground' : undefined)}>{directionText}</span>
        </p>
      )}

      {/* Both records as rates against the break-even they have to clear. The
          two text columns left the reader to decide whether 53% was good. */}
      <SignalBacktestChart
        className="mt-3"
        backtestRaw={signal?.typical_hit}
        performance={performance}
      />
    </div>
  );
}
