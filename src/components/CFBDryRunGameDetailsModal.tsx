import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, CircleDollarSign, Clock3, Info, Target, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import {
  formatSignalSeasonRecord,
  signalSeasonRecordClassName,
  type SignalPerformanceRow,
} from '@/utils/signalPerformance';

type SignalDefinition = {
  signal_key?: string | null;
  display_name?: string | null;
  definition?: string | null;
  why_it_works?: string | null;
  bet_direction?: string | null;
  typical_hit?: string | null;
};

type CFBDryRunPick = {
  id?: string | number;
  game_id: string;
  card_group?: string | null;
  sort_order?: number | null;
  pick_label?: string | null;
  pick_team?: string | null;
  pick_side?: string | null;
  model_line?: number | string | null;
  vegas_line?: number | string | null;
  edge?: number | string | null;
  best_book_logo?: string | null;
  best_book_name?: string | null;
  best_line?: number | string | null;
  best_odds?: number | string | null;
  conviction?: string | null;
  is_mammoth?: boolean | null;
  signal_keys?: string[] | string | null;
  has_play?: boolean | null;
  display_only?: boolean | null;
};

type CFBDryRunGameDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  prediction: any;
};

const CARD_LABELS: Record<string, string> = {
  spread: 'Spread',
  total: 'Total',
  team_total: 'Team Totals',
  moneyline: 'Moneyline',
  h1_spread: '1H Spread',
  h1_total: '1H Total',
  h1_ml: '1H Moneyline',
};

const CARD_ORDER = ['spread', 'total', 'team_total', 'moneyline', 'h1_spread', 'h1_total', 'h1_ml'];

const normalizeCardGroup = (group?: string | null): string => {
  const key = (group || 'other').toLowerCase();
  if (key.startsWith('team_total')) return 'team_total';
  if (key === 'ml') return 'moneyline';
  if (key === 'h1_moneyline') return 'h1_ml';
  return key;
};

const normalizeSignalKeys = (value: CFBDryRunPick['signal_keys']): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [String(value)];
  } catch {
    return String(value).split(',').map((part) => part.trim()).filter(Boolean);
  }
};

const formatNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
};

const formatEdge = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  const sign = num > 0 ? '+' : '';
  return `${sign}${formatNumber(num)}`;
};

const convictionClass = (conviction?: string | null, isMammoth?: boolean | null): string => {
  if (isMammoth || conviction === 'mammoth') return 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30';
  if (conviction === 'high') return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30';
  if (conviction === 'med') return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
  if (conviction === 'low') return 'bg-amber-700/15 text-amber-700 dark:text-amber-300 border-amber-700/30';
  if (conviction === 'lean') return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
  return 'bg-muted text-muted-foreground border-border';
};

