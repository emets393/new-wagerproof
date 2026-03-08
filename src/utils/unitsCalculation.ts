/**
 * Canonical unit math — matches SQL recalculate_avatar_performance() and
 * agentPerformanceService.calculateNetUnits().
 *
 * The bettor always risks `units` (1.0 for agents).
 *
 * Negative odds (favorite, e.g. -110):
 *   Win  → +units * (100 / |odds|)   (you win LESS than you risk)
 *   Loss → -units
 *
 * Positive odds (underdog, e.g. +150):
 *   Win  → +units * (odds / 100)     (you win MORE than you risk)
 *   Loss → -units
 *
 * Push / Pending → 0
 */

export interface UnitsCalculationResult {
  unitsWon: number;
  unitsLost: number;
  netUnits: number;
}

/**
 * Parse odds string to number.
 * Handles "-110", "+180". Unsigned integers (e.g. "110") are treated as
 * positive per standard American odds convention. Returns null for
 * unparseable input, zero, or decimal values.
 */
function parseOdds(oddsString: string | null | undefined): number | null {
  if (!oddsString) return null;

  const trimmed = String(oddsString).trim();
  // Reject decimal odds — American odds are always integers
  if (!/^[+-]?\d+$/.test(trimmed)) return null;

  const num = parseInt(trimmed, 10);
  // odds = 0 is invalid (would cause division by zero)
  if (!Number.isFinite(num) || num === 0) return null;

  return num;
}

/**
 * Calculate units for a pick result.
 *
 * This is the CANONICAL implementation used across web, mobile, and charts.
 * It matches the SQL function `recalculate_avatar_performance()` exactly:
 *   WON + neg odds → units * (100 / |odds|)
 *   WON + pos odds → units * (odds / 100)
 *   LOST           → -units
 */
export function calculateUnits(
  result: 'won' | 'lost' | 'push' | 'pending' | null | undefined,
  odds: string | number | null | undefined,
  units: number | null | undefined
): UnitsCalculationResult {
  if (!result || result === 'pending' || !units || units === 0 || !Number.isFinite(units)) {
    return { unitsWon: 0, unitsLost: 0, netUnits: 0 };
  }

  if (result === 'push') {
    return { unitsWon: 0, unitsLost: 0, netUnits: 0 };
  }

  const oddsNum = typeof odds === 'number'
    ? (odds === 0 ? null : odds)
    : parseOdds(odds as string);

  if (oddsNum === null) {
    return { unitsWon: 0, unitsLost: 0, netUnits: 0 };
  }

  if (result === 'won') {
    if (oddsNum < 0) {
      // Negative odds: payout = units * (100 / |odds|)
      const unitsWon = units * (100 / Math.abs(oddsNum));
      return { unitsWon, unitsLost: 0, netUnits: unitsWon };
    } else {
      // Positive odds: payout = units * (odds / 100)
      const unitsWon = units * (oddsNum / 100);
      return { unitsWon, unitsLost: 0, netUnits: unitsWon };
    }
  } else if (result === 'lost') {
    // Loss is always -units (the amount risked)
    return { unitsWon: 0, unitsLost: units, netUnits: -units };
  }

  return { unitsWon: 0, unitsLost: 0, netUnits: 0 };
}

/**
 * Calculate total units from an array of picks
 */
export function calculateTotalUnits(
  picks: Array<{
    result?: 'won' | 'lost' | 'push' | 'pending' | null;
    best_price?: string | number | null;
    units?: number | null;
  }>
): UnitsCalculationResult {
  let totalWon = 0;
  let totalLost = 0;

  picks.forEach(pick => {
    const calc = calculateUnits(pick.result, pick.best_price, pick.units);
    totalWon += calc.unitsWon;
    totalLost += calc.unitsLost;
  });

  return {
    unitsWon: totalWon,
    unitsLost: totalLost,
    netUnits: totalWon - totalLost,
  };
}

