import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import type {
  MlbAnalysisBetType,
  MlbAnalysisResponse,
  MlbAnalysisUpcomingGame,
  MlbPitcherOption,
} from '@/types/mlbHistoricalAnalysis';
import { filterPitchers } from '@/utils/mlbPitcherSearch';

export async function fetchMlbAnalysis(
  betType: MlbAnalysisBetType,
  filters: Record<string, unknown>,
): Promise<MlbAnalysisResponse | null> {
  const { data, error } = await collegeFootballSupabase.rpc('mlb_analysis', {
    p_bet_type: betType,
    p_filters: filters,
  });
  if (error) {
    console.error('[mlb_analysis]', error.message);
    return null;
  }
  return data as MlbAnalysisResponse;
}

export async function fetchMlbAnalysisUpcoming(
  betType: MlbAnalysisBetType,
  filters: Record<string, unknown>,
): Promise<MlbAnalysisUpcomingGame[]> {
  const { data, error } = await collegeFootballSupabase.rpc('mlb_analysis_upcoming', {
    p_bet_type: betType,
    p_filters: filters,
  });
  if (error) {
    console.error('[mlb_analysis_upcoming]', error.message);
    return [];
  }
  return (data as MlbAnalysisUpcomingGame[]) || [];
}

let pitcherCatalogPromise: Promise<MlbPitcherOption[]> | null = null;

async function loadMlbPitcherCatalog(): Promise<MlbPitcherOption[]> {
  if (!pitcherCatalogPromise) {
    pitcherCatalogPromise = (async () => {
      const { data, error } = await collegeFootballSupabase.rpc('mlb_pitcher_options', { p_q: null });
      if (error) {
        console.error('[mlb_pitcher_options]', error.message);
        pitcherCatalogPromise = null;
        return [];
      }
      return (data as MlbPitcherOption[]) || [];
    })();
  }
  return pitcherCatalogPromise;
}

/** Accent-insensitive local filter over a once-loaded pitcher catalog. */
export async function fetchMlbPitcherOptions(q: string | null): Promise<MlbPitcherOption[]> {
  const catalog = await loadMlbPitcherCatalog();
  return filterPitchers(catalog, q ?? '', 40);
}

export async function fetchMlbTeamAbbrs(): Promise<{ abbr: string; name: string }[]> {
  const { data, error } = await collegeFootballSupabase
    .from('mlb_team_mapping')
    .select('team, team_name');
  if (error || !data) return [];
  const seen = new Set<string>();
  // mlb_analysis_base uses game-log abbrs (AZ/ATH); mapping still has ARI/OAK.
  const toGameLog = (abbr: string) => {
    const a = abbr.trim().toUpperCase();
    if (a === 'ARI') return 'AZ';
    if (a === 'OAK' || a === 'LVA' || a === 'SAC') return 'ATH';
    return a;
  };
  const label = (abbr: string, name: string) => {
    if (abbr === 'ATH') return 'Athletics';
    if (abbr === 'AZ') return 'Arizona Diamondbacks';
    return name || abbr;
  };
  return (data as { team?: string; team_name?: string }[])
    .map(r => {
      const abbr = toGameLog(String(r.team || ''));
      return { abbr, name: label(abbr, String(r.team_name || r.team || '')) };
    })
    .filter(t => t.abbr && (seen.has(t.abbr) ? false : (seen.add(t.abbr), true)))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
}
