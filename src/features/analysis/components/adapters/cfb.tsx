import * as React from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_CFB_SNAPSHOT,
  CFB_SPORT_CONFIG,
  isSideSymmetricCfb,
} from '@/features/analysis/filterSchemaCfb';
import { NFL_DAYS } from '@/features/analysis/filterSchema';
import {
  CFB_ASOF_DEFAULTS,
  normalizeCfbSavedFilterSnapshot,
  type CfbWebFilterSnapshot,
} from '@/features/analysis/normalizeSavedFilterSnapshot';
import { applySportFilterPatch, type FilterPatchOp } from '@/features/analysis/sportFilterEngine';
import { rewriteCfbFavDogOps } from '@/features/analysis/cfbNlFavDogRewrite';
import { rewriteSpreadVsTtLineOps } from '@/features/analysis/rewriteSpreadVsTtLine';
import {
  FG_SPREAD_CFB,
  H1_SPREAD_CFB,
  FG_TOTAL_CFB,
  H1_TOTAL_CFB,
  TT_LINE_CFB,
  emitWindRange,
  windLabel,
} from '@/features/analysis/footballMarketLines';
import { TeamMultiSelect, type TeamOption } from '@/features/analysis/TeamMultiSelect';
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

type S = CfbWebFilterSnapshot;

const SEASON_MAX = 2025;
const WEEK_MAX = 16;
/**
 * Warehouse `cfb_analysis` is slower than NFL — under the ~3s statement_timeout only
 * season_min=2025 completes reliably. Wider defaults time out and the UI shows empty
 * splits. Absolute floor stays on the slider for users who narrow other dims.
 */
const DEFAULT_SEASON_LOOKBACK = 0; // inclusive → [2025, 2025]
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
const GAME_TOTAL = new Set(['fg_total', 'h1_total']);
const SPREAD_MARKETS = new Set(['fg_spread', 'h1_spread']);

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
  spreadMax: 50,
  h1SpreadMax: 28,
  totalMin: 30,
  totalMax: 80,
  ttMin: 10,
  ttMax: 55,
  h1TotalMin: 15,
  h1TotalMax: 45,
  marginBounds: [-80, 80],
  ppgMax: 60,
  paPgMax: 60,
  pointDiffAbs: 40,
  avgCoverAbs: 30,
  prevWinsMax: 15,
  oppPpgMax: 60,
  oppPaPgMax: 60,
  mlNote: 'CFB moneyline odds cover 2021+.',
};

