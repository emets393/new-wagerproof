import React, { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, Clock, Target, BarChart2 } from 'lucide-react';
import { getNBATeamInitials } from '@/utils/teamColors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const getNBATeamLogoUrl = (teamName: string): string => {
  if (!teamName) return '/placeholder.svg';
  const espnLogoMap: { [key: string]: string } = {
    'Atlanta': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
    'Boston': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    'Brooklyn': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
    'Charlotte': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
    'Chicago': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
    'Cleveland': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
    'Dallas': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    'Denver': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
    'Detroit': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
    'Golden State': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    'Houston': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
    'Indiana': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
    'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'LA Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Memphis': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
    'Miami': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    'Milwaukee': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    'Minnesota': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
    'New Orleans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
    'New York': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
    'Oklahoma City': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Okla City': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Orlando': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
    'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
    'Phoenix': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
    'Portland': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    'Sacramento': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
    'San Antonio': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
    'Toronto': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
    'Utah': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
    'Washington': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
  };
  if (espnLogoMap[teamName]) return espnLogoMap[teamName];
  const lower = teamName.toLowerCase();
  const key = Object.keys(espnLogoMap).find(k => k.toLowerCase() === lower);
  if (key) return espnLogoMap[key];
  for (const [k, url] of Object.entries(espnLogoMap)) {
    if (teamName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(teamName.toLowerCase()))
      return url;
  }
  return '/placeholder.svg';
};

/** Bucket row from nba_edge_accuracy_by_bucket */
interface EdgeAccuracyBucket {
  edge_type: string;
  bucket: number;
  games: number;
  correct: number;
  accuracy_pct: number;
}

type BucketMap = Map<string, { games: number; correct: number; accuracy_pct: number }>;

interface GameWithAccuracy {
  game_id: number;
  away_team: string;
  home_team: string;
  away_abbr: string;
  home_abbr: string;
  game_date: string;
  tipoff_time_et: string | null;
  home_spread: number | null;
  over_line: number | null;
  home_spread_diff: number | null;
  over_line_diff: number | null;
  home_win_prob: number | null;
  away_win_prob: number | null;
  model_fair_total: number | null;
  spreadBucketKey: number | null;
  ouBucketKey: number | null;
  mlBucketKey: number | null;
  mlPickIsHome: boolean | null;
  mlPickProbRounded: number | null;
  spreadAccuracy: { games: number; accuracy_pct: number } | null;
  ouAccuracy: { games: number; accuracy_pct: number } | null;
  mlAccuracy: { games: number; accuracy_pct: number } | null;
}

export type EdgeAccuracySortMode = 'time' | 'spread' | 'moneyline' | 'ou';

const roundToNearestHalf = (value: number): number => Math.round(value * 2) / 2;

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

