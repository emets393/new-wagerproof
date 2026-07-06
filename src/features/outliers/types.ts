// Web port of the iOS Outliers Trends models
// (wagerproof-ios-native/WagerproofKit/Sources/WagerproofModels/OutliersTrends.swift).

export type OutliersTrendsSport = 'nfl' | 'ncaaf' | 'mlb' | 'nba' | 'ncaab';

export type OutliersTrendsSubject = 'all' | 'teams' | 'coaches' | 'refs' | 'players';

export type OutliersTrendsSubjectKind = 'team' | 'coach' | 'referee' | 'player';

/** 'all' or a slate game id. */
export type OutliersTrendsMatchupFilter = string;

export const OUTLIERS_SPORTS: OutliersTrendsSport[] = ['nfl', 'ncaaf', 'mlb', 'nba', 'ncaab'];

export const OUTLIERS_SPORT_LABELS: Record<OutliersTrendsSport, string> = {
  nfl: 'NFL',
  ncaaf: 'NCAAF',
  mlb: 'MLB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

export const OUTLIERS_SUBJECT_LABELS: Record<OutliersTrendsSubject, string> = {
  all: 'All',
  teams: 'Teams',
  coaches: 'Coaches',
  refs: 'Refs',
  players: 'Players',
};

export function sportHasTrendsData(sport: OutliersTrendsSport): boolean {
  return sport === 'nfl' || sport === 'ncaaf' || sport === 'mlb';
}

export function allowedSubjects(sport: OutliersTrendsSport): OutliersTrendsSubject[] {
  switch (sport) {
    case 'nfl':
      return ['all', 'teams', 'coaches', 'refs', 'players'];
    case 'ncaaf':
      return ['all', 'teams', 'coaches'];
    case 'mlb':
      return ['teams'];
    default:
      return [];
  }
}

// MARK: - Slate

export interface OutliersTrendsMLBContext {
  homeMl: number | null;
  awayMl: number | null;
  homeSpread: number | null;
  awaySpread: number | null;
  totalLine: number | null;
  f5HomeMl: number | null;
  f5AwayMl: number | null;
  f5HomeSpread: number | null;
  f5AwaySpread: number | null;
  f5TotalLine: number | null;
  homeSpreadOdds: number | null;
  awaySpreadOdds: number | null;
  totalOverOdds: number | null;
  totalUnderOdds: number | null;
  f5HomeSpreadOdds: number | null;
  f5AwaySpreadOdds: number | null;
  f5TotalOverOdds: number | null;
  f5TotalUnderOdds: number | null;
  isDivisional: boolean;
  isDayGame: boolean;
  seriesGameNumber: number | null;
}

export interface OutliersTrendsGame {
  id: string;
  season: number;
  week: number;
  awayAb: string;
  homeAb: string;
  awayTeam: string;
  homeTeam: string;
  fgSpreadClose: number | null;
  fgTotalClose: number | null;
  kickoff: string | null;
  slot: string | null;
  assignedReferee: string | null;
  mlbContext?: OutliersTrendsMLBContext | null;
}

export function gameLabel(game: OutliersTrendsGame): string {
  return `${game.awayAb} @ ${game.homeAb}`;
}

// MARK: - Display cards

export interface OutliersTrendsBettingLine {
  id: string;
  label: string;
  lineText: string;
  oddsText: string | null;
  bookName: string | null;
  bookLogoUrl: string | null;
  teamAbbr: string | null;
}

export interface OutliersTrendsCardRow {
  id: string;
  text: string;
  coverageNote: string | null;
  /** 0-1 dominant side rate for this row. */
  dominantPct: number;
  sampleN: number;
}

export interface OutliersTrendsCard {
  id: string;
  gameId: string;
  matchupLabel: string;
  subjectKind: OutliersTrendsSubjectKind;
  subjectName: string;
  subjectDetail: string | null;
  teamAbbr: string | null;
  playerId: string | null;
  marketKey: string;
  betTypeLabel: string;
  trendValue: number;
  trendSampleN: number;
  headshotUrl: string | null;
  bettingLines: OutliersTrendsBettingLine[];
  rows: OutliersTrendsCardRow[];
  isPlayerOverflow: boolean;
}

export interface OutliersTrendsMarketSection {
  marketKey: string;
  title: string;
  cards: OutliersTrendsCard[];
}

// MARK: - Split primitives (shared with the MLB client-side engine)

export interface TrendSplitCell {
  h: number;
  l: number;
  p: number | null;
  n: number;
  pct: number;
}

export interface TrendH2HCell {
  h: number;
  n: number;
  pct: number | null;
}

/** market → dimension → window → cell. */
export type TrendSplits = Record<string, Record<string, Record<string, TrendSplitCell>>>;

export interface TrendMatchupRecord {
  meetings: number | null;
  markets: Record<string, TrendH2HCell>;
}

export interface MLBTeamTrendRecord {
  teamAbbr: string;
  teamName: string | null;
  season: number;
  throughDate: string | null;
  splits: TrendSplits;
  matchups: Record<string, TrendMatchupRecord>;
}

export interface MLBTrendsSlateBundle {
  games: OutliersTrendsGame[];
  season: number;
  throughDate: string | null;
  teams: MLBTeamTrendRecord[];
}