const PRESETS = [
  { label: 'Conference underdogs', betType: 'fg_spread', filters: { conferenceGame: true, spreadSide: 'underdog' } },
  { label: 'Non-conference unders', betType: 'fg_total', filters: { conferenceGame: false } },
  { label: 'Neutral-site games', betType: 'fg_spread', filters: { neutralSite: true } },
  { label: 'Primetime favorites', betType: 'fg_spread', filters: { primetime: true, spreadSide: 'favorite' } },
  { label: 'Big home favorites (TT)', betType: 'team_total', filters: { side: 'home', favDog: 'favorite', spreadSize: [10, 28] } },
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

function conferenceHeadlineSubject(conferences: string[], situation: string): string {
  const base = `${conferences.join(', ')} schools`;
  return situation ? `${base} (${situation.toLowerCase()})` : base;
}
function conferenceScopeNote(conferences: string[], conferenceGame: boolean | null): string {
  if (conferences.length === 0) return 'All FBS teams in every past game that matches your filters.';
  const names = conferences.length === 1 ? conferences[0] : conferences.join(', ');
  if (conferenceGame === true) return `${names} conference games only — matchups between schools in that conference.`;
  if (conferenceGame === false) return `${names} schools in non-conference games only.`;
  if (conferences.length === 1) return `Every game a ${names} school played — non-conference, bowls, and more. Not ${names}-only matchups.`;
  return `Every game involving a ${names} school — non-conference, bowls, and more.`;
}

const seasonFloorFor = (betType: string) => (LIMITED.has(betType) ? 2023 : 2016);

function defaultSeasons(betType: string): [number, number] {
  const floor = seasonFloorFor(betType);
  return [Math.max(floor, SEASON_MAX - DEFAULT_SEASON_LOOKBACK), SEASON_MAX];
}

function reset(betType: string): S {
  return {
    ...DEFAULT_CFB_SNAPSHOT,
    betType,
    seasons: defaultSeasons(betType),
    // Regular-season default keeps cfb_analysis under the warehouse statement_timeout;
    // gameType='any' (all bowls/playoffs too) is still available on the slider.
    gameType: 'regular',
  };
}

function toRpcFilters(s: S, data?: AdapterData): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  const isGameTotal = GAME_TOTAL.has(s.betType);
  const isMlMkt = ML_MARKETS.has(s.betType);
  const isTeamTotal = s.betType === 'team_total';
  // Always emit season_min — omitting at the floor scans all history and times out.
  f.season_min = s.seasons[0];
  if (s.seasons[1] < SEASON_MAX) f.season_max = s.seasons[1];
  if (s.gameType !== 'any') f.game_type = s.gameType;
  if (s.rankedMatchup !== 'any') f.ranked_matchup = s.rankedMatchup;
  if (s.gameType === 'any' || s.gameType === 'regular') {
    if (s.weeks[0] > 1) f.week_min = s.weeks[0];
    if (s.weeks[1] < WEEK_MAX) f.week_max = s.weeks[1];
  }
  if (s.side !== 'any' && !isGameTotal) f.side = s.side;
  if (s.teams.length) f.team = s.teams;
  if (s.opponents.length) f.opponent = s.opponents;
  if (s.daysOfWeek.length) f.day_of_week = s.daysOfWeek;
  emitFootballLines(f, s as unknown as FootballShared, {
    fgSpread: FG_SPREAD_CFB,
    h1Spread: H1_SPREAD_CFB,
    fgTotal: FG_TOTAL_CFB,
    h1Total: H1_TOTAL_CFB,
    ttLine: TT_LINE_CFB,
  });
  if (s.favDog !== 'any' && (isMlMkt || isTeamTotal)) f.fav_dog = s.favDog;
  if (s.primetime !== null) f.primetime = s.primetime;
  if (s.conferenceGame !== null) f.conference_game = s.conferenceGame;
  if (s.neutralSite !== null) f.neutral_site = s.neutralSite;
  const picked = s.selectedConferences.filter(Boolean);
  const confMap = data?.conferenceTeamMap ?? {};
  if (!s.teams.length) {
    if (picked.length === 1) {
      f.conference = picked[0];
    } else if (picked.length > 1) {
      const confTeams = Array.from(new Set(picked.flatMap((c) => confMap[c] ?? []))).sort();
      if (confTeams.length > 0) f.team = confTeams;
    }
  } else if (picked.length === 1) {
    f.conference = picked[0];
  }
  if (s.tempRange[0] > -10) f.temp_min = s.tempRange[0];
  if (s.tempRange[1] < 110) f.temp_max = s.tempRange[1];
  emitWindRange(f, s.windRange);
  if (s.weather !== 'any') f.weather = s.weather;
  if (s.dome !== 'any') f.dome = s.dome === 'dome';
  if (s.restBye === 'off_bye') f.rest_min = 13;
  else if (s.restBye === 'short') f.rest_max = 6;
  else if (s.restBye === 'pre_bye') f.pre_bye = true;
  emitFootballLastGame(f, s as unknown as FootballShared, [-80, 80]);
  emitFootballAsOf(f, s as unknown as FootballShared, CFB_ASOF_DEFAULTS);
  return f;
}

function toCurrentFilterPayload(s: S): Record<string, unknown> {
  const out: Record<string, unknown> = { betType: s.betType };
  for (const k of Object.keys(DEFAULT_CFB_SNAPSHOT) as Array<keyof typeof DEFAULT_CFB_SNAPSHOT>) {
    if (k === 'betType') continue;
    if (JSON.stringify(s[k as keyof S]) !== JSON.stringify(DEFAULT_CFB_SNAPSHOT[k])) {
      out[k] = s[k as keyof S];
    }
  }
  return out;
}

