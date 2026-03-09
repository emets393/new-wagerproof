import {
  formatMoneyline,
  formatSpread,
  formatDate,
  formatCompactDate,
  roundToNearestHalf,
  getDisplayedProb,
} from '../../utils/formatting';

describe('formatting', () => {
  describe('formatMoneyline', () => {
    it('returns dash for null', () => {
      expect(formatMoneyline(null)).toBe('-');
    });

    it('formats positive moneyline with + prefix', () => {
      expect(formatMoneyline(150)).toBe('+150');
    });

    it('formats negative moneyline', () => {
      expect(formatMoneyline(-110)).toBe('-110');
    });

    it('formats zero', () => {
      // 0 is not > 0, so no + prefix
      expect(formatMoneyline(0)).toBe('0');
    });
  });

  describe('formatSpread', () => {
    it('returns dash for null', () => {
      expect(formatSpread(null)).toBe('-');
    });

    it('formats positive spread with + prefix', () => {
      expect(formatSpread(3.5)).toBe('+3.5');
    });

    it('formats negative spread', () => {
      expect(formatSpread(-7)).toBe('-7');
    });

    it('formats zero spread', () => {
      expect(formatSpread(0)).toBe('0');
    });
  });

  describe('formatDate', () => {
    it('formats YYYY-MM-DD to human-readable date', () => {
      const result = formatDate('2024-01-15');
      expect(result).toContain('January');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('handles invalid input gracefully', () => {
      // The function catches errors and returns the original string,
      // but malformed dates may produce "Invalid Date" instead of throwing
      const result = formatDate('invalid');
      expect(typeof result).toBe('string');
    });
  });

  describe('formatCompactDate', () => {
    it('returns TBD for null', () => {
      expect(formatCompactDate(null)).toBe('TBD');
    });

    it('returns TBD for undefined', () => {
      expect(formatCompactDate(undefined)).toBe('TBD');
    });

    it('formats YYYY-MM-DD to compact format', () => {
      const result = formatCompactDate('2024-01-15');
      // Should contain short day/month like "Mon, Jan 15"
      expect(result).toBeTruthy();
      expect(result).not.toBe('TBD');
    });

    it('handles datetime strings with T separator', () => {
      const result = formatCompactDate('2024-01-15T18:00:00Z');
      expect(result).toBeTruthy();
      expect(result).not.toBe('TBD');
    });
  });

  describe('roundToNearestHalf', () => {
    it('returns dash for null', () => {
      expect(roundToNearestHalf(null)).toBe('-');
    });

    it('returns dash for undefined', () => {
      expect(roundToNearestHalf(undefined)).toBe('-');
    });

    it('rounds to nearest half - exact half', () => {
      expect(roundToNearestHalf(3.5)).toBe(3.5);
    });

    it('rounds to nearest half - round up', () => {
      expect(roundToNearestHalf(3.3)).toBe(3.5);
    });

    it('rounds to nearest half - round down', () => {
      expect(roundToNearestHalf(3.1)).toBe(3);
    });

    it('handles whole numbers', () => {
      expect(roundToNearestHalf(7)).toBe(7);
    });

    it('handles negative numbers', () => {
      expect(roundToNearestHalf(-3.3)).toBe(-3.5);
    });
  });

  describe('getDisplayedProb', () => {
    it('returns null for null input', () => {
      expect(getDisplayedProb(null)).toBeNull();
    });

    it('returns the value when >= 0.5', () => {
      expect(getDisplayedProb(0.65)).toBe(0.65);
    });

    it('returns complement when < 0.5', () => {
      expect(getDisplayedProb(0.35)).toBe(0.65);
    });

    it('returns 0.5 for exactly 0.5', () => {
      expect(getDisplayedProb(0.5)).toBe(0.5);
    });

    it('returns 1 for probability of 0', () => {
      expect(getDisplayedProb(0)).toBe(1);
    });

    it('returns 1 for probability of 1', () => {
      expect(getDisplayedProb(1)).toBe(1);
    });
  });
});
