/**
 * Calculate units won or lost based on bet result and odds
 * 
 * For negative odds (favorite, e.g., -120):
 * - Risk = (|odds|/100) * units
 * - Win = +units
 * - Loss = -risk
 * 
 * For positive odds (underdog, e.g., +180):
 * - Risk = units
 * - Win = +(odds/100) * units
 * - Loss = -units
 * 
 * Push: 0 units
 */

export interface UnitsCalculationResult {
  unitsWon: number;
  unitsLost: number;
  netUnits: number;
}

/**
 * Parse odds string to number
 * Handles formats like "-110", "+180", "110" (assumed negative)
 */
function parseOdds(oddsString: string | null | undefined): number | null {
  if (!oddsString) return null;
  
  const trimmed = oddsString.toString().trim();
  if (trimmed.startsWith('+')) {
    return parseInt(trimmed.substring(1), 10);
  } else if (trimmed.startsWith('-')) {
    return parseInt(trimmed, 10);
  } else {
    // Check if it's just a number
    const num = parseInt(trimmed, 10);
    if (isNaN(num)) return null;
    // If no sign, assume negative if typically > 100, but American odds usually have sign
    // or if it's just "110", it might mean -110. 
    // Let's assume standard American odds behavior where user input might be lazy.
    // But if it's a small number (like decimal), this logic fails. 
    // Assuming American odds as per web codebase context.
    return num > 0 ? -num : num;
  }
}

/**
 * Calculate units for a pick result
 * 
 * @param result - 'won', 'lost', 'push', or null/undefined
 * @param odds - The betting odds (e.g., "-110", "+180")
 * @param units - The number of units wagered
 * @returns UnitsCalculationResult with unitsWon, unitsLost, and netUnits
 */
export function calculateUnits(
  result: 'won' | 'lost' | 'push' | 'pending' | null | undefined,
  odds: string | number | null | undefined,
  units: number | null | undefined
): UnitsCalculationResult {
  // Default to 0 if no result or pending
  if (!result || result === 'pending' || !units || units === 0) {
    return { unitsWon: 0, unitsLost: 0, netUnits: 0 };
  }

  // Push always returns 0
  if (result === 'push') {
    return { unitsWon: 0, unitsLost: 0, netUnits: 0 };
  }

  // Parse odds
  const oddsNum = typeof odds === 'number' ? odds : parseOdds(odds as string);
  if (oddsNum === null) {
    // If no odds, can't calculate - return 0
    return { unitsWon: 0, unitsLost: 0, netUnits: 0 };
  }

  if (result === 'won') {
    if (oddsNum < 0) {
      // Negative odds: win = +units
      return { unitsWon: units, unitsLost: 0, netUnits: units };
    } else {
      // Positive odds: win = +(odds/100) * units
      const unitsWon = (oddsNum / 100) * units;
      return { unitsWon, unitsLost: 0, netUnits: unitsWon };
    }
  } else if (result === 'lost') {
    if (oddsNum < 0) {
      // Negative odds: loss = -risk, where risk = (|odds|/100) * units
      const risk = (Math.abs(oddsNum) / 100) * units;
      return { unitsWon: 0, unitsLost: risk, netUnits: -risk };
    } else {
      // Positive odds: loss = -units
      return { unitsWon: 0, unitsLost: units, netUnits: -units };
    }
  }

  return { unitsWon: 0, unitsLost: 0, netUnits: 0 };
}

/**
 * Calculate total units from an array of picks
 */
export function calculateTotalUnits(
  picks: Array<{
    result?: 'won' | 'lost' | 'push' | 'pending' | null;
    best_price?: string | null;
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

