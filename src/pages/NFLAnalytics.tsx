import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, TrendingUp, TrendingDown, CalendarClock } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

// ── Bet-type spine — the FIRST choice; everything downstream speaks this one market ──
const BET_GROUPS = [
  { group: 'Full Game', items: [
    { key: 'fg_spread', label: 'Spread' }, { key: 'fg_ml', label: 'Moneyline' },
    { key: 'fg_total', label: 'Total' }, { key: 'team_total', label: 'Team Total' }] },
  { group: 'First Half', items: [
    { key: 'h1_spread', label: '1H Spread' }, { key: 'h1_ml', label: '1H Moneyline' },
    { key: 'h1_total', label: '1H Total' }] },
];
const SPREAD_MARKETS = new Set(['fg_spread', 'h1_spread']);
const ML_MARKETS = new Set(['fg_ml', 'h1_ml']);
const TOTAL_MARKETS = new Set(['fg_total', 'h1_total']);
const LIMITED_MARKETS = new Set(['h1_spread', 'h1_ml', 'h1_total', 'team_total']); // 2023+ only

// per-market line-filter config (the SUBJECT market's line, filterable for every bet type)
const SPREAD_CFG: Record<string, { max: number; mk: string; xk: string; amk: string; axk: string }> = {
  fg_spread: { max: 20, mk: 'spread_min', xk: 'spread_max', amk: 'abs_spread_min', axk: 'abs_spread_max' },
  h1_spread: { max: 14, mk: 'h1_spread_min', xk: 'h1_spread_max', amk: 'h1_abs_spread_min', axk: 'h1_abs_spread_max' },
};
const TOTAL_CFG: Record<string, { min: number; max: number; mk: string; xk: string; label: string }> = {
  fg_total: { min: 30, max: 60, mk: 'total_min', xk: 'total_max', label: 'Game total' },
  h1_total: { min: 15, max: 35, mk: 'h1_total_min', xk: 'h1_total_max', label: '1H total' },
  team_total: { min: 10, max: 40, mk: 'tt_min', xk: 'tt_max', label: 'Team total line' },
};

// team abbr → ESPN logo (handles the LA/LAR + WAS/WSH quirks across our two sources)
const ESPN: Record<string, string> = { LA: 'lar', LAR: 'lar', LAC: 'lac', WAS: 'wsh', WSH: 'wsh', JAC: 'jax', OAK: 'lv', SD: 'lac', STL: 'lar' };
const logoFor = (abbr?: string) => abbr ? `https://a.espncdn.com/i/teamlogos/nfl/500/${(ESPN[abbr] || abbr).toLowerCase()}.png` : '/placeholder.svg';

// plain-English label for a result side, per market
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

// the bet-type-relevant line for an upcoming game
function lineForBet(betType: string, g: any): string {
  const t = g.team, sp = g.team_spread;
  if (betType === 'fg_spread') return `${t} ${sp > 0 ? '+' : ''}${sp}`;
  if (betType === 'fg_ml') return `${t} ML (${g.is_favorite ? 'favorite' : 'underdog'})`;
  if (betType === 'fg_total') return `Total O/U ${g.total ?? '—'}`;
  if (betType === 'team_total') return `${t} team total ${g.tt_line ?? '—'}`;
  if (betType === 'h1_spread') return `${t} 1H ${g.h1_spread > 0 ? '+' : ''}${g.h1_spread ?? '—'}`;
  if (betType === 'h1_ml') return `${t} 1H ML (${g.is_favorite ? 'favorite' : 'underdog'})`;
  if (betType === 'h1_total') return `1H Total O/U ${g.h1_total ?? '—'}`;
  return '';
}
function fmtKick(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  } catch { return ''; }
}

type Opt = { side: string; n: number; hit_pct: number; roi: number | null };
type Bar = { dimension: string; options: Opt[] };
type Analysis = {
  bet_type: string;
  coverage: { season_min: number; season_max: number; n_bets: number; n_games: number };
  baseline_pct: number;
  bars: Bar[];
  by_team: { team: string; n: number; hit_pct: number; roi: number | null }[];
  by_coach: { coach: string; n: number; hit_pct: number; roi: number | null }[];
  by_referee: { referee: string; n: number; hit_pct: number; roi: number | null }[];
};

