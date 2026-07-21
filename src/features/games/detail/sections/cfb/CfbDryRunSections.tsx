import { useEffect, useMemo, useState } from 'react';
import { Chip, Tooltip } from '@heroui/react';
import { BarChart3, Check, CircleDollarSign, Clock3, Flame, Target, Trophy } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import {
  formatSignalSeasonRecord,
  signalSeasonRecordClassName,
  type SignalPerformanceRow,
} from '@/utils/signalPerformance';
import {
  CollegeTeamMark,
  Disclosure,
  EmptyNote,
  MarketGapHeader,
  MarketGapRow,
  STACK,
  toNum,
} from './shared';
import type { CFBPrediction } from '../../../api/cfbGames';
import type { GameFeedItem, TeamRef } from '../../../types';

/**
 * Admin dry-run CFB detail sections — the slate summary plus the grouped
 * prediction cards from `cfb_dryrun_picks`.
 *
 * Rebuilt against `detail/WIDGET_DESIGN.md`: the widget card is the only
 * surface (the old layout nested picks → metric boxes → signal panels three
 * deep), number pairs became diverging model-vs-market bars, and the signal
 * breakdowns collapse behind a disclosure that says how many there are.
 */

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

type ConvictionSummary = {
  card?: string;
  conviction?: string;
  mammoth?: boolean;
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

/** One plain-language line per market group, so no card is unlabelled. */
const CARD_SUBTITLES: Record<string, string> = {
  spread: 'Where the model’s full-game spread sits against the book’s.',
  total: 'Where the model’s full-game total sits against the book’s.',
  team_total: 'Points the model expects from each team on its own, versus the posted team totals.',
  moneyline: 'Straight-up winner, priced against the book’s moneyline.',
  h1_spread: 'First-half spread only — the model prices halves separately from the full game.',
  h1_total: 'First-half total only — the model prices halves separately from the full game.',
  h1_ml: 'First-half winner only — the model prices halves separately from the full game.',
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

type ChipTone = 'default' | 'primary' | 'success' | 'warning';

/** Conviction tiers, warmest at the top. Mammoth is the model's highest tier. */
const CONVICTION_TONE: Record<string, ChipTone> = {
  mammoth: 'warning',
  high: 'success',
  med: 'primary',
  low: 'default',
  lean: 'default',
};

const CONVICTION_LABEL: Record<string, string> = {
  mammoth: 'Mammoth',
  high: 'Strong',
  med: 'Medium',
  low: 'Low',
  lean: 'Lean',
};

function convictionKey(conviction?: string | null, isMammoth?: boolean | null): string | null {
  if (isMammoth) return 'mammoth';
  const key = (conviction || '').toLowerCase();
  return key in CONVICTION_TONE ? key : conviction ? 'lean' : null;
}

function ConvictionChip({
  conviction,
  isMammoth,
  suffix,
}: {
  conviction?: string | null;
  isMammoth?: boolean | null;
  /** Market name appended on the slate summary ("Mammoth: spread"). */
  suffix?: string;
}) {
  const key = convictionKey(conviction, isMammoth);
  if (!key) return null;
  return (
    <Chip
      size="sm"
      variant="flat"
      color={CONVICTION_TONE[key]}
      startContent={key === 'mammoth' ? <Flame className="ml-1.5 h-3 w-3" aria-hidden /> : undefined}
      classNames={{ content: 'text-[11px] font-semibold capitalize' }}
    >
      {CONVICTION_LABEL[key]}
      {suffix ? `: ${suffix}` : ''}
    </Chip>
  );
}

/**
 * Slate summary: how hard the model likes this game, its projected final score,
 * and where its spread/total land against the book.
 */
export function CfbDryRunSummarySection({ game }: { game: GameFeedItem<CFBPrediction> }) {
  const prediction = game.raw;
  const convictionSummary: ConvictionSummary[] = Array.isArray(prediction.conviction_summary)
    ? prediction.conviction_summary
    : [];

  // Verbatim mammoth detection from CollegeFootball.tsx (isMammothCard).
  const isMammothCard = Boolean(
    prediction.mammoth ||
      convictionSummary.some((entry) => entry.mammoth || entry.conviction === 'mammoth')
  );
  const mammothMarkets = convictionSummary
    .filter((entry) => entry.mammoth || entry.conviction === 'mammoth')
    .map((entry) => (entry.card || 'pick').replace(/_/g, ' '));

  const predAway = toNum(prediction.pred_away_score);
  const predHome = toNum(prediction.pred_home_score);
  const hasScore = predAway !== null && predHome !== null;
  // Home spread is negative when home is favoured, so it's away minus home.
  const modelHomeSpread = hasScore ? predAway - predHome : null;
  const modelTotal = hasScore ? predAway + predHome : null;
  const vegasHomeSpread = toNum(prediction.home_spread) ?? game.lines.homeSpread ?? null;
  const vegasTotal = toNum(prediction.over_line) ?? game.lines.total ?? null;
  const homeWins = hasScore && predHome >= predAway;

  return (
    <WidgetCard
      icon={<Trophy />}
      title="Slate Summary"
      subtitle="How hard the model likes this game, the score it projects, and where that lands against the book."
      className="@xl:col-span-2"
    >
      <div className={STACK}>
        {(isMammothCard || convictionSummary.length > 0) && (
          <div className="flex flex-col gap-2">
            {isMammothCard && (
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  Mammoth Play
                </span>
                <span className="min-w-0 truncate text-[11px] capitalize text-muted-foreground">
                  {mammothMarkets.length > 0
                    ? mammothMarkets.join(' · ')
                    : 'Highest-conviction tier on this slate'}
                </span>
              </div>
            )}
            {convictionSummary.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {convictionSummary.map((entry, index) => (
                  <ConvictionChip
                    key={`${entry.card}-${index}`}
                    conviction={entry.conviction}
                    isMammoth={entry.mammoth}
                    suffix={(entry.card || 'pick').replace(/_/g, ' ')}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {hasScore && (
          <ProjectedScore
            away={game.awayTeam}
            home={game.homeTeam}
            awayScore={predAway}
            homeScore={predHome}
            homeWins={homeWins}
          />
        )}

        {(modelHomeSpread !== null || modelTotal !== null) && (
          <div className="border-t border-black/5 pt-2 dark:border-white/10">
            <MarketGapHeader />
            <MarketGapRow
              label={`Spread (${game.homeTeam.abbrev})`}
              model={modelHomeSpread}
              vegas={vegasHomeSpread}
            />
            <MarketGapRow label="Total" model={modelTotal} vegas={vegasTotal} />
          </div>
        )}

        {!hasScore && modelHomeSpread === null && (
          <EmptyNote>No projected score on this dry-run row yet.</EmptyNote>
        )}
      </div>
    </WidgetCard>
  );
}

/**
 * Projected final score with each team's share of the projected points as a
 * divided bar in the clubs' own colours. The projected winner keeps full
 * opacity and a check; the other side dims to keep the read instant.
 */
function ProjectedScore({
  away,
  home,
  awayScore,
  homeScore,
  homeWins,
}: {
  away: TeamRef;
  home: TeamRef;
  awayScore: number;
  homeScore: number;
  homeWins: boolean;
}) {
  const total = awayScore + homeScore;
  const awayShare = total > 0 ? (awayScore / total) * 100 : 50;
  const homeShare = 100 - awayShare;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <CollegeTeamMark team={away} size={28} dimmed={homeWins} />
          <span className={cn('text-lg font-bold tabular-nums', homeWins ? 'text-muted-foreground' : 'text-foreground')}>
            {away.abbrev} {awayScore.toFixed(1)}
          </span>
          {!homeWins && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {homeWins && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className={cn('text-lg font-bold tabular-nums', homeWins ? 'text-foreground' : 'text-muted-foreground')}>
            {homeScore.toFixed(1)} {home.abbrev}
          </span>
          <CollegeTeamMark team={home} size={28} dimmed={!homeWins} />
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Projected ${away.abbrev} ${awayScore.toFixed(1)}, ${home.abbrev} ${homeScore.toFixed(1)}`}
      >
        <div
          style={{ width: `${awayShare}%`, backgroundColor: away.colors.primary }}
          className={cn('transition-opacity', homeWins && 'opacity-35')}
        />
        <div
          style={{ width: `${homeShare}%`, backgroundColor: home.colors.primary }}
          className={cn('transition-opacity', !homeWins && 'opacity-35')}
        />
      </div>
    </div>
  );
}

/**
 * The dry-run prediction cards (`cfb_dryrun_picks` grouped by market): the pick,
 * its conviction, the model-vs-market gap, and the supporting signals.
 */
export function CfbDryRunPicksSection({ game }: { game: GameFeedItem<CFBPrediction> }) {
  const prediction = game.raw;
  const [picks, setPicks] = useState<CFBDryRunPick[]>([]);
  const [signalDefs, setSignalDefs] = useState<Record<string, SignalDefinition>>({});
  const [signalPerformance, setSignalPerformance] = useState<Record<string, SignalPerformanceRow>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prediction?.game_id) return;

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
  }, [prediction?.game_id]);

  const groupedPicks = useMemo(() => {
    const groups = picks.reduce<Record<string, CFBDryRunPick[]>>((acc, pick) => {
      const group = normalizeCardGroup(pick.card_group);
      acc[group] = acc[group] || [];
      acc[group].push(pick);
      return acc;
    }, {});

    return CARD_ORDER.map((group) => ({ group, rows: groups[group] || [] })).filter(({ rows }) => rows.length > 0);
  }, [picks]);

  if (loading) {
    return (
      <WidgetCard
        icon={<Target />}
        title="Prediction Cards"
        subtitle="Every market the dry-run model priced for this game."
      >
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard
        icon={<Target />}
        title="Prediction Cards"
        subtitle="Every market the dry-run model priced for this game."
      >
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </WidgetCard>
    );
  }

  if (groupedPicks.length === 0) {
    return (
      <WidgetCard
        icon={<Target />}
        title="Prediction Cards"
        subtitle="Every market the dry-run model priced for this game."
      >
        <EmptyNote>No dry-run prediction cards found for this game.</EmptyNote>
      </WidgetCard>
    );
  }

  return (
    <>
      {groupedPicks.map(({ group, rows }) => (
        // Key on the game too: the detail pane persists across selections, and
        // without this the per-pick signal disclosures would stay open from the
        // previously selected game.
        <PredictionGroupCard
          key={`${prediction.game_id}-${group}`}
          group={group}
          rows={rows}
          signalDefs={signalDefs}
          signalPerformance={signalPerformance}
        />
      ))}
    </>
  );
}

function PredictionGroupCard({
  group,
  rows,
  signalDefs,
  signalPerformance,
}: {
  group: string;
  rows: CFBDryRunPick[];
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
}) {
  const Icon = group.includes('spread') ? Target
    : group.includes('total') ? BarChart3
    : group.includes('moneyline') || group.includes('ml') ? CircleDollarSign
    : group.includes('h1') ? Clock3
    : Trophy;

  const playCount = rows.filter((row) => row.has_play).length;

  return (
    <WidgetCard
      icon={<Icon />}
      title={CARD_LABELS[group] || group}
      subtitle={CARD_SUBTITLES[group] ?? 'How the model priced this market against the book.'}
      accessory={
        playCount > 0 ? (
          <Chip size="sm" variant="flat" color="primary" classNames={{ content: 'text-[11px] font-semibold' }}>
            {playCount} pick{playCount === 1 ? '' : 's'}
          </Chip>
        ) : undefined
      }
    >
      {/* Hairlines between picks — the card is already the surface. */}
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {rows.map((row, index) => (
          <PickRow
            key={`${row.id || row.pick_label || group}-${index}`}
            row={row}
            signalDefs={signalDefs}
            signalPerformance={signalPerformance}
          />
        ))}
      </div>
    </WidgetCard>
  );
}

function PickRow({
  row,
  signalDefs,
  signalPerformance,
}: {
  row: CFBDryRunPick;
  signalDefs: Record<string, SignalDefinition>;
  signalPerformance: Record<string, SignalPerformanceRow>;
}) {
  const signalKeys = normalizeSignalKeys(row.signal_keys);
  const model = toNum(row.model_line);
  const vegas = toNum(row.vegas_line);
  // Prefer deriving the gap so the row's three numbers can't visibly disagree;
  // the stored `edge` is only used when one of the two lines is missing.
  const gap = row.display_only
    ? null
    : model !== null && vegas !== null
      ? undefined
      : toNum(row.edge);

  return (
    <div className={cn('flex flex-col gap-2 py-3 first:pt-0 last:pb-0', row.display_only && 'opacity-70')}>
      {/* The pick first and largest; everything under it is the case for it. */}
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {row.display_only ? 'Projection only' : row.has_play ? 'Surfaced pick' : 'Informational'}
          </span>
          <span className="truncate text-lg font-bold leading-tight tracking-tight text-foreground">
            {row.pick_label || 'Projection only'}
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!row.display_only && (
            <ConvictionChip conviction={row.conviction} isMammoth={row.is_mammoth} />
          )}
          {(row.best_book_logo || row.best_book_name) && (
            <Tooltip
              content={`Best available price: ${row.best_book_name || 'book'}`}
              size="sm"
              delay={200}
            >
              <span className="flex items-center gap-1.5">
                {row.best_book_logo && (
                  <img
                    src={row.best_book_logo}
                    alt={row.best_book_name || 'book'}
                    className="h-4 w-4 rounded object-contain"
                  />
                )}
                <span className="text-[12px] font-bold tabular-nums text-foreground">
                  {formatNumber(row.best_line)}
                  {row.best_odds ? ` (${row.best_odds})` : ''}
                </span>
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      <div>
        {/* Captions repeat per pick rather than once per card so a row is never
            three unlabelled numbers when you scroll into the middle of a card. */}
        <MarketGapHeader />
        <MarketGapRow label="Line" model={model} vegas={vegas} gap={gap} format={formatNumber} />
      </div>

      {signalKeys.length > 0 && (
        <Disclosure
          label="Supporting signals"
          summary={`${signalKeys.length} signal${signalKeys.length === 1 ? '' : 's'}`}
        >
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground/80">
            Patterns the model found in this matchup, with how each has performed historically and
            so far this season.
          </p>
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {signalKeys.map((key) => (
              <SignalDetail
                key={key}
                signalKey={key}
                signal={signalDefs[key]}
                performance={signalPerformance[signalDefs[key]?.signal_key || key]}
              />
            ))}
          </div>
        </Disclosure>
      )}
    </div>
  );
}

/** One signal, flat: what it is, why it works, and its two records side by side. */
function SignalDetail({
  signalKey,
  signal,
  performance,
}: {
  signalKey: string;
  signal: SignalDefinition | undefined;
  performance: SignalPerformanceRow | undefined;
}) {
  const seasonRecord = formatSignalSeasonRecord(performance);

  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <div className="text-[11px] font-bold text-foreground">{signal?.display_name || signalKey}</div>
      {signal?.definition && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{signal.definition}</p>
      )}
      {signal?.why_it_works && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Why it works:</span> {signal.why_it_works}
        </p>
      )}
      {signal?.bet_direction && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Direction:</span> {signal.bet_direction}
        </p>
      )}

      {/* Two records, two columns — the backtest and the live season are
          different claims and reading them stacked invited conflating them. */}
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Backtest
          </div>
          <div className="text-sm font-bold tabular-nums text-foreground">
            {signal?.typical_hit || '—'}
          </div>
          <div className="text-[10px] leading-snug text-muted-foreground/80">Multi-season</div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-primary">This season</div>
          <div
            className={cn(
              'text-sm font-bold tabular-nums',
              signalSeasonRecordClassName(seasonRecord.tone),
              seasonRecord.isSmallSample && 'opacity-90',
            )}
          >
            {seasonRecord.detail}
          </div>
          <div className="text-[10px] leading-snug text-muted-foreground/80">Live graded</div>
        </div>
      </div>
    </div>
  );
}