export function CFBDryRunGameDetailsModal({ isOpen, onClose, prediction }: CFBDryRunGameDetailsModalProps) {
  const [picks, setPicks] = useState<CFBDryRunPick[]>([]);
  const [signalDefs, setSignalDefs] = useState<Record<string, SignalDefinition>>({});
  const [signalPerformance, setSignalPerformance] = useState<Record<string, SignalPerformanceRow>>({});
  const [expandedSignals, setExpandedSignals] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !prediction?.game_id) return;

    const fetchPicks = async () => {
      setLoading(true);
      setError(null);
      try {
        const season = Number(prediction?.season) || 2025;
        const [{ data: pickRows, error: picksError }, { data: defsRows, error: defsError }, { data: perfRows, error: perfError }] = await Promise.all([
          collegeFootballSupabase
            .from('cfb_dryrun_picks')
            .select('*')
            .eq('game_id', prediction.game_id)
            .order('sort_order', { ascending: true }),
          collegeFootballSupabase.from('cfb_signal_defs').select('*'),
          collegeFootballSupabase
            .from('signal_performance')
            .select('*')
            .eq('sport', 'cfb')
            .eq('season', season),
        ]);

        if (picksError) throw picksError;
        if (defsError) throw defsError;
        if (perfError) throw perfError;

        const defsByKey = (defsRows || []).reduce<Record<string, SignalDefinition>>((acc, row: SignalDefinition) => {
          if (row.signal_key) acc[row.signal_key] = row;
          return acc;
        }, {});

        const perfByKey = (perfRows || []).reduce<Record<string, SignalPerformanceRow>>((acc, row: SignalPerformanceRow) => {
          if (row.signal_key) acc[row.signal_key] = row;
          return acc;
        }, {});

        setPicks(pickRows || []);
        setSignalDefs(defsByKey);
        setSignalPerformance(perfByKey);
      } catch (err) {
        debug.error('Error loading CFB dry-run picks:', err);
        setError(err instanceof Error ? err.message : 'Unable to load CFB picks');
      } finally {
        setLoading(false);
      }
    };

    fetchPicks();
  }, [isOpen, prediction?.game_id]);

  const groupedPicks = useMemo(() => {
    const groups = picks.reduce<Record<string, CFBDryRunPick[]>>((acc, pick) => {
      const group = normalizeCardGroup(pick.card_group);
      acc[group] = acc[group] || [];
      acc[group].push(pick);
      return acc;
    }, {});

    return CARD_ORDER.map((group) => ({ group, rows: groups[group] || [] })).filter(({ rows }) => rows.length > 0);
  }, [picks]);

  if (!prediction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
            <TeamHeader team={prediction.away_team} logo={prediction.away_logo} abbr={prediction.away_abbr} rank={prediction.away_rank} />
            <span className="text-muted-foreground">@</span>
            <TeamHeader team={prediction.home_team} logo={prediction.home_logo} abbr={prediction.home_abbr} rank={prediction.home_rank} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/80">
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryMetric label="Vegas Spread" value={`${prediction.away_abbr || 'Away'} ${formatNumber(prediction.away_spread)} / ${prediction.home_abbr || 'Home'} ${formatNumber(prediction.home_spread)}`} />
                <SummaryMetric label="Total" value={formatNumber(prediction.over_line)} />
                <SummaryMetric label="Predicted Score" value={`${prediction.away_abbr || 'Away'} ${formatNumber(prediction.pred_away_score)} · ${prediction.home_abbr || 'Home'} ${formatNumber(prediction.pred_home_score)}`} />
              </div>
            </CardContent>
          </Card>

          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {error && (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && groupedPicks.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No dry-run prediction cards found for this game.
              </CardContent>
            </Card>
          )}

          {groupedPicks.map(({ group, rows }) => (
            <PredictionCard
              key={group}
              group={group}
              rows={rows}
              signalDefs={signalDefs}
              expandedSignals={expandedSignals}
              setExpandedSignals={setExpandedSignals}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeamHeader({ team, logo, abbr, rank }: { team: string; logo?: string; abbr?: string; rank?: number | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {logo && <img src={logo} alt={`${team} logo`} className="h-8 w-8 object-contain" />}
      <span className="truncate">{abbr || team}</span>
      {rank && <Badge variant="secondary" className="text-[10px]">#{rank}</Badge>}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-black text-foreground">{value}</div>
    </div>
  );
}

function PredictionCard({
  group,
  rows,
  signalDefs,
  expandedSignals,
  setExpandedSignals,
}: {
  group: string;
  rows: CFBDryRunPick[];
  signalDefs: Record<string, SignalDefinition>;
  expandedSignals: Record<string, boolean>;
  setExpandedSignals: (next: Record<string, boolean>) => void;
}) {
  const Icon = group.includes('spread') ? Target
    : group.includes('total') ? BarChart3
    : group.includes('moneyline') || group.includes('ml') ? CircleDollarSign
    : group.includes('h1') ? Clock3
    : Trophy;

  return (
    <Card className="overflow-hidden border-border/70 bg-card/80">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-black">{CARD_LABELS[group] || group}</h3>
        </div>

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={`${row.id || row.pick_label || group}-${index}`}
              className={`rounded-xl border p-3 ${row.has_play ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-muted/30'} ${row.display_only ? 'opacity-85' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-black text-foreground">{row.pick_label || 'Projection only'}</h4>
                    {row.display_only && <Badge variant="outline">Display only</Badge>}
                    {row.has_play && <Badge className="bg-primary text-primary-foreground">Pick</Badge>}
                    {!row.display_only && row.conviction && (
                      <Badge variant="outline" className={convictionClass(row.conviction, row.is_mammoth)}>
                        {row.is_mammoth ? 'Mammoth' : row.conviction}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.display_only ? 'Context only, not a surfaced bet.' : row.has_play ? 'Actual surfaced pick.' : 'Informational projection.'}
                  </p>
                </div>

                {(row.best_book_logo || row.best_book_name) && (
                  <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-2 py-1">
                    {row.best_book_logo && <img src={row.best_book_logo} alt={row.best_book_name || 'book'} className="h-5 w-5 rounded object-contain" />}
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">{row.best_book_name || 'Best book'}</div>
                      <div className="text-xs font-black">{formatNumber(row.best_line)} {row.best_odds ? `(${row.best_odds})` : ''}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <SummaryMetric label="Vegas" value={formatNumber(row.vegas_line)} />
                <SummaryMetric label="Ours" value={formatNumber(row.model_line)} />
                <SummaryMetric label="Edge" value={row.display_only ? '-' : formatEdge(row.edge)} />
              </div>

              <SignalPills
                signalKeys={normalizeSignalKeys(row.signal_keys)}
                signalDefs={signalDefs}
                signalPerformance={signalPerformance}
                expandedSignals={expandedSignals}
                setExpandedSignals={setExpandedSignals}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SignalPills({
  signalKeys,
  signalDefs,
  signalPerformance,
  expandedSignals,
  setExpandedSignals,
}: {
  signalKeys: string[];
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
  expandedSignals: Record<string, boolean>;
  setExpandedSignals: (next: Record<string, boolean>) => void;
}) {
  if (signalKeys.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Supporting signals</div>
      <div className="flex flex-wrap gap-2">
        {signalKeys.map((key) => {
          const signal = signalDefs[key];
          const expanded = expandedSignals[key];
          return (
            <div key={key} className="w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto rounded-full px-3 py-1 text-xs"
                onClick={() => setExpandedSignals({ ...expandedSignals, [key]: !expanded })}
              >
                <Info className="mr-1 h-3 w-3" />
                {signal?.display_name || key}
              </Button>
              {expanded && signal && (
                <div className="mt-2 rounded-lg border border-border/70 bg-background/70 p-3 text-left text-xs leading-relaxed">
                  {signal.definition && <p className="font-medium text-foreground">{signal.definition}</p>}
                  {signal.why_it_works && <p className="mt-2 text-muted-foreground"><span className="font-bold text-foreground">Why it works:</span> {signal.why_it_works}</p>}
                  {signal.bet_direction && <p className="mt-2 text-muted-foreground"><span className="font-bold text-foreground">Direction:</span> {signal.bet_direction}</p>}
                  <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    {signal.typical_hit && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Historical backtest
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Hit rate from multi-season backtesting — not this year&apos;s live results.
                        </p>
                        <p className="mt-1 text-base font-bold text-foreground">{signal.typical_hit}</p>
                      </div>
                    )}
                    {signal.typical_hit && (
                      <div className="border-t border-border/50" />
                    )}
                    {(() => {
                      const seasonRecord = formatSignalSeasonRecord(
                        signalPerformance[signal.signal_key || key],
                      );
                      return (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                            This season
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Live graded record for the current season.
                          </p>
                          <p className={`mt-1 text-base font-bold ${signalSeasonRecordClassName(seasonRecord.tone)} ${seasonRecord.isSmallSample ? 'opacity-90' : ''}`}>
                            {seasonRecord.detail}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
