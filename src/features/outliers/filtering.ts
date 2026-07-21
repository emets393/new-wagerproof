// Web port of the iOS filter/section pipeline
// (wagerproof-ios-native/WagerproofKit/Sources/WagerproofServices/NFLTrendsEngine.swift
// `filterPrecomputedCards` + OutliersTrends.swift `OutliersTrendsMarketSection.sections`).
import type {
  OutliersTrendsCard,
  OutliersTrendsGame,
  OutliersTrendsMarketSection,
  OutliersTrendsMatchupFilter,
  OutliersTrendsSport,
  OutliersTrendsSubject,
  OutliersTrendsSubjectKind,
} from './types';

/** Max cards per market carousel — cards arrive best-first, so this keeps the strongest trends. */
export const SECTION_CARD_CAP = 24;

/** Sport-qualified matchup key (`"nfl:2025_10_KC_BUF"`), unique across merged slates. */
export function matchupKey(sport: OutliersTrendsSport, gameId: string): string {
  return `${sport}:${gameId}`;
}

/**
 * Narrows a multi-select matchup filter to the raw game ids belonging to one
 * sport. Returns null when nothing is selected (= no matchup filter at all).
 *
 * An EMPTY set is meaningful and distinct from null: it means games were picked
 * but none of them are this sport's, so this slate contributes nothing.
 */
export function matchupIdsForSport(
  selection: OutliersTrendsMatchupFilter[],
  sport: OutliersTrendsSport,
): Set<string> | null {
  if (selection.length === 0) return null;
  const ids = new Set<string>();
  const prefix = `${sport}:`;
  for (const key of selection) {
    if (key.startsWith(prefix)) ids.add(key.slice(prefix.length));
  }
  return ids;
}

/** Subject pill value → the card kind it keeps ('all' keeps everything). */
const SUBJECT_TO_KIND: Partial<Record<OutliersTrendsSubject, OutliersTrendsSubjectKind>> = {
  teams: 'team',
  coaches: 'coach',
  refs: 'referee',
  players: 'player',
};

/**
 * Only subjects tied to the current slate — the assigned referee, or a
 * team/coach/player whose team key matches either side of the card's game.
 */
function matchesSlateScope(
  card: OutliersTrendsCard,
  gamesById: Map<string, OutliersTrendsGame>,
): boolean {
  const game = gamesById.get(card.gameId);
  if (!game) return false;
  if (card.subjectKind === 'referee') {
    const assigned = game.assignedReferee;
    if (!assigned || assigned.length === 0) return false;
    return card.subjectName === assigned;
  }
  const teamKey = card.teamAbbr;
  if (!teamKey) return false;
  return (
    teamKey === game.homeAb ||
    teamKey === game.awayAb ||
    teamKey === game.homeTeam ||
    teamKey === game.awayTeam
  );
}

/** NFL player prop cards without an actual sportsbook line have nothing to bet — hide them. */
function hasDisplayableBettingLine(card: OutliersTrendsCard, sport: OutliersTrendsSport): boolean {
  if (sport === 'ncaaf') return true;
  if (card.subjectKind === 'player' && !card.isPlayerOverflow) {
    return card.bettingLines.length > 0;
  }
  return true;
}

/**
 * Full iOS filter pipeline: slate scope → subject → displayable line →
 * matchup → sort by trend strength (sample size tiebreak).
 */
export function filterTrendCards(
  cards: OutliersTrendsCard[],
  games: OutliersTrendsGame[],
  sport: OutliersTrendsSport,
  subject: OutliersTrendsSubject,
  /** Allowed game ids for this sport; null means no matchup filter. */
  matchupIds: Set<string> | null,
): OutliersTrendsCard[] {
  const gamesById = new Map(games.map((g) => [g.id, g]));
  const wantedKind = SUBJECT_TO_KIND[subject];
  return cards
    .filter((card) => {
      if (!matchesSlateScope(card, gamesById)) return false;
      if (wantedKind && card.subjectKind !== wantedKind) return false;
      if (!hasDisplayableBettingLine(card, sport)) return false;
      return matchupIds === null || matchupIds.has(card.gameId);
    })
    .sort((a, b) => b.trendValue - a.trendValue || b.trendSampleN - a.trendSampleN);
}

/** Canonical section order across every sport; unranked markets fall to the end. */
const MARKET_ORDER: string[] = [
  'spread', 'moneyline', 'total', 'team_total', 'h1_spread', 'h1_total',
  'ml', 'rl', 'ou', 'f5_ml', 'f5_rl', 'f5_ou',
  'player_pass_yds', 'player_pass_tds', 'player_rush_yds',
  'player_reception_yds', 'player_receptions', 'player_anytime_td',
];

function marketRank(key: string): number {
  const idx = MARKET_ORDER.indexOf(key);
  return idx === -1 ? MARKET_ORDER.length : idx;
}

/**
 * Buckets an already-sorted (best-first) card list by market into ordered
 * sections, capping each carousel. Player-overflow placeholders are dropped —
 * carousels scroll instead.
 */
export function buildMarketSections<TCard extends OutliersTrendsCard>(
  cards: TCard[],
  cap: number = SECTION_CARD_CAP,
): OutliersTrendsMarketSection<TCard>[] {
  const keyOrder: string[] = [];
  const groups = new Map<string, TCard[]>();
  for (const card of cards) {
    if (card.isPlayerOverflow) continue;
    let bucket = groups.get(card.marketKey);
    if (!bucket) {
      bucket = [];
      groups.set(card.marketKey, bucket);
      keyOrder.push(card.marketKey);
    }
    bucket.push(card);
  }
  return keyOrder
    .map((key) => {
      const bucket = groups.get(key) ?? [];
      return {
        marketKey: key,
        title: bucket[0]?.betTypeLabel ?? key,
        cards: bucket.slice(0, cap),
      };
    })
    .sort((a, b) => marketRank(a.marketKey) - marketRank(b.marketKey));
}
