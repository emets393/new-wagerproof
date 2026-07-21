// Pure TS port of the iOS ParlayGodEngine
// (wagerproof-ios-native/WagerproofKit/Sources/WagerproofServices/ParlayGodEngine.swift).
// Builds Parlay God legs + tickets from the MLB trends bundle and the
// player-props slate. UI-free — the hook feeds it data and memoizes the output.
// Rules validated against live data in .context/parlay_god_demo.py before the
// Swift port; keep the three in sync if a tunable moves. NFL prop legs are
// intentionally NOT ported (out of scope this phase — matchup-widget only on iOS).
import type {
  MLBTrendsSlateBundle,
  OutliersTrendsGame,
  TrendMatchupRecord,
  TrendSplitCell,
} from '@/features/outliers/types';
import { gameLabel } from '@/features/outliers/types';
import {
  appAbbr,
  mlbGameContext,
  mlbNickname,
  trendsAbbr,
} from '@/features/outliers/mlbTrendsEngine';
import { defaultLine, marketLabel } from '@/utils/mlbPlayerProps';
import type {
  ParlayGodCategory,
  ParlayGodPropMatchup,
  ParlayLeg,
  ParlayTicket,
} from './types';
import { PARLAY_CATEGORY_ORDER } from './types';

// MARK: - Tuning (verbatim from the Swift source — do not retune here)

/** A streak qualifies at N of N with N >= this. */
export const MIN_SAMPLE = 3;
/** Steepest juice allowed on a leg (american odds). */
export const ODDS_FLOOR = -350;
/**
 * Alternate-line legs need a deeper current streak than the base gate —
 * otherwise every heavy alt line qualifies and the category is all chalk.
 */
export const ALT_LINE_MIN_STREAK = 7;
/** Rail tickets aim for 5 legs; anything under `MIN_LEGS` doesn't render. */
export const MAX_LEGS = 5;
export const MIN_LEGS = 3;
/** Same-game (matchup widget) tickets are smaller — one game rarely fields five. */
export const SAME_GAME_MAX_LEGS = 4;
/** Max legs per market per ticket, so a card isn't five "1+ Hits". */
export const MARKET_CAP = 2;

// MARK: - Odds math

export function decimalOdds(american: number): number {
  return american > 0 ? 1 + american / 100 : 1 + 100 / -american;
}

