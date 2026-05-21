import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';

export interface PitcherReportHROpportunity {
  batter: string;
  team?: string | null;
  bat_side?: string | null;
  vs?: string | null;
  matchup?: string | null;
  hr_score?: number | null;
  xwoba_vs_hand?: number | null;
  xwoba_pctile?: number | null;
  iso_vs_hand?: number | null;
  park_hr_factor?: number | null;
  hot?: boolean | null;
  l10_xwoba?: number | null;
  pitch_edges?: unknown;
  limited_sample?: boolean | null;
}

export interface PitcherReportPitchMatchup {
  type?: 'batter' | 'pitcher' | string | null;
  pitch?: string | null;
  usage?: number | null;
  xwoba?: number | null;
  barrel?: number | null;
  whiff?: number | null;
  bbe?: number | null;
  limited?: boolean | null;
  batter?: string | null;
  batting_team?: string | null;
  opp_pitcher?: string | null;
  matchup?: string | null;
  bat_side?: string | null;
  hot?: boolean | null;
}

export interface PitcherReportPitcherEdge {
  pitcher_name: string;
  hand?: string | null;
  archetype?: string | null;
  woba_allowed?: number | null;
  xwoba_allowed?: number | null;
  k_pct?: number | null;
  opp_strong_bats?: number | null;
  opp_hot_bats?: number | null;
  net_edge?: number | null;
  pitching_team?: string | null;
  matchup?: string | null;
}

export interface PitcherMatchupsReportTopPlays {
  hr_opportunities?: PitcherReportHROpportunity[];
  hottest_batters?: PitcherReportHROpportunity[];
  notable_pitch_matchups?: PitcherReportPitchMatchup[];
  pitcher_advantages?: PitcherReportPitcherEdge[];
  pitcher_disadvantages?: PitcherReportPitcherEdge[];
}

export interface PitcherMatchupsReportGameBreakdown {
  game_pk?: number;
  matchup?: string;
  venue?: string | null;
  game_time_et?: string | null;
  total_line?: number | null;
  weather?: {
    temp_f?: number | null;
    wind_mph?: number | null;
    wind_dir?: string | null;
  } | null;
  sides?: unknown[];
}

export interface MLBPitcherMatchupsReport {
  report_date: string;
  season: number;
  generated_at: string;
  generation_version: number;
  games_count: number;
  lineups_status: 'confirmed' | 'partial' | 'projected' | string | null;
  narrative_text: string | null;
  narrative_model: string | null;
  top_plays: PitcherMatchupsReportTopPlays | null;
  game_breakdowns: PitcherMatchupsReportGameBreakdown[] | null;
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function useMLBPitcherMatchupsReport() {
  return useQuery<MLBPitcherMatchupsReport | null>({
    queryKey: ['mlb-pitcher-matchups-report-mobile', getTodayET()],
    queryFn: async () => {
      const today = getTodayET();
      const { data, error } = await collegeFootballSupabase
        .from('mlb_pitcher_matchups_report')
        .select('*')
        .eq('report_date', today)
        .maybeSingle();

      if (error) throw error;
      return data as MLBPitcherMatchupsReport | null;
    },
    refetchInterval: 10 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    staleTime: 10 * 60 * 1000,
  });
}
