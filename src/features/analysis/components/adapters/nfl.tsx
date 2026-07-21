import * as React from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_NFL_SNAPSHOT,
  NFL_DAYS,
  NFL_DIVISIONS,
  isSideSymmetric,
} from '@/features/analysis/filterSchema';
import {
  NFL_ASOF_DEFAULTS,
  normalizeNflSavedFilterSnapshot,
  type NflWebFilterSnapshot,
} from '@/features/analysis/normalizeSavedFilterSnapshot';
import { applyFilterPatch } from '@/features/analysis/applyFilterPatch';
import { rewriteSpreadVsTtLineOps } from '@/features/analysis/rewriteSpreadVsTtLine';
import {
  FG_SPREAD_NFL,
  H1_SPREAD_NFL,
  FG_TOTAL_NFL,
  H1_TOTAL_NFL,
  TT_LINE_NFL,
  emitWindRange,
  windLabel,
} from '@/features/analysis/footballMarketLines';
import { TeamMultiSelect, type TeamOption } from '@/features/analysis/TeamMultiSelect';
import type { FilterPatchOp } from '@/features/analysis/sportFilterEngine';
import { RangeRow, SelectRow, MultiToggle, TriRow, FilterGroup } from '../FilterControls';
import {
  FootballLinesGroup,
  FootballTailGroups,
  FOOTBALL_SHARED_GROUP_FIELDS,
  type FootballBounds,
  type FootballShared,
} from '../FootballRailShared';
import type {
  AdapterData,
  AnalysisResponse,
  BreakdownRow,
  BreakdownTabDef,
  ChatResult,
  TrendsSportAdapter,
  UpcomingGame,
} from './types';
import { fmtKick } from './shared';
import { footballLineChips, footballLastGameChips, footballAsOfChips } from './footballChips';
import { emitFootballLines, emitFootballLastGame, emitFootballAsOf } from './footballRpc';

type S = NflWebFilterSnapshot;

const BET_GROUPS = [
  {
    group: 'Full Game',
    items: [
      { key: 'fg_spread', label: 'Spread' },
      { key: 'fg_ml', label: 'Moneyline' },
      { key: 'fg_total', label: 'Total' },
      { key: 'team_total', label: 'Team Total' },
    ],
  },
  {
    group: 'First Half',
    items: [
      { key: 'h1_spread', label: '1H Spread' },
      { key: 'h1_ml', label: '1H Moneyline' },
      { key: 'h1_total', label: '1H Total' },
    ],
  },
];
const LIMITED = new Set(['h1_spread', 'h1_ml', 'h1_total', 'team_total']);
const ML_MARKETS = new Set(['fg_ml', 'h1_ml']);
const TOTAL_MARKETS = new Set(['fg_total', 'h1_total']);
// markets whose subject direction reads from spreadSide (else favDog)
const SPREAD_SUBJECT = new Set(['fg_spread', 'h1_spread', 'fg_ml', 'h1_ml']);

const VERB: Record<string, string> = {
  fg_spread: 'covered',
  h1_spread: 'covered the 1H spread',
  fg_ml: 'won',
  h1_ml: 'won in the 1H',
  fg_total: 'went over',
  h1_total: 'went over the 1H total',
  team_total: 'went over their team total',
};
const OUTCOME: Record<string, string> = {
  fg_spread: 'Cover',
  h1_spread: 'Cover',
  fg_ml: 'Win',
  h1_ml: 'Win',
  fg_total: 'Over',
  h1_total: 'Over',
  team_total: 'Over',
};

const BOUNDS: FootballBounds = {
  spreadMax: 20,
  h1SpreadMax: 14,
  totalMin: 30,
  totalMax: 60,
  ttMin: 10,
  ttMax: 40,
  h1TotalMin: 15,
  h1TotalMax: 35,
  marginBounds: [-60, 60],
  ppgMax: 40,
  paPgMax: 40,
  pointDiffAbs: 20,
  avgCoverAbs: 15,
  prevWinsMax: 16,
  oppPpgMax: 40,
  oppPaPgMax: 40,
};

