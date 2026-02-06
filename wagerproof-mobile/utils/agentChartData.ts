import { AgentPick, Sport } from '@/types/agent';
import { calculateUnits } from '@/utils/unitsCalculation';

// ============================================================================
// TYPES
// ============================================================================

export interface ChartDataPoint {
  x: number;
  y: number;
  isBestRun?: boolean;
}

export interface BestRun {
  startIndex: number;
  endIndex: number;
  wins: number;
  losses: number;
  netUnits: number;
  picks: number;
}

export interface SportChartData {
  sport: Sport | 'all';
  label: string;
  wins: number;
  losses: number;
  pushes: number;
  netUnits: number;
  chartData: ChartDataPoint[];
  bestRunIndices: { start: number; end: number } | null;
  bestRun: BestRun | null;
}

const SPORT_LABELS: Record<Sport | 'all', string> = {
  all: 'All Sports',
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

// ============================================================================
// BEST RUN CALCULATION
// ============================================================================

/**
 * Finds the maximum gain period (lowest low to highest high)
 * in a set of graded agent picks.
 */
export function calculateAgentBestRun(
  picks: AgentPick[],
): { bestRun: BestRun | null; bestRunIndices: { start: number; end: number } | null } {
  const sortedPicks = [...picks]
    .filter((p) => p.result && p.result !== 'pending')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (sortedPicks.length === 0) return { bestRun: null, bestRunIndices: null };

  // Build cumulative units array starting at 0
  const cumulativeUnits: number[] = [0];
  let running = 0;

  sortedPicks.forEach((pick) => {
    const calc = calculateUnits(pick.result, pick.odds, pick.units);
    running += calc.netUnits;
    cumulativeUnits.push(running);
  });

  // Find maximum gain period (lowest point to highest point after it)
  let bestGain = 0;
  let bestStartIdx = 0;
  let bestEndIdx = 0;
  let minValue = cumulativeUnits[0];
  let minIdx = 0;

  for (let i = 1; i < cumulativeUnits.length; i++) {
    if (cumulativeUnits[i] < minValue) {
      minValue = cumulativeUnits[i];
      minIdx = i;
    }

    const currentGain = cumulativeUnits[i] - minValue;
    if (currentGain > bestGain) {
      bestGain = currentGain;
      bestStartIdx = minIdx;
      bestEndIdx = i;
    }
  }

  if (bestGain <= 0) return { bestRun: null, bestRunIndices: null };

  const runPicks = sortedPicks.slice(bestStartIdx, bestEndIdx);
  const wins = runPicks.filter((p) => p.result === 'won').length;
  const losses = runPicks.filter((p) => p.result === 'lost').length;

  return {
    bestRun: {
      startIndex: bestStartIdx,
      endIndex: bestEndIdx - 1,
      wins,
      losses,
      netUnits: bestGain,
      picks: runPicks.length,
    },
    bestRunIndices: { start: bestStartIdx, end: bestEndIdx },
  };
}

// ============================================================================
// CHART STATS COMPUTATION
// ============================================================================

/**
 * Computes chart data for all picks combined plus each preferred sport.
 */
export function computeAgentChartStats(
  allPicks: AgentPick[],
  preferredSports: Sport[],
): SportChartData[] {
  const sportKeys: (Sport | 'all')[] = ['all', ...preferredSports];

  return sportKeys.map((sportKey) => {
    const picks =
      sportKey === 'all'
        ? allPicks
        : allPicks.filter((p) => p.sport === sportKey);

    // Filter out pending, sort chronologically
    const gradedPicks = [...picks]
      .filter((p) => p.result && p.result !== 'pending')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const wins = gradedPicks.filter((p) => p.result === 'won').length;
    const losses = gradedPicks.filter((p) => p.result === 'lost').length;
    const pushes = gradedPicks.filter((p) => p.result === 'push').length;

    // Build cumulative chart data
    let cumulative = 0;
    const chartData: ChartDataPoint[] = [{ x: 0, y: 0 }];

    gradedPicks.forEach((pick, index) => {
      const calc = calculateUnits(pick.result, pick.odds, pick.units);
      cumulative += calc.netUnits;
      chartData.push({ x: index + 1, y: cumulative });
    });

    // Calculate best run
    const { bestRun, bestRunIndices } = calculateAgentBestRun(picks);

    // Mark best run points
    if (bestRunIndices) {
      for (let i = bestRunIndices.start; i <= bestRunIndices.end; i++) {
        if (chartData[i]) {
          chartData[i].isBestRun = true;
        }
      }
    }

    return {
      sport: sportKey,
      label: SPORT_LABELS[sportKey],
      wins,
      losses,
      pushes,
      netUnits: cumulative,
      chartData,
      bestRunIndices,
      bestRun,
    };
  });
}
