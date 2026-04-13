import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useMLBRegressionReport } from '@/hooks/useMLBRegressionReport';
import type { ModelAccuracy, AccuracyBucket } from '@/hooks/useMLBRegressionReport';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calendar,
  CloudSun,
  Flame,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  Target,
  User,
  Users,
} from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import NFLGameCard from '@/components/NFLGameCard';
import { LiquidButton } from '@/components/animate-ui/components/buttons/liquid';
import {
  buildMlbTeamMappingMaps,
  espnMlb500LogoUrlFromAbbrev,
  normalizeTeamNameKey,
  resolveMlbTeamDisplay,
  supplementalMlbLogoUrl,
} from '@/utils/mlbTeamLogos';

interface MLBPredictionRow {
  id: number | null;
  game_pk: number;
  official_date: string;
  game_time_et: string | null;
  is_active: boolean | null;
  is_completed: boolean | null;
  is_postponed: boolean | null;
  status: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  total_line: number | null;
  ml_home_win_prob: number | null;
  ml_away_win_prob: number | null;
  home_ml_edge_pct: number | null;
  away_ml_edge_pct: number | null;
  ou_edge: number | null;
  ou_direction: 'OVER' | 'UNDER' | null;
  home_sp_name: string | null;
  away_sp_name: string | null;
  projection_label: string | null;
  is_final_prediction?: boolean | null;
  home_sp_confirmed?: boolean | null;
  away_sp_confirmed?: boolean | null;
  weather_confirmed?: boolean | null;
  weather_imputed?: boolean | null;
  odds_available?: boolean | null;
  prediction_available?: boolean | null;
  starters_available?: boolean | null;
  within_lockout_window?: boolean | null;
  f5_fair_total?: number | null;
  f5_pred_margin?: number | null;
  f5_total_line?: number | null;
  f5_home_spread?: number | null;
  f5_away_spread?: number | null;
  f5_ou_edge?: number | null;
  f5_home_win_prob?: number | null;
  f5_away_win_prob?: number | null;
  f5_home_ml_edge_pct?: number | null;
  f5_away_ml_edge_pct?: number | null;
  f5_home_ml_strong_signal?: boolean | null;
  f5_away_ml_strong_signal?: boolean | null;
  ou_fair_total?: number | null;
  home_ml_strong_signal?: boolean | null;
  away_ml_strong_signal?: boolean | null;
  ou_strong_signal?: boolean | null;
  ou_moderate_signal?: boolean | null;
}

interface MLBTeamMapping {
  mlb_api_id: number;
  team: string;
  team_name: string;
  logo_url: string | null;
}

type SortKey = 'time' | 'ml' | 'ou';
type CardProjectionView = 'full' | 'f5';
const fallbackTeamColors = { primary: '#1f2937', secondary: '#6b7280' };

function formatMoneyline(ml: number | null): string {
  if (ml === null || ml === undefined) return '-';
  return ml > 0 ? `+${ml}` : String(ml);
}

function formatSpread(spread: number | null | undefined): string {
  if (spread === null || spread === undefined || Number.isNaN(Number(spread))) return '-';
  const n = Number(spread);
  const body = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return n > 0 ? `+${body}` : body;
}

function formatDateLabel(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function toNum(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value);
}