const ESPN: Record<string, string> = {
  LA: 'lar',
  LAR: 'lar',
  LAC: 'lac',
  WAS: 'wsh',
  WSH: 'wsh',
  JAC: 'jax',
  OAK: 'lv',
  SD: 'lac',
  STL: 'lar',
};
const NFL_TEAM_RPC_ALIAS: Record<string, string> = { LA: 'LAR' };
const toRpcTeam = (abbr: string) => NFL_TEAM_RPC_ALIAS[abbr.toUpperCase()] || abbr.toUpperCase();
const logoForAbbr = (abbr?: string) =>
  abbr
    ? `https://a.espncdn.com/i/teamlogos/nfl/500/${(ESPN[abbr] || abbr).toLowerCase()}.png`
    : '/placeholder.svg';

const NFL_TEAMS: TeamOption[] = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB',
  'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
].map((abbr) => ({ id: abbr, name: abbr, logo: logoForAbbr(abbr) }));

const PRESETS = [
  { label: 'Cold-weather unders', betType: 'fg_total', filters: { tempMax: 32 } },
  { label: 'Home underdogs', betType: 'fg_spread', filters: { side: 'away', favDog: 'underdog' } },
  { label: 'Primetime favorites', betType: 'fg_spread', filters: { primetime: true, spreadSide: 'favorite' } },
  { label: 'Divisional unders', betType: 'fg_total', filters: { division: true } },
  { label: 'Big home favorites (TT)', betType: 'team_total', filters: { side: 'home', spreadSide: 'favorite', spreadSize: [7, 20] } },
];

function sideLabel(betType: string, side: string): string {
  if (side === 'over') return 'Over';
  if (side === 'under') return 'Under';
  const verb = ML_MARKETS.has(betType) ? 'won' : 'covered';
  if (side === 'home') return `Home ${verb}`;
  if (side === 'away') return `Away ${verb}`;
  if (side === 'favorite') return `Favorites ${verb}`;
  if (side === 'underdog') return `Underdogs ${verb}`;
  return side;
}

function seasonFloorFor(betType: string) {
  return LIMITED.has(betType) ? 2023 : 2018;
}

function reset(betType: string): S {
  const floor = seasonFloorFor(betType);
  return { ...DEFAULT_NFL_SNAPSHOT, betType, seasons: [floor, 2025] };
}

function toRpcFilters(s: S): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  const floor = seasonFloorFor(s.betType);
  if (s.seasons[0] > floor) f.season_min = s.seasons[0];
  if (s.seasons[1] < 2025) f.season_max = s.seasons[1];
  if (s.seasonType === 'regular') {
    f.season_type = 'regular';
    if (s.weeks[0] > 1) f.week_min = s.weeks[0];
    if (s.weeks[1] < 18) f.week_max = s.weeks[1];
  } else if (s.seasonType === 'postseason') {
    f.season_type = 'postseason';
    if (s.playoffRound !== 'any') f.playoff_round = s.playoffRound;
  }
  if (s.side !== 'any') f.side = s.side;
  if (s.teams.length) f.team = s.teams.map(toRpcTeam);
  if (s.opponents.length) f.opponent = s.opponents.map(toRpcTeam);
  if (s.daysOfWeek.length) f.day_of_week = s.daysOfWeek;
  if (s.teamDivisions.length) f.team_division = s.teamDivisions;
  emitFootballLines(f, s as unknown as FootballShared, {
    fgSpread: FG_SPREAD_NFL,
    h1Spread: H1_SPREAD_NFL,
    fgTotal: FG_TOTAL_NFL,
    h1Total: H1_TOTAL_NFL,
    ttLine: TT_LINE_NFL,
  });
  if (s.favDog !== 'any' && s.betType === 'team_total') f.fav_dog = s.favDog;
  if (s.primetime !== null) f.primetime = s.primetime;
  if (s.division !== null) f.division = s.division;
  if (s.dome !== 'any') f.dome = s.dome === 'dome';
  if (s.tempRange[0] > -10) f.temp_min = s.tempRange[0];
  if (s.tempRange[1] < 100) f.temp_max = s.tempRange[1];
  emitWindRange(f, s.windRange);
  if (s.precip !== 'any') f.precip = s.precip;
  if (s.restBye === 'off_bye') f.rest_min = 13;
  else if (s.restBye === 'short') f.rest_max = 4;
  else if (s.restBye === 'pre_bye') f.pre_bye = true;
  if (s.coach !== 'any') f.coach = s.coach;
  if (s.referee !== 'any') f.referee = s.referee;
  emitFootballLastGame(f, s as unknown as FootballShared, [-60, 60]);
  emitFootballAsOf(f, s as unknown as FootballShared, NFL_ASOF_DEFAULTS);
  return f;
}

