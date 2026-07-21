/**
 * Guardrail for the snapshot → p_filters transcription. Feeds representative snapshots through each
 * adapter's `toRpcFilters` and asserts golden p_filters — so the extraction from the retired pages'
 * `buildFilters` can't silently drift. Independent of the 8 protected engine tests.
 */
import { describe, it, expect } from 'vitest';
import { nflAdapter } from './nfl';
import { cfbAdapter } from './cfb';
import { mlbAdapter } from './mlb';

describe('NFL toRpcFilters', () => {
  it('emits nothing for a fresh default snapshot', () => {
    expect(nflAdapter.toRpcFilters(nflAdapter.reset('fg_spread'))).toEqual({});
  });

  it('signs the favorite spread and keeps side', () => {
    const s = { ...nflAdapter.reset('fg_spread'), side: 'home', spreadSide: 'favorite', spreadSize: [3, 7] };
    const f = nflAdapter.toRpcFilters(s);
    expect(f.side).toBe('home');
    expect(f.spread_min).toBe(-7);
    expect(f.spread_max).toBe(-3);
  });

  it('sends day_of_week as an array', () => {
    const f = nflAdapter.toRpcFilters({ ...nflAdapter.reset('fg_spread'), daysOfWeek: ['Thu'] });
    expect(Array.isArray(f.day_of_week)).toBe(true);
    expect(f.day_of_week).toEqual(['Thu']);
  });

  it('clamps the season floor on 2023+-only markets (no season_min emitted at floor)', () => {
    expect(nflAdapter.toRpcFilters(nflAdapter.reset('h1_spread'))).toEqual({});
  });

  it('gates fav_dog to team_total only', () => {
    expect(nflAdapter.toRpcFilters({ ...nflAdapter.reset('fg_spread'), favDog: 'favorite' }).fav_dog).toBeUndefined();
    expect(nflAdapter.toRpcFilters({ ...nflAdapter.reset('team_total'), favDog: 'favorite' }).fav_dog).toBe('favorite');
  });
});

describe('CFB toRpcFilters', () => {
  it('emits nothing for a fresh default snapshot', () => {
    expect(cfbAdapter.toRpcFilters(cfbAdapter.reset('fg_spread'))).toEqual({});
  });

  it('maps a single conference to f.conference', () => {
    const f = cfbAdapter.toRpcFilters({ ...cfbAdapter.reset('fg_spread'), selectedConferences: ['SEC'] });
    expect(f.conference).toBe('SEC');
  });

  it('expands multi-conference selection into a sorted team list', () => {
    const map = { SEC: ['Alabama', 'Georgia'], 'Big Ten': ['Michigan', 'Ohio State'] };
    const f = cfbAdapter.toRpcFilters(
      { ...cfbAdapter.reset('fg_spread'), selectedConferences: ['Big Ten', 'SEC'] },
      { teamOptions: [], conferenceTeamMap: map },
    );
    expect(f.team).toEqual(['Alabama', 'Georgia', 'Michigan', 'Ohio State']);
  });

  it('skips side on game totals', () => {
    expect(cfbAdapter.toRpcFilters({ ...cfbAdapter.reset('fg_total'), side: 'home' }).side).toBeUndefined();
  });
});

describe('MLB toRpcFilters', () => {
  it('defaults to the last-2-seasons window (narrower than the 2023 floor)', () => {
    // DEFAULT_SEASONS = [2025, 2026] > SEASON_FLOOR (2023) → season_min IS emitted (matches old page).
    expect(mlbAdapter.toRpcFilters(mlbAdapter.reset('ml'))).toEqual({ season_min: 2025 });
  });

  it('sends day_of_week as an ARRAY (the scalar-vs-array regression guard)', () => {
    const f = mlbAdapter.toRpcFilters({ ...mlbAdapter.reset('ml'), dayOfWeek: 'Fri' });
    expect(Array.isArray(f.day_of_week)).toBe(true);
    expect(f.day_of_week).toEqual(['Fri']);
  });

  it('uses totalBounds over the slider when set', () => {
    const f = mlbAdapter.toRpcFilters({ ...mlbAdapter.reset('total'), totalBounds: { min: 8, max: 8.5 } });
    expect(f.total_min).toBe(8);
    expect(f.total_max).toBe(8.5);
  });

  it('emits only the bounds an OptRange actually sets', () => {
    const f = mlbAdapter.toRpcFilters({ ...mlbAdapter.reset('ml'), spXfip: { max: 3.5 } });
    expect(f.sp_xfip_max).toBe(3.5);
    expect(f.sp_xfip_min).toBeUndefined();
  });

  it('treats a leftover streak bound as open-ended', () => {
    const f = mlbAdapter.toRpcFilters({ ...mlbAdapter.reset('ml'), streakMin: '', streakMax: '-3' });
    expect(f.streak_max).toBe(-3);
    expect(f.streak_min).toBeUndefined();
  });
});
