import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type {
  BatterRecentForm,
  BatterSplitRow,
  BatterVsArchetypeRow,
  BatterVsPitchTypeRow,
  LineupRow,
  MatchupGame,
  PitcherArchetypeProfile,
  PitcherArchetypeType,
  PitcherArsenalRow,
  PitcherBattedBallProfile,
  PitcherBattedBallRow,
  PitcherMatchupData,
  PitchHand,
} from '@/types/mlb-matchups';
import { isDisplayArchetype } from '@/utils/mlbPitcherArchetypes';
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
    ((data ?? []) as Record<string, unknown>[]).map(raw => {
      const xwobaRaw =
        raw.xwoba_allowed ?? raw.xwobacon_allowed ?? raw.xwobacon ?? raw.xwoba ?? null;
      const wobaRaw = raw.woba_allowed ?? raw.woba ?? null;
      return {
        ...(raw as PitcherBattedBallRow),
        pitcher_id: Number(raw.pitcher_id),
        batters_faced: Number(raw.batters_faced ?? 0),
        xwoba_allowed: xwobaRaw != null ? Number(xwobaRaw) : null,
        woba_allowed: wobaRaw != null ? Number(wobaRaw) : null,
      };
    }),
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

function normalizeRecentFormRow(raw: Record<string, unknown>): BatterRecentForm {
  return {
    batter_id: Number(raw.batter_id),
    season: raw.season != null ? Number(raw.season) : undefined,
    vs_pitcher_hand: raw.vs_pitcher_hand as BatterRecentForm['vs_pitcher_hand'],
    window_games: Number(raw.window_games ?? 10),
    games_used: Number(raw.games_used ?? 0),
    pa: Number(raw.pa ?? 0),
    bbe: Number(raw.bbe ?? 0),
    avg_exit_velo: raw.avg_exit_velo != null ? Number(raw.avg_exit_velo) : null,
    hard_hit_pct: raw.hard_hit_pct != null ? Number(raw.hard_hit_pct) : null,
    barrel_pct: raw.barrel_pct != null ? Number(raw.barrel_pct) : null,
    pull_air_pct: raw.pull_air_pct != null ? Number(raw.pull_air_pct) : null,
    gb_pct: raw.gb_pct != null ? Number(raw.gb_pct) : null,
    fb_pct: raw.fb_pct != null ? Number(raw.fb_pct) : null,
    ld_pct: raw.ld_pct != null ? Number(raw.ld_pct) : null,
    k_pct: raw.k_pct != null ? Number(raw.k_pct) : null,
    bb_pct: raw.bb_pct != null ? Number(raw.bb_pct) : null,
    xwoba: raw.xwoba != null ? Number(raw.xwoba) : null,
    as_of_date: raw.as_of_date != null ? String(raw.as_of_date) : null,
  };
}

async function fetchBatterRecentForms(
  playerIds: number[],
  vsHand: PitchHand,
  season: number,
): Promise<Map<number, BatterRecentForm>> {
  if (playerIds.length === 0 || (vsHand !== 'R' && vsHand !== 'L')) return new Map();

  const { data, error } = await collegeFootballSupabase
    .from('mlb_batter_recent_form')
    .select('*')
    .eq('season', season)
    .eq('vs_pitcher_hand', vsHand)
    .eq('window_games', 10)
    .in('batter_id', playerIds);

  if (error) throw error;

  const map = new Map<number, BatterRecentForm>();
  for (const row of data ?? []) {
    const normalized = normalizeRecentFormRow(row as Record<string, unknown>);
    map.set(normalized.batter_id, normalized);
  }
  return map;
}

async function fetchPitcherArchetype(
  pitcherId: number,
  season: number,
): Promise<PitcherArchetypeProfile | null> {
  const { data, error } = await collegeFootballSupabase
    .from('v_mlb_pitcher_archetypes')
    .select('archetype, k_pct, gb_pct, fb_pct, bb_pct, max_fb_velo')
    .eq('pitcher_id', pitcherId)
    .eq('season', season)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    archetype: String(data.archetype) as PitcherArchetypeType,
    k_pct: data.k_pct != null ? Number(data.k_pct) : null,
    gb_pct: data.gb_pct != null ? Number(data.gb_pct) : null,
    fb_pct: data.fb_pct != null ? Number(data.fb_pct) : null,
    bb_pct: data.bb_pct != null ? Number(data.bb_pct) : null,
    max_fb_velo: data.max_fb_velo != null ? Number(data.max_fb_velo) : null,
  };
}

