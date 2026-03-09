import { describe, it, expect } from 'vitest';
import {
  normalizeTeamName,
  normalizeTeamNamesInFilters,
  getTeamNameVariations,
} from '@/utils/teamNormalization';

describe('teamNormalization', () => {
  describe('normalizeTeamName', () => {
    it('returns input unchanged for current names', () => {
      expect(normalizeTeamName('Kansas City Chiefs')).toBe('Kansas City Chiefs');
    });

    it('returns input for empty string', () => {
      expect(normalizeTeamName('')).toBe('');
    });

    // Historical team name changes
    it('normalizes Oakland Raiders to Las Vegas Raiders', () => {
      expect(normalizeTeamName('Oakland Raiders')).toBe('Las Vegas Raiders');
    });

    it('normalizes Washington Redskins to Washington Commanders', () => {
      expect(normalizeTeamName('Washington Redskins')).toBe('Washington Commanders');
    });

    it('normalizes Washington Football Team to Washington Commanders', () => {
      expect(normalizeTeamName('Washington Football Team')).toBe('Washington Commanders');
    });

    it('normalizes St. Louis Rams to Los Angeles Rams', () => {
      expect(normalizeTeamName('St. Louis Rams')).toBe('Los Angeles Rams');
    });

    it('normalizes San Diego Chargers to Los Angeles Chargers', () => {
      expect(normalizeTeamName('San Diego Chargers')).toBe('Los Angeles Chargers');
    });

    // Partial matches
    it('normalizes Oakland to Las Vegas in partial match', () => {
      expect(normalizeTeamName('Oakland')).toBe('Las Vegas');
    });
  });

  describe('normalizeTeamNamesInFilters', () => {
    it('normalizes home_team field', () => {
      const filters = { home_team: 'Oakland Raiders', other: 'test' };
      const result = normalizeTeamNamesInFilters(filters);
      expect(result.home_team).toBe('Las Vegas Raiders');
      expect(result.other).toBe('test');
    });

    it('normalizes away_team field', () => {
      const filters = { away_team: 'San Diego Chargers' };
      const result = normalizeTeamNamesInFilters(filters);
      expect(result.away_team).toBe('Los Angeles Chargers');
    });

    it('normalizes team field', () => {
      const filters = { team: 'Washington Redskins' };
      const result = normalizeTeamNamesInFilters(filters);
      expect(result.team).toBe('Washington Commanders');
    });

    it('does not modify non-team fields', () => {
      const filters = { league: 'NFL', season: '2024' };
      const result = normalizeTeamNamesInFilters(filters);
      expect(result).toEqual(filters);
    });

    it('does not mutate original object', () => {
      const original = { home_team: 'Oakland Raiders' };
      normalizeTeamNamesInFilters(original);
      expect(original.home_team).toBe('Oakland Raiders');
    });
  });

  describe('getTeamNameVariations', () => {
    it('always includes the current name', () => {
      const variations = getTeamNameVariations('Las Vegas Raiders');
      expect(variations).toContain('Las Vegas Raiders');
    });

    it('includes historical names for relocated teams', () => {
      const variations = getTeamNameVariations('Las Vegas Raiders');
      expect(variations).toContain('Oakland Raiders');
    });

    it('includes all historical Washington names', () => {
      const variations = getTeamNameVariations('Washington Commanders');
      expect(variations).toContain('Washington Redskins');
      expect(variations).toContain('Washington Football Team');
    });

    it('returns only current name for teams without changes', () => {
      const variations = getTeamNameVariations('New England Patriots');
      expect(variations).toEqual(['New England Patriots']);
    });
  });
});
