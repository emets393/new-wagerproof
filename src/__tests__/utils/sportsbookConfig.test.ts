import { describe, it, expect } from 'vitest';
import {
  TOP_SPORTSBOOKS,
  ADDITIONAL_SPORTSBOOKS,
  ALL_SPORTSBOOKS,
  SPORT_KEY_MAP,
  getOddsApiSportKey,
  getSportsbookByKey,
} from '@/utils/sportsbookConfig';

describe('sportsbookConfig', () => {
  describe('TOP_SPORTSBOOKS', () => {
    it('has exactly 5 top sportsbooks', () => {
      expect(TOP_SPORTSBOOKS).toHaveLength(5);
    });

    it('all top sportsbooks have isTop5 set to true', () => {
      TOP_SPORTSBOOKS.forEach(sb => {
        expect(sb.isTop5).toBe(true);
      });
    });

    it('includes DraftKings and FanDuel', () => {
      const keys = TOP_SPORTSBOOKS.map(sb => sb.key);
      expect(keys).toContain('draftkings');
      expect(keys).toContain('fanduel');
    });

    it('all sportsbooks have required fields', () => {
      TOP_SPORTSBOOKS.forEach(sb => {
        expect(sb.key).toBeTruthy();
        expect(sb.displayName).toBeTruthy();
        expect(typeof sb.isTop5).toBe('boolean');
      });
    });
  });

  describe('ADDITIONAL_SPORTSBOOKS', () => {
    it('has additional sportsbooks', () => {
      expect(ADDITIONAL_SPORTSBOOKS.length).toBeGreaterThan(0);
    });

    it('all additional sportsbooks have isTop5 set to false', () => {
      ADDITIONAL_SPORTSBOOKS.forEach(sb => {
        expect(sb.isTop5).toBe(false);
      });
    });
  });

  describe('ALL_SPORTSBOOKS', () => {
    it('is the combination of top and additional', () => {
      expect(ALL_SPORTSBOOKS.length).toBe(
        TOP_SPORTSBOOKS.length + ADDITIONAL_SPORTSBOOKS.length
      );
    });

    it('has no duplicate keys', () => {
      const keys = ALL_SPORTSBOOKS.map(sb => sb.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('SPORT_KEY_MAP', () => {
    it('maps nfl correctly', () => {
      expect(SPORT_KEY_MAP['nfl']).toBe('americanfootball_nfl');
    });

    it('maps cfb correctly', () => {
      expect(SPORT_KEY_MAP['cfb']).toBe('americanfootball_ncaaf');
    });

    it('maps nba correctly', () => {
      expect(SPORT_KEY_MAP['nba']).toBe('basketball_nba');
    });

    it('maps ncaab correctly', () => {
      expect(SPORT_KEY_MAP['ncaab']).toBe('basketball_ncaab');
    });
  });

  describe('getOddsApiSportKey', () => {
    it('returns correct key for known sports', () => {
      expect(getOddsApiSportKey('nfl')).toBe('americanfootball_nfl');
      expect(getOddsApiSportKey('nba')).toBe('basketball_nba');
    });

    it('returns null for unknown sport', () => {
      expect(getOddsApiSportKey('cricket')).toBeNull();
    });
  });

  describe('getSportsbookByKey', () => {
    it('finds top sportsbook by key', () => {
      const sb = getSportsbookByKey('draftkings');
      expect(sb).toBeDefined();
      expect(sb?.displayName).toBe('DraftKings');
    });

    it('finds additional sportsbook by key', () => {
      const sb = getSportsbookByKey('bovada');
      expect(sb).toBeDefined();
      expect(sb?.displayName).toBe('Bovada');
    });

    it('returns undefined for unknown key', () => {
      expect(getSportsbookByKey('nonexistent')).toBeUndefined();
    });
  });
});
