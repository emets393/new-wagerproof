// Web port of the iOS Parlay God models
// (wagerproof-ios-native/WagerproofKit/Sources/WagerproofModels/ParlayGod.swift).
// The "data contract" §5a in specs/outliers_spec.md — the dashboard compiles
// against these exact names. Keep in lockstep with the Swift source and
// .claude/docs/16_parlay_god.md.
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';

// MARK: - Categories

/**
 * The "why it's perfect" axis for a leg. Each rail card is one category: every
 * leg on it is backed by a 100% streak in that dimension.
 */
export type ParlayGodCategory =
  | 'versusOpponent'
  | 'recentForm'
  | 'alternateLines'
  | 'homeAway'
  | 'teamForm'
  | 'favDog'
  | 'dayNight'
  | 'firstFive'
  | 'armType';

/** Rail display order — the user-confirmed five first, extras after. */
export const PARLAY_CATEGORY_ORDER: ParlayGodCategory[] = [
  'versusOpponent',
  'recentForm',
  'alternateLines',
  'homeAway',
  'teamForm',
  'favDog',
  'dayNight',
  'firstFive',
  'armType',
];

export const PARLAY_CATEGORY_TITLE: Record<ParlayGodCategory, string> = {
  versusOpponent: '100% Versus Opponent',
  recentForm: '100% Recent Form',
  alternateLines: '100% Alternate Lines',
  homeAway: '100% Home/Away',
  teamForm: '100% Team Form',
  favDog: '100% Fav vs Dog',
  dayNight: '100% Day/Night',
  firstFive: '100% First 5',
  armType: '100% vs Arm Type',
};

/**
 * lucide-react icon names standing in for the iOS SF Symbols. Kept as strings
 * so this module stays UI-free — the dashboard resolves the component by name.
 */
export const PARLAY_CATEGORY_ICON: Record<ParlayGodCategory, string> = {
  versusOpponent: 'Shield',
  recentForm: 'Flame',
  alternateLines: 'SlidersHorizontal',
  homeAway: 'Home',
  teamForm: 'LineChart',
  favDog: 'PawPrint',
  dayNight: 'MoonStar',
  firstFive: 'Hash',
  armType: 'PersonStanding',
};

// MARK: - Legs

export type ParlayLegKind = 'team' | 'prop';

/**
 * One bettable selection backed by a perfect (100%) streak. Legs are the atoms
 * the engine assembles into `ParlayTicket`s.
 */
export interface ParlayLeg {
  /** `${category}|${gameKey}|${subject}|${betText}` — stable, dedupe-friendly. */
  id: string;
  kind: ParlayLegKind;
  category: ParlayGodCategory;
  /** `String(game_pk)` — joins `OutliersTrendsGame.id` and `MatchupGame.game_pk`. */
  gameKey: string;
  matchupLabel: string;
  gameTimeEt: string | null;
  /** Display name: team nickname or short player name ("S. Kwan"). */
  subject: string;
  teamAbbr: string | null;
  /** MLB player id — headshot key on prop legs. */
  playerId: number | null;
  /** Direct headshot URL (NFL props ship one; MLB resolves off `playerId`). */
  headshotUrl: string | null;
  /** The actual bet: "CWS ML", "TOR -1.5", "Over 8.5", "2+ Hits". */
  betText: string;
  /** American odds. */
  odds: number;
  /** Streak credential: "Won 5 straight as underdog". */
  evidence: string;
  streakN: number;
  /** Market key for per-card diversity capping (ml, rl, ou, f5_ml, batter_hits, ...). */
  marketKey: string;
  /** Team the bet backs (ML/RL); same-game legs backing different teams conflict. */
  backedTeamAbbr: string | null;
  /** Set for totals legs so Over/Under of the same market can't share a card. */
  totalsFamily: string | null;
  totalsSide: string | null;
}

export const legOddsText = (l: ParlayLeg): string => (l.odds > 0 ? `+${l.odds}` : `${l.odds}`);

/** "5/5", "10/10" — perfect streaks are always N of N. */
export const legFractionText = (l: ParlayLeg): string => `${l.streakN}/${l.streakN}`;

// MARK: - Tickets

/** An assembled parlay: 3-5 conflict-free legs plus the combined price. */
export interface ParlayTicket {
  /** "slate-recentForm" | "props-dayNight" | "game-<pk>-0". */
  id: string;
  category: ParlayGodCategory;
  legs: ParlayLeg[];
  combinedOddsText: string;
}

/** True when every leg comes from the same game (matchup-widget tickets). */
export const ticketIsSameGame = (t: ParlayTicket): boolean =>
  new Set(t.legs.map((l) => l.gameKey)).size === 1;

// MARK: - Prop-slate input

/**
 * Web prop-slate input for `propLegs`, assembled in the hook from the existing
 * MLB props hooks. `teamByPlayerId` may be partial — leg avatars fall back to
 * the MLB headshot by `playerId`, so a missing team tint is cosmetic only.
 */
export interface ParlayGodPropMatchup {
  gamePk: number;
  awayAbbr: string;
  homeAbbr: string;
  gameTimeEt: string | null;
  teamByPlayerId: Map<number, string>;
  /** Rows from `get_mlb_player_props_l10`. */
  props: MlbPlayerPropRow[];
}
