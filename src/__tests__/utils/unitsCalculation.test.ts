import { describe, it, expect } from 'vitest';
import { calculateUnits, calculateTotalUnits } from '@/utils/unitsCalculation';

describe('unitsCalculation', () => {
  describe('calculateUnits', () => {
    // Edge cases and null handling
    it('returns zeros for null result', () => {
      const result = calculateUnits(null, '-110', 1);
      expect(result).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for undefined result', () => {
      const result = calculateUnits(undefined, '-110', 1);
      expect(result).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for pending result', () => {
      const result = calculateUnits('pending', '-110', 1);
      expect(result).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for push result', () => {
      const result = calculateUnits('push', '-110', 1);
      expect(result).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for null units', () => {
      const result = calculateUnits('won', '-110', null);
      expect(result).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for zero units', () => {
      const result = calculateUnits('won', '-110', 0);
      expect(result).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('returns zeros for null odds', () => {
      const result = calculateUnits('won', null, 1);
      expect(result).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    // Won with negative odds (favorite)
    it('calculates won with negative odds correctly', () => {
      const result = calculateUnits('won', '-110', 1);
      expect(result.unitsWon).toBe(1);
      expect(result.unitsLost).toBe(0);
      expect(result.netUnits).toBe(1);
    });

    it('calculates won with heavily favored odds', () => {
      const result = calculateUnits('won', '-200', 2);
      expect(result.unitsWon).toBe(2);
      expect(result.unitsLost).toBe(0);
      expect(result.netUnits).toBe(2);
    });

    // Won with positive odds (underdog)
    it('calculates won with positive odds correctly', () => {
      const result = calculateUnits('won', '+180', 1);
      expect(result.unitsWon).toBe(1.8);
      expect(result.unitsLost).toBe(0);
      expect(result.netUnits).toBe(1.8);
    });

    it('calculates won with even money', () => {
      const result = calculateUnits('won', '+100', 1);
      expect(result.unitsWon).toBe(1);
      expect(result.netUnits).toBe(1);
    });

    // Lost with negative odds (favorite)
    it('calculates lost with negative odds correctly', () => {
      const result = calculateUnits('lost', '-110', 1);
      expect(result.unitsWon).toBe(0);
      expect(result.unitsLost).toBe(1.1);
      expect(result.netUnits).toBe(-1.1);
    });

    it('calculates lost with -200 odds correctly', () => {
      const result = calculateUnits('lost', '-200', 1);
      expect(result.unitsWon).toBe(0);
      expect(result.unitsLost).toBe(2);
      expect(result.netUnits).toBe(-2);
    });

    // Lost with positive odds (underdog)
    it('calculates lost with positive odds correctly', () => {
      const result = calculateUnits('lost', '+180', 1);
      expect(result.unitsWon).toBe(0);
      expect(result.unitsLost).toBe(1);
      expect(result.netUnits).toBe(-1);
    });

    // Numeric odds (not string)
    it('handles numeric odds input', () => {
      const result = calculateUnits('won', -110, 1);
      expect(result.unitsWon).toBe(1);
      expect(result.netUnits).toBe(1);
    });

    it('handles positive numeric odds input', () => {
      const result = calculateUnits('won', 150, 1);
      expect(result.unitsWon).toBe(1.5);
      expect(result.netUnits).toBe(1.5);
    });

    // String odds without sign (assumed negative)
    it('handles unsigned string odds (assumes negative)', () => {
      const result = calculateUnits('won', '110', 1);
      // '110' without sign is treated as -110
      expect(result.unitsWon).toBe(1);
    });

    // Multiple units
    it('scales correctly with multiple units', () => {
      const result = calculateUnits('won', '+200', 5);
      expect(result.unitsWon).toBe(10);
      expect(result.netUnits).toBe(10);
    });
  });

  describe('calculateTotalUnits', () => {
    it('returns zeros for empty array', () => {
      const result = calculateTotalUnits([]);
      expect(result).toEqual({ unitsWon: 0, unitsLost: 0, netUnits: 0 });
    });

    it('aggregates multiple winning picks', () => {
      const picks = [
        { result: 'won' as const, best_price: '-110', units: 1 },
        { result: 'won' as const, best_price: '+150', units: 1 },
      ];
      const result = calculateTotalUnits(picks);
      expect(result.unitsWon).toBe(2.5); // 1 + 1.5
      expect(result.unitsLost).toBe(0);
      expect(result.netUnits).toBe(2.5);
    });

    it('aggregates mixed results correctly', () => {
      const picks = [
        { result: 'won' as const, best_price: '+100', units: 1 },
        { result: 'lost' as const, best_price: '-110', units: 1 },
        { result: 'push' as const, best_price: '-110', units: 1 },
      ];
      const result = calculateTotalUnits(picks);
      expect(result.unitsWon).toBe(1);
      expect(result.unitsLost).toBe(1.1);
      expect(result.netUnits).toBeCloseTo(-0.1, 5);
    });

    it('handles picks with missing data gracefully', () => {
      const picks = [
        { result: 'won' as const, best_price: '-110', units: 1 },
        { result: undefined, best_price: null, units: null },
        { result: 'pending' as const, best_price: '+200', units: 2 },
      ];
      const result = calculateTotalUnits(picks);
      expect(result.unitsWon).toBe(1);
      expect(result.unitsLost).toBe(0);
      expect(result.netUnits).toBe(1);
    });
  });
});