// Swift `Double.rounded()` is round-half-away-from-zero; JS Math.round rounds
// half toward +Infinity, so mirror the Swift rule exactly for parity.
function roundHalfAwayFromZero(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

export function americanText(fromDecimal: number): string {
  const d = fromDecimal;
  if (!(d > 1)) return '-';
  if (d >= 2) return `+${roundHalfAwayFromZero((d - 1) * 100)}`;
  return `${roundHalfAwayFromZero(-100 / (d - 1))}`;
}

export function combinedOddsText(legs: ParlayLeg[]): string {
  const decimal = legs.reduce((acc, l) => acc * decimalOdds(l.odds), 1.0);
  return americanText(decimal);
}

function oddsOk(odds: number | null | undefined): boolean {
  if (odds === null || odds === undefined) return false;
  return odds >= ODDS_FLOOR;
}

// MARK: - Leg construction

interface LegInput {
  kind: ParlayLeg['kind'];
  category: ParlayGodCategory;
  gameKey: string;
  matchupLabel: string;
  gameTimeEt: string | null;
  subject: string;
  teamAbbr: string | null;
  playerId: number | null;
  headshotUrl?: string | null;
  betText: string;
  odds: number;
  evidence: string;
  streakN: number;
  marketKey: string;
  backedTeamAbbr?: string | null;
  totalsFamily?: string | null;
  totalsSide?: string | null;
}

/** Mirrors the Swift `ParlayLeg.init` — derives the stable id from its fields. */
function makeLeg(input: LegInput): ParlayLeg {
  return {
    id: `${input.category}|${input.gameKey}|${input.subject}|${input.betText}`,
    kind: input.kind,
    category: input.category,
    gameKey: input.gameKey,
    matchupLabel: input.matchupLabel,
    gameTimeEt: input.gameTimeEt,
    subject: input.subject,
    teamAbbr: input.teamAbbr,
    playerId: input.playerId,
    headshotUrl: input.headshotUrl ?? null,
    betText: input.betText,
    odds: input.odds,
    evidence: input.evidence,
    streakN: input.streakN,
    marketKey: input.marketKey,
    backedTeamAbbr: input.backedTeamAbbr ?? null,
    totalsFamily: input.totalsFamily ?? null,
    totalsSide: input.totalsSide ?? null,
  };
}

// MARK: - Team legs (mlb_team_trends splits + matchups via the Outliers bundle)

const TEAM_MARKETS = ['ml', 'rl', 'ou', 'f5_ml', 'f5_rl', 'f5_ou'];

interface SideSpec {
  sideKey: 'home' | 'away';
  abbr: string;
  oppAbbr: string;
  roleRaw: string | null;
}

interface DimSpec {
  dim: string;
  category: ParlayGodCategory;
  contextText: string;
}

export function teamLegs(bundle: MLBTrendsSlateBundle): ParlayLeg[] {
  const teamByAbbr = new Map(bundle.teams.map((t) => [t.teamAbbr, t]));
  const legs: ParlayLeg[] = [];

  for (const game of bundle.games) {
    const ctx = mlbGameContext(game);
    const sides: SideSpec[] = [
      { sideKey: 'home', abbr: game.homeAb, oppAbbr: game.awayAb, roleRaw: ctx.homeFavDog },
      { sideKey: 'away', abbr: game.awayAb, oppAbbr: game.homeAb, roleRaw: ctx.awayFavDog },
    ];

    for (const { sideKey, abbr, oppAbbr, roleRaw } of sides) {
      const record = teamByAbbr.get(abbr);
      if (!record) continue;

      // Dimension → category, only where today's game matches the context.
      const dims: DimSpec[] = [
        { dim: 'overall', category: 'teamForm', contextText: 'games' },
        {
          dim: sideKey,
          category: 'homeAway',
          contextText: sideKey === 'home' ? 'at home' : 'on the road',
        },
        {
          dim: ctx.dayNightScope,
          category: 'dayNight',
          contextText: ctx.dayNightScope === 'day' ? 'day games' : 'night games',
        },
      ];
      if (roleRaw) {
        dims.push({
          dim: roleRaw,
          category: 'favDog',
          contextText: roleRaw === 'favorite' ? 'as favorite' : 'as underdog',
        });
      }

      for (const market of TEAM_MARKETS) {
        const marketBlock = record.splits[market];
        if (!marketBlock) continue;
        for (const { dim, category, contextText } of dims) {
          const isF5 = market.startsWith('f5_');
          // F5 is its own category, anchored to overall form only.
          if (isF5 && dim !== 'overall') continue;
          const cat: ParlayGodCategory = isF5 ? 'firstFive' : category;
          const block = marketBlock[dim];
          if (!block) continue;
          const perfect = bestPerfectCell(block);
          if (!perfect) continue;
          const [cell, hitSide] = perfect;
          const leg = makeTeamLeg({
            game,
            sideKey,
            abbr,
            oppAbbr,
            market,
            n: cell.n,
            hits: hitSide ? cell.h : cell.l,
            hitSide,
            contextText,
            category: cat,
          });
          if (leg) legs.push(leg);
        }
      }

      // H2H record vs today's opponent → Versus Opponent.
      const h2h = h2hMatchupRecord(record.matchups, oppAbbr);
      if (h2h) {
        for (const market of ['ml', 'rl', 'ou']) {
          const cell = h2h.markets[market];
          if (!cell || cell.n < MIN_SAMPLE) continue;
          const pct = cell.pct ?? (cell.n > 0 ? cell.h / cell.n : 0);
          let hitSide: boolean;
          if (pct === 1.0) hitSide = true;
          else if (pct === 0.0) hitSide = false;
          else continue;
          // H2H cells carry no explicit loss count; the fade side is n - h.
          const hits = hitSide ? cell.h : cell.n - cell.h;
          const leg = makeTeamLeg({
            game,
            sideKey,
            abbr,
            oppAbbr,
            market,
            n: cell.n,
            hits,
            hitSide,
            contextText: `vs ${oppAbbr.toUpperCase()}`,
            category: 'versusOpponent',
          });
          if (leg) legs.push(leg);
        }
      }
    }
  }
  return legs;
}

/** Largest-sample window that went 100% one way (no pushes on the miss side). */
function bestPerfectCell(block: Record<string, TrendSplitCell>): [TrendSplitCell, boolean] | null {
  let best: [TrendSplitCell, boolean] | null = null;
  for (const cell of Object.values(block)) {
    if (cell.n < MIN_SAMPLE) continue;
    let side: boolean;
    if (cell.pct === 1.0) side = true;
    else if (cell.pct === 0.0 && (cell.p ?? 0) === 0) side = false;
    else continue;
    if (best === null || cell.n > best[0].n) best = [cell, side];
  }
  return best;
}

function h2hMatchupRecord(
  matchups: Record<string, TrendMatchupRecord>,
  opponent: string,
): TrendMatchupRecord | null {
  // Bundle records are remapped to app abbrs, but try the trends/app aliases too.
  const keys = [opponent.toUpperCase(), trendsAbbr(opponent), appAbbr(opponent)];
  for (const key of keys) {
    const record = matchups[key];
    if (record) return record;
  }
  return null;
}

interface TeamLegInput {
  game: OutliersTrendsGame;
  sideKey: 'home' | 'away';
  abbr: string;
  oppAbbr: string;
  market: string;
  n: number;
  hits: number;
  hitSide: boolean;
  contextText: string;
  category: ParlayGodCategory;
}

function makeTeamLeg(input: TeamLegInput): ParlayLeg | null {
  const { game, sideKey, abbr, oppAbbr, market, n, hits, hitSide, contextText, category } = input;
  const ctx = game.mlbContext;
  if (!ctx) return null;
  const isHome = sideKey === 'home';
  const isF5 = market.startsWith('f5_');
  const base = isF5 ? market.slice(3) : market;
  const pfx = isF5 ? 'F5 ' : '';
  const teamNick = mlbNickname(isHome ? game.homeTeam : game.awayTeam);
  const oppNick = mlbNickname(isHome ? game.awayTeam : game.homeTeam);

  const build = (opts: {
    subject: string;
    subjectAbbr: string;
    bet: string;
    odds: number | null;
    evidence: string;
    backed: string | null;
    totalsFamily?: string | null;
    totalsSide?: string | null;
  }): ParlayLeg | null => {
    if (opts.odds === null) return null;
    const rounded = roundHalfAwayFromZero(opts.odds);
    if (!oddsOk(rounded)) return null;
    return makeLeg({
      kind: 'team',
      category,
      gameKey: game.id,
      matchupLabel: gameLabel(game),
      gameTimeEt: game.kickoff,
      subject: opts.subject,
      teamAbbr: opts.subjectAbbr,
      playerId: null,
      betText: opts.bet,
      odds: rounded,
      evidence: opts.evidence,
      streakN: n,
      marketKey: market,
      backedTeamAbbr: opts.backed,
      totalsFamily: opts.totalsFamily ?? null,
      totalsSide: opts.totalsSide ?? null,
    });
  };

  switch (base) {
    case 'ml': {
      const teamOdds = isF5
        ? isHome
          ? ctx.f5HomeMl
          : ctx.f5AwayMl
        : isHome
          ? ctx.homeMl
          : ctx.awayMl;
      const oppOdds = isF5
        ? isHome
          ? ctx.f5AwayMl
          : ctx.f5HomeMl
        : isHome
          ? ctx.awayMl
          : ctx.homeMl;
      if (hitSide) {
        return build({
          subject: teamNick,
          subjectAbbr: abbr,
          bet: `${pfx}${abbr} ML`,
          odds: teamOdds,
          evidence: `Won ${hits} straight ${contextText}`,
          backed: abbr,
        });
      }
      // Perfect losing streak → back the opponent.
      return build({
        subject: oppNick,
        subjectAbbr: oppAbbr,
        bet: `${pfx}${oppAbbr} ML`,
        odds: oppOdds,
        evidence: `${abbr} lost ${hits} straight ${contextText}`,
        backed: oppAbbr,
      });
    }
    case 'rl': {
      if (hitSide) {
        const spread = isF5
          ? isHome
            ? ctx.f5HomeSpread
            : ctx.f5AwaySpread
          : isHome
            ? ctx.homeSpread
            : ctx.awaySpread;
        const juice = isF5
          ? isHome
            ? ctx.f5HomeSpreadOdds
            : ctx.f5AwaySpreadOdds
          : isHome
            ? ctx.homeSpreadOdds
            : ctx.awaySpreadOdds;
        if (spread === null) return null;
        return build({
          subject: teamNick,
          subjectAbbr: abbr,
          bet: `${pfx}${abbr} ${spreadText(spread)}`,
          odds: juice,
          evidence: `Covered ${hits} straight ${contextText}`,
          backed: abbr,
        });
      }
      const spread = isF5
        ? isHome
          ? ctx.f5AwaySpread
          : ctx.f5HomeSpread
        : isHome
          ? ctx.awaySpread
          : ctx.homeSpread;
      const juice = isF5
        ? isHome
          ? ctx.f5AwaySpreadOdds
          : ctx.f5HomeSpreadOdds
        : isHome
          ? ctx.awaySpreadOdds
          : ctx.homeSpreadOdds;
      if (spread === null) return null;
      return build({
        subject: oppNick,
        subjectAbbr: oppAbbr,
        bet: `${pfx}${oppAbbr} ${spreadText(spread)}`,
        odds: juice,
        evidence: `${abbr} failed to cover ${hits} straight ${contextText}`,
        backed: oppAbbr,
      });
    }
    case 'ou': {
      const total = isF5 ? ctx.f5TotalLine : ctx.totalLine;
      if (total === null) return null;
      const family = isF5 ? 'f5_ou' : 'ou';
      if (hitSide) {
        return build({
          subject: teamNick,
          subjectAbbr: abbr,
          bet: `${pfx}Over ${lineText(total)}`,
          odds: isF5 ? ctx.f5TotalOverOdds : ctx.totalOverOdds,
          evidence: `Over hit ${hits} straight ${abbr} ${contextText}`,
          backed: null,
          totalsFamily: family,
          totalsSide: 'over',
        });
      }
      return build({
        subject: teamNick,
        subjectAbbr: abbr,
        bet: `${pfx}Under ${lineText(total)}`,
        odds: isF5 ? ctx.f5TotalUnderOdds : ctx.totalUnderOdds,
        evidence: `Under hit ${hits} straight ${abbr} ${contextText}`,
        backed: null,
        totalsFamily: family,
        totalsSide: 'under',
      });
    }
    default:
      return null;
  }
}

function spreadText(value: number): string {
  const body = Number.isInteger(value) ? String(Math.trunc(value)) : value.toFixed(1);
  return value > 0 ? `+${body}` : body;
}

function lineText(value: number): string {
  return Number.isInteger(value) ? String(Math.trunc(value)) : value.toFixed(1);
}

// MARK: - Prop legs (props slate via get_mlb_player_props_l10)

export function propLegs(matchups: ParlayGodPropMatchup[]): ParlayLeg[] {
  const legs: ParlayLeg[] = [];
  for (const matchup of matchups) {
    const gameKey = String(matchup.gamePk);
    const label = `${matchup.awayAbbr} @ ${matchup.homeAbbr}`;
    const teamByPlayer = matchup.teamByPlayerId;

    for (const row of matchup.props) {
      const name = shortName(row.player_name);
      const teamAbbr = teamByPlayer.get(row.player_id) ?? null;

      const propLeg = (opts: {
        category: ParlayGodCategory;
        line: number;
        over: boolean;
        odds: number | null | undefined;
        evidence: string;
        n: number;
      }): ParlayLeg | null => {
        if (!oddsOk(opts.odds)) return null;
        return makeLeg({
          kind: 'prop',
          category: opts.category,
          gameKey,
          matchupLabel: label,
          gameTimeEt: matchup.gameTimeEt,
          subject: name,
          teamAbbr,
          playerId: row.player_id,
          betText: propBetText(row.market, opts.line, opts.over),
          odds: opts.odds as number,
          evidence: opts.evidence,
          streakN: opts.n,
          marketKey: row.market,
        });
      };

      const dl = defaultLine(row.lines);
      if (dl === null) continue;
      const entry = row.lines.find((l) => l.line === dl);
      if (!entry) continue;

      // Recent Form — every one of the last (up to) 10 on one side of the line.
      const recent = row.games.slice(0, 10);
      if (recent.length >= MIN_SAMPLE) {
        if (recent.every((g) => g.v > dl)) {
          const leg = propLeg({
            category: 'recentForm',
            line: dl,
            over: true,
            odds: entry.over,
            evidence: `Hit in ${recent.length} straight games`,
            n: recent.length,
          });
          if (leg) legs.push(leg);
        } else if (recent.every((g) => g.v < dl)) {
          const leg = propLeg({
            category: 'recentForm',
            line: dl,
            over: false,
            odds: entry.under,
            evidence: `Stayed under in ${recent.length} straight`,
            n: recent.length,
          });
          if (leg) legs.push(leg);
        }
      }

      // Day/Night — perfect in today's slot.
      const dayFlag = row.game_is_day ? 1 : 0;
      const slotGames = row.games.filter((g) => g.d === dayFlag).slice(0, 10);
      if (slotGames.length >= MIN_SAMPLE && slotGames.every((g) => g.v > dl)) {
        const slot = row.game_is_day ? 'day' : 'night';
        const leg = propLeg({
          category: 'dayNight',
          line: dl,
          over: true,
          odds: entry.over,
          evidence: `Hit in all ${slotGames.length} ${slot} games`,
          n: slotGames.length,
        });
        if (leg) legs.push(leg);
      }

      // vs Arm Type — perfect against today's opposing-starter archetype.
      if (!row.is_pitcher && row.opp_archetype_today) {
        const arch = row.opp_archetype_today;
        const archGames = row.games.filter((g) => g.a === arch).slice(0, 10);
        if (archGames.length >= MIN_SAMPLE && archGames.every((g) => g.v > dl)) {
          const leg = propLeg({
            category: 'armType',
            line: dl,
            over: true,
            odds: entry.over,
            evidence: `Hit in all ${archGames.length} vs ${arch.toLowerCase()} arms`,
            n: archGames.length,
          });
          if (leg) legs.push(leg);
        }
      }

      // Alternate Lines — a non-default ladder line riding a deep live streak.
      for (const alt of row.lines) {
        if (alt.line === dl) continue;
        if (!oddsOk(alt.over)) continue;
        let streak = 0;
        for (const g of row.games) {
          if (g.v > alt.line) streak += 1;
          else break;
        }
        if (streak >= ALT_LINE_MIN_STREAK) {
          const leg = propLeg({
            category: 'alternateLines',
            line: alt.line,
            over: true,
            odds: alt.over,
            evidence: `Hit in ${streak} straight games`,
            n: streak,
          });
          if (leg) legs.push(leg);
        }
      }
    }
  }
  return legs;
}

function shortName(full: string): string {
  const parts = full.split(' ').filter(Boolean);
  if (parts.length <= 1) return full;
  const first = parts[0]?.charAt(0);
  if (!first) return full;
  return `${first}. ${parts.slice(1).join(' ')}`;
}

function propBetText(market: string, line: number, over: boolean): string {
  const label = marketLabel(market);
  if (over) {
    // ".5" lines read as thresholds: Over 0.5 Hits → "1+ Hits".
    if (!Number.isInteger(line)) {
      return `${Math.trunc(line) + 1}+ ${label}`;
    }
    return `Over ${lineText(line)} ${label}`;
  }
  return `Under ${lineText(line)} ${label}`;
}

// MARK: - Assembly

export interface AssembleOptions {
  maxLegs?: number;
  onePerGame: boolean;
  /** `false` for same-game tickets — a game only has two team subjects. */
  uniqueSubjects?: boolean;
  /** Bet keys (`gameKey|subject|betText`) to skip — used by same-game cards. */
  excluding?: Set<string>;
}

/**
 * Greedy best-first fill honoring: unique subject, unique (game, subject, bet),
 * optional one-leg-per-game, market diversity cap, and conflict rules (opposite
 * totals sides, same-game legs backing different teams). Deterministic — sorted
 * streakN desc → odds desc → id asc, so the same pool yields the same parlay.
 */
export function assemble(pool: ParlayLeg[], opts: AssembleOptions): ParlayLeg[] {
  const maxLegs = opts.maxLegs ?? MAX_LEGS;
  const uniqueSubjects = opts.uniqueSubjects ?? true;
  const excluding = opts.excluding ?? new Set<string>();

  const sorted = [...pool].sort((a, b) => {
    if (a.streakN !== b.streakN) return b.streakN - a.streakN;
    if (a.odds !== b.odds) return b.odds - a.odds;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const chosen: ParlayLeg[] = [];
  const subjects = new Set<string>();
  const gamesUsed = new Set<string>();
  const betsSeen = new Set<string>();
  const marketCounts = new Map<string, number>();

  for (const leg of sorted) {
    const betKey = `${leg.gameKey}|${leg.subject}|${leg.betText}`;
    if (excluding.has(betKey)) continue;
    if (betsSeen.has(betKey)) continue;
    if (uniqueSubjects && subjects.has(leg.subject)) continue;
    if (opts.onePerGame && gamesUsed.has(leg.gameKey)) continue;
    if ((marketCounts.get(leg.marketKey) ?? 0) >= MARKET_CAP) continue;
    if (chosen.some((c) => conflicts(c, leg))) continue;
    chosen.push(leg);
    subjects.add(leg.subject);
    gamesUsed.add(leg.gameKey);
    betsSeen.add(betKey);
    marketCounts.set(leg.marketKey, (marketCounts.get(leg.marketKey) ?? 0) + 1);
    if (chosen.length === maxLegs) break;
  }
  return chosen;
}

function conflicts(a: ParlayLeg, b: ParlayLeg): boolean {
  if (a.gameKey !== b.gameKey) return false;
  if (a.totalsFamily !== null && a.totalsFamily === b.totalsFamily && a.totalsSide !== b.totalsSide) {
    return true;
  }
  if (a.backedTeamAbbr !== null && b.backedTeamAbbr !== null && a.backedTeamAbbr !== b.backedTeamAbbr) {
    return true;
  }
  return false;
}

function exclusionKey(leg: ParlayLeg): string {
  return `${leg.gameKey}|${leg.subject}|${leg.betText}`;
}

// MARK: - Ticket building

/**
 * One themed 5-leg ticket per category (cross-game), game markets ONLY. Parlay
 * God mirrors the Outliers page's markets (ML / RL / totals / F5); player props
 * are Props Cheats territory. Categories that can't field `MIN_LEGS` are dropped.
 */
export function slateTickets(pool: ParlayLeg[]): ParlayTicket[] {
  return buildCategoryTickets(
    pool.filter((l) => l.kind === 'team'),
    'slate',
    true,
  );
}

/** Player-prop legs only — the "Props Cheats" rail. */
export function propsTickets(pool: ParlayLeg[]): ParlayTicket[] {
  return buildCategoryTickets(
    pool.filter((l) => l.kind === 'prop'),
    'props',
    false,
  );
}

function buildCategoryTickets(
  pool: ParlayLeg[],
  idPrefix: string,
  onePerGame: boolean,
): ParlayTicket[] {
  const byCategory = new Map<ParlayGodCategory, ParlayLeg[]>();
  for (const leg of pool) {
    const list = byCategory.get(leg.category) ?? [];
    list.push(leg);
    byCategory.set(leg.category, list);
  }

  const tickets: ParlayTicket[] = [];
  for (const category of PARLAY_CATEGORY_ORDER) {
    const legsForCategory = byCategory.get(category);
    if (!legsForCategory) continue;
    const chosen = assemble(legsForCategory, { maxLegs: MAX_LEGS, onePerGame });
    if (chosen.length < MIN_LEGS) continue;
    tickets.push({
      id: `${idPrefix}-${category}`,
      category,
      legs: chosen,
      combinedOddsText: combinedOddsText(chosen),
    });
  }
  return tickets;
}

/**
 * Up to `maxCards` same-game tickets for one matchup, mixing team + prop legs
 * across categories. Later cards exclude earlier cards' bets. Unused by the
 * Outliers page — ported for parity with the iOS matchup-widget surface.
 */
export function gameTickets(pool: ParlayLeg[], gameKey: string, maxCards = 3): ParlayTicket[] {
  const gamePool = pool.filter((l) => l.gameKey === gameKey);
  const used = new Set<string>();
  const tickets: ParlayTicket[] = [];
  for (let index = 0; index < maxCards; index++) {
    const chosen = assemble(gamePool, {
      maxLegs: SAME_GAME_MAX_LEGS,
      onePerGame: false,
      uniqueSubjects: false,
      excluding: used,
    });
    if (chosen.length < MIN_LEGS) break;
    tickets.push({
      id: `game-${gameKey}-${index}`,
      category: chosen[0].category,
      legs: chosen,
      combinedOddsText: combinedOddsText(chosen),
    });
    for (const leg of chosen) used.add(exclusionKey(leg));
  }
  return tickets;
}

/** Convenience the hook/dashboard call: build both cross-game rails at once. */
export function buildParlayTickets(input: {
  bundle: MLBTrendsSlateBundle | null;
  propMatchups: ParlayGodPropMatchup[];
}): { slateTickets: ParlayTicket[]; propsTickets: ParlayTicket[] } {
  const teamPool = input.bundle ? teamLegs(input.bundle) : [];
  const propPool = propLegs(input.propMatchups);
  return {
    slateTickets: slateTickets(teamPool),
    propsTickets: propsTickets(propPool),
  };
}
