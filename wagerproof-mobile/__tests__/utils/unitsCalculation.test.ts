import { calculateUnits, calculateTotalUnits } from '../../utils/unitsCalculation';

describe('mobile unitsCalculation', () => {
  describe('calculateUnits', () => {
    // Null/edge case handling
    it('returns zeros for null result', () => {
      expect(calculateUnits(null, '-110', 1)).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for pending', () => {
      expect(calculateUnits('pending', '-110', 1)).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for push', () => {
      expect(calculateUnits('push', '-110', 1)).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for null units', () => {
      expect(calculateUnits('won', '-110', null)).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for zero units', () => {
      expect(calculateUnits('won', '-110', 0)).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    // Won scenarios
    it('won with negative odds: returns +units', () => {
      const result = calculateUnits('won', '-110', 1);
      expect(result.unitsWon).toBe(1);
      expect(result.netUnits).toBe(1);
    });

    it('won with positive odds: returns +(odds/100)*units', () => {
      const result = calculateUnits('won', '+200', 1);
      expect(result.unitsWon).toBe(2);
      expect(result.netUnits).toBe(2);
    });

    // Lost scenarios
    it('lost with negative odds: returns -(|odds|/100)*units', () => {
      const result = calculateUnits('lost', '-150', 1);
      expect(result.unitsLost).toBe(1.5);
      expect(result.netUnits).toBe(-1.5);
    });

    it('lost with positive odds: returns -units', () => {
      const result = calculateUnits('lost', '+200', 1);
      expect(result.unitsLost).toBe(1);
      expect(result.netUnits).toBe(-1);
    });

    // Numeric odds
    it('handles numeric odds', () => {
      const result = calculateUnits('won', -110, 1);
      expect(result.unitsWon).toBe(1);
    });

    // Edge: Infinity/NaN protection (mobile version)
    it('handles non-finite units', () => {
      const result = calculateUnits('won', '-110', Infinity);
      expect(result).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });
  });

  describe('calculateTotalUnits', () => {
    it('returns zeros for empty array', () => {
      expect(calculateTotalUnits([])).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('aggregates multiple picks', () => {
      const picks = [
        { result: 'won' as const, best_price: '+100', units: 1 },
        { result: 'lost' as const, best_price: '-110', units: 1 },
      ];
      const result = calculateTotalUnits(picks);
      expect(result.unitsWon).toBe(1);
      expect(result.unitsLost).toBe(1.1);
      expect(result.netUnits).toBeCloseTo(-0.1, 5);
    });

    it('ignores pending and null picks', () => {
      const picks = [
        { result: 'won' as const, best_price: '+100', units: 1 },
        { result: 'pending' as const, best_price: '+100', units: 1 },
        { result: null, best_price: null, units: null },
      ];
      const result = calculateTotalUnits(picks);
      expect(result.unitsWon).toBe(1);
      expect(result.netUnits).toBe(1);
    });
  });
});
