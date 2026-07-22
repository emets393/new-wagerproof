import type { GamesSport } from './types';

interface SportSeasonWindow {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  startsLabel: string;
}

/**
 * Broad league windows used to organize the sport picker. These include each
 * league's postseason and intentionally use month-level return copy because
 * exact opening dates move from year to year.
 */
const SPORT_SEASONS: Record<GamesSport, SportSeasonWindow> = {
  nfl: { startMonth: 9, startDay: 1, endMonth: 2, endDay: 15, startsLabel: 'Starts 9/1' },
  cfb: { startMonth: 8, startDay: 20, endMonth: 1, endDay: 20, startsLabel: 'Starts 8/20' },
  nba: { startMonth: 10, startDay: 15, endMonth: 6, endDay: 30, startsLabel: 'Starts 10/15' },
  ncaab: { startMonth: 11, startDay: 1, endMonth: 4, endDay: 15, startsLabel: 'Starts 11/1' },
  mlb: { startMonth: 3, startDay: 20, endMonth: 11, endDay: 5, startsLabel: 'Starts 3/20' },
};

function monthDayValue(month: number, day: number): number {
  return month * 100 + day;
}

export function isSportInSeason(sport: GamesSport, date = new Date()): boolean {
  const season = SPORT_SEASONS[sport];
  const today = monthDayValue(date.getMonth() + 1, date.getDate());
  const start = monthDayValue(season.startMonth, season.startDay);
  const end = monthDayValue(season.endMonth, season.endDay);

  // Football and basketball seasons cross the calendar-year boundary.
  return start <= end ? today >= start && today <= end : today >= start || today <= end;
}

export function sportSeasonStartsLabel(sport: GamesSport): string {
  return SPORT_SEASONS[sport].startsLabel;
}