/** CFB conference multi-select (sport-local). */
function ConferenceMultiSelect({
  conferences,
  selected,
  onChange,
}: {
  conferences: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name].sort());
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.length === 0 ? 'All conferences' : `${selected.length} selected`}
        </span>
        {selected.length > 0 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange([])}>
            Clear all
          </Button>
        )}
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
        {conferences.map((name) => (
          <label key={name} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted/50">
            <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} className="rounded border-border" />
            <span className="text-sm">{name}</span>
          </label>
        ))}
      </div>
    </div>
  );
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
  const isGameTotal = GAME_TOTAL.has(s.betType);
  const isMlMkt = ML_MARKETS.has(s.betType);
  const isTeamTotal = s.betType === 'team_total';
  return (
    <>
      <FilterGroup title="Teams" defaultOpen>
        <TeamMultiSelect label="Team" options={data.teamOptions} value={s.teams} onChange={(v) => update({ teams: v })} />
        <TeamMultiSelect label="Opponent" options={data.teamOptions} value={s.opponents} onChange={(v) => update({ opponents: v })} emptyLabel="Any opponent" />
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Conferences</div>
          <ConferenceMultiSelect
            conferences={data.conferences ?? []}
            selected={s.selectedConferences}
            onChange={(v) => update({ selectedConferences: v })}
          />
        </div>
      </FilterGroup>

      {/* game totals have no side/role controls — hide the whole group there */}
      {!isGameTotal && (
        <FilterGroup title="Side & Role">
          <SelectRow label="Side" value={s.side} onChange={(v) => update({ side: v })} options={[['any', 'Either'], ['home', 'Home'], ['away', 'Away']]} />
          {(isMlMkt || isTeamTotal) && (
            <SelectRow label="Favorite / Underdog" value={s.favDog} onChange={(v) => update({ favDog: v })} options={[['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']]} />
          )}
        </FilterGroup>
      )}

      <FootballLinesGroup s={s as unknown as FootballShared} update={update as (p: Partial<FootballShared>) => void} b={BOUNDS} />

      <FilterGroup title="Schedule">
        <RangeRow label={`Seasons: ${s.seasons[0]}–${s.seasons[1]}`} min={floor} max={SEASON_MAX} step={1} value={s.seasons} onChange={(v) => update({ seasons: v })} />
        <SelectRow
          label="Game type"
          value={s.gameType}
          onChange={(v) => update({ gameType: v })}
          options={[['any', 'All games'], ['regular', 'Regular season'], ['bowl', 'Bowl games'], ['playoff', 'Playoff'], ['postseason', 'All postseason']]}
        />
        {(s.gameType === 'any' || s.gameType === 'regular') && (
          <RangeRow label={`Weeks: ${s.weeks[0]}–${s.weeks[1]}`} min={1} max={WEEK_MAX} step={1} value={s.weeks} onChange={(v) => update({ weeks: v })} />
        )}
        <MultiToggle label="Days of week" options={NFL_DAYS} value={s.daysOfWeek} onChange={(v) => update({ daysOfWeek: v })} />
        <SelectRow
          label="Rest / Bye"
          value={s.restBye}
          onChange={(v) => update({ restBye: v })}
          options={[['any', 'Any'], ['off_bye', 'Off a bye'], ['pre_bye', 'Week before a bye'], ['short', 'Short week (<7 days)']]}
        />
      </FilterGroup>

      <FilterGroup title="Game">
        <SelectRow
          label="Ranked matchup"
          value={s.rankedMatchup}
          onChange={(v) => update({ rankedMatchup: v })}
          options={[['any', 'Any'], ['both', 'Both ranked'], ['neither', 'Neither ranked'], ['home_ranked', 'Home ranked, away unranked'], ['away_ranked', 'Away ranked, home unranked'], ['either', 'Either ranked']]}
        />
        <TriRow label="Primetime (7pm+ ET)" value={s.primetime} onChange={(v) => update({ primetime: v })} />
        <TriRow label="Conference game" value={s.conferenceGame} onChange={(v) => update({ conferenceGame: v })} />
        <TriRow label="Neutral site" value={s.neutralSite} onChange={(v) => update({ neutralSite: v })} />
      </FilterGroup>

      <FilterGroup title="Weather & Venue">
        <SelectRow label="Weather" value={s.weather} onChange={(v) => update({ weather: v })} options={[['any', 'Any'], ['clear', 'Clear'], ['cloudy', 'Cloudy'], ['rain', 'Rain'], ['snow', 'Snow']]} />
        <SelectRow label="Venue" value={s.dome} onChange={(v) => update({ dome: v })} options={[['any', 'Any'], ['dome', 'Dome / indoors'], ['outdoor', 'Outdoors']]} />
        <RangeRow label={`Temp: ${s.tempRange[0]}–${s.tempRange[1]}°F`} min={-10} max={110} step={1} value={s.tempRange} onChange={(v) => update({ tempRange: v })} />
        <RangeRow label={`Wind: ${s.windRange[0]}–${s.windRange[1]} mph`} min={0} max={60} step={1} value={s.windRange} onChange={(v) => update({ windRange: v })} />
        <p className="text-[10px] text-muted-foreground/70">
          Weather conditions are complete for 2022+, partial for 2018–2021, and sparse in 2016–2017.
        </p>
      </FilterGroup>

      <FootballTailGroups s={s as unknown as FootballShared} update={update as (p: Partial<FootballShared>) => void} b={BOUNDS} />
    </>
  );
}