function toCurrentFilterPayload(s: S): Record<string, unknown> {
  const out: Record<string, unknown> = { betType: s.betType };
  for (const k of Object.keys(DEFAULT_NFL_SNAPSHOT) as Array<keyof typeof DEFAULT_NFL_SNAPSHOT>) {
    if (k === 'betType') continue;
    if (JSON.stringify(s[k as keyof S]) !== JSON.stringify(DEFAULT_NFL_SNAPSHOT[k])) {
      out[k] = s[k as keyof S];
    }
  }
  return out;
}

function RailSections({
  snapshot: s,
  update,
  data,
}: {
  snapshot: S;
  update: (patch: Partial<S>) => void;
  data: AdapterData;
}) {
  const floor = seasonFloorFor(s.betType);
  return (
    <>
      <FilterGroup title="Situation" defaultOpen>
        <RangeRow label={`Seasons: ${s.seasons[0]}–${s.seasons[1]}`} min={floor} max={2025} step={1} value={s.seasons} onChange={(v) => update({ seasons: v })} />
        <SelectRow
          label="Season type"
          value={s.seasonType}
          onChange={(v) => update({ seasonType: v })}
          options={[['any', 'Regular + Playoffs'], ['regular', 'Regular season'], ['postseason', 'Playoffs only']]}
        />
        {s.seasonType === 'regular' && (
          <RangeRow label={`Weeks: ${s.weeks[0]}–${s.weeks[1]}`} min={1} max={18} step={1} value={s.weeks} onChange={(v) => update({ weeks: v })} />
        )}
        {s.seasonType === 'postseason' && (
          <SelectRow
            label="Playoff round"
            value={s.playoffRound}
            onChange={(v) => update({ playoffRound: v })}
            options={[['any', 'All rounds'], ['Wild Card', 'Wild Card'], ['Divisional', 'Divisional'], ['Conference', 'Conference'], ['Super Bowl', 'Super Bowl']]}
          />
        )}
        <SelectRow label="Side" value={s.side} onChange={(v) => update({ side: v })} options={[['any', 'Either'], ['home', 'Home'], ['away', 'Away']]} />
        <TeamMultiSelect label="Team" options={data.teamOptions} value={s.teams} onChange={(v) => update({ teams: v })} />
        <TeamMultiSelect label="Opponent" options={data.teamOptions} value={s.opponents} onChange={(v) => update({ opponents: v })} emptyLabel="Any opponent" />
        <MultiToggle label="Days of week" options={NFL_DAYS} value={s.daysOfWeek} onChange={(v) => update({ daysOfWeek: v })} />
        {s.betType === 'team_total' && (
          <SelectRow label="Favorite / Underdog" value={s.favDog} onChange={(v) => update({ favDog: v })} options={[['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']]} />
        )}
      </FilterGroup>

      <FootballLinesGroup s={s as unknown as FootballShared} update={update as (p: Partial<FootballShared>) => void} b={BOUNDS} />

      <FilterGroup title="Matchup">
        <TriRow label="Primetime" value={s.primetime} onChange={(v) => update({ primetime: v })} />
        <TriRow label="Divisional" value={s.division} onChange={(v) => update({ division: v })} />
        <MultiToggle label="Team division" options={NFL_DIVISIONS} value={s.teamDivisions} onChange={(v) => update({ teamDivisions: v })} />
        <SelectRow
          label="Rest / Bye"
          value={s.restBye}
          onChange={(v) => update({ restBye: v })}
          options={[['any', 'Any'], ['off_bye', 'Off a bye'], ['pre_bye', 'Week before a bye'], ['short', 'Short rest (Thu)']]}
        />
      </FilterGroup>

      <FilterGroup title="Weather">
        <SelectRow label="Venue" value={s.dome} onChange={(v) => update({ dome: v })} options={[['any', 'Any'], ['dome', 'Dome'], ['outdoor', 'Outdoor']]} />
        <SelectRow label="Precipitation" value={s.precip} onChange={(v) => update({ precip: v })} options={[['any', 'Any'], ['none', 'None'], ['rain', 'Rain'], ['snow', 'Snow']]} />
        <RangeRow label={`Temp: ${s.tempRange[0]}–${s.tempRange[1]}°F`} min={-10} max={100} step={1} value={s.tempRange} onChange={(v) => update({ tempRange: v })} />
        <RangeRow label={`Wind: ${s.windRange[0]}–${s.windRange[1]} mph`} min={0} max={60} step={1} value={s.windRange} onChange={(v) => update({ windRange: v })} />
      </FilterGroup>

      <FilterGroup title="Context">
        <SelectRow label="Coach" value={s.coach} onChange={(v) => update({ coach: v })} options={[['any', 'Any coach'], ...(data.coaches ?? []).map((c) => [c, c] as [string, string])]} />
        <SelectRow label="Referee" value={s.referee} onChange={(v) => update({ referee: v })} options={[['any', 'Any referee'], ...(data.referees ?? []).map((r) => [r, r] as [string, string])]} />
      </FilterGroup>

      <FootballTailGroups s={s as unknown as FootballShared} update={update as (p: Partial<FootballShared>) => void} b={BOUNDS} />
    </>
  );
}

