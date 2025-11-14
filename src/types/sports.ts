export type SportType = 'nfl' | 'cfb' | 'nba' | 'ncaab';

export const SPORT_LABELS: Record<SportType, string> = {
  nfl: 'NFL',
  cfb: 'College Football',
  nba: 'NBA',
  ncaab: 'College Basketball',
};

export const FOOTBALL_SPORTS: SportType[] = ['nfl', 'cfb'];
export const BASKETBALL_SPORTS: SportType[] = ['nba', 'ncaab'];
export const ALL_SUPPORTED_SPORTS: SportType[] = [...FOOTBALL_SPORTS, ...BASKETBALL_SPORTS];