const formatTipoffTime = (tipoffTimeUtc: string | null, gameDate?: string | null): string => {
  if (!tipoffTimeUtc) return '';
  try {
    let utcDate: Date;
    if (tipoffTimeUtc.includes('T') || (tipoffTimeUtc.length > 10 && tipoffTimeUtc.includes(' '))) {
      utcDate = new Date(tipoffTimeUtc);
    } else if (gameDate) {
      const timePart = tipoffTimeUtc.includes(':') && tipoffTimeUtc.split(':').length >= 2
        ? tipoffTimeUtc.length === 5 ? `${tipoffTimeUtc}:00` : tipoffTimeUtc
        : tipoffTimeUtc;
      utcDate = new Date(`${gameDate}T${timePart}`);
    } else {
      utcDate = new Date(tipoffTimeUtc);
    }
    if (isNaN(utcDate.getTime())) return '';
    const timeStr = utcDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${timeStr} ET`;
  } catch {
    return '';
  }
};

function buildBucketMap(rows: EdgeAccuracyBucket[]): BucketMap {
  const map: BucketMap = new Map();
  for (const r of rows) {
    const key = `${r.edge_type}|${r.bucket}`;
    map.set(key, { games: r.games, correct: r.correct, accuracy_pct: r.accuracy_pct });
  }
  return map;
}

function getBucketKeyForSpread(homeSpreadDiff: number | null): number | null {
  if (homeSpreadDiff === null || Number.isNaN(homeSpreadDiff)) return null;
  return roundToNearestHalf(Math.abs(homeSpreadDiff));
}

function getBucketKeyForOU(overLineDiff: number | null): number | null {
  if (overLineDiff === null || Number.isNaN(overLineDiff)) return null;
  return roundToNearestHalf(overLineDiff);
}

function getBucketKeyForML(homeWinProb: number | null, awayWinProb: number | null): number | null {
  const home = homeWinProb != null && !Number.isNaN(homeWinProb) ? homeWinProb : 0;
  const away = awayWinProb != null && !Number.isNaN(awayWinProb) ? awayWinProb : 0;
  const max = Math.max(home, away);
  if (max <= 0) return null;
  return Math.round(max * 20) / 20;
}

function lookupAccuracy(
  bucketMap: BucketMap,
  edgeType: string,
  bucketKey: number | null
): { games: number; accuracy_pct: number } | null {
  if (bucketKey === null) return null;
  const key = `${edgeType}|${bucketKey}`;
  const row = bucketMap.get(key);
  return row ? { games: row.games, accuracy_pct: row.accuracy_pct } : null;
}

function sortGames(
  games: GameWithAccuracy[],
  mode: EdgeAccuracySortMode
): GameWithAccuracy[] {
  const byTime = (a: GameWithAccuracy, b: GameWithAccuracy) => {
    const da = a.game_date || '';
    const db = b.game_date || '';
    if (da !== db) return da.localeCompare(db);
    const ta = a.tipoff_time_et || '';
    const tb = b.tipoff_time_et || '';
    return ta.localeCompare(tb);
  };

  if (mode === 'time') {
    return [...games].sort(byTime);
  }

  const accuracy = (g: GameWithAccuracy): number => {
    if (mode === 'spread') return g.spreadAccuracy?.accuracy_pct ?? -1;
    if (mode === 'moneyline') return g.mlAccuracy?.accuracy_pct ?? -1;
    return g.ouAccuracy?.accuracy_pct ?? -1;
  };

  return [...games].sort((a, b) => {
    const diff = accuracy(b) - accuracy(a);
    if (diff !== 0) return diff;
    return byTime(a, b);
  });
}

export default function NBATodayEdgeAccuracy() {
  const [games, setGames] = useState<GameWithAccuracy[]>([]);
  const [bucketMap, setBucketMap] = useState<BucketMap>(new Map());
  const [sortMode, setSortMode] = useState<EdgeAccuracySortMode>('time');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // View already returns only today's games (by DB date); no client date filter to avoid timezone mismatch
      const { data: rows, error: viewError } = await collegeFootballSupabase
        .from('nba_todays_games_predictions_with_accuracy')
        .select('*')
        .order('game_date', { ascending: true })
        .order('tipoff_time_et', { ascending: true });

      if (viewError) {
        setError(`Failed to load: ${viewError.message}`);
        setLoading(false);
        return;
      }

      const list = (rows || []) as any[];
      const merged: GameWithAccuracy[] = list.map((row: any) => {
        const vegasHomeSpread = row.vegas_home_spread != null ? Number(row.vegas_home_spread) : null;
        const vegasTotal = row.vegas_total != null ? Number(row.vegas_total) : null;
        const modelFair = row.model_fair_home_spread != null ? Number(row.model_fair_home_spread) : null;
        const predTotal = row.pred_total_points != null ? Number(row.pred_total_points) : null;
        const homeSpreadDiff =
          vegasHomeSpread !== null && modelFair !== null ? vegasHomeSpread - modelFair : null;
        const overLineDiff =
          vegasTotal !== null && predTotal !== null ? predTotal - vegasTotal : null;
        const homeWinProb = row.home_win_prob != null ? Number(row.home_win_prob) : null;
        const awayWinProb = row.away_win_prob != null ? Number(row.away_win_prob) : null;
        const mlBucketKey = row.ml_bucket != null ? Number(row.ml_bucket) : null;
        const mlPickIsHome =
          row.model_ml_winner === 'home' ? true : row.model_ml_winner === 'away' ? false : null;

        const spreadAcc =
          row.spread_accuracy_pct != null && row.spread_bucket_games != null
            ? { games: Number(row.spread_bucket_games), accuracy_pct: Number(row.spread_accuracy_pct) }
            : null;
        const ouAcc =
          row.ou_accuracy_pct != null && row.ou_bucket_games != null
            ? { games: Number(row.ou_bucket_games), accuracy_pct: Number(row.ou_accuracy_pct) }
            : null;
        const mlAcc =
          row.ml_accuracy_pct != null && row.ml_bucket_games != null
            ? { games: Number(row.ml_bucket_games), accuracy_pct: Number(row.ml_accuracy_pct) }
            : null;

        return {
          game_id: row.game_id,
          away_team: row.away_team ?? '',
          home_team: row.home_team ?? '',
          away_abbr: getNBATeamInitials(row.away_team ?? ''),
          home_abbr: getNBATeamInitials(row.home_team ?? ''),
          game_date: row.game_date ?? '',
          tipoff_time_et: row.tipoff_time_et ?? null,
          home_spread: vegasHomeSpread,
          over_line: vegasTotal,
          home_spread_diff: homeSpreadDiff,
          over_line_diff: overLineDiff,
          home_win_prob: homeWinProb,
          away_win_prob: awayWinProb,
          model_fair_total: predTotal,
          spreadBucketKey: row.spread_bucket != null ? Number(row.spread_bucket) : null,
          ouBucketKey: row.ou_bucket != null ? Number(row.ou_bucket) : null,
          mlBucketKey,
          mlPickIsHome,
          mlPickProbRounded: mlBucketKey,
          spreadAccuracy: spreadAcc,
          ouAccuracy: ouAcc,
          mlAccuracy: mlAcc,
        };
      });

      setGames(merged);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const sortedGames = sortGames(games, sortMode);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Today&apos;s Predictions & Edge Accuracy</h1>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Today&apos;s Predictions & Edge Accuracy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Latest model predictions and historical accuracy by edge bucket for today&apos;s NBA games.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as EdgeAccuracySortMode)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="time">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Time
              </span>
            </SelectItem>
            <SelectItem value="spread">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" /> Most accurate Spread
              </span>
            </SelectItem>
            <SelectItem value="moneyline">
              <span className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" /> Most accurate Moneyline
              </span>
            </SelectItem>
            <SelectItem value="ou">
              <span className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" /> Most accurate Over/Under
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedGames.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No games today. Check back later or refresh.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedGames.map((g) => {
            const awayAbbr = g.away_abbr ?? getNBATeamInitials(g.away_team ?? '');
            const homeAbbr = g.home_abbr ?? getNBATeamInitials(g.home_team ?? '');
            const homePredictedToCover = g.home_spread_diff != null && g.home_spread_diff > 0;
            const spreadPickAbbr = homePredictedToCover ? homeAbbr : awayAbbr;
            const spreadPickLine =
              g.home_spread != null
                ? homePredictedToCover
                  ? `${g.home_spread > 0 ? '+' : ''}${g.home_spread}`
                  : `${-Number(g.home_spread) > 0 ? '+' : ''}${-Number(g.home_spread)}`
                : null;
            const spreadEdgeDisplay =
              g.home_spread_diff != null
                ? `+${roundToNearestHalf(Math.abs(g.home_spread_diff))}`
                : '—';
            const ouEdgeDisplay =
              g.over_line_diff != null
                ? `+${roundToNearestHalf(Math.abs(g.over_line_diff))}`
                : '—';
            const mlPickAbbr = g.mlPickIsHome ? homeAbbr : awayAbbr;
            const mlLabel =
              g.mlPickProbRounded != null
                ? `${mlPickAbbr} ${Math.round(g.mlPickProbRounded * 100)}%`
                : '—';
            const overUnder =
              g.over_line_diff != null && g.over_line != null
                ? g.over_line_diff > 0
                  ? `Over ${g.over_line}`
                  : `Under ${g.over_line}`
                : '—';

            return (
              <Card key={g.game_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 shrink-0">
                      <img
                        src={getNBATeamLogoUrl(g.away_team)}
                        alt={awayAbbr}
                        className="w-6 h-6 object-contain"
                      />
                      <span className="truncate">{awayAbbr}</span>
                      <span className="text-muted-foreground">@</span>
                      <img
                        src={getNBATeamLogoUrl(g.home_team)}
                        alt={homeAbbr}
                        className="w-6 h-6 object-contain"
                      />
                      <span className="truncate">{homeAbbr}</span>
                    </CardTitle>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {formatTipoffTime(g.tipoff_time_et, g.game_date) || 'TBD'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-lg bg-muted/60 dark:bg-muted/40 border border-border px-3 py-2 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Spread</span>
                      <span>
                        {spreadPickLine != null ? `${spreadPickAbbr} ${spreadPickLine}` : '—'} (edge {spreadEdgeDisplay})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Accuracy</span>
                      <span>
                        {g.spreadAccuracy ? `${g.spreadAccuracy.accuracy_pct.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/60 dark:bg-muted/40 border border-border px-3 py-2 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Moneyline Win Prob %</span>
                      <span>{mlLabel}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Accuracy</span>
                      <span>
                        {g.mlAccuracy ? `${g.mlAccuracy.accuracy_pct.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/60 dark:bg-muted/40 border border-border px-3 py-2 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Over/Under</span>
                      <span>{overUnder} (edge {ouEdgeDisplay})</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Accuracy</span>
                      <span>
                        {g.ouAccuracy ? `${g.ouAccuracy.accuracy_pct.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
