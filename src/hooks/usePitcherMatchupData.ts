import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type {
  BatterSplitRow,
  BatterVsPitchTypeRow,
  LineupRow,
  MatchupGame,
  PitcherArsenalRow,
  PitcherBattedBallProfile,
  PitcherBattedBallRow,
  PitcherMatchupData,
  PitchHand,
} from '@/types/mlb-matchups';
import { arsenalPitchTypes, groupArsenalByHand, normalizeVsBatterHand } from '@/utils/mlbArsenal';

function buildBattedBallProfile(rows: PitcherBattedBallRow[]): PitcherBattedBallProfile {
  const byHand = (h: 'A' | 'R' | 'L') =>
    rows.find(r => normalizeVsBatterHand(r.vs_batter_hand) === h) ?? null;
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
  return ((data ?? []) as PitcherArsenalRow[]).map(row => ({
    ...row,
    pitcher_id: Number(row.pitcher_id),
    pitches_thrown: Number(row.pitches_thrown ?? 0),
    vs_batter_hand: normalizeVsBatterHand(row.vs_batter_hand),
  }));
}

async function fetchBattedBall(pitcherId: number, season: number): Promise<PitcherBattedBallProfile> {
  const { data, error } = await collegeFootballSupabase
    .from('mlb_pitcher_batted_ball')
    .select('*')
    .eq('pitcher_id', pitcherId)
    .eq('season', season);
  if (error) throw error;
  return buildBattedBallProfile(
    ((data ?? []) as PitcherBattedBallRow[]).map(row => ({
      ...row,
      pitcher_id: Number(row.pitcher_id),
      batters_faced: Number(row.batters_faced ?? 0),
    })),
  );
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
      .from('v_mlb_batter_platoon_summary')
      .select('*')
      .eq('season', season)
      .eq('vs_pitcher_hand', vsHand)
      .in('batter_id', playerIds),
    collegeFootballSupabase
      .from('v_mlb_batter_platoon_summary')
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
    other_hand_pa: row.other_hand_pa != null ? Number(row.other_hand_pa) : null,
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
    pa: Number(row.pa ?? 0),
  }));
}

export async function fetchPitcherMatchupDataForGame(
  game: MatchupGame,
  season: number,
): Promise<PitcherMatchupData> {
  const [awayArsenalRaw, homeArsenalRaw, awayBattedBall, homeBattedBall, awayLineup, homeLineup] =
    await Promise.all([
      fetchArsenal(game.away_sp_id, season),
      fetchArsenal(game.home_sp_id, season),
      fetchBattedBall(game.away_sp_id, season),
      fetchBattedBall(game.home_sp_id, season),
      fetchLineup(game.game_pk, game.away_team_id),
      fetchLineup(game.game_pk, game.home_team_id),
    ]);

  const awayArsenal = groupArsenalByHand(awayArsenalRaw);
  const homeArsenal = groupArsenalByHand(homeArsenalRaw);

  const awayIds = awayLineup.map(l => l.player_id);
  const homeIds = homeLineup.map(l => l.player_id);

  const [awayLineupSplits, homeLineupSplits] = await Promise.all([
    fetchBatterSplits(awayIds, game.home_sp_hand, season),
    fetchBatterSplits(homeIds, game.away_sp_hand, season),
  ]);

  const [awayBatterVsPitch, homeBatterVsPitch] = await Promise.all([
    fetchBatterVsPitchTypes(awayIds, game.home_sp_hand, arsenalPitchTypes(homeArsenal), season),
    fetchBatterVsPitchTypes(homeIds, game.away_sp_hand, arsenalPitchTypes(awayArsenal), season),
  ]);

  return {
    awayArsenal,
    homeArsenal,
    awayBattedBall,
    homeBattedBall,
    awayLineup,
    homeLineup,
    awayLineupSplits,
    homeLineupSplits,
    awayBatterVsPitch,
    homeBatterVsPitch,
  };
}

export function usePitcherMatchupData(
  game: MatchupGame | null,
  season: number,
  enabled: boolean,
) {
  return useQuery<PitcherMatchupData>({
    queryKey: [
      'mlb-pitcher-matchup-data',
      game?.game_pk,
      game?.away_sp_id,
      game?.home_sp_id,
      season,
    ],
    enabled: enabled && game != null && game.game_pk > 0 && game.away_sp_id > 0 && game.home_sp_id > 0,
    queryFn: () => fetchPitcherMatchupDataForGame(game!, season),
    staleTime: 10 * 60 * 1000,
  });
}