function useAdapterData(): AdapterData {
  const [teamOptions, setTeamOptions] = React.useState<TeamOption[]>([]);
  const [conferences, setConferences] = React.useState<string[]>([]);
  const [conferenceTeamMap, setConferenceTeamMap] = React.useState<Record<string, string[]>>({});
  const [cfbLogos, setCfbLogos] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    collegeFootballSupabase
      .from('cfb_team_mapping')
      .select('api,logo_light,logo_dark')
      .then(({ data }) => {
        if (data)
          setCfbLogos(
            Object.fromEntries(
              (data as { api?: string; logo_light?: string }[])
                .filter((t) => t.api && t.logo_light)
                .map((t) => [t.api as string, t.logo_light as string]),
            ),
          );
      });
    collegeFootballSupabase
      .from('cfb_teams')
      .select('team_name,conference')
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string[]> = {};
        for (const row of data as { team_name: string; conference: string | null }[]) {
          if (!row.conference) continue;
          (map[row.conference] ??= []).push(row.team_name);
        }
        for (const key of Object.keys(map)) map[key].sort();
        setConferenceTeamMap(map);
        setTeamOptions(
          Array.from(new Set((data as { team_name: string }[]).map((r) => r.team_name).filter(Boolean)))
            .sort()
            .map((name) => ({ id: name, name })),
        );
      });
    collegeFootballSupabase
      .rpc('cfb_analysis', { p_bet_type: 'fg_spread', p_filters: {} })
      .then(({ data }) => {
        if (data)
          setConferences(
            ((data.by_conference as { conference: string }[]) || [])
              .map((c) => c.conference)
              .filter(Boolean)
              .sort(),
          );
      });
  }, []);
  return { teamOptions, conferences, conferenceTeamMap, cfbLogos };
}