// significance: sample size + deviation from break-even
function significance(n: number, hit: number): { label: string; tone: string } {
  const dev = Math.abs(hit - 50);
  if (n < 20) return { label: 'Thin sample', tone: 'bg-muted text-muted-foreground' };
  if (n >= 60 && dev >= 5) return { label: 'Strong', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
  if (n >= 30 && dev >= 3) return { label: 'Solid', tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' };
  return { label: 'Neutral', tone: 'bg-muted text-muted-foreground' };
}

const PRESETS: { label: string; betType: string; filters: any }[] = [
  { label: 'Cold-weather unders', betType: 'fg_total', filters: { tempMax: 32 } },
  { label: 'Home underdogs', betType: 'fg_spread', filters: { side: 'away', favDog: 'underdog' } },
  { label: 'Primetime favorites', betType: 'fg_spread', filters: { primetime: true, spreadSide: 'favorite' } },
  { label: 'Divisional unders', betType: 'fg_total', filters: { division: true } },
  { label: 'Big home favorites (TT)', betType: 'team_total', filters: { side: 'home', spreadSide: 'favorite', spreadSize: [7, 20] } },
];

// ── Result bar: the donut replacement — split + count + baseline marker + ROI + significance ──
function ResultBar({ betType, bar, baseline }: { betType: string; bar: Bar; baseline: number }) {
  const [a, b] = bar.options;
  const total = (a?.n || 0) + (b?.n || 0);
  const aPct = a?.hit_pct ?? 0;
  return (
    <div className="space-y-1.5">
      <div className="flex h-9 w-full overflow-hidden rounded-lg border bg-muted/40 text-xs font-semibold">
        <div className="flex items-center justify-start px-3 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
          style={{ width: `${Math.max(aPct, 12)}%` }}>
          {sideLabel(betType, a.side)} {aPct}%
        </div>
        <div className="flex flex-1 items-center justify-end px-3 text-muted-foreground whitespace-nowrap">
          {sideLabel(betType, b.side)} {b?.hit_pct}%
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{a.n} of {total} · baseline {baseline}%</span>
        {a.roi != null && (
          <span className={a.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
            {a.roi >= 0 ? '+' : ''}{a.roi}% ROI
          </span>
        )}
      </div>
    </div>
  );
}

function BreakdownTable({ betType, rows, keyName }: { betType: string; rows: any[]; keyName: string }) {
  const [sort, setSort] = useState<'roi' | 'hit' | 'n'>('n');
  const sorted = useMemo(() => [...(rows || [])].sort((x, y) =>
    sort === 'n' ? y.n - x.n : sort === 'hit' ? y.hit_pct - x.hit_pct : (y.roi ?? -999) - (x.roi ?? -999)), [rows, sort]);
  const isTeam = keyName === 'team';
  const isML = ML_MARKETS.has(betType);
  if (!rows?.length) return <p className="text-sm text-muted-foreground py-6 text-center">No results with enough games (min 3).</p>;
  return (
    <div>
      <div className="flex gap-1 mb-2">
        {(['n', 'hit', 'roi'] as const).filter(s => s !== 'roi' || !isML).map(s => (
          <Button key={s} size="sm" variant={sort === s ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setSort(s)}>
            {s === 'n' ? 'Games' : s === 'hit' ? 'Hit %' : 'ROI'}
          </Button>
        ))}
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-lg border divide-y">
        {sorted.map((r, i) => {
          const sig = significance(r.n, r.hit_pct);
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              {isTeam
                ? <img src={logoFor(r.team)} alt={r.team} className="w-6 h-6 shrink-0" onError={e => (e.currentTarget.style.visibility = 'hidden')} />
                : <div className="w-6 shrink-0" />}
              <span className="flex-1 truncate font-medium">{r[keyName]}</span>
              <Badge variant="secondary" className={`text-[10px] ${sig.tone}`}>{r.n}g</Badge>
              <span className={`w-14 text-right font-semibold ${r.hit_pct > 52 ? 'text-emerald-600 dark:text-emerald-400' : r.hit_pct < 48 ? 'text-red-600 dark:text-red-400' : ''}`}>{r.hit_pct}%</span>
              {!isML && <span className={`w-16 text-right text-xs ${(r.roi ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{r.roi != null ? `${r.roi >= 0 ? '+' : ''}${r.roi}%` : '—'}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NFLAnalytics() {
  const [betType, setBetType] = useState('fg_spread');
  const [data, setData] = useState<Analysis | null>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // filter state (UI-shaped; translated to RPC keys in buildFilters)
  const [seasons, setSeasons] = useState<[number, number]>([2018, 2025]);
  const [weeks, setWeeks] = useState<[number, number]>([1, 22]);
  const [side, setSide] = useState('any');
  const [favDog, setFavDog] = useState('any');
  const [spreadSide, setSpreadSide] = useState('any'); // favorite | underdog | any
  const [spreadSize, setSpreadSize] = useState<[number, number]>([0, 20]);
  const [lineRange, setLineRange] = useState<[number, number]>([30, 60]);
  const [primetime, setPrimetime] = useState<boolean | null>(null);
  const [division, setDivision] = useState<boolean | null>(null);
  const [dome, setDome] = useState<string>('any');
  const [tempRange, setTempRange] = useState<[number, number]>([-10, 100]);
  const [windMax, setWindMax] = useState(60);
  const [precip, setPrecip] = useState('any');
  const [restBye, setRestBye] = useState('any'); // any | off_bye | pre_bye | short
  const [coach, setCoach] = useState('any');
  const [referee, setReferee] = useState('any');
  const [coaches, setCoaches] = useState<string[]>([]);
  const [refs, setRefs] = useState<string[]>([]);

  // 1H/TT markets only have 2023+; clamp the season floor so users can't pick empty ranges
  const seasonFloor = LIMITED_MARKETS.has(betType) ? 2023 : 2018;
  // when the bet type changes, reset the line controls to that market's range (avoids stale bounds)
  useEffect(() => {
    if (seasons[0] < seasonFloor) setSeasons([seasonFloor, seasons[1]]);
    setSpreadSize([0, SPREAD_CFG[betType]?.max ?? 20]);
    const t = TOTAL_CFG[betType];
    if (t) setLineRange([t.min, t.max]);
  }, [betType]); // eslint-disable-line

  const buildFilters = useCallback(() => {
    const f: any = {};
    if (seasons[0] > seasonFloor) f.season_min = seasons[0];
    if (seasons[1] < 2025) f.season_max = seasons[1];
    if (weeks[0] > 1) f.week_min = weeks[0];
    if (weeks[1] < 22) f.week_max = weeks[1];
    if (side !== 'any') f.side = side;
    // subject-market line control: size+side for spread markets, range for total markets
    const scfg = SPREAD_CFG[betType];
    if (scfg) {
      const [lo, hi] = spreadSize;
      if (spreadSide === 'favorite') { f[scfg.mk] = -hi; f[scfg.xk] = -lo; }
      else if (spreadSide === 'underdog') { f[scfg.mk] = lo; f[scfg.xk] = hi; }
      else if (lo > 0 || hi < scfg.max) { f[scfg.amk] = lo; f[scfg.axk] = hi; }
    }
    if (favDog !== 'any' && (ML_MARKETS.has(betType) || betType === 'team_total')) f.fav_dog = favDog;
    const tcfg = TOTAL_CFG[betType];
    if (tcfg) {
      if (lineRange[0] > tcfg.min) f[tcfg.mk] = lineRange[0];
      if (lineRange[1] < tcfg.max) f[tcfg.xk] = lineRange[1];
    }
    if (primetime !== null) f.primetime = primetime;
    if (division !== null) f.division = division;
    if (dome !== 'any') f.dome = dome === 'dome';
    if (tempRange[0] > -10) f.temp_min = tempRange[0];
    if (tempRange[1] < 100) f.temp_max = tempRange[1];
    if (windMax < 60) f.wind_max = windMax;
    if (precip !== 'any') f.precip = precip;
    if (restBye === 'off_bye') f.rest_min = 13;
    else if (restBye === 'short') f.rest_max = 4;
    else if (restBye === 'pre_bye') f.pre_bye = true;
    if (coach !== 'any') f.coach = coach;
    if (referee !== 'any') f.referee = referee;
    return f;
  }, [betType, seasons, weeks, side, favDog, spreadSide, spreadSize, lineRange, primetime, division, dome, tempRange, windMax, precip, restBye, coach, referee, seasonFloor]);

  // load coach/ref option lists once
  useEffect(() => {
    collegeFootballSupabase.rpc('nfl_analysis', { p_bet_type: 'fg_spread', p_filters: {} }).then(({ data }) => {
      if (data) {
        setCoaches((data.by_coach || []).map((c: any) => c.coach).sort());
        setRefs((data.by_referee || []).map((r: any) => r.referee).sort());
      }
    });
  }, []);

  // fetch on any change (debounced)
  useEffect(() => {
    setLoading(true);
    const filters = buildFilters();
    const t = setTimeout(async () => {
      const [a, u] = await Promise.all([
        collegeFootballSupabase.rpc('nfl_analysis', { p_bet_type: betType, p_filters: filters }),
        collegeFootballSupabase.rpc('nfl_analysis_upcoming', { p_bet_type: betType, p_filters: filters }),
      ]);
      setData(a.data as Analysis);
      setUpcoming((u.data as any[]) || []);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [betType, buildFilters]);

  const applyPreset = (p: typeof PRESETS[0]) => {
    setBetType(p.betType);
    const f = p.filters;
    setSide(f.side || 'any'); setFavDog(f.favDog || 'any');
    setSpreadSide(f.spreadSide || 'any');
    setPrimetime(f.primetime ?? null); setDivision(f.division ?? null);
    setTempRange([-10, f.tempMax ?? 100]);
    // spread size is reset by the bet-type effect; apply the preset's after it runs
    if (f.spreadSize) setTimeout(() => setSpreadSize(f.spreadSize), 0);
  };

  // only bars where BOTH sides actually have games (a side pinned by a filter → degenerate → hide)
  const shownBars = useMemo(() => (data?.bars || []).filter(bar => bar.options.every(o => o && o.n > 0)), [data]);
  // headline: strongest WELL-SAMPLED option — never an empty/tiny side (that was the 0-games bug)
  const headline = useMemo(() => {
    let best: { opt: Opt; dim: string } | null = null;
    for (const bar of shownBars) for (const opt of bar.options) {
      if (!opt.n || opt.hit_pct == null || opt.n < 8) continue;
      if (!best || Math.abs(opt.hit_pct - 50) > Math.abs(best.opt.hit_pct - 50)) best = { opt, dim: bar.dimension };
    }
    return best;
  }, [shownBars]);

  const cov = data?.coverage;
  const limited = LIMITED_MARKETS.has(betType);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">NFL Historical Analysis</h1>
        <p className="text-sm text-muted-foreground">Pick a bet type, set the situation, and see how it's played out — plus this week's games that match.</p>
      </div>

      {/* ── Bet-type spine ── */}
      <div className="flex flex-wrap gap-4 mb-4">
        {BET_GROUPS.map(g => (
          <div key={g.group}>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{g.group}</div>
            <div className="flex gap-1">
              {g.items.map(it => (
                <Button key={it.key} size="sm" variant={betType === it.key ? 'default' : 'outline'}
                  onClick={() => setBetType(it.key)}>{it.label}</Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* presets */}
      <div className="flex flex-wrap gap-2 mb-5">
        {PRESETS.map(p => (
          <Badge key={p.label} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => applyPreset(p)}>{p.label}</Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── RESULTS ── */}
        <div className="xl:col-span-2 space-y-4">
          {/* coverage readout */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary">
              {loading ? 'Loading…' : cov ? `Based on ${cov.n_games} games, ${cov.season_min}–${cov.season_max}` : 'No games match'}
            </Badge>
            {limited && <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40">Limited history (2023+)</Badge>}
          </div>

          {/* headline insight */}
          {!loading && headline && cov && (
            <Card className="border-l-4 border-l-primary">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {headline.opt.hit_pct >= 50 ? <TrendingUp className="w-5 h-5 text-emerald-500 mt-0.5" /> : <TrendingDown className="w-5 h-5 text-red-500 mt-0.5" />}
                  <div>
                    <p className="font-semibold leading-snug">
                      {sideLabel(betType, headline.opt.side)} <span className="text-primary">{headline.opt.hit_pct}%</span>
                      {' '}({headline.opt.n} games){headline.opt.roi != null && <> · <span className={headline.opt.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{headline.opt.roi >= 0 ? '+' : ''}{headline.opt.roi}% ROI</span></>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(headline.opt.hit_pct - data!.baseline_pct >= 0 ? '+' : '')}{(headline.opt.hit_pct - data!.baseline_pct).toFixed(1)} pts vs the {data!.baseline_pct}% baseline · {significance(headline.opt.n, headline.opt.hit_pct).label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* result bars */}
          <Card><CardContent className="py-4 space-y-4">
            {loading ? <Skeleton className="h-9 w-full" /> :
              shownBars.length ? shownBars.map((bar, i) => <ResultBar key={i} betType={betType} bar={bar} baseline={data!.baseline_pct} />)
              : <p className="text-sm text-muted-foreground text-center py-4">{cov?.n_games ? 'Not enough games to show a reliable split — try widening the filters.' : 'No games match these filters.'}</p>}
          </CardContent></Card>

          {/* breakdowns */}
          {!loading && data && (
            <Card><CardContent className="py-4">
              <Tabs defaultValue="team">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="team">By Team</TabsTrigger>
                  <TabsTrigger value="coach">By Coach</TabsTrigger>
                  <TabsTrigger value="ref">By Referee</TabsTrigger>
                </TabsList>
                <TabsContent value="team"><BreakdownTable betType={betType} rows={data.by_team} keyName="team" /></TabsContent>
                <TabsContent value="coach"><BreakdownTable betType={betType} rows={data.by_coach} keyName="coach" /></TabsContent>
                <TabsContent value="ref"><BreakdownTable betType={betType} rows={data.by_referee} keyName="referee" /></TabsContent>
              </Tabs>
            </CardContent></Card>
          )}

          {/* upcoming match */}
          {!loading && upcoming.length > 0 && (
            <Card className="border-primary/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3 font-semibold text-sm"><CalendarClock className="w-4 h-4 text-primary" /> This week's games that match ({upcoming.length})</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {upcoming.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <img src={logoFor(g.team)} alt="" className="w-6 h-6" onError={e => (e.currentTarget.style.visibility = 'hidden')} />
                      <div className="flex-1">
                        <div className="font-medium">{g.matchup}</div>
                        <div className="text-xs font-medium text-foreground/80">{lineForBet(betType, g)}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtKick(g.kickoff)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── FILTERS (adaptive) ── */}
        <div className="xl:sticky xl:top-4 h-fit space-y-3">
          <Card><CardContent className="py-4 space-y-4">
            <div className="text-sm font-semibold">Situation</div>
            <RangeRow label={`Seasons: ${seasons[0]}–${seasons[1]}`} min={seasonFloor} max={2025} step={1} value={seasons} onChange={setSeasons} />
            <RangeRow label={`Weeks: ${weeks[0]}–${weeks[1]}`} min={1} max={22} step={1} value={weeks} onChange={setWeeks} />
            <SelectRow label="Side" value={side} onChange={setSide} options={[['any', 'Either'], ['home', 'Home'], ['away', 'Away']]} />

            {SPREAD_CFG[betType] && (
              <>
                <SelectRow label={betType === 'h1_spread' ? '1H spread side' : 'Spread side'} value={spreadSide} onChange={setSpreadSide}
                  options={[['any', 'Either side'], ['favorite', 'Favored by'], ['underdog', 'Getting']]} />
                <RangeRow label={`${spreadSide === 'favorite' ? 'Favored by' : spreadSide === 'underdog' ? 'Getting' : 'Spread'}: ${spreadSize[0]}–${spreadSize[1]} pts`}
                  min={0} max={SPREAD_CFG[betType].max} step={0.5} value={spreadSize} onChange={setSpreadSize} />
              </>
            )}
            {(ML_MARKETS.has(betType) || betType === 'team_total') && (
              <SelectRow label="Favorite / Underdog" value={favDog} onChange={setFavDog} options={[['any', 'Either'], ['favorite', 'Favorites'], ['underdog', 'Underdogs']]} />
            )}
            {TOTAL_CFG[betType] && (
              <RangeRow label={`${TOTAL_CFG[betType].label}: ${lineRange[0]}–${lineRange[1]}`}
                min={TOTAL_CFG[betType].min} max={TOTAL_CFG[betType].max} step={0.5} value={lineRange} onChange={setLineRange} />
            )}
          </CardContent></Card>

          <FilterSection title="Conditions">
            <TriRow label="Primetime" value={primetime} onChange={setPrimetime} />
            <TriRow label="Divisional" value={division} onChange={setDivision} />
            <SelectRow label="Venue" value={dome} onChange={setDome} options={[['any', 'Any'], ['dome', 'Dome'], ['outdoor', 'Outdoor']]} />
            <SelectRow label="Precipitation" value={precip} onChange={setPrecip} options={[['any', 'Any'], ['none', 'None'], ['rain', 'Rain'], ['snow', 'Snow']]} />
            <RangeRow label={`Temp: ${tempRange[0]}–${tempRange[1]}°F`} min={-10} max={100} step={1} value={tempRange} onChange={setTempRange} />
            <div><div className="text-xs text-muted-foreground mb-1">Max wind: {windMax} mph</div><Slider min={0} max={60} step={1} value={[windMax]} onValueChange={([v]) => setWindMax(v)} /></div>
            <SelectRow label="Rest / Bye" value={restBye} onChange={setRestBye}
              options={[['any', 'Any'], ['off_bye', 'Off a bye'], ['pre_bye', 'Week before a bye'], ['short', 'Short rest (Thu)']]} />
          </FilterSection>

          <FilterSection title="Context">
            <SelectRow label="Coach" value={coach} onChange={setCoach} options={[['any', 'Any coach'], ...coaches.map(c => [c, c] as [string, string])]} />
            <SelectRow label="Referee" value={referee} onChange={setReferee} options={[['any', 'Any referee'], ...refs.map(r => [r, r] as [string, string])]} />
          </FilterSection>
        </div>
      </div>
    </div>
  );
}

// ── small filter primitives ──
function RangeRow({ label, min, max, step, value, onChange }: any) {
  return <div><div className="text-xs text-muted-foreground mb-1">{label}</div>
    <Slider min={min} max={max} step={step} value={value} onValueChange={(v: number[]) => onChange([v[0], v[1]])} minStepsBetweenThumbs={0} /></div>;
}
function SelectRow({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <div><div className="text-xs text-muted-foreground mb-1">{label}</div>
    <Select value={value} onValueChange={onChange}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>;
}
function TriRow({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const opts: [string, boolean | null][] = [['Any', null], ['Yes', true], ['No', false]];
  return <div><div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div className="flex gap-1">{opts.map(([l, v]) => <Button key={l} size="sm" variant={value === v ? 'default' : 'outline'} className="h-7 flex-1 text-xs" onClick={() => onChange(v)}>{l}</Button>)}</div></div>;
}
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Collapsible open={open} onOpenChange={setOpen}>
    <Card><CardContent className="py-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-semibold">
        {title}<ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3">{children}</CollapsibleContent>
    </CardContent></Card>
  </Collapsible>;
}
