import type { LineupRow, MatchupGame } from '@/types/mlb-matchups';
import type { MlbPlayerPropRow, PropComputedAtLine } from '@/types/mlb-player-props';
import { marketLabel, pickHeadlineProp } from '@/utils/mlbPlayerProps';
import { formatMlbToolTime, mlbToolTimeSortKey } from '../shared/feedUtils';
import { mlbToolTeam } from '../shared/teams';
import type { MlbToolFeedItem } from '../shared/types';

/**
 * Turns the raw prop rows into a ranked list of plays. The legacy page rendered
 * every posted market as an accordion and left "which of these is actually
 * worth a look" to the reader; here every prop carries its last-10 clear rate
 * against the break-even the posted odds imply.
 */

/** Fewer recent games than this and the hit rate is noise, not a read. */
export const MIN_PROP_GAMES = 5;

export interface PropPlay {
  playerId: number;
  playerName: string;
  isPitcher: boolean;
  market: string;
  marketLabel: string;
  computed: PropComputedAtLine;
  /** Last-10 clear rate, 0-100. Null when the player has no recent games. */
  l10Pct: number | null;
  /** Break-even win rate the posted over price implies, 0-100. */
  impliedPct: number | null;
  /** l10Pct − impliedPct: how much the recent form beats the price. */
  edgePts: number | null;
  /** Lineup slot when the player is in a posted lineup. */
  battingOrder: number | null;
  batSide: string | null;
  side: 'away' | 'home' | null;
}

/** American odds → break-even win probability, as a percentage. */
export function impliedProbabilityPct(odds: number | null | undefined): number | null {
  if (odds == null || !Number.isFinite(odds) || odds === 0) return null;
  const value = Number(odds);
  const prob = value > 0 ? 100 / (value + 100) : -value / (-value + 100);
  return prob * 100;
}

function buildPlay(
  rows: MlbPlayerPropRow[],
  lineupByPlayer: Map<number, { row: LineupRow; side: 'away' | 'home' }>,
): PropPlay | null {
  const headline = pickHeadlineProp(rows);
  if (!headline) return null;

  const { row, computed } = headline;
  const l10Pct = computed.l10.games > 0 ? (computed.l10.over / computed.l10.games) * 100 : null;
  const impliedPct = impliedProbabilityPct(computed.overOdds);
  const slot = lineupByPlayer.get(row.player_id);

  return {
    playerId: row.player_id,
    playerName: row.player_name,
    isPitcher: row.is_pitcher,
    market: row.market,
    marketLabel: marketLabel(row.market),
    computed,
    l10Pct,
    impliedPct,
    edgePts: l10Pct !== null && impliedPct !== null ? l10Pct - impliedPct : null,
    battingOrder: slot?.row.batting_order ?? null,
    batSide: slot?.row.bat_side ?? null,
    side: slot?.side ?? null,
  };
}

/**
 * One play per player (their strongest posted market), ranked by how far the
 * recent clear rate beats the posted price. Plays with too few recent games
 * sort last rather than being dropped — the row still says the line exists.
 */
export function buildPropPlays(
  props: MlbPlayerPropRow[],
  awayLineup: LineupRow[],
  homeLineup: LineupRow[],
  game: MatchupGame,
): PropPlay[] {
  const lineupByPlayer = new Map<number, { row: LineupRow; side: 'away' | 'home' }>();
  for (const row of awayLineup) lineupByPlayer.set(row.player_id, { row, side: 'away' });
  for (const row of homeLineup) lineupByPlayer.set(row.player_id, { row, side: 'home' });

  const byPlayer = new Map<number, MlbPlayerPropRow[]>();
  for (const row of props) {
    const list = byPlayer.get(row.player_id) ?? [];
    list.push(row);
    byPlayer.set(row.player_id, list);
  }

  const plays: PropPlay[] = [];
  for (const rows of byPlayer.values()) {
    const play = buildPlay(rows, lineupByPlayer);
    if (!play) continue;
    // Starters aren't in a posted lineup, so their side comes off the game row.
    if (play.side === null && play.isPitcher) {
      play.side =
        play.playerId === game.away_sp_id ? 'away' : play.playerId === game.home_sp_id ? 'home' : null;
    }
    plays.push(play);
  }

  return plays.sort((a, b) => {
    const aQualifies = (a.computed.l10.games ?? 0) >= MIN_PROP_GAMES;
    const bQualifies = (b.computed.l10.games ?? 0) >= MIN_PROP_GAMES;
    if (aQualifies !== bQualifies) return aQualifies ? -1 : 1;
    return (b.edgePts ?? b.l10Pct ?? -1) - (a.edgePts ?? a.l10Pct ?? -1);
  });
}

export interface PropMatchupFeedItem extends MlbToolFeedItem {
  game: MatchupGame;
  /** Every posted market's best line per player, best play first. */
  plays: PropPlay[];
  /** The single strongest play, or null when nothing is posted yet. */
  topPlay: PropPlay | null;
  /** True until this game's props query resolves. */
  propsLoading: boolean;
}

export function buildPropMatchupFeedItems(
  games: MatchupGame[],
  propsByGamePk: Map<number, MlbPlayerPropRow[]>,
  matchupByGamePk: Map<number, { awayLineup: LineupRow[]; homeLineup: LineupRow[] }>,
  propsLoading: boolean,
): PropMatchupFeedItem[] {
  return games
    .map((game) => {
      const props = propsByGamePk.get(game.game_pk) ?? [];
      const matchup = matchupByGamePk.get(game.game_pk);
      const plays = buildPropPlays(
        props,
        matchup?.awayLineup ?? [],
        matchup?.homeLineup ?? [],
        game,
      );
      const qualified = plays.filter((p) => p.computed.l10.games >= MIN_PROP_GAMES);

      return {
        id: String(game.game_pk),
        gamePk: game.game_pk,
        away: mlbToolTeam(game.away_abbr, game.away_team_name),
        home: mlbToolTeam(game.home_abbr, game.home_team_name),
        gameDate: game.official_date,
        gameTimeLabel: formatMlbToolTime(game.game_time),
        timeSortKey: mlbToolTimeSortKey(game.official_date, game.game_time),
        game,
        plays,
        topPlay: qualified[0] ?? plays[0] ?? null,
        propsLoading: propsLoading && props.length === 0,
      } satisfies PropMatchupFeedItem;
    })
    .sort((a, b) => a.timeSortKey.localeCompare(b.timeSortKey));
}

/** Family name only — feed captions and paged rows have no room for full names. */
export function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}
