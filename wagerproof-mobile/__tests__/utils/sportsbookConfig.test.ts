import {
  TOP_SPORTSBOOKS,
  ADDITIONAL_SPORTSBOOKS,
  ALL_SPORTSBOOKS,
  SPORT_KEY_MAP,
  getOddsApiSportKey,
  getSportsbookByKey,
} from '../../utils/sportsbookConfig';

describe('mobile sportsbookConfig', () => {
  describe('TOP_SPORTSBOOKS', () => {
    it('has 5 top sportsbooks', () => {
      expect(TOP_SPORTSBOOKS).toHaveLength(5);
    });

    it('all marked as top5', () => {
      TOP_SPORTSBOOKS.forEach(sb => {
        expect(sb.isTop5).toBe(true);
      });
    });

    it('includes key sportsbooks', () => {
      const keys = TOP_SPORTSBOOKS.map(sb => sb.key);
      expect(keys).toContain('draftkings');
      expect(keys).toContain('fanduel');
      expect(keys).toContain('betmgm');
    });
  });

  describe('ALL_SPORTSBOOKS', () => {
    it('has no duplicate keys', () => {
      const keys = ALL_SPORTSBOOKS.map(sb => sb.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('combines top and additional', () => {
      expect(ALL_SPORTSBOOKS.length).toBe(TOP_SPORTSBOOKS.length + ADDITIONAL_SPORTSBOOKS.length);
    });
  });

  describe('SPORT_KEY_MAP', () => {
    it('maps all four main sports', () => {
      expect(SPORT_KEY_MAP['nfl']).toBe('americanfootball_nfl');
      expect(SPORT_KEY_MAP['cfb']).toBe('americanfootball_ncaaf');
      expect(SPORT_KEY_MAP['nba']).toBe('basketball_nba');
      expect(SPORT_KEY_MAP['ncaab']).toBe('basketball_ncaab');
    });
  });

  describe('getOddsApiSportKey', () => {
    it('returns key for known sports', () => {
      expect(getOddsApiSportKey('nfl')).toBe('americanfootball_nfl');
    });

    it('returns null for unknown', () => {
      expect(getOddsApiSportKey('soccer')).toBeNull();
    });
  });

  describe('getSportsbookByKey', () => {
    it('finds sportsbook', () => {
      const sb = getSportsbookByKey('fanduel');
      expect(sb?.displayName).toBe('FanDuel');
    });

    it('returns undefined for unknown', () => {
      expect(getSportsbookByKey('nonexistent')).toBeUndefined();
    });
  });
});
