import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, TrendingUp, TrendingDown, CalendarClock, Loader2, Bookmark, Trash2 } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

type Opt = { side: string; n: number; wins: number; hit_pct: number; roi: number | null };
type Bar = { dimension: string; options: Opt[] };
type Analysis = {
  bet_type: string;
  coverage: { season_min: number; season_max: number; n_bets: number; n_games: number };
  baseline_pct: number;
  overall: { n: number; wins: number; hit_pct: number; roi: number | null };
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

// verb + outcome word + count noun, per market
const VERB: Record<string, string> = {
  fg_spread: 'covered', h1_spread: 'covered the 1H spread',
  fg_ml: 'won', h1_ml: 'won in the 1H',
  fg_total: 'went over', h1_total: 'went over the 1H total',
  team_total: 'went over their team total',
};
const OUTCOME: Record<string, string> = {
  fg_spread: 'Cover', h1_spread: 'Cover', fg_ml: 'Win', h1_ml: 'Win',
  fg_total: 'Over', h1_total: 'Over', team_total: 'Over',
};
const nounFor = (bt: string) => bt === 'team_total' ? 'team totals' : 'games';

const PRESETS: { label: string; betType: string; filters: any }[] = [
  { label: 'Cold-weather unders', betType: 'fg_total', filters: { tempMax: 32 } },
  { label: 'Home underdogs', betType: 'fg_spread', filters: { side: 'away', favDog: 'underdog' } },
  { label: 'Primetime favorites', betType: 'fg_spread', filters: { primetime: true, spreadSide: 'favorite' } },
  { label: 'Divisional unders', betType: 'fg_total', filters: { division: true } },
  { label: 'Big home favorites (TT)', betType: 'team_total', filters: { side: 'home', spreadSide: 'favorite', spreadSize: [7, 20] } },
];

const DIM_LABEL: Record<string, string> = { over_under: 'Over / Under', home_away: 'Home vs Away', fav_dog: 'Favorite vs Underdog' };

// one clearly-labeled row per option: "Home covered 44% (19 of 44)" with a hit-rate bar + baseline
function OptionRow({ betType, opt, baseline }: { betType: string; opt: Opt; baseline: number }) {
  const good = opt.hit_pct >= 52.4; // break-even at -110
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{sideLabel(betType, opt.side)}</span>
        <span className={good ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-foreground/80'}>
          {opt.hit_pct}% <span className="text-xs text-muted-foreground font-normal">({opt.wins} of {opt.n})</span>
        </span>
      </div>
      <div className="relative h-2 rounded bg-muted mt-1 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded bg-emerald-500/50" style={{ width: `${Math.min(opt.hit_pct, 100)}%` }} />
        <div className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${baseline}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground mt-0.5">
        <span>vs {baseline}% baseline</span>
        {opt.roi != null && <span className={opt.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{opt.roi >= 0 ? '+' : ''}{opt.roi}% ROI</span>}
      </div>
    </div>
  );
}

function ResultBar({ betType, bar, baseline }: { betType: string; bar: Bar; baseline: number }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{DIM_LABEL[bar.dimension] || bar.dimension}</div>
      {bar.options.map((opt, i) => <OptionRow key={i} betType={betType} opt={opt} baseline={baseline} />)}
    </div>
  );
}

function BreakdownTable({ betType, rows, keyName }: { betType: string; rows: any[]; keyName: string }) {
  const [sort, setSort] = useState<'roi' | 'hit' | 'n'>('n');
  const sorted = useMemo(() => [...(rows || [])].sort((x, y) =>
    sort === 'n' ? y.n - x.n : sort === 'hit' ? y.hit_pct - x.hit_pct : (y.roi ?? -999) - (x.roi ?? -999)), [rows, sort]);
  const isTeam = keyName === 'team';
  const isML = ML_MARKETS.has(betType);
  const outcome = OUTCOME[betType] || 'Hit';
  if (!rows?.length) return <p className="text-sm text-muted-foreground py-6 text-center">No results with enough games (min 3).</p>;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {(['n', 'hit', 'roi'] as const).filter(s => s !== 'roi' || !isML).map(s => (
            <Button key={s} size="sm" variant={sort === s ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setSort(s)}>
              {s === 'n' ? 'Games' : s === 'hit' ? `${outcome} %` : 'ROI'}
            </Button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">{outcome} rate</span>
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

  // saved filters (per authed user, main project)
  const { user } = useAuth();
  const [saved, setSaved] = useState<any[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const snapshot = () => ({ betType, seasons, weeks, side, favDog, spreadSide, spreadSize, lineRange, primetime, division, dome, tempRange, windMax, precip, restBye, coach, referee });
  const restore = (s: any) => {
    setBetType(s.betType); setSeasons(s.seasons); setWeeks(s.weeks); setSide(s.side); setFavDog(s.favDog);
    setSpreadSide(s.spreadSide); setPrimetime(s.primetime ?? null); setDivision(s.division ?? null);
    setDome(s.dome); setTempRange(s.tempRange); setWindMax(s.windMax); setPrecip(s.precip);
    setRestBye(s.restBye); setCoach(s.coach); setReferee(s.referee);
    // spreadSize/lineRange are reset by the bet-type effect — re-apply after it runs
    setTimeout(() => { setSpreadSize(s.spreadSize); setLineRange(s.lineRange); }, 0);
  };
  const loadSaved = useCallback(async () => {
    if (!user) { setSaved([]); return; }
    const { data } = await supabase.from('nfl_analysis_saved_filters').select('*').order('created_at', { ascending: false });
    setSaved(data || []);
  }, [user]);
  useEffect(() => { loadSaved(); }, [loadSaved]);
  const saveCurrent = async () => {
    if (!user || !saveName.trim()) return;
    const { error } = await supabase.from('nfl_analysis_saved_filters')
      .insert({ user_id: user.id, name: saveName.trim(), bet_type: betType, filters: snapshot() });
    if (error) { alert(error.message); return; }
    setSaveName(''); setShowSave(false); loadSaved();
  };
  const deleteSaved = async (id: string) => { await supabase.from('nfl_analysis_saved_filters').delete().eq('id', id); loadSaved(); };

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

  // secondary context splits — only shown when BOTH sides have games (not pinned by a filter)
  const shownBars = useMemo(() => (data?.bars || []).filter(bar => bar.options.every(o => o && o.n > 0)), [data]);
  // plain-English subject for the headline, built from the active filters (never empty/degenerate)
  const subject = useMemo(() => {
    if (TOTAL_CFG[betType] && betType !== 'team_total') return 'Games';
    const parts: string[] = [];
    if (side !== 'any') parts.push(side === 'home' ? 'Home' : 'Road');
    const dir = SPREAD_CFG[betType] ? spreadSide : favDog;
    if (dir && dir !== 'any') parts.push(dir === 'favorite' ? 'favorites' : 'underdogs');
    if (betType === 'team_total' && !parts.length) return 'Teams';
    if (!parts.length) return 'Teams';
    const s = parts.join(' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [betType, side, spreadSide, favDog]);

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
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map(p => (
          <Badge key={p.label} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => applyPreset(p)}>{p.label}</Badge>
        ))}
      </div>

      {/* saved filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {!user ? (
          <span className="text-xs text-muted-foreground">Sign in to save filters you want to track this season.</span>
        ) : (
          <>
            {saved.length > 0 && (
              <Select onValueChange={(id) => { const s = saved.find(x => x.id === id); if (s) restore(s.filters); }}>
                <SelectTrigger className="h-8 w-56 text-xs"><Bookmark className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder={`Saved filters (${saved.length})`} /></SelectTrigger>
                <SelectContent>
                  {saved.map(s => (
                    <div key={s.id} className="flex items-center">
                      <SelectItem value={s.id} className="flex-1">{s.name}</SelectItem>
                      <button className="px-2 text-muted-foreground hover:text-red-500" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteSaved(s.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showSave ? (
              <div className="flex items-center gap-1">
                <Input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Name this filter" className="h-8 w-48 text-xs"
                  onKeyDown={e => e.key === 'Enter' && saveCurrent()} />
                <Button size="sm" className="h-8" onClick={saveCurrent} disabled={!saveName.trim() || saved.length >= 25}>Save</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowSave(false); setSaveName(''); }}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowSave(true)} disabled={saved.length >= 25}>
                <Bookmark className="w-3.5 h-3.5 mr-1" /> Save current {saved.length >= 25 && '(25 max)'}
              </Button>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── RESULTS (kept mounted across refetches so the page height never collapses) ── */}
        <div className={`xl:col-span-2 space-y-4 transition-opacity ${loading && data ? 'opacity-50' : ''}`}>
          {/* coverage readout */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary">
              {cov ? `Based on ${cov.n_games} games, ${cov.season_min}–${cov.season_max}` : loading ? 'Loading…' : 'No games match'}
            </Badge>
            {limited && <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40">Limited history (2023+)</Badge>}
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>

          {/* headline: ONE clear result for the exact filtered situation */}
          {!data ? <Skeleton className="h-20 w-full" /> : data.overall && cov && data.overall.n > 0 ? (
            <Card className="border-l-4 border-l-primary">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {data.overall.hit_pct >= 50 ? <TrendingUp className="w-5 h-5 text-emerald-500 mt-0.5" /> : <TrendingDown className="w-5 h-5 text-red-500 mt-0.5" />}
                  <div>
                    <p className="font-semibold leading-snug">
                      {subject} {VERB[betType]} <span className="text-primary">{data.overall.hit_pct}%</span>
                      {' '}<span className="text-sm font-normal text-muted-foreground">({data.overall.wins} of {data.overall.n} {nounFor(betType)})</span>{data.overall.roi != null && <> · <span className={data.overall.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{data.overall.roi >= 0 ? '+' : ''}{data.overall.roi}% ROI</span></>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(data.overall.hit_pct - data.baseline_pct >= 0 ? '+' : '')}{(data.overall.hit_pct - data.baseline_pct).toFixed(1)} pts vs the {data.baseline_pct}% baseline · {significance(data.overall.n, data.overall.hit_pct).label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No games match these filters — try widening them.</CardContent></Card>
          )}

          {/* secondary context splits (only non-degenerate — hidden when a filter pins the side) */}
          {data && shownBars.length > 0 && (
            <Card><CardContent className="py-4 space-y-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Breakdown</div>
              {shownBars.map((bar, i) => <ResultBar key={i} betType={betType} bar={bar} baseline={data.baseline_pct} />)}
            </CardContent></Card>
          )}

          {/* breakdowns */}
          {data && (
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
          {data && upcoming.length > 0 && (
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