function isF5MlStrongSignal(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function formatGameTime(timeString: string | null): string {
  if (!timeString) return 'TBD';
  const date = new Date(timeString);
  if (Number.isNaN(date.getTime())) return 'TBD';
  const time = date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${time} ET`;
}

function toYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Match `official_date` (YYYY-MM-DD) to today's date in Eastern Time (same notion of "game day" as first-pitch ET). */
function isOfficialDateToday(officialDate: string | null | undefined): boolean {
  if (!officialDate) return false;
  const day = officialDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  return day === todayEt;
}

/** Bordered region inside MLB game cards — separates header, matchup, status, signals, projections, weather. */
const MLB_CARD_SECTION =
  'rounded-xl border border-slate-500/35 bg-gradient-to-b from-slate-900/45 to-slate-950/55 p-3 sm:p-4 ring-1 ring-inset ring-white/[0.06] shadow-sm';

/** Inner panel for nested projection blocks (ML / Total). */
const MLB_CARD_INNER =
  'rounded-lg border border-slate-600/45 bg-slate-950/40 p-3 space-y-2 ring-1 ring-inset ring-white/[0.04]';

function fallbackAbbrevFromTeamName(teamName: string): string {
  const t = teamName.trim();
  if (!t) return 'MLB';
  return t
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function getConfidenceTier(pred: MLBPredictionRow): 'full' | 'high' | 'medium' | 'low' {
  if (pred.is_final_prediction && pred.home_sp_confirmed && pred.away_sp_confirmed && pred.weather_confirmed) return 'full';
  if (pred.home_sp_confirmed && pred.away_sp_confirmed) return 'high';
  if (pred.home_sp_confirmed || pred.away_sp_confirmed) return 'medium';
  return 'low';
}

function getFullGameRuns(pred: MLBPredictionRow): { home: number; away: number; margin: number } | null {
  const p = toNum(pred.ml_home_win_prob);
  const total = toNum(pred.ou_fair_total);
  if (p === null || total === null || p <= 0 || p >= 1) return null;

  const exp = 1.83;
  const ratio = Math.pow(p / (1 - p), 1 / exp);
  const home = total * ratio / (ratio + 1);
  const away = total / (ratio + 1);
  return { home, away, margin: home - away };
}

function getF5Runs(pred: MLBPredictionRow): { home: number; away: number } | null {
  const total = toNum(pred.f5_fair_total);
  const margin = toNum(pred.f5_pred_margin);
  if (total === null || margin === null) return null;
  return {
    home: (total + margin) / 2,
    away: (total - margin) / 2,
  };
}

/** Row from `mlb_game_signals` — arrays are JSON in DB; normalized at render. */
interface MLBGameSignalsRow {
  game_pk: number;
  home_signals: unknown;
  away_signals: unknown;
  game_signals: unknown;
}

interface MLBSignalItem {
  category: string;
  severity: string;
  message: string;
}

/** Stable map key so string/number/bigint `game_pk` from PostgREST all match. */
function gamePkMapKey(pk: unknown): string | null {
  if (pk === null || pk === undefined) return null;
  if (typeof pk === 'bigint') return pk.toString();
  const n = Number(pk);
  if (!Number.isNaN(n) && Number.isFinite(n)) return String(Math.trunc(n));
  const s = String(pk).trim();
  return s.length ? s : null;
}

function normalizeJsonArray(raw: unknown): unknown[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p;
      if (p && typeof p === 'object') return Object.values(p as Record<string, unknown>);
      return [];
    } catch {
      return [];
    }
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).filter((v) => v !== undefined);
  }
  return [];
}

function pickSignalMessage(o: Record<string, unknown>): string | null {
  const raw = o.message ?? o.Message ?? o.text ?? o.body ?? o.summary;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return null;
}

function pickSignalString(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.length) return v;
  }
  return '';
}

function parseSignalArray(raw: unknown): MLBSignalItem[] {
  const arr = normalizeJsonArray(raw);
  const out: MLBSignalItem[] = [];
  for (const x of arr) {
    let item: unknown = x;
    if (typeof item === 'string') {
      try {
        item = JSON.parse(item);
      } catch {
        continue;
      }
    }
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const message = pickSignalMessage(o);
    if (!message) continue;
    out.push({
      category: pickSignalString(o, 'category', 'Category', 'type'),
      severity: pickSignalString(o, 'severity', 'Severity', 'level'),
      message,
    });
  }
  return out;
}

function signalsRowForGamePk(
  map: Map<string, MLBGameSignalsRow>,
  gamePk: number | string | null | undefined,
): MLBGameSignalsRow | undefined {
  const key = gamePkMapKey(gamePk);
  if (!key) return undefined;
  return map.get(key);
}

/** Game-level first, then home, then away (per product spec). */
function combineSignalsOrdered(row: MLBGameSignalsRow | undefined): MLBSignalItem[] {
  if (!row) return [];
  return [
    ...parseSignalArray(row.game_signals),
    ...parseSignalArray(row.home_signals),
    ...parseSignalArray(row.away_signals),
  ];
}

function signalSeverityPillClass(severity: string): string {
  switch (severity) {
    case 'negative':
      return 'border-orange-500/45 bg-orange-950/45 text-orange-100 dark:text-orange-50';
    case 'positive':
      return 'border-emerald-500/40 bg-emerald-950/35 text-emerald-100 dark:text-emerald-50';
    case 'over':
      return 'border-amber-500/45 bg-amber-950/40 text-amber-100 dark:text-amber-50';
    case 'under':
      return 'border-blue-500/40 bg-blue-950/40 text-blue-100 dark:text-blue-50';
    default:
      return 'border-slate-600 bg-slate-900/50 text-slate-200';
  }
}

function SignalCategoryIcon({ category }: { category: string }) {
  const cn = 'h-3.5 w-3.5 flex-shrink-0 opacity-90';
  switch (category.toLowerCase()) {
    case 'pitcher':
      return <User className={cn} aria-hidden />;
    case 'bullpen':
      return <Flame className={cn} aria-hidden />;
    case 'batting':
      return <Activity className={cn} aria-hidden />;
    case 'schedule':
      return <Calendar className={cn} aria-hidden />;
    case 'weather':
      return <CloudSun className={cn} aria-hidden />;
    case 'park':
      return <MapPin className={cn} aria-hidden />;
    default:
      return <Target className={cn} aria-hidden />;
  }
}

export default function MLB() {
  const [predictions, setPredictions] = useState<MLBPredictionRow[]>([]);
  /** `mlb_api_id` → row (matches `home_team_id` / `away_team_id` when those are MLB team IDs). */
  const [teamMapByMlbApiId, setTeamMapByMlbApiId] = useState<Map<number, MLBTeamMapping>>(new Map());
  /** `team_name` (normalized) → row — primary join per product spec. */
  const [teamMapByTeamName, setTeamMapByTeamName] = useState<Map<string, MLBTeamMapping>>(new Map());
  const [teamMappingsList, setTeamMappingsList] = useState<MLBTeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortAscending, setSortAscending] = useState(false);
  const [projectionViewByGame, setProjectionViewByGame] = useState<Record<string, CardProjectionView>>({});
  const [signalsByGamePk, setSignalsByGamePk] = useState<Map<string, MLBGameSignalsRow>>(new Map());
  const [hoveredGamePk, setHoveredGamePk] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: games, error: gamesError } = await collegeFootballSupabase
        .from('mlb_games_today')
        .select('*')
        .order('official_date', { ascending: true })
        .order('game_time_et', { ascending: true });

      if (gamesError) {
        throw new Error(gamesError.message);
      }

      const { data: teams, error: teamError } = await collegeFootballSupabase
        .from('mlb_team_mapping')
        .select('*');

      if (teamError) {
        throw new Error(teamError.message);
      }

      const { byMlbApiId, byTeamName, list: mappingList } = buildMlbTeamMappingMaps(
        (teams || []) as Record<string, unknown>[],
      );
      setTeamMapByMlbApiId(byMlbApiId as Map<number, MLBTeamMapping>);
      setTeamMapByTeamName(byTeamName as Map<string, MLBTeamMapping>);
      setTeamMappingsList(mappingList as MLBTeamMapping[]);
      const gamePks = (games || []).map((g: any) => Number(g.game_pk)).filter((n: number) => !Number.isNaN(n));
      const currentByGamePk = new Map<number, Record<string, unknown>>();
      if (gamePks.length > 0) {
        const { data: currentRows } = await collegeFootballSupabase
          .from('mlb_predictions_current')
          .select('game_pk,is_final_prediction,f5_home_ml_edge_pct,f5_away_ml_edge_pct')
          .in('game_pk', gamePks);
        (currentRows || []).forEach((row: any) => {
          const pk = Number(row.game_pk);
          if (!Number.isNaN(pk)) {
            currentByGamePk.set(pk, row as Record<string, unknown>);
          }
        });
      }

      const mergedGames = (games || []).map((g: any) => {
        const pk = Number(g.game_pk);
        const cur = !Number.isNaN(pk) ? currentByGamePk.get(pk) : undefined;
        return {
          ...g,
          is_final_prediction:
            cur !== undefined ? !!cur.is_final_prediction : (g.is_final_prediction ?? null),
          ...(cur !== undefined
            ? {
                f5_home_ml_edge_pct: (cur.f5_home_ml_edge_pct ?? null) as number | null,
                f5_away_ml_edge_pct: (cur.f5_away_ml_edge_pct ?? null) as number | null,
              }
            : {}),
        };
      });

      // Fetch all rows from the view (already scoped server-side). Do not `.in(game_pk)` here:
      // signal rows must still join when `game_pk` serialization matches cards.
      const { data: signalRows, error: signalsError } = await collegeFootballSupabase
        .from('mlb_game_signals')
        .select('game_pk, home_signals, away_signals, game_signals');

      if (signalsError) {
        console.warn('[MLB] mlb_game_signals:', signalsError.message);
        setSignalsByGamePk(new Map());
      } else {
        const sigMap = new Map<string, MLBGameSignalsRow>();
        (signalRows || []).forEach((r: any) => {
          const key = gamePkMapKey(r.game_pk);
          if (!key) return;
          const pkNum = Number(r.game_pk);
          sigMap.set(key, {
            game_pk: Number.isNaN(pkNum) ? 0 : pkNum,
            home_signals: r.home_signals,
            away_signals: r.away_signals,
            game_signals: r.game_signals,
          });
        });
        setSignalsByGamePk(sigMap);
      }

      setPredictions(mergedGames as MLBPredictionRow[]);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch MLB data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const sortedPredictions = useMemo(() => {
    let list = predictions;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((g) =>
        `${g.away_team_name || ''} ${g.home_team_name || ''}`.toLowerCase().includes(q),
      );
    }

    const byDateTime = (a: MLBPredictionRow, b: MLBPredictionRow) => {
      const dateCmp = (a.official_date || '').localeCompare(b.official_date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.game_time_et || '').localeCompare(b.game_time_et || '');
    };

    const score = (g: MLBPredictionRow): number => {
      if (sortKey === 'ml') return Math.max(Math.abs(g.home_ml_edge_pct || 0), Math.abs(g.away_ml_edge_pct || 0));
      if (sortKey === 'ou') return Math.abs(g.ou_edge || 0);
      return 0;
    };

    const sorted = [...list].sort((a, b) => {
      if (sortKey === 'time') return byDateTime(a, b);
      const s = score(b) - score(a);
      if (s !== 0) return s;
      return byDateTime(a, b);
    });

    return sortAscending ? sorted.reverse() : sorted;
  }, [predictions, searchText, sortKey, sortAscending]);

  /**
   * Resolve abbreviation (`team`) and logo (`logo_url`) from `mlb_team_mapping`.
   * Spec: match `mlb_games_today.home_team_name` / `away_team_name` to mapping `team_name`;
   * fallback: `home_team_id` / `away_team_id` === `mlb_api_id`; then fuzzy name match.
   */
  function resolveTeamMapping(
    teamId: number | null | undefined,
    teamNameFromGame: string | null | undefined,
  ): { abbrev: string; logoUrl: string | null } | null {
    return resolveMlbTeamDisplay(
      teamId,
      teamNameFromGame,
      teamMapByMlbApiId,
      teamMapByTeamName,
      teamMappingsList,
    );
  }

  const getCardProjectionView = (gameKey: string): CardProjectionView => {
    return projectionViewByGame[gameKey] || 'full';
  };

  const setCardProjectionView = (gameKey: string, view: CardProjectionView) => {
    setProjectionViewByGame((prev) => ({ ...prev, [gameKey]: view }));
  };

  // Fetch real model accuracy from today's regression report
  const { data: regressionReport } = useMLBRegressionReport();
  const modelAccuracy = regressionReport?.model_accuracy ?? null;

  // Edge bucket thresholds (must match the Python script)
  const ML_BUCKETS: [number, string][] = [[7, "7%+"], [4, "4-6.9%"], [2, "2-3.9%"], [0, "<2%"]];
  const OU_BUCKETS: [number, string][] = [[1.5, "1.5+"], [1.0, "1.0-1.49"], [0.5, "0.5-0.99"], [0, "<0.5"]];
  const F5_ML_BUCKETS: [number, string][] = [[20, "20%+"], [10, "10-19.9%"], [5, "5-9.9%"], [0, "<5%"]];
  const F5_OU_BUCKETS: [number, string][] = [[1.0, "1.0+"], [0.5, "0.5-0.99"], [0, "<0.5"]];

  const getBucketLabel = useCallback((edge: number, buckets: [number, string][]) => {
    const absEdge = Math.abs(edge);
    for (const [threshold, label] of buckets) {
      if (absEdge >= threshold) return label;
    }
    return buckets[buckets.length - 1][1];
  }, []);

  const lookupBucketAccuracy = useCallback((
    betType: 'full_ml' | 'full_ou' | 'f5_ml' | 'f5_ou',
    edge: number,
    side?: 'home' | 'away',
    fav_dog?: 'favorite' | 'underdog',
    direction?: string,
  ): { win_pct: number; roi_pct: number; record: string } | null => {
    if (!modelAccuracy) return null;
    const data = modelAccuracy[betType];
    if (!data) return null;

    const buckets = betType === 'full_ml' ? ML_BUCKETS
      : betType === 'full_ou' ? OU_BUCKETS
      : betType === 'f5_ml' ? F5_ML_BUCKETS
      : F5_OU_BUCKETS;
    const bucketLabel = getBucketLabel(edge, buckets);

    // Find matching bucket in accuracy data
    for (const b of data.by_bucket) {
      const bAny = b as any;
      if (b.bucket !== bucketLabel) continue;
      if (side && b.side && b.side !== side) continue;
      if (fav_dog && b.fav_dog && b.fav_dog !== fav_dog) continue;
      if (direction && b.direction && b.direction !== direction) continue;
      if (b.games < 3) continue; // minimum sample
      return {
        win_pct: b.win_pct,
        roi_pct: bAny.roi_pct ?? 0,
        record: `${b.wins}-${b.games - b.wins}`,
      };
    }
    return null;
  }, [modelAccuracy, getBucketLabel]);

  const accuracyBadge = useCallback((info: { win_pct: number; roi_pct: number; record: string } | null) => {
    if (!info) return null;
    const color = info.win_pct >= 65
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
      : info.win_pct >= 55
        ? 'bg-orange-500/20 text-orange-300 border-orange-400/40'
        : 'bg-red-500/20 text-red-300 border-red-400/40';
    return (
      <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] sm:text-xs ${color}`}>
        {info.win_pct}% W ({info.record})
      </span>
    );
  }, []);

  const signalStyle = (signal: 'Strong' | 'Moderate' | 'Weak') => {
    if (signal === 'Strong') {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
    }
    if (signal === 'Moderate') {
      return 'bg-orange-500/20 text-orange-300 border-orange-400/40';
    }
    return 'bg-red-500/20 text-red-300 border-red-400/40';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">MLB</h1>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">MLB</h1>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by team name..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 w-full max-w-md"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            variant={sortKey === 'time' ? 'default' : 'outline'}
            className="text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto"
            onClick={() => {
              if (sortKey === 'time') setSortAscending(!sortAscending);
              else {
                setSortKey('time');
                setSortAscending(false);
              }
            }}
          >
            Time {sortKey === 'time' && (sortAscending ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
          </Button>
          <Button
            variant={sortKey === 'ml' ? 'default' : 'outline'}
            className="text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto"
            onClick={() => {
              if (sortKey === 'ml') setSortAscending(!sortAscending);
              else {
                setSortKey('ml');
                setSortAscending(false);
              }
            }}
          >
            ML Edge {sortKey === 'ml' && (sortAscending ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
          </Button>
          <Button
            variant={sortKey === 'ou' ? 'default' : 'outline'}
            className="text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto"
            onClick={() => {
              if (sortKey === 'ou') setSortAscending(!sortAscending);
              else {
                setSortKey('ou');
                setSortAscending(false);
              }
            }}
          >
            O/U Edge {sortKey === 'ou' && (sortAscending ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lastUpdated && <span className="text-xs sm:text-sm text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</span>}
          <LiquidButton onClick={fetchData} variant="outline" className="bg-slate-50 dark:bg-muted text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2">
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </LiquidButton>
        </div>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {sortedPredictions.length === 0 && !error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No Upcoming MLB Predictions</h3>
              <p className="text-muted-foreground">No games were returned from `mlb_games_today`.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2 sm:gap-3 md:gap-4 auto-rows-fr" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
        {sortedPredictions.map((prediction) => {
          const rowAny = prediction as any;
          const awayTeam = rowAny.away_team_name ?? rowAny.away_team ?? rowAny.away_team_full_name ?? 'Away Team';
          const homeTeam = rowAny.home_team_name ?? rowAny.home_team ?? rowAny.home_team_full_name ?? 'Home Team';
          const awayTeamId = Number(rowAny.away_team_id ?? rowAny.away_mlb_team_id ?? rowAny.away_id ?? NaN);
          const homeTeamId = Number(rowAny.home_team_id ?? rowAny.home_mlb_team_id ?? rowAny.home_id ?? NaN);
          const gameKey = String(prediction.game_pk ?? prediction.id ?? `${awayTeam}-${homeTeam}-${prediction.official_date}`);

          const awayResolved = resolveTeamMapping(Number.isNaN(awayTeamId) ? null : awayTeamId, awayTeam);
          const homeResolved = resolveTeamMapping(Number.isNaN(homeTeamId) ? null : homeTeamId, homeTeam);
          const awayAbbrev = awayResolved?.abbrev ?? fallbackAbbrevFromTeamName(awayTeam);
          const homeAbbrev = homeResolved?.abbrev ?? fallbackAbbrevFromTeamName(homeTeam);
          const awayLogoUrl =
            awayResolved?.logoUrl ??
            supplementalMlbLogoUrl(normalizeTeamNameKey(awayTeam), awayAbbrev) ??
            null;
          const homeLogoUrl =
            homeResolved?.logoUrl ??
            supplementalMlbLogoUrl(normalizeTeamNameKey(homeTeam), homeAbbrev) ??
            null;
          const mlProb = Math.max(prediction.ml_home_win_prob || 0, prediction.ml_away_win_prob || 0);
          const mlSide = (prediction.ml_home_win_prob || 0) >= (prediction.ml_away_win_prob || 0) ? homeAbbrev : awayAbbrev;
          const ouEdge = Math.abs(prediction.ou_edge || 0);
          const ouDirection = prediction.ou_direction || 'N/A';
          const fullRuns = getFullGameRuns(prediction);
          const isPostponed = prediction.is_postponed === true;
          const homeMlEdge = toNum(prediction.home_ml_edge_pct);
          const awayMlEdge = toNum(prediction.away_ml_edge_pct);
          // Pick based on win probability (who we think wins)
          const mlPickIsHome = (toNum(prediction.ml_home_win_prob) ?? 0) >= (toNum(prediction.ml_away_win_prob) ?? 0);
          const mlPickTeam = mlPickIsHome ? homeAbbrev : awayAbbrev;
          const mlPickEdge = mlPickIsHome ? homeMlEdge : awayMlEdge;
          const mlIsStrong = mlPickIsHome ? prediction.home_ml_strong_signal : prediction.away_ml_strong_signal;
          const mlConfidenceLabel = mlIsStrong ? 'Strong' : 'Weak';
          const totalConfidenceLabel = prediction.ou_strong_signal
            ? 'Strong'
            : prediction.ou_moderate_signal
              ? 'Moderate'
              : 'Weak';
          const cardView = getCardProjectionView(gameKey);
          const f5Runs = getF5Runs(prediction);
          const f5HomeProb = toNum(prediction.f5_home_win_prob);
          const f5AwayProb = toNum(prediction.f5_away_win_prob);
          // Pick F5 based on win probability (who we think wins F5)
          const f5PickIsHome = (f5HomeProb ?? 0) >= (f5AwayProb ?? 0);
          const f5HomeMlEdge = toNum(prediction.f5_home_ml_edge_pct);
          const f5AwayMlEdge = toNum(prediction.f5_away_ml_edge_pct);
          const f5PickTeam = f5PickIsHome ? homeAbbrev : awayAbbrev;
          const f5PickEdge = f5PickIsHome ? f5HomeMlEdge : f5AwayMlEdge;
          const rSig = prediction as Record<string, unknown>;
          const f5PickMlStrong = f5PickIsHome
            ? isF5MlStrongSignal(rSig.f5_home_ml_strong_signal)
            : isF5MlStrongSignal(rSig.f5_away_ml_strong_signal);
          const f5TotalEdge = Math.abs(toNum(prediction.f5_ou_edge) ?? 0);
          const f5Direction = (toNum(prediction.f5_ou_edge) ?? 0) >= 0 ? 'OVER' : 'UNDER';
          const activeRuns = cardView === 'full' ? fullRuns : f5Runs;

          const scoreLogoImg = (url: string | null, abbrev: string, side: 'away' | 'home') => {
            const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
              const target = e.currentTarget;
              target.src = espnMlb500LogoUrlFromAbbrev(abbrev);
              target.onerror = () => {
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.mlb-score-logo-fallback')) {
                  const span = document.createElement('span');
                  span.className = 'text-sm sm:text-base font-bold mlb-score-logo-fallback';
                  span.textContent = abbrev;
                  parent.appendChild(span);
                }
              };
            };
            return (
              <div
                className="flex h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-400 bg-white/80 dark:bg-slate-900/40"
                title={side === 'away' ? awayTeam : homeTeam}
              >
                {url ? (
                  <img
                    src={url}
                    alt={abbrev}
                    className="h-full w-full object-contain p-1"
                    referrerPolicy="no-referrer"
                    onError={onImgError}
                  />
                ) : (
                  <span className="text-sm sm:text-base font-bold">{abbrev}</span>
                )}
              </div>
            );
          };

          if (isPostponed) {
            return (
              <Card key={`${prediction.game_pk}-postponed`}>
                <CardContent className="py-6 text-center">
                  <div className="font-semibold">{awayAbbrev} @ {homeAbbrev}</div>
                  <div className="text-sm text-muted-foreground mt-1">{formatDateLabel(prediction.official_date)} • {formatGameTime(prediction.game_time_et)}</div>
                  <div className="mt-3 inline-flex bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-semibold">
                    Postponed
                  </div>
                </CardContent>
              </Card>
            );
          }

          const pkNum = Number(prediction.game_pk);
          const cardPk = Number.isNaN(pkNum) ? null : pkNum;

          return (
            <NFLGameCard
              key={`${prediction.game_pk}-${prediction.id ?? 'row'}`}
              isHovered={cardPk !== null && hoveredGamePk === cardPk}
              onMouseEnter={() => cardPk !== null && setHoveredGamePk(cardPk)}
              onMouseLeave={() => setHoveredGamePk(null)}
              awayTeamColors={fallbackTeamColors}
              homeTeamColors={fallbackTeamColors}
              homeSpread={null}
              awaySpread={null}
            >
              <CardContent className="space-y-4 pt-5 pb-6">
                <div className={`${MLB_CARD_SECTION} text-center space-y-2`}>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{formatDateLabel(prediction.official_date)}</div>
                  <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-white/80 bg-gray-100/80 dark:bg-white/5 px-3 py-1 rounded-full border border-gray-300 dark:border-white/20 inline-block">
                    {formatGameTime(prediction.game_time_et)}
                  </div>
                  {prediction.projection_label && (
                    <div className="text-[11px] text-muted-foreground">{prediction.projection_label}</div>
                  )}
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <span
                      title={prediction.is_final_prediction
                        ? 'Final prediction — locked in at game time'
                        : 'Preliminary projection — may update as game data finalizes'}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                        prediction.is_final_prediction
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}
                    >
                      {prediction.is_final_prediction ? <Lock className="h-3 w-3" /> : null}
                      {prediction.is_final_prediction ? 'Final Prediction' : 'Preliminary Projection'}
                    </span>
                  </div>
                </div>

                <div className={`${MLB_CARD_SECTION} flex justify-between items-start`}>
                  <div className="text-center flex-1">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-2 sm:mb-3 flex items-center justify-center rounded-full border-2 border-slate-400 overflow-hidden bg-white/80 dark:bg-slate-900/40">
                      {awayLogoUrl ? (
                        <img
                          src={awayLogoUrl}
                          alt={awayAbbrev}
                          className="w-full h-full object-contain p-1"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = espnMlb500LogoUrlFromAbbrev(awayAbbrev);
                            target.onerror = () => {
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector('.mlb-logo-fallback')) {
                                const span = document.createElement('span');
                                span.className = 'text-xs sm:text-sm font-bold mlb-logo-fallback';
                                span.textContent = awayAbbrev;
                                parent.appendChild(span);
                              }
                            };
                          }}
                        />
                      ) : (
                        <span className="text-xs sm:text-sm font-bold">{awayAbbrev}</span>
                      )}
                    </div>
                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{awayAbbrev}</div>
                    <div className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">
                      {formatMoneyline(prediction.away_ml)}
                      {toNum(prediction.away_spread) !== null ? (
                        <span className="ml-1 font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          ({formatSpread(prediction.away_spread)})
                        </span>
                      ) : null}
                    </div>
                    {prediction.away_sp_name && <div className="text-[11px] text-muted-foreground mt-1">SP: {prediction.away_sp_name}</div>}
                    <div title={prediction.away_sp_confirmed ? 'Starter confirmed' : 'Starter TBD'} className="text-[11px] text-muted-foreground">
                      {prediction.away_sp_confirmed ? 'SP ✓' : 'SP TBD'}
                    </div>
                  </div>

                  <div className="text-center px-2 sm:px-4 flex flex-col items-center justify-center">
                    <span className="text-4xl sm:text-5xl font-bold text-gray-300 dark:text-white/40 mb-2 sm:mb-3">@</span>
                    <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-white bg-gray-100/80 dark:bg-white/5 px-2 sm:px-3 py-1 rounded-full border border-gray-300 dark:border-white/20">
                      Total: {prediction.total_line ?? '-'}
                    </div>
                  </div>

                  <div className="text-center flex-1">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-2 sm:mb-3 flex items-center justify-center rounded-full border-2 border-slate-400 overflow-hidden bg-white/80 dark:bg-slate-900/40">
                      {homeLogoUrl ? (
                        <img
                          src={homeLogoUrl}
                          alt={homeAbbrev}
                          className="w-full h-full object-contain p-1"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = espnMlb500LogoUrlFromAbbrev(homeAbbrev);
                            target.onerror = () => {
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector('.mlb-logo-fallback')) {
                                const span = document.createElement('span');
                                span.className = 'text-xs sm:text-sm font-bold mlb-logo-fallback';
                                span.textContent = homeAbbrev;
                                parent.appendChild(span);
                              }
                            };
                          }}
                        />
                      ) : (
                        <span className="text-xs sm:text-sm font-bold">{homeAbbrev}</span>
                      )}
                    </div>
                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{homeAbbrev}</div>
                    <div className="text-sm sm:text-base font-bold text-green-600 dark:text-green-400">
                      {formatMoneyline(prediction.home_ml)}
                      {toNum(prediction.home_spread) !== null ? (
                        <span className="ml-1 font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          ({formatSpread(prediction.home_spread)})
                        </span>
                      ) : null}
                    </div>
                    {prediction.home_sp_name && <div className="text-[11px] text-muted-foreground mt-1">SP: {prediction.home_sp_name}</div>}
                    <div title={prediction.home_sp_confirmed ? 'Starter confirmed' : 'Starter TBD'} className="text-[11px] text-muted-foreground">
                      {prediction.home_sp_confirmed ? 'SP ✓' : 'SP TBD'}
                    </div>
                  </div>
                </div>

                <div className={`${MLB_CARD_SECTION} flex flex-wrap justify-center`}>
                  <div className="bg-purple-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
                    <Target className="h-3 w-3" />
                    <span>Status: {prediction.status || 'Scheduled'}</span>
                  </div>
                </div>

                {isOfficialDateToday(prediction.official_date) &&
                  (() => {
                    const allSignals = combineSignalsOrdered(signalsRowForGamePk(signalsByGamePk, prediction.game_pk));
                    return (
                      <div className={MLB_CARD_SECTION}>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Signals</div>
                        {allSignals.length > 0 ? (
                          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
                            {allSignals.map((sig, si) => (
                              <div
                                key={`${prediction.game_pk}-sig-${si}`}
                                className={`inline-flex max-w-[min(100%,22rem)] flex-shrink-0 items-start gap-1.5 rounded-2xl border px-2.5 py-1.5 text-left text-[11px] leading-snug ${signalSeverityPillClass(sig.severity)}`}
                              >
                                <SignalCategoryIcon category={sig.category} />
                                <span className="min-w-0">{sig.message}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2.5 text-left text-[11px] leading-relaxed text-slate-300 dark:text-slate-400">
                            No supplemental betting signals for this matchup right now. Your projections and edges above are the same full model outputs—this block only adds extra situational or trend context when our system surfaces it.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                <div className={`${MLB_CARD_SECTION} space-y-4`}>
                  <div className="flex justify-center gap-2">
                    <Button
                      size="sm"
                      variant={cardView === 'full' ? 'default' : 'outline'}
                      onClick={() => setCardProjectionView(gameKey, 'full')}
                      className="text-xs"
                    >
                      Full Game
                    </Button>
                    <Button
                      size="sm"
                      variant={cardView === 'f5' ? 'default' : 'outline'}
                      onClick={() => setCardProjectionView(gameKey, 'f5')}
                      className="text-xs"
                    >
                      1st 5
                    </Button>
                  </div>

                  <div className="text-center">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                      Projected Score ({cardView === 'full' ? 'Full Game' : '1st 5'})
                    </div>
                    {activeRuns ? (
                      <div className="mx-auto flex max-w-md items-center justify-center gap-3 sm:gap-5">
                        {scoreLogoImg(awayLogoUrl, awayAbbrev, 'away')}
                        <div className="flex min-w-[6.5rem] items-center justify-center px-1 sm:min-w-[7.5rem]">
                          <div className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                            <span>{activeRuns.away.toFixed(1)}</span>
                            <span className="mx-2 font-normal text-slate-500">—</span>
                            <span>{activeRuns.home.toFixed(1)}</span>
                          </div>
                        </div>
                        {scoreLogoImg(homeLogoUrl, homeAbbrev, 'home')}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Projection unavailable</div>
                    )}
                  </div>

                  <div className={MLB_CARD_INNER}>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {cardView === 'full' ? 'Moneyline Projection' : '1st 5 Moneyline Projection'}
                    </div>
                    {cardView === 'full' ? (() => {
                      const mlSide = mlPickIsHome ? 'home' : 'away';
                      const mlLine = mlPickIsHome ? toNum(prediction.home_ml) : toNum(prediction.away_ml);
                      const mlFavDog = mlLine !== null ? (mlLine < 0 ? 'favorite' : 'underdog') as 'favorite' | 'underdog' : undefined;
                      const mlAcc = mlPickEdge !== null ? lookupBucketAccuracy('full_ml', mlPickEdge, mlSide as 'home' | 'away', mlFavDog) : null;
                      return <>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-white">
                          <span>Pick: <span className="font-semibold">{mlPickTeam}</span></span>
                          <span>Edge: <span className="font-semibold">{mlPickEdge !== null ? `${mlPickEdge > 0 ? '+' : ''}${mlPickEdge.toFixed(1)}%` : '-'}</span></span>
                          {mlAcc ? accuracyBadge(mlAcc) : (
                            <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] sm:text-xs ${signalStyle(mlConfidenceLabel as 'Strong' | 'Weak')}`}>
                              {mlConfidenceLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {awayAbbrev}: Win Prob {toNum(prediction.ml_away_win_prob) !== null ? `${((toNum(prediction.ml_away_win_prob) as number) * 100).toFixed(1)}%` : '-'} | ML Edge {awayMlEdge !== null ? `${awayMlEdge > 0 ? '+' : ''}${awayMlEdge.toFixed(1)}%` : '-'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {homeAbbrev}: Win Prob {toNum(prediction.ml_home_win_prob) !== null ? `${((toNum(prediction.ml_home_win_prob) as number) * 100).toFixed(1)}%` : '-'} | ML Edge {homeMlEdge !== null ? `${homeMlEdge > 0 ? '+' : ''}${homeMlEdge.toFixed(1)}%` : '-'}
                        </div>
                      </>;
                    })() : (() => {
                      const f5Side = f5PickIsHome ? 'home' : 'away';
                      const f5Acc = f5PickEdge !== null ? lookupBucketAccuracy('f5_ml', f5PickEdge, f5Side as 'home' | 'away') : null;
                      return <>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-white">
                          <span>Pick: <span className="font-semibold">{f5PickTeam}</span></span>
                          <span>Edge: <span className="font-semibold">{f5PickEdge !== null ? `${f5PickEdge > 0 ? '+' : ''}${f5PickEdge.toFixed(1)}%` : '-'}</span></span>
                          {f5Acc ? accuracyBadge(f5Acc) : f5PickMlStrong ? (
                            <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] sm:text-xs ${signalStyle('Strong')}`}>
                              Strong
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {awayAbbrev}: F5 Win Prob{' '}
                          {f5AwayProb !== null ? `${(f5AwayProb * 100).toFixed(1)}%` : '-'}
                          {' '}| F5 ML Edge{' '}
                          {f5AwayMlEdge !== null ? `${f5AwayMlEdge > 0 ? '+' : ''}${f5AwayMlEdge.toFixed(1)}%` : '-'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {homeAbbrev}: F5 Win Prob{' '}
                          {f5HomeProb !== null ? `${(f5HomeProb * 100).toFixed(1)}%` : '-'}
                          {' '}| F5 ML Edge{' '}
                          {f5HomeMlEdge !== null ? `${f5HomeMlEdge > 0 ? '+' : ''}${f5HomeMlEdge.toFixed(1)}%` : '-'}
                        </div>
                      </>;
                    })()}
                  </div>

                  <div className={MLB_CARD_INNER}>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{cardView === 'full' ? 'Total Projection' : '1st 5 Total Projection'}</div>
                    {cardView === 'full' ? (() => {
                      const ouAcc = lookupBucketAccuracy('full_ou', toNum(prediction.ou_edge) ?? 0, undefined, undefined, prediction.ou_direction ?? undefined);
                      return <>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-white">
                          <span>Pick: <span className="font-semibold">{ouDirection}</span></span>
                          <span>Edge: <span className="font-semibold">+{ouEdge.toFixed(2)}</span></span>
                          {ouAcc ? accuracyBadge(ouAcc) : (
                            <span className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] sm:text-xs ${signalStyle(totalConfidenceLabel as 'Strong' | 'Moderate' | 'Weak')}`}>
                              {totalConfidenceLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Fair Total: {toNum(prediction.ou_fair_total)?.toFixed(2) ?? '-'} | Market Total: {toNum(prediction.total_line)?.toFixed(1) ?? '-'}
                        </div>
                      </>;
                    })() : (() => {
                      const f5OuAcc = lookupBucketAccuracy('f5_ou', toNum(prediction.f5_ou_edge) ?? 0, undefined, undefined, f5Direction.toLowerCase());
                      return <>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-white">
                          <span>Pick: <span className="font-semibold">{f5Direction}</span></span>
                          <span>Edge: <span className="font-semibold">+{f5TotalEdge.toFixed(2)}</span></span>
                          {f5OuAcc ? accuracyBadge(f5OuAcc) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          F5 Fair Total: {toNum(prediction.f5_fair_total)?.toFixed(2) ?? '-'} | F5 Market Total: {toNum(prediction.f5_total_line)?.toFixed(1) ?? '-'}
                        </div>
                      </>;
                    })()}
                  </div>
                </div>

                <div className={`${MLB_CARD_SECTION} text-xs text-center text-muted-foreground space-y-1`}>
                  {toNum((prediction as any).temperature_f) !== null ||
                  toNum((prediction as any).wind_speed_mph) !== null ||
                  (prediction as any).wind_direction ||
                  (prediction as any).sky ? (
                    <>
                      <div className="font-medium text-slate-300">Weather</div>
                      <div>
                        Temp: {toNum((prediction as any).temperature_f) !== null ? `${(toNum((prediction as any).temperature_f) as number).toFixed(0)}F` : 'N/A'}
                        {' | '}
                        Wind: {toNum((prediction as any).wind_speed_mph) !== null ? `${(toNum((prediction as any).wind_speed_mph) as number).toFixed(0)} mph` : 'N/A'}
                        {' '}
                        {(prediction as any).wind_direction ? `${(prediction as any).wind_direction}` : ''}
                      </div>
                      <div>
                        Sky: {(prediction as any).sky || 'N/A'}
                      </div>
                    </>
                  ) : (
                    <div title="Weather details become available closer to first pitch.">
                      Weather data not available yet.
                    </div>
                  )}
                  {!prediction.weather_confirmed && (
                    <div className="text-[11px]">
                      {(prediction.weather_imputed ? 'Using estimated weather inputs.' : 'Awaiting confirmed weather inputs.')}
                    </div>
                  )}
                </div>
              </CardContent>
            </NFLGameCard>
          );
        })}
      </div>
    </div>
  );
}
