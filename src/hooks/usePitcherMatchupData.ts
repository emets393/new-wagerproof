import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type {
  BatterSplitRow,
  BatterVsPitchTypeRow,
  LineupRow,
  PitcherArsenalRow,
  PitcherBattedBallProfile,
  PitcherBattedBallRow,
  PitcherMatchupData,
  PitchHand,
} from '@/types/mlb-matchups';
function arsenalPitchTypes(arsenal: PitcherArsenalRow[]): string[] {
  return [
    ...new Set(
      arsenal
        .filter(p => (p.pitches_thrown ?? 0) >= 25)
        .map(p => p.pitch_type),
    ),
  ];
}

function buildBattedBallProfile(rows: PitcherBattedBallRow[]): PitcherBattedBallProfile {
  const byHand = (h: 'A' | 'R' | 'L') => rows.find(r => r.vs_batter_hand === h) ?? null;
  return {
    overall: byHand('A'),
    vs_R: byHand('R'),
    vs_L: byHand('L'),
  };
}

async function fetchArsenal(pitcherId: number, season: number): Promise<PitcherArsenalRow[]> {
  const { data, error } = await collegeFootballSupabase
    .from('mlb_pitcher_arsenal')
    .select('*')
    .eq('pitcher_id', pitcherId)
    .eq('season', season);
  if (error) throw error;
  return (data ?? []) as PitcherArsenalRow[];
}

async function fetchBattedBall(pitcherId: number, season: number): Promise<PitcherBattedBallProfile> {
  const { data, error } = await collegeFootballSupabase
    .from('mlb_pitcher_batted_ball')
    .select('*')
    .eq('pitcher_id', pitcherId)
    .eq('season', season);
  if (error) throw error;
  return buildBattedBallProfile((data ?? []) as PitcherBattedBallRow[]);
}

async function fetchLineup(gamePk: number, teamId: number): Promise<LineupRow[]> {
  const { data, error } = await collegeFootballSupabase
    .from('mlb_game_lineups')
    .select('*')
    .eq('game_pk', gamePk)
    .eq('team_id', teamId)
    .order('batting_order', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as LineupRow[]).map(row => ({
    ...row,
    player_id: Number(row.player_id),
    batting_order: Number(row.batting_order),
    team_id: Number(row.team_id),
    game_pk: Number(row.game_pk),
    is_confirmed: row.is_confirmed === true,
  }));
}

async function fetchBatterSplits(
  playerIds: number[],
  vsHand: PitchHand,
  season: number,
): Promise<BatterSplitRow[]> {
  if (playerIds.length === 0) return [];

  const [splitRes, seasonRes] = await Promise.all([
    collegeFootballSupabase
      .from('mlb_batter_split_profile')
      .select('*')
      .eq('season', season)
      .eq('vs_pitcher_hand', vsHand)
      .in('batter_id', playerIds),
    collegeFootballSupabase
      .from('mlb_batter_split_profile')
      .select('batter_id, xwoba')
      .eq('season', season)
      .eq('vs_pitcher_hand', 'A')
      .in('batter_id', playerIds),
  ]);

  if (splitRes.error) throw splitRes.error;
  if (seasonRes.error) throw seasonRes.error;

  const seasonAvg = new Map<number, number | null>();
  for (const row of seasonRes.data ?? []) {
    seasonAvg.set(Number(row.batter_id), row.xwoba != null ? Number(row.xwoba) : null);
  }

  return ((splitRes.data ?? []) as BatterSplitRow[]).map(row => ({
    ...row,
    batter_id: Number(row.batter_id),
    pa: Number(row.pa ?? 0),
    season_avg_xwoba: seasonAvg.get(Number(row.batter_id)) ?? null,
  }));
}

async function fetchBatterVsPitchTypes(
  batterIds: number[],
  vsHand: PitchHand,
  pitchTypes: string[],
  season: number,
): Promise<BatterVsPitchTypeRow[]> {
  if (batterIds.length === 0 || pitchTypes.length === 0) return [];

  const { data, error } = await collegeFootballSupabase
    .from('mlb_batter_vs_pitch_type')
    .select('*')
    .eq('season', season)
    .eq('vs_pitcher_hand', vsHand)
    .in('batter_id', batterIds)
    .in('pitch_type', pitchTypes);

  if (error) throw error;
  return ((data ?? []) as BatterVsPitchTypeRow[]).map(row => ({
    ...row,
    batter_id: Number(row.batter_id),
    pitches_seen: Number(row.pitches_seen ?? 0),
  }));
}

export function usePitcherMatchupData(
  gamePk: number,
  awaySpId: number,
  homeSpId: number,
  awayTeamId: number,
  homeTeamId: number,
  homeSpHand: PitchHand,
  awaySpHand: PitchHand,
  season: number,
  enabled: boolean,
) {
  return useQuery<PitcherMatchupData>({
    queryKey: [
      'mlb-pitcher-matchup-data',
      gamePk,
      awaySpId,
      homeSpId,
      awayTeamId,
      homeTeamId,
      homeSpHand,
      awaySpHand,
      season,
    ],
    enabled: enabled && gamePk > 0 && awaySpId > 0 && homeSpId > 0,
    queryFn: async () => {
      const [awayArsenal, homeArsenal, awayBattedBall, homeBattedBall, awayLineup, homeLineup] =
        await Promise.all([
          fetchArsenal(awaySpId, season),
          fetchArsenal(homeSpId, season),
          fetchBattedBall(awaySpId, season),
          fetchBattedBall(homeSpId, season),
          fetchLineup(gamePk, awayTeamId),
          fetchLineup(gamePk, homeTeamId),
        ]);

      const awayIds = awayLineup.map(l => l.player_id);
      const homeIds = homeLineup.map(l => l.player_id);

      const [awayBatterSplits, homeBatterSplits] = await Promise.all([
        fetchBatterSplits(awayIds, homeSpHand, season),
        fetchBatterSplits(homeIds, awaySpHand, season),
      ]);

      const homePitchTypes = arsenalPitchTypes(homeArsenal);
      const awayPitchTypes = arsenalPitchTypes(awayArsenal);

      const [awayBatterVsPitch, homeBatterVsPitch] = await Promise.all([
        fetchBatterVsPitchTypes(awayIds, homeSpHand, homePitchTypes, season),
        fetchBatterVsPitchTypes(homeIds, awaySpHand, awayPitchTypes, season),
      ]);

      return {
        awayArsenal,
        homeArsenal,
        awayBattedBall,
        homeBattedBall,
        awayLineup,
        homeLineup,
        awayBatterSplits,
        homeBatterSplits,
        awayBatterVsPitch,
        homeBatterVsPitch,
      };
    },
    staleTime: 10 * 60 * 1000,
  });
}
