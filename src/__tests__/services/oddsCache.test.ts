import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getCachedOdds, setCachedOdds, clearCache, getCacheAge } from '@/services/oddsCache';

describe('oddsCache', () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockEvents = [
    {
      id: 'event-1',
      sport_key: 'americanfootball_nfl',
      sport_title: 'NFL',
      commence_time: '2024-01-15T18:00:00Z',
      home_team: 'Kansas City Chiefs',
      away_team: 'Buffalo Bills',
    },
  ];

  describe('setCachedOdds / getCachedOdds', () => {
    it('stores and retrieves odds', () => {
      setCachedOdds('nfl', mockEvents);
      const cached = getCachedOdds('nfl');
      expect(cached).toEqual(mockEvents);
    });

    it('returns null for uncached sport', () => {
      expect(getCachedOdds('nba')).toBeNull();
    });

    it('returns null after cache expires (5 minutes)', () => {
      setCachedOdds('nfl', mockEvents);

      // Advance time by 5 minutes + 1 second
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      expect(getCachedOdds('nfl')).toBeNull();
    });

    it('returns data before cache expires', () => {
      setCachedOdds('nfl', mockEvents);

      // Advance time by 4 minutes
      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(getCachedOdds('nfl')).toEqual(mockEvents);
    });

    it('caches different sports independently', () => {
      const nbaEvents = [
        {
          id: 'event-2',
          sport_key: 'basketball_nba',
          sport_title: 'NBA',
          commence_time: '2024-01-15T19:00:00Z',
          home_team: 'Los Angeles Lakers',
          away_team: 'Boston Celtics',
        },
      ];

      setCachedOdds('nfl', mockEvents);
      setCachedOdds('nba', nbaEvents);

      expect(getCachedOdds('nfl')).toEqual(mockEvents);
      expect(getCachedOdds('nba')).toEqual(nbaEvents);
    });
  });

  describe('clearCache', () => {
    it('clears specific sport cache', () => {
      setCachedOdds('nfl', mockEvents);
      setCachedOdds('nba', mockEvents);

      clearCache('nfl');

      expect(getCachedOdds('nfl')).toBeNull();
      expect(getCachedOdds('nba')).toEqual(mockEvents);
    });

    it('clears all caches when no sport specified', () => {
      setCachedOdds('nfl', mockEvents);
      setCachedOdds('nba', mockEvents);

      clearCache();

      expect(getCachedOdds('nfl')).toBeNull();
      expect(getCachedOdds('nba')).toBeNull();
    });
  });

  describe('getCacheAge', () => {
    it('returns null for uncached sport', () => {
      expect(getCacheAge('nfl')).toBeNull();
    });

    it('returns age in seconds', () => {
      setCachedOdds('nfl', mockEvents);

      // Advance 30 seconds
      vi.advanceTimersByTime(30000);

      expect(getCacheAge('nfl')).toBe(30);
    });

    it('returns 0 for just-cached data', () => {
      setCachedOdds('nfl', mockEvents);
      expect(getCacheAge('nfl')).toBe(0);
    });
  });
});
