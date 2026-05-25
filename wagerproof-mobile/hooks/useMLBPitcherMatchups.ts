import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import type {
  BatterRecentForm,
  BatterSplitRow,
  BatterVsArchetypeRow,
  BatterVsPitchTypeRow,
  LineupRow,
  PitcherArsenalRow,
  PitcherArchetypeProfile,
  PitcherBattedBallRow,
  PitcherMatchupGame,
  PitcherMatchupSummary,
} from '@/types/mlbPitcherMatchups';
import type { MLBTeamMapping } from '@/types/mlb';
import {
  fallbackAbbrevFromTeamName,
  normalizeTeamNameKey,
} from '@/types/mlb';
import { getMLBFallbackTeamInfo } from '@/constants/mlbTeams';
import { normalizePitchHand, toF5SplitTeamAbbr } from '@/utils/mlbF5Splits';

function seasonFromDate(date: string | null | undefined): number {
  const year = Number((date ?? '').slice(0, 4));
  return Number.isFinite(year) && year > 2000 ? year : new Date().getFullYear();
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function addDaysYmd(baseYmd: string, days: number): string {
  const date = new Date(`${baseYmd}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA');
}

function resolveTeam(
  teamName: string,
  teamId: number | null,
  byName: Map<string, MLBTeamMapping>,
  byId: Map<number, MLBTeamMapping>,
): string {
  const nameKey = normalizeTeamNameKey(teamName);
  const direct = byName.get(nameKey);
  if (direct?.team) return direct.team;
  if (teamId) {
    const byTeamId = byId.get(teamId);
    if (byTeamId?.team) return byTeamId.team;
  }
  for (const [key, mapping] of byName) {
    if (key.includes(nameKey) || nameKey.includes(key)) return mapping.team;
  }
  return getMLBFallbackTeamInfo(teamName)?.team ?? fallbackAbbrevFromTeamName(teamName);
}

async function loadTeamMappings() {
  const { data } = await collegeFootballSupabase
    .from('mlb_team_mapping')
    .select('*');
  const byName = new Map<string, MLBTeamMapping>();
  const byId = new Map<number, MLBTeamMapping>();
  for (const raw of data ?? []) {
    const mapping: MLBTeamMapping = {
      mlb_api_id: Number(raw.mlb_api_id ?? raw.team_id ?? raw.id),
      team: String(raw.team ?? raw.abbreviation ?? raw.team_abbrev ?? ''),
      team_name: String(raw.team_name ?? raw.name ?? raw.full_name ?? ''),
      logo_url: raw.logo_url ?? raw.logo ?? null,
    };
    if (mapping.team_name) byName.set(normalizeTeamNameKey(mapping.team_name), mapping);
    if (mapping.mlb_api_id) byId.set(mapping.mlb_api_id, mapping);
  }
  return { byName, byId };
}

function normalizePitcherBattedBall(raw: Record<string, unknown>): PitcherBattedBallRow {
  const xwoba = raw.xwoba_allowed ?? raw.xwobacon_allowed ?? raw.xwobacon ?? raw.xwoba ?? null;
  const woba = raw.woba_allowed ?? raw.woba ?? null;
  return {
    ...(raw as unknown as PitcherBattedBallRow),
    pitcher_id: Number(raw.pitcher_id),
    batters_faced: Number(raw.batters_faced ?? 0),
    xwoba_allowed: xwoba != null ? Number(xwoba) : null,
    woba_allowed: woba != null ? Number(woba) : null,
    k_pct: raw.k_pct != null ? Number(raw.k_pct) : null,
    bb_pct: raw.bb_pct != null ? Number(raw.bb_pct) : null,
    gb_pct: raw.gb_pct != null ? Number(raw.gb_pct) : null,
    fb_pct: raw.fb_pct != null ? Number(raw.fb_pct) : null,
    hr_per_fb_pct: raw.hr_per_fb_pct != null ? Number(raw.hr_per_fb_pct) : null,
    barrel_pct: raw.barrel_pct != null ? Number(raw.barrel_pct) : null,
  };
}

function topBattersForTeam(
  lineup: LineupRow[],
  splitsById: Map<number, BatterSplitRow>,
  vsHand: 'R' | 'L',
): BatterSplitRow[] {
  return lineup
    .map(row => {
      const split = splitsById.get(row.player_id);
      if (!split) {
        const fallback: BatterSplitRow = {
          batter_id: row.player_id,
          batter_name: row.player_name,
          has_split: false,
          batting_order: row.batting_order,
          position: row.position,
          bat_side: row.bat_side,
          vs_pitcher_hand: vsHand,
          pa: 0,
          avg: null,
          obp: null,
          slg: null,
          ops: null,
          iso: null,
          woba: null,
          babip: null,
          xwoba: null,
          k_pct: null,
          bb_pct: null,
          avg_exit_velo: null,
          barrel_pct: null,
          hard_hit_pct: null,
          gb_pct: null,
          fb_pct: null,
          ld_pct: null,
          iffb_pct: null,
          pull_pct: null,
          pull_air_pct: null,
          center_pct: null,
          oppo_pct: null,
          hr_per_pa: null,
          hr_per_fb_pct: null,
          recent_form: null,
        };
        return fallback;
      }
      return {
        ...split,
        has_split: true,
        batter_name: split.batter_name || row.player_name,
        batting_order: row.batting_order,
        position: row.position,
        bat_side: row.bat_side,
      };
    })
    .sort((a, b) => (a.batting_order ?? 99) - (b.batting_order ?? 99));
}

function normalizeRecentForm(raw: Record<string, unknown>): BatterRecentForm {
  return {
    batter_id: Number(raw.batter_id),
    pa: Number(raw.pa ?? 0),
    bbe: Number(raw.bbe ?? 0),
    avg_exit_velo: raw.avg_exit_velo != null ? Number(raw.avg_exit_velo) : null,
    hard_hit_pct: raw.hard_hit_pct != null ? Number(raw.hard_hit_pct) : null,
    barrel_pct: raw.barrel_pct != null ? Number(raw.barrel_pct) : null,
    pull_air_pct: raw.pull_air_pct != null ? Number(raw.pull_air_pct) : null,
    k_pct: raw.k_pct != null ? Number(raw.k_pct) : null,
    xwoba: raw.xwoba != null ? Number(raw.xwoba) : null,
  };
}

function normalizeArsenal(raw: Record<string, unknown>): PitcherArsenalRow {
  return {
    pitcher_id: Number(raw.pitcher_id),
    pitch_type: String(raw.pitch_type ?? ''),
    pitch_type_label: String(raw.pitch_type_label ?? raw.pitch_type ?? ''),
    vs_batter_hand: raw.vs_batter_hand as PitcherArsenalRow['vs_batter_hand'],
    pitches_thrown: Number(raw.pitches_thrown ?? 0),
    usage_pct: raw.usage_pct != null ? Number(raw.usage_pct) : null,
    avg_velo: raw.avg_velo != null ? Number(raw.avg_velo) : null,
    avg_spin_rpm: raw.avg_spin_rpm != null ? Number(raw.avg_spin_rpm) : null,
    avg_horizontal_break: raw.avg_horizontal_break != null ? Number(raw.avg_horizontal_break) : null,
    avg_vertical_break: raw.avg_vertical_break != null ? Number(raw.avg_vertical_break) : null,
    whiff_pct: raw.whiff_pct != null ? Number(raw.whiff_pct) : null,
    xwoba_allowed: raw.xwoba_allowed != null ? Number(raw.xwoba_allowed) : null,
    gb_pct: raw.gb_pct != null ? Number(raw.gb_pct) : null,
    fb_pct: raw.fb_pct != null ? Number(raw.fb_pct) : null,
    ld_pct: raw.ld_pct != null ? Number(raw.ld_pct) : null,
    hr_per_fb_pct: raw.hr_per_fb_pct != null ? Number(raw.hr_per_fb_pct) : null,
  };
}

function normalizeVsPitch(raw: Record<string, unknown>): BatterVsPitchTypeRow {
  return {
    batter_id: Number(raw.batter_id),
    vs_pitcher_hand: raw.vs_pitcher_hand as 'R' | 'L',
    pitch_type: String(raw.pitch_type ?? ''),
    pitch_type_label: String(raw.pitch_type_label ?? raw.pitch_type ?? ''),
    pitches_seen: Number(raw.pitches_seen ?? 0),
    pa: Number(raw.pa ?? 0),
    avg: raw.avg != null ? Number(raw.avg) : null,
    slg: raw.slg != null ? Number(raw.slg) : null,
    xwoba: raw.xwoba != null ? Number(raw.xwoba) : null,
    whiff_pct: raw.whiff_pct != null ? Number(raw.whiff_pct) : null,
    gb_pct: raw.gb_pct != null ? Number(raw.gb_pct) : null,
    fb_pct: raw.fb_pct != null ? Number(raw.fb_pct) : null,
    hr_per_fb_pct: raw.hr_per_fb_pct != null ? Number(raw.hr_per_fb_pct) : null,
  };
}

function normalizeVsArchetype(raw: Record<string, unknown>): BatterVsArchetypeRow {
  const pa = Number(raw.pa ?? 0);
  return {
    batter_id: Number(raw.batter_id),
    season: Number(raw.season),
    vs_pitcher_hand: raw.vs_pitcher_hand as 'R' | 'L',
    archetype: String(raw.archetype ?? ''),
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

export function useMLBPitcherMatchups() {
  return useQuery<PitcherMatchupSummary[]>({
    queryKey: ['mlb-pitcher-matchups-mobile', getTodayET()],
    queryFn: async () => {
      const today = getTodayET();
      const end = addDaysYmd(today, 2);
      const { data: gameRows, error: gamesError } = await collegeFootballSupabase
        .from('mlb_games_today')
        .select('*')
        .gte('official_date', today)
        .lte('official_date', end)
        .order('official_date', { ascending: true })
        .order('game_time_et', { ascending: true });

      if (gamesError) throw gamesError;
      const { byName, byId } = await loadTeamMappings();

      const games: PitcherMatchupGame[] = (gameRows ?? [])
        .filter((row: any) => !row.is_postponed && row.away_sp_id && row.home_sp_id)
        .map((row: any) => {
          const awayName = row.away_team_name || row.away_team || row.away_team_full_name || 'Away';
          const homeName = row.home_team_name || row.home_team || row.home_team_full_name || 'Home';
          const awayTeamId = Number(row.away_team_id ?? row.away_mlb_team_id ?? row.away_id ?? 0) || null;
          const homeTeamId = Number(row.home_team_id ?? row.home_mlb_team_id ?? row.home_id ?? 0) || null;
          return {
            game_pk: Number(row.game_pk),
            official_date: row.official_date,
            game_time_et: row.game_time_et,
            away_team_id: awayTeamId,
            home_team_id: homeTeamId,
            away_team_name: awayName,
            home_team_name: homeName,
            away_abbr: toF5SplitTeamAbbr(resolveTeam(awayName, awayTeamId, byName, byId)),
            home_abbr: toF5SplitTeamAbbr(resolveTeam(homeName, homeTeamId, byName, byId)),
            away_sp_id: Number(row.away_sp_id),
            home_sp_id: Number(row.home_sp_id),
            away_sp_name: String(row.away_sp_name ?? 'Away starter'),
            home_sp_name: String(row.home_sp_name ?? 'Home starter'),
            away_sp_hand: normalizePitchHand(row.away_sp_hand),
            home_sp_hand: normalizePitchHand(row.home_sp_hand),
          };
        });

      if (!games.length) return [];

      const season = seasonFromDate(games[0].official_date);
      const pitcherIds = [...new Set(games.flatMap(g => [g.away_sp_id, g.home_sp_id]))];
      const gamePks = games.map(g => g.game_pk);

      const [archRes, bbRes, lineupRes, arsenalRes] = await Promise.all([
        collegeFootballSupabase
          .from('v_mlb_pitcher_archetypes')
          .select('pitcher_id, archetype, k_pct, gb_pct, fb_pct, bb_pct, max_fb_velo')
          .eq('season', season)
          .in('pitcher_id', pitcherIds),
        collegeFootballSupabase
          .from('mlb_pitcher_batted_ball')
          .select('*')
          .eq('season', season)
          .eq('vs_batter_hand', 'A')
          .in('pitcher_id', pitcherIds),
        collegeFootballSupabase
          .from('mlb_game_lineups')
          .select('*')
          .in('game_pk', gamePks)
          .order('batting_order', { ascending: true }),
        collegeFootballSupabase
          .from('mlb_pitcher_arsenal')
          .select('*')
          .eq('season', season)
          .in('pitcher_id', pitcherIds),
      ]);

      if (archRes.error) {
        console.warn('Pitcher archetypes unavailable:', archRes.error.message);
      }
      if (bbRes.error) {
        console.warn('Pitcher batted-ball data unavailable:', bbRes.error.message);
      }
      if (lineupRes.error) {
        console.warn('Lineup data unavailable:', lineupRes.error.message);
      }
      if (arsenalRes.error) {
        console.warn('Pitcher arsenal unavailable:', arsenalRes.error.message);
      }

      const archetypeByPitcher = new Map<number, PitcherArchetypeProfile>();
      for (const row of archRes.error ? [] : archRes.data ?? []) {
        archetypeByPitcher.set(Number(row.pitcher_id), {
          pitcher_id: Number(row.pitcher_id),
          archetype: String(row.archetype) as PitcherArchetypeProfile['archetype'],
          k_pct: row.k_pct != null ? Number(row.k_pct) : null,
          gb_pct: row.gb_pct != null ? Number(row.gb_pct) : null,
          fb_pct: row.fb_pct != null ? Number(row.fb_pct) : null,
          bb_pct: row.bb_pct != null ? Number(row.bb_pct) : null,
          max_fb_velo: row.max_fb_velo != null ? Number(row.max_fb_velo) : null,
        });
      }

      const battedBallByPitcher = new Map<number, PitcherBattedBallRow>();
      for (const row of bbRes.error ? [] : bbRes.data ?? []) {
        const normalized = normalizePitcherBattedBall(row as Record<string, unknown>);
        battedBallByPitcher.set(normalized.pitcher_id, normalized);
      }

      const arsenalByPitcher = new Map<number, PitcherArsenalRow[]>();
      const allPitchTypes = new Set<string>();
      for (const row of arsenalRes.error ? [] : arsenalRes.data ?? []) {
        const normalized = normalizeArsenal(row as Record<string, unknown>);
        if (!normalized.pitch_type) continue;
        allPitchTypes.add(normalized.pitch_type);
        const rows = arsenalByPitcher.get(normalized.pitcher_id) ?? [];
        rows.push(normalized);
        arsenalByPitcher.set(normalized.pitcher_id, rows);
      }

      const lineupByGameTeam = new Map<string, LineupRow[]>();
      const lineupRows = lineupRes.error ? [] : lineupRes.data ?? [];
      for (const raw of lineupRows) {
        const lineupRow: LineupRow = {
          game_pk: Number(raw.game_pk),
          team_id: Number(raw.team_id),
          player_id: Number(raw.player_id),
          player_name: String(raw.player_name),
          batting_order: Number(raw.batting_order),
          position: raw.position ?? null,
          bat_side: raw.bat_side ?? null,
          is_confirmed: raw.is_confirmed === true,
        };
        const key = `${lineupRow.game_pk}|${lineupRow.team_id}`;
        const rows = lineupByGameTeam.get(key) ?? [];
        rows.push(lineupRow);
        lineupByGameTeam.set(key, rows);
      }

      const batterIds = [...new Set(lineupRows.map((r: any) => Number(r.player_id)).filter(Boolean))];
      const splitsByHand = new Map<'R' | 'L', Map<number, BatterSplitRow>>();
      for (const hand of ['R', 'L'] as const) {
        if (!batterIds.length) continue;
        const [splitRes, recentRes] = await Promise.all([
          collegeFootballSupabase
            .from('v_mlb_batter_platoon_summary')
            .select('*')
            .eq('season', season)
            .eq('vs_pitcher_hand', hand)
            .in('batter_id', batterIds),
          collegeFootballSupabase
            .from('mlb_batter_recent_form')
            .select('*')
            .eq('season', season)
            .eq('vs_pitcher_hand', hand)
            .eq('window_games', 10)
            .in('batter_id', batterIds),
        ]);
        if (splitRes.error) {
          console.warn(`Batter splits vs ${hand}HP unavailable:`, splitRes.error.message);
        }
        if (recentRes.error) {
          console.warn(`Batter recent form vs ${hand}HP unavailable:`, recentRes.error.message);
        }

        const recentMap = new Map<number, BatterRecentForm>();
        for (const row of recentRes.error ? [] : recentRes.data ?? []) {
          const normalized = normalizeRecentForm(row as Record<string, unknown>);
          recentMap.set(normalized.batter_id, normalized);
        }

        const map = new Map<number, BatterSplitRow>();
        for (const row of splitRes.error ? [] : splitRes.data ?? []) {
          map.set(Number(row.batter_id), {
            batter_id: Number(row.batter_id),
            batter_name: String(row.batter_name ?? ''),
            has_split: true,
            vs_pitcher_hand: hand,
            pa: Number(row.pa ?? 0),
            avg: row.avg != null ? Number(row.avg) : null,
            obp: row.obp != null ? Number(row.obp) : null,
            slg: row.slg != null ? Number(row.slg) : null,
            ops: row.ops != null ? Number(row.ops) : null,
            iso: row.iso != null ? Number(row.iso) : null,
            woba: row.woba != null ? Number(row.woba) : null,
            babip: row.babip != null ? Number(row.babip) : null,
            xwoba: row.xwoba != null ? Number(row.xwoba) : null,
            k_pct: row.k_pct != null ? Number(row.k_pct) : null,
            bb_pct: row.bb_pct != null ? Number(row.bb_pct) : null,
            avg_exit_velo: row.avg_exit_velo != null ? Number(row.avg_exit_velo) : null,
            barrel_pct: row.barrel_pct != null ? Number(row.barrel_pct) : null,
            hard_hit_pct: row.hard_hit_pct != null ? Number(row.hard_hit_pct) : null,
            gb_pct: row.gb_pct != null ? Number(row.gb_pct) : null,
            fb_pct: row.fb_pct != null ? Number(row.fb_pct) : null,
            ld_pct: row.ld_pct != null ? Number(row.ld_pct) : null,
            iffb_pct: row.iffb_pct != null ? Number(row.iffb_pct) : null,
            pull_pct: row.pull_pct != null ? Number(row.pull_pct) : null,
            pull_air_pct: row.pull_air_pct != null ? Number(row.pull_air_pct) : null,
            center_pct: row.center_pct != null ? Number(row.center_pct) : null,
            oppo_pct: row.oppo_pct != null ? Number(row.oppo_pct) : null,
            hr_per_pa: row.hr_per_pa != null ? Number(row.hr_per_pa) : null,
            hr_per_fb_pct: row.hr_per_fb_pct != null ? Number(row.hr_per_fb_pct) : null,
            recent_form: recentMap.get(Number(row.batter_id)) ?? null,
          });
        }
        splitsByHand.set(hand, map);
      }

      const pitchTypeList = [...allPitchTypes];
      const [vsPitchR, vsPitchL, vsArchRes] = await Promise.all([
        batterIds.length && pitchTypeList.length
          ? collegeFootballSupabase
            .from('mlb_batter_vs_pitch_type')
            .select('*')
            .eq('season', season)
            .eq('vs_pitcher_hand', 'R')
            .in('batter_id', batterIds)
            .in('pitch_type', pitchTypeList)
          : Promise.resolve({ data: [], error: null } as any),
        batterIds.length && pitchTypeList.length
          ? collegeFootballSupabase
            .from('mlb_batter_vs_pitch_type')
            .select('*')
            .eq('season', season)
            .eq('vs_pitcher_hand', 'L')
            .in('batter_id', batterIds)
            .in('pitch_type', pitchTypeList)
          : Promise.resolve({ data: [], error: null } as any),
        batterIds.length
          ? collegeFootballSupabase
            .from('mlb_batter_vs_archetype')
            .select('*')
            .eq('season', season)
            .in('batter_id', batterIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (vsPitchR.error) console.warn('Batter vs RHP pitch-type unavailable:', vsPitchR.error.message);
      if (vsPitchL.error) console.warn('Batter vs LHP pitch-type unavailable:', vsPitchL.error.message);
      if (vsArchRes.error) console.warn('Batter vs archetype unavailable:', vsArchRes.error.message);

      const vsPitchMap = new Map<string, BatterVsPitchTypeRow[]>();
      for (const row of [
        ...(vsPitchR.error ? [] : vsPitchR.data ?? []),
        ...(vsPitchL.error ? [] : vsPitchL.data ?? []),
      ]) {
        const normalized = normalizeVsPitch(row as Record<string, unknown>);
        const key = `${normalized.batter_id}|${normalized.vs_pitcher_hand}`;
        const rows = vsPitchMap.get(key) ?? [];
        rows.push(normalized);
        vsPitchMap.set(key, rows);
      }

      const vsArchMap = new Map<string, BatterVsArchetypeRow>();
      for (const row of vsArchRes.error ? [] : vsArchRes.data ?? []) {
        const normalized = normalizeVsArchetype(row as Record<string, unknown>);
        vsArchMap.set(`${normalized.batter_id}|${normalized.vs_pitcher_hand}|${normalized.archetype}`, normalized);
      }

      const pickVsPitch = (batters: BatterSplitRow[], pitcherHand: 'R' | 'L' | null | undefined, arsenal: PitcherArsenalRow[]) => {
        if (pitcherHand !== 'R' && pitcherHand !== 'L') return {};
        const allowed = new Set(arsenal.map(p => p.pitch_type));
        const out: Record<number, BatterVsPitchTypeRow[]> = {};
        for (const batter of batters) {
          out[batter.batter_id] = (vsPitchMap.get(`${batter.batter_id}|${pitcherHand}`) ?? [])
            .filter(row => allowed.has(row.pitch_type));
        }
        return out;
      };

      const pickVsArch = (
        batters: BatterSplitRow[],
        pitcherHand: 'R' | 'L' | null | undefined,
        archetype: string | null | undefined,
      ) => {
        if ((pitcherHand !== 'R' && pitcherHand !== 'L') || !archetype || archetype === 'Insufficient') return {};
        const out: Record<number, BatterVsArchetypeRow> = {};
        for (const batter of batters) {
          const row = vsArchMap.get(`${batter.batter_id}|${pitcherHand}|${archetype}`);
          if (row) out[batter.batter_id] = row;
        }
        return out;
      };

      return games.map(game => {
        const awayLineup =
          game.away_team_id != null ? lineupByGameTeam.get(`${game.game_pk}|${game.away_team_id}`) ?? [] : [];
        const homeLineup =
          game.home_team_id != null ? lineupByGameTeam.get(`${game.game_pk}|${game.home_team_id}`) ?? [] : [];
        const awayOppLineup = homeLineup;
        const homeOppLineup = awayLineup;
        const homeBatterSplits = game.away_sp_hand === 'R' || game.away_sp_hand === 'L'
          ? splitsByHand.get(game.away_sp_hand) ?? new Map<number, BatterSplitRow>()
          : new Map<number, BatterSplitRow>();
        const awayBatterSplits = game.home_sp_hand === 'R' || game.home_sp_hand === 'L'
          ? splitsByHand.get(game.home_sp_hand) ?? new Map<number, BatterSplitRow>()
          : new Map<number, BatterSplitRow>();

        const awayArsenal = arsenalByPitcher.get(game.away_sp_id) ?? [];
        const homeArsenal = arsenalByPitcher.get(game.home_sp_id) ?? [];
        const homeBattersVsAway = topBattersForTeam(
          awayOppLineup,
          homeBatterSplits,
          game.away_sp_hand === 'R' || game.away_sp_hand === 'L' ? game.away_sp_hand : 'R',
        );
        const awayBattersVsHome = topBattersForTeam(
          homeOppLineup,
          awayBatterSplits,
          game.home_sp_hand === 'R' || game.home_sp_hand === 'L' ? game.home_sp_hand : 'R',
        );
        const awayArch = archetypeByPitcher.get(game.away_sp_id) ?? null;
        const homeArch = archetypeByPitcher.get(game.home_sp_id) ?? null;

        const sortLineup = (rows: LineupRow[]) =>
          [...rows].sort((a, b) => a.batting_order - b.batting_order);

        return {
          game,
          awayLineup: sortLineup(awayLineup),
          homeLineup: sortLineup(homeLineup),
          awayPitcher: {
            archetype: awayArch,
            battedBall: battedBallByPitcher.get(game.away_sp_id) ?? null,
            arsenal: awayArsenal,
            topOpposingBatters: homeBattersVsAway,
            batterVsPitchByBatter: pickVsPitch(homeBattersVsAway, game.away_sp_hand, awayArsenal),
            batterVsArchetypeByBatter: pickVsArch(homeBattersVsAway, game.away_sp_hand, awayArch?.archetype),
          },
          homePitcher: {
            archetype: homeArch,
            battedBall: battedBallByPitcher.get(game.home_sp_id) ?? null,
            arsenal: homeArsenal,
            topOpposingBatters: awayBattersVsHome,
            batterVsPitchByBatter: pickVsPitch(awayBattersVsHome, game.home_sp_hand, homeArsenal),
            batterVsArchetypeByBatter: pickVsArch(awayBattersVsHome, game.home_sp_hand, homeArch?.archetype),
          },
        };
      });
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
