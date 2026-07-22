import { describe, expect, it } from 'vitest';
import { isSportInSeason, sportSeasonStartsLabel } from './sportSeasons';

describe('sport season status', () => {
  it('recognizes a summer MLB slate while fall and winter sports are inactive', () => {
    const july = new Date(2026, 6, 21);

    expect(isSportInSeason('mlb', july)).toBe(true);
    expect(isSportInSeason('nfl', july)).toBe(false);
    expect(isSportInSeason('cfb', july)).toBe(false);
    expect(isSportInSeason('nba', july)).toBe(false);
    expect(isSportInSeason('ncaab', july)).toBe(false);
  });

  it('handles seasons that cross into a new calendar year', () => {
    const january = new Date(2027, 0, 10);

    expect(isSportInSeason('nfl', january)).toBe(true);
    expect(isSportInSeason('cfb', january)).toBe(true);
    expect(isSportInSeason('nba', january)).toBe(true);
    expect(isSportInSeason('ncaab', january)).toBe(true);
  });

  it('provides return copy for every inactive sport label', () => {
    expect(sportSeasonStartsLabel('cfb')).toBe('Starts 8/20');
    expect(sportSeasonStartsLabel('mlb')).toBe('Starts 3/20');
  });
});