function normalizeVsArchetypeRow(raw: Record<string, unknown>): BatterVsArchetypeRow {
  const pa = Number(raw.pa ?? 0);
  return {
    batter_id: Number(raw.batter_id),
    season: Number(raw.season),
    vs_pitcher_hand: raw.vs_pitcher_hand as 'R' | 'L',
    archetype: String(raw.archetype),
    pa,
    avg: raw.avg != null ? Number(raw.avg) : null,
    obp: raw.obp != null ? Number(raw.obp) : null,
    slg: raw.slg != null ? Number(raw.slg) : null,
    xwoba: raw.xwoba != null ? Number(raw.xwoba) : null,
    k_pct: raw.k_pct != null ? Number(raw.k_pct) : null,
    barrel_pct: raw.barrel_pct != null ? Number(raw.barrel_pct) : null,
    hard_hit_pct: raw.hard_hit_pct != null ? Number(raw.hard_hit_pct) : null,
    hr_per_pa:
      raw.hr_per_pa != null
        ? Number(raw.hr_per_pa)
        : raw.home_runs != null && pa > 0
          ? Number(raw.home_runs) / pa
          : null,
  };
}

async function fetchBatterVsArchetypes(
  batterIds: number[],
  season: number,
  vsHand: PitchHand,
  archetype: PitcherArchetypeType,
): Promise<Record<number, BatterVsArchetypeRow>> {
  if (
    batterIds.length === 0 ||
    (vsHand !== 'R' && vsHand !== 'L') ||
    !isDisplayArchetype(archetype)
  ) {
    return {};
  }

  const { data, error } = await collegeFootballSupabase
    .from('mlb_batter_vs_archetype')
    .select('*')
    .eq('season', season)
    .eq('vs_pitcher_hand', vsHand)
    .eq('archetype', archetype)
    .in('batter_id', batterIds);

  if (error) throw error;

  const out: Record<number, BatterVsArchetypeRow> = {};
  for (const row of data ?? []) {
    const normalized = normalizeVsArchetypeRow(row as Record<string, unknown>);
    out[normalized.batter_id] = normalized;
  }
  return out;
}

function attachRecentForm(
  splits: BatterSplitRow[],
  recentById: Map<number, BatterRecentForm>,
): BatterSplitRow[] {
  return splits.map(split => {
    const recent = recentById.get(split.batter_id);
    return recent ? { ...split, recent_form: recent } : split;
  });
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

  const [awayBatterVsPitch, homeBatterVsPitch, awayRecent, homeRecent, awayArchetype, homeArchetype] =
    await Promise.all([
      fetchBatterVsPitchTypes(awayIds, game.home_sp_hand, arsenalPitchTypes(homeArsenal), season),
      fetchBatterVsPitchTypes(homeIds, game.away_sp_hand, arsenalPitchTypes(awayArsenal), season),
      fetchBatterRecentForms(awayIds, game.home_sp_hand, season),
      fetchBatterRecentForms(homeIds, game.away_sp_hand, season),
      fetchPitcherArchetype(game.away_sp_id, season),
      fetchPitcherArchetype(game.home_sp_id, season),
    ]);

  const awayArchType = awayArchetype?.archetype ?? 'Insufficient';
  const homeArchType = homeArchetype?.archetype ?? 'Insufficient';

  const [awayVsArchetypeByBatter, homeVsArchetypeByBatter] = await Promise.all([
    fetchBatterVsArchetypes(awayIds, season, game.home_sp_hand, homeArchType),
    fetchBatterVsArchetypes(homeIds, season, game.away_sp_hand, awayArchType),
  ]);

  return {
    awayArsenal,
    homeArsenal,
    awayBattedBall,
    homeBattedBall,
    awayLineup,
    homeLineup,
    awayLineupSplits: attachRecentForm(awayLineupSplits, awayRecent),
    homeLineupSplits: attachRecentForm(homeLineupSplits, homeRecent),
    awayBatterVsPitch,
    homeBatterVsPitch,
    awayArchetype,
    homeArchetype,
    awayVsArchetypeByBatter,
    homeVsArchetypeByBatter,
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
