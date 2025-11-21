/**
 * Sportsbook configuration for The Odds API integration
 */

export interface Sportsbook {
  key: string;
  displayName: string;
  logo?: string;
  isTop5: boolean;
}

// Top 5 most used US sportsbooks (displayed as prominent buttons)
// Based on market share and popularity in the US market
export const TOP_SPORTSBOOKS: Sportsbook[] = [
  {
    key: 'draftkings',
    displayName: 'DraftKings',
    isTop5: true,
  },
  {
    key: 'fanduel',
    displayName: 'FanDuel',
    isTop5: true,
  },
  {
    key: 'betmgm',
    displayName: 'BetMGM',
    isTop5: true,
  },
  {
    key: 'betrivers',
    displayName: 'BetRivers',
    isTop5: true,
  },
  {
    key: 'espnbet',
    displayName: 'ESPN BET',
    isTop5: true,
  },
];

// Additional free US sportsbooks (shown in dropdown)
// Only includes free US bookmakers (excludes paid subscription ones like Caesars/williamhill_us, fanatics, rebet)
export const ADDITIONAL_SPORTSBOOKS: Sportsbook[] = [
  {
    key: 'betonlineag',
    displayName: 'BetOnline.ag',
    isTop5: false,
  },
  {
    key: 'betus',
    displayName: 'BetUS',
    isTop5: false,
  },
  {
    key: 'bovada',
    displayName: 'Bovada',
    isTop5: false,
  },
  {
    key: 'lowvig',
    displayName: 'LowVig.ag',
    isTop5: false,
  },
  {
    key: 'mybookieag',
    displayName: 'MyBookie.ag',
    isTop5: false,
  },
  {
    key: 'ballybet',
    displayName: 'Bally Bet',
    isTop5: false,
  },
  {
    key: 'betanysports',
    displayName: 'BetAnything',
    isTop5: false,
  },
  {
    key: 'betparx',
    displayName: 'betPARX',
    isTop5: false,
  },
  {
    key: 'fliff',
    displayName: 'Fliff',
    isTop5: false,
  },
  {
    key: 'hardrockbet',
    displayName: 'Hard Rock Bet',
    isTop5: false,
  },
];

export const ALL_SPORTSBOOKS = [...TOP_SPORTSBOOKS, ...ADDITIONAL_SPORTSBOOKS];

// Sport key mapping: our game_type -> The Odds API sport key
export const SPORT_KEY_MAP: Record<string, string> = {
  'nfl': 'americanfootball_nfl',
  'cfb': 'americanfootball_ncaaf',
  'nba': 'basketball_nba',
  'ncaab': 'basketball_ncaab',
};

// Get The Odds API sport key from our game type
export function getOddsApiSportKey(gameType: string): string | null {
  return SPORT_KEY_MAP[gameType] || null;
}

// Get sportsbook by key
export function getSportsbookByKey(key: string): Sportsbook | undefined {
  return ALL_SPORTSBOOKS.find(sb => sb.key === key);
}

