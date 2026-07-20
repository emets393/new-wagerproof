import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

export type MlbPitcherCatalogRow = {
  id: number;
  name: string;
  hand: string | null;
  team: string | null;
};

let catalogPromise: Promise<MlbPitcherCatalogRow[]> | null = null;

/** Shared once-per-session pitcher catalog for typeahead + NL chat validation. */
export function loadMlbPitcherCatalog(): Promise<MlbPitcherCatalogRow[]> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const { data, error } = await collegeFootballSupabase.rpc('mlb_pitcher_options', { p_q: null });
      if (error) {
        catalogPromise = null;
        throw error;
      }
      return (data as MlbPitcherCatalogRow[]) || [];
    })();
  }
  return catalogPromise;
}

export function mlbPitcherCatalogNames(rows: MlbPitcherCatalogRow[]): string[] {
  return rows.map((p) => p.name).filter(Boolean);
}
