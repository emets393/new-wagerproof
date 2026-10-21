import type { PublicSport } from './types';

/**
 * Which league the page opens on when the URL has no sport.
 * NFL leads through the football season whenever that league is on the board.
 * On 20 Oct 2026 that is NFL, even if an NBA tip is sooner.
 */
export function pickLandingSport(
  present: readonly PublicSport[],
  now = new Date(),
): PublicSport | 'all' {
  const has = (sport: PublicSport) => present.includes(sport);
  const month = now.getMonth();
  const nflSeason = month >= 8 || month <= 1;
  if (nflSeason && has('nfl')) return 'nfl';
  const cfbSeason = month >= 7 && month <= 11;
  if (cfbSeason && has('cfb')) return 'cfb';
  const nbaSeason = month >= 9 || month <= 5;
  if (nbaSeason && has('nba')) return 'nba';
  if (has('ncaab')) return 'ncaab';
  return present[0] ?? 'all';
}
