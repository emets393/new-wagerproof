/**
 * Guardrail for the snapshot → p_filters transcription. Feeds representative snapshots through each
 * adapter's `toRpcFilters` and asserts golden p_filters — so the extraction from the retired pages'
 * `buildFilters` can't silently drift. Independent of the 8 protected engine tests.
 *
 * Season note (2026-07): warehouse analysis RPCs hit statement_timeout (~3s) on unrestricted /
 * deep-history scans. Defaults MUST emit a season_min that keeps the query under that budget
 * (NFL ≥2023, CFB =2025, MLB already last-2-seasons). Omitting season_min at the floor used to
 * mean "all history" and is what made Situations/breakdowns look permanently empty.
 */
import { describe, it, expect } from 'vitest';
import { nflAdapter } from './nfl';
import { cfbAdapter } from './cfb';
import { mlbAdapter } from './mlb';

describe('NFL toRpcFilters', () => {
  it('emits season_min for a fresh default snapshot (warehouse timeout guard)', () => {
    expect(nflAdapter.toRpcFilters(nflAdapter.reset('fg_spread'))).toEqual({ season_min: 2023 });
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

  it('still emits season_min on 2023+-only markets at their floor', () => {
    expect(nflAdapter.toRpcFilters(nflAdapter.reset('h1_spread'))).toEqual({ season_min: 2023 });
  });

  it('gates fav_dog to team_total only', () => {
    expect(nflAdapter.toRpcFilters({ ...nflAdapter.reset('fg_spread'), favDog: 'favorite' }).fav_dog).toBeUndefined();
    expect(nflAdapter.toRpcFilters({ ...nflAdapter.reset('team_total'), favDog: 'favorite' }).fav_dog).toBe('favorite');
  });
});

describe('CFB toRpcFilters', () => {
  it('emits season_min + regular game_type for a fresh default snapshot (warehouse timeout guard)', () => {
    expect(cfbAdapter.toRpcFilters(cfbAdapter.reset('fg_spread'))).toEqual({
      season_min: 2025,
      game_type: 'regular',
    });
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
  it('defaults to the last-2-seasons window and always emits season_min', () => {
    // DEFAULT_SEASONS = [2025, 2026] → season_min always emitted (even if equal to floor).
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
