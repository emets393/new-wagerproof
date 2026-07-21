/**
 * Per-sport bundle map for the unified Historical Trends page. Each adapter behind one key; the
 * workbench looks up the active adapter by URL sport. All sport knowledge lives in the adapters
 * (`components/adapters/*`); everything else in `components/` is sport-agnostic.
 */
import type { Sport, TrendsSportAdapter } from './components/adapters/types';
import { nflAdapter } from './components/adapters/nfl';
import { cfbAdapter } from './components/adapters/cfb';
import { mlbAdapter } from './components/adapters/mlb';

export const SPORTS: Sport[] = ['nfl', 'cfb', 'mlb'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TREND_ADAPTERS: Record<Sport, TrendsSportAdapter<any>> = {
  nfl: nflAdapter,
  cfb: cfbAdapter,
  mlb: mlbAdapter,
};

export function isSport(value: string | null | undefined): value is Sport {
  return value === 'nfl' || value === 'cfb' || value === 'mlb';
}

export type { Sport };