function useAdapterData(): AdapterData {
  const [teamOptions, setTeamOptions] = React.useState<TeamOption[]>(NFL_TEAMS);
  const [coaches, setCoaches] = React.useState<string[]>([]);
  const [referees, setReferees] = React.useState<string[]>([]);
  React.useEffect(() => {
    collegeFootballSupabase
      .rpc('nfl_analysis', { p_bet_type: 'fg_spread', p_filters: {} })
      .then(({ data }) => {
        if (data) {
          setCoaches(((data.by_coach as { coach: string }[]) || []).map((c) => c.coach).filter(Boolean).sort());
          setReferees(((data.by_referee as { referee: string }[]) || []).map((r) => r.referee).filter(Boolean).sort());
        }
      });
    collegeFootballSupabase
      .from('nfl_teams')
      .select('team_abbr, team_name')
      .then(({ data }) => {
        if (!data?.length) return;
        setTeamOptions(
          (data as { team_abbr?: string; team_name?: string }[])
            .map((r) => {
              const abbr = toRpcTeam(String(r.team_abbr || '').toUpperCase());
              return { id: abbr, name: String(r.team_name || abbr), logo: logoForAbbr(abbr) };
            })
            .filter((t) => t.id)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      });
  }, []);
  return { teamOptions, coaches, referees };
}

export const nflAdapter: TrendsSportAdapter<S> = {
  sport: 'nfl',
  label: 'NFL',
  betGroups: BET_GROUPS,
  defaultBetType: 'fg_spread',
  limitedBetTypes: LIMITED,
  seasonFloorFor,
  seasonMax: 2025,

  reset,
  normalize: (raw, betType) => normalizeNflSavedFilterSnapshot(raw as Record<string, unknown>, betType),
  withBetType: (s, betType) => {
    const floor = seasonFloorFor(betType);
    return { ...s, betType, seasons: s.seasons[0] < floor ? [floor, s.seasons[1]] : s.seasons };
  },

  analysisRpc: 'nfl_analysis',
  upcomingRpc: 'nfl_analysis_upcoming',
  toRpcFilters,

  toCurrentFilterPayload,
  chatBodyExtras: (data) => ({ coaches: data.coaches ?? [], referees: data.referees ?? [] }),
  applyChat: (current, ops: FilterPatchOp[], ctx): ChatResult<S> => {
    const rewritten = rewriteSpreadVsTtLineOps(ctx.sentence, ops, { spreadMax: 20 });
    const res = applyFilterPatch(current, { ops: rewritten }, { coaches: ctx.data.coaches, referees: ctx.data.referees });
    return { snapshot: res.snapshot, applied: res.applied, rejected: res.rejected, noChange: res.noChange };
  },
  nlExamples: [
    'Teams on 3+ game win streak',
    'Home underdogs in primetime',
    'Road favorites off a loss',
    'Divisional games in December',
    'Teams with winning record',
  ],

  isTotalMarket: (bt) => TOTAL_MARKETS.has(bt),
  recoverTotalOverall: true,
  hideSideBarsWhenSymmetric: false,
  isSideSymmetric: (s) => isSideSymmetric(s),
  showsROI: () => true,
  verb: (bt) => VERB[bt] ?? 'hit',
  outcomeWord: (bt) => OUTCOME[bt] ?? 'Hit',
  nounFor: (bt) => (bt === 'team_total' ? 'team totals' : 'games'),
  sideLabel,
  headlineSubject: (s) => {
    const isTotal = TOTAL_MARKETS.has(s.betType);
    const parts: string[] = [];
    if (!isTotal && s.side !== 'any') parts.push(s.side === 'home' ? 'Home' : 'Road');
    const direction = isTotal ? 'any' : SPREAD_SUBJECT.has(s.betType) ? s.spreadSide : s.favDog;
    if (direction && direction !== 'any') parts.push(direction === 'favorite' ? 'favorites' : 'underdogs');
    const situation = parts.join(' ');
    if (s.coach !== 'any') return `${s.coach}'s teams${situation ? ` (${situation.toLowerCase()})` : ''}`;
    if (situation) return situation.charAt(0).toUpperCase() + situation.slice(1);
    return isTotal ? 'Games' : 'Teams';
  },
  scopeNote: (s) => {
    const bits: string[] = [];
    if (s.coach !== 'any') bits.push(`${s.coach}-coached teams`);
    if (s.referee !== 'any') bits.push(`games officiated by ${s.referee}`);
    const who = bits.length ? bits.join(' · ') : 'all teams';
    return `${who} in every past game that matches your filters.`;
  },
  focusSide: (_s, dimension, side) =>
    dimension === 'home_away' ? { side } : dimension === 'fav_dog' ? { spreadSide: side } : {},

  breakdownTabs: (_s, data): BreakdownTabDef[] => [
    { key: 'team', label: 'By Team', rows: (data.by_team as BreakdownRow[]) ?? [], hasLogos: true, labelKey: 'team' },
    { key: 'coach', label: 'By Coach', rows: (data.by_coach as BreakdownRow[]) ?? [], hasLogos: false, labelKey: 'coach' },
    { key: 'ref', label: 'By Referee', rows: (data.by_referee as BreakdownRow[]) ?? [], hasLogos: false, labelKey: 'referee' },
  ],
  logoFor: (row) => logoForAbbr(String(row.team ?? '')),
  lineForBet: (betType, g: UpcomingGame) => {
    const t = g.team as string;
    const sp = g.team_spread as number;
    if (betType === 'fg_spread') return `${t} ${sp > 0 ? '+' : ''}${sp}`;
    if (betType === 'fg_ml') return `${t} ML (${g.is_favorite ? 'favorite' : 'underdog'})`;
    if (betType === 'fg_total') return `Total O/U ${g.total ?? '—'}`;
    if (betType === 'team_total') return `${t} team total ${g.tt_line ?? '—'}`;
    if (betType === 'h1_spread') return `${t} 1H ${(g.h1_spread as number) > 0 ? '+' : ''}${g.h1_spread ?? '—'}`;
    if (betType === 'h1_ml') return `${t} 1H ML (${g.is_favorite ? 'favorite' : 'underdog'})`;
    if (betType === 'h1_total') return `1H Total O/U ${g.h1_total ?? '—'}`;
    return '';
  },
  upcomingLabel: (count) => `This week's games that match (${count})`,
  upcomingTime: (g) => fmtKick(g.kickoff as string | undefined),

  presets: PRESETS,
  applyPreset: (p) => {
    const next = reset(p.betType);
    const f = p.filters as Record<string, unknown>;
    return {
      ...next,
      side: (f.side as string) || 'any',
      favDog: (f.favDog as string) || 'any',
      spreadSide: (f.spreadSide as string) || 'any',
      primetime: (f.primetime as boolean | null) ?? null,
      division: (f.division as boolean | null) ?? null,
      tempRange: [-10, (f.tempMax as number) ?? 100],
      spreadSize: (f.spreadSize as [number, number]) ?? next.spreadSize,
    } as S;
  },
  activeChips: (s) => {
    const floor = seasonFloorFor(s.betType);
    const c: { label: string; patch: Record<string, unknown> }[] = [];
    if (s.seasons[0] !== floor || s.seasons[1] !== 2025) c.push({ label: `Seasons ${s.seasons[0]}–${s.seasons[1]}`, patch: { seasons: [floor, 2025] } });
    if (s.seasonType !== 'any') c.push({ label: s.seasonType === 'regular' ? 'Regular season' : 'Playoffs', patch: { seasonType: 'any', playoffRound: 'any' } });
    if (s.seasonType === 'regular' && (s.weeks[0] !== 1 || s.weeks[1] !== 18)) c.push({ label: `Weeks ${s.weeks[0]}–${s.weeks[1]}`, patch: { weeks: [1, 18] } });
    if (s.seasonType === 'postseason' && s.playoffRound !== 'any') c.push({ label: `Round: ${s.playoffRound}`, patch: { playoffRound: 'any' } });
    if (s.side !== 'any') c.push({ label: s.side === 'home' ? 'Home' : 'Away', patch: { side: 'any' } });
    if (s.teams.length) c.push({ label: `Team: ${s.teams.join(', ')}`, patch: { teams: [] } });
    if (s.opponents.length) c.push({ label: `Opp: ${s.opponents.join(', ')}`, patch: { opponents: [] } });
    if (s.daysOfWeek.length) c.push({ label: `Days: ${s.daysOfWeek.join(', ')}`, patch: { daysOfWeek: [] } });
    if (s.teamDivisions.length) c.push({ label: `Division: ${s.teamDivisions.join(', ')}`, patch: { teamDivisions: [] } });
    if (s.betType === 'team_total' && s.favDog !== 'any') c.push({ label: s.favDog === 'favorite' ? 'Favorites' : 'Underdogs', patch: { favDog: 'any' } });
    c.push(...footballLineChips(s as unknown as FootballShared, BOUNDS));
    if (s.primetime !== null) c.push({ label: `Primetime: ${s.primetime ? 'Yes' : 'No'}`, patch: { primetime: null } });
    if (s.division !== null) c.push({ label: `Divisional: ${s.division ? 'Yes' : 'No'}`, patch: { division: null } });
    if (s.dome !== 'any') c.push({ label: s.dome === 'dome' ? 'Dome' : 'Outdoor', patch: { dome: 'any' } });
    if (s.precip !== 'any') c.push({ label: `Precip: ${s.precip}`, patch: { precip: 'any' } });
    if (s.tempRange[0] !== -10 || s.tempRange[1] !== 100) c.push({ label: `Temp ${s.tempRange[0]}–${s.tempRange[1]}°F`, patch: { tempRange: [-10, 100] } });
    const wl = windLabel(s.windRange);
    if (wl) c.push({ label: wl, patch: { windRange: [0, 60] } });
    if (s.restBye !== 'any') c.push({ label: ({ off_bye: 'Off a bye', pre_bye: 'Before a bye', short: 'Short rest' } as Record<string, string>)[s.restBye] || s.restBye, patch: { restBye: 'any' } });
    if (s.coach !== 'any') c.push({ label: `Coach: ${s.coach}`, patch: { coach: 'any' } });
    if (s.referee !== 'any') c.push({ label: `Ref: ${s.referee}`, patch: { referee: 'any' } });
    c.push(...footballLastGameChips(s as unknown as FootballShared, [-60, 60]));
    c.push(...footballAsOfChips(s as unknown as FootballShared, NFL_ASOF_DEFAULTS));
    return c;
  },
  savedTable: 'nfl_analysis_saved_filters',

  groupFields: {
    Situation: ['seasons', 'seasonType', 'weeks', 'playoffRound', 'side', 'teams', 'opponents', 'daysOfWeek', 'favDog'],
    Matchup: ['primetime', 'division', 'teamDivisions', 'restBye'],
    Weather: ['dome', 'precip', 'tempRange', 'windRange'],
    Context: ['coach', 'referee'],
    ...FOOTBALL_SHARED_GROUP_FIELDS,
  },

  useAdapterData,
  RailSections,
};