export const cfbAdapter: TrendsSportAdapter<S> = {
  sport: 'cfb',
  label: 'CFB',
  betGroups: BET_GROUPS,
  defaultBetType: 'fg_spread',
  limitedBetTypes: LIMITED,
  seasonFloorFor,
  seasonMax: SEASON_MAX,

  reset,
  normalize: (raw, betType) => normalizeCfbSavedFilterSnapshot(raw as Record<string, unknown>, betType),
  withBetType: (s, betType) => {
    const floor = seasonFloorFor(betType);
    return { ...s, betType, seasons: s.seasons[0] < floor ? [floor, s.seasons[1]] : s.seasons };
  },

  analysisRpc: 'cfb_analysis',
  upcomingRpc: 'cfb_analysis_upcoming',
  toRpcFilters,

  toCurrentFilterPayload,
  chatBodyExtras: () => ({}),
  applyChat: (current, ops: FilterPatchOp[], ctx): ChatResult<S> => {
    const rewritten = rewriteCfbFavDogOps(
      String(current.betType),
      rewriteSpreadVsTtLineOps(ctx.sentence, ops, { spreadMax: 50 }),
    );
    const res = applySportFilterPatch(CFB_SPORT_CONFIG, current, { ops: rewritten });
    return { snapshot: res.snapshot, applied: res.applied, rejected: res.rejected, noChange: res.noChange };
  },
  nlExamples: [
    'Michigan as underdogs',
    'SEC home favorites in conference play',
    'Ranked matchups on neutral sites',
    'Non-conference unders',
    'Teams on a 3-game win streak',
  ],

  isTotalMarket: (bt) => GAME_TOTAL.has(bt),
  recoverTotalOverall: false,
  hideSideBarsWhenSymmetric: true,
  isSideSymmetric: (s) => isSideSymmetricCfb(s),
  showsROI: () => true,
  verb: (bt) => VERB[bt] ?? 'hit',
  outcomeWord: (bt) => OUTCOME[bt] ?? 'Hit',
  nounFor: (bt) => (bt === 'team_total' ? 'team totals' : 'games'),
  sideLabel,
  headlineSubject: (s) => {
    const isGameTotal = GAME_TOTAL.has(s.betType);
    const isTotal = isGameTotal;
    const isSpreadMkt = SPREAD_MARKETS.has(s.betType);
    const isMlMkt = ML_MARKETS.has(s.betType);
    const isTeamTotal = s.betType === 'team_total';
    const parts: string[] = [];
    if (s.side !== 'any' && !isGameTotal) parts.push(s.side === 'home' ? 'Home' : 'Road');
    const dir = isSpreadMkt ? s.spreadSide : isMlMkt || isTeamTotal ? s.favDog : 'any';
    if (dir && dir !== 'any') parts.push(dir === 'favorite' ? 'favorites' : 'underdogs');
    const situation = parts.join(' ');
    if (s.selectedConferences.length > 0) return conferenceHeadlineSubject(s.selectedConferences, situation);
    if (situation) return situation.charAt(0).toUpperCase() + situation.slice(1);
    return isTotal ? 'Games' : 'Teams';
  },
  scopeNote: (s) => conferenceScopeNote(s.selectedConferences, s.conferenceGame),
  focusSide: (s, dimension, side) => {
    if (dimension === 'home_away') return { side };
    if (dimension === 'fav_dog') return SPREAD_MARKETS.has(s.betType) ? { spreadSide: side } : { favDog: side };
    return {};
  },

  breakdownTabs: (s, data): BreakdownTabDef[] => {
    const team: BreakdownTabDef = { key: 'team', label: 'By Team', rows: (data.by_team as BreakdownRow[]) ?? [], hasLogos: true, labelKey: 'team' };
    if (s.selectedConferences.length > 0) return [team];
    return [
      team,
      { key: 'conf', label: 'By Conference', rows: (data.by_conference as BreakdownRow[]) ?? [], hasLogos: false, labelKey: 'conference' },
    ];
  },
  logoFor: (row, _tab, data) => data.cfbLogos?.[String(row.team ?? '')] ?? null,
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
      conferenceGame: (f.conferenceGame as boolean | null) ?? null,
      neutralSite: (f.neutralSite as boolean | null) ?? null,
      spreadSize: (f.spreadSize as [number, number]) ?? next.spreadSize,
    } as S;
  },
  activeChips: (s) => {
    const defSeasons = defaultSeasons(s.betType);
    const isGameTotal = GAME_TOTAL.has(s.betType);
    const isMlMkt = ML_MARKETS.has(s.betType);
    const isTeamTotal = s.betType === 'team_total';
    const c: { label: string; patch: Record<string, unknown> }[] = [];
    if (s.seasons[0] !== defSeasons[0] || s.seasons[1] !== defSeasons[1])
      c.push({ label: `Seasons ${s.seasons[0]}–${s.seasons[1]}`, patch: { seasons: defSeasons } });
    if (s.gameType !== 'regular')
      c.push({
        label:
          ({ any: 'All game types', bowl: 'Bowl games', playoff: 'Playoff', postseason: 'All postseason' } as Record<
            string,
            string
          >)[s.gameType] || s.gameType,
        patch: { gameType: 'regular' },
      });
    if (s.rankedMatchup !== 'any') c.push({ label: ({ both: 'Both ranked', neither: 'Neither ranked', home_ranked: 'Home ranked / away unranked', away_ranked: 'Away ranked / home unranked', either: 'Either ranked' } as Record<string, string>)[s.rankedMatchup] || s.rankedMatchup, patch: { rankedMatchup: 'any' } });
    if ((s.gameType === 'any' || s.gameType === 'regular') && (s.weeks[0] !== 1 || s.weeks[1] !== WEEK_MAX)) c.push({ label: `Weeks ${s.weeks[0]}–${s.weeks[1]}`, patch: { weeks: [1, WEEK_MAX] } });
    if (s.side !== 'any' && !isGameTotal) c.push({ label: s.side === 'home' ? 'Home' : 'Away', patch: { side: 'any' } });
    if (s.teams.length) c.push({ label: `Team: ${s.teams.join(', ')}`, patch: { teams: [] } });
    if (s.opponents.length) c.push({ label: `Opp: ${s.opponents.join(', ')}`, patch: { opponents: [] } });
    if (s.daysOfWeek.length) c.push({ label: `Days: ${s.daysOfWeek.join(', ')}`, patch: { daysOfWeek: [] } });
    if ((isMlMkt || isTeamTotal) && s.favDog !== 'any') c.push({ label: s.favDog === 'favorite' ? 'Favorites' : 'Underdogs', patch: { favDog: 'any' } });
    c.push(...footballLineChips(s as unknown as FootballShared, BOUNDS));
    if (s.primetime !== null) c.push({ label: `Primetime: ${s.primetime ? 'Yes' : 'No'}`, patch: { primetime: null } });
    if (s.conferenceGame !== null) c.push({ label: `Conference game: ${s.conferenceGame ? 'Yes' : 'No'}`, patch: { conferenceGame: null } });
    if (s.neutralSite !== null) c.push({ label: `Neutral site: ${s.neutralSite ? 'Yes' : 'No'}`, patch: { neutralSite: null } });
    for (const conf of s.selectedConferences) {
      c.push({ label: conf, patch: { selectedConferences: s.selectedConferences.filter((x) => x !== conf) } });
    }
    if (s.weather !== 'any') c.push({ label: `Weather: ${({ clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow' } as Record<string, string>)[s.weather]}`, patch: { weather: 'any' } });
    if (s.dome !== 'any') c.push({ label: s.dome === 'dome' ? 'Indoors / dome' : 'Outdoors', patch: { dome: 'any' } });
    if (s.tempRange[0] !== -10 || s.tempRange[1] !== 110) c.push({ label: `Temp ${s.tempRange[0]}–${s.tempRange[1]}°F`, patch: { tempRange: [-10, 110] } });
    const wl = windLabel(s.windRange);
    if (wl) c.push({ label: wl, patch: { windRange: [0, 60] } });
    if (s.restBye !== 'any') c.push({ label: ({ off_bye: 'Off a bye', pre_bye: 'Before a bye', short: 'Short week' } as Record<string, string>)[s.restBye] || s.restBye, patch: { restBye: 'any' } });
    c.push(...footballLastGameChips(s as unknown as FootballShared, [-80, 80]));
    c.push(...footballAsOfChips(s as unknown as FootballShared, CFB_ASOF_DEFAULTS));
    return c;
  },
  savedTable: 'cfb_analysis_saved_filters',

  groupFields: {
    Teams: ['teams', 'opponents', 'selectedConferences'],
    'Side & Role': ['side', 'favDog'],
    Schedule: ['seasons', 'gameType', 'weeks', 'daysOfWeek', 'restBye'],
    Game: ['rankedMatchup', 'primetime', 'conferenceGame', 'neutralSite'],
    'Weather & Venue': ['weather', 'dome', 'tempRange', 'windRange'],
    ...FOOTBALL_SHARED_GROUP_FIELDS,
  },

  useAdapterData,
  RailSections,
};
