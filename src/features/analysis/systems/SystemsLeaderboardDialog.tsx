import * as React from 'react';
import {
  ChartLine,
  Flame,
  Loader2,
  Percent,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Sport } from '@/features/analysis/sportAdapters';
import {
  filterChipLabels,
  isColdLast10,
  isHotLast10,
  isSport,
  recordText,
  sampleBadge,
  sportLabel,
  systemTemperature,
  verdictLabel,
  type LeaderboardSportFilter,
  type LeaderboardSystem,
} from './analysisSystemsService';
import { useSystemsLeaderboard } from './useAnalysisSystems';

const GREEN = '#22c55e';
const RED = '#ef4444';
const ICE = '#38bdf8';
const GOLD = '#f59e0b';

type SortMode = 'bestROI' | 'bestRecord' | 'mostUnits' | 'hottestStreak';

const SORT_OPTIONS: { id: SortMode; label: string; icon: React.ReactNode }[] = [
  { id: 'bestROI', label: 'Best ROI', icon: <ChartLine className="h-3.5 w-3.5" /> },
  { id: 'bestRecord', label: 'Best record', icon: <Percent className="h-3.5 w-3.5" /> },
  { id: 'mostUnits', label: 'Most units', icon: <Zap className="h-3.5 w-3.5" /> },
  { id: 'hottestStreak', label: 'Hottest streak', icon: <Flame className="h-3.5 w-3.5" /> },
];

const SPORT_FILTERS: { id: LeaderboardSportFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mlb', label: 'MLB' },
  { id: 'nfl', label: 'NFL' },
  { id: 'cfb', label: 'CFB' },
];

function streakHeat(sys: LeaderboardSystem): number {
  const s = sys.streak;
  if (!s || s.kind !== 'win') return 0;
  return s.len;
}

function sortSystems(systems: LeaderboardSystem[], mode: SortMode): LeaderboardSystem[] {
  const rows = [...systems];
  switch (mode) {
    case 'bestROI':
      return rows.sort((a, b) => (b.all_time?.roi ?? -Infinity) - (a.all_time?.roi ?? -Infinity));
    case 'bestRecord':
      return rows.sort((a, b) => (b.all_time?.hit_pct ?? -1) - (a.all_time?.hit_pct ?? -1));
    case 'mostUnits':
      return rows.sort((a, b) => (b.all_time?.units ?? -Infinity) - (a.all_time?.units ?? -Infinity));
    case 'hottestStreak':
      return rows.sort((a, b) => streakHeat(b) - streakHeat(a));
  }
}

interface SystemsLeaderboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Seed the sport filter from the trends page's active sport. */
  initialSport?: LeaderboardSportFilter;
  onApplySystem: (system: LeaderboardSystem) => void;
}

/** Multi-sport Systems Leaderboard — Sport filter is required on web. */
export function SystemsLeaderboardDialog({
  open,
  onOpenChange,
  initialSport = 'all',
  onApplySystem,
}: SystemsLeaderboardDialogProps) {
  const [sport, setSport] = React.useState<LeaderboardSportFilter>(initialSport);
  const [sort, setSort] = React.useState<SortMode>('bestROI');
  const { data: systems, isLoading } = useSystemsLeaderboard(sport, 50, { enabled: open });

  React.useEffect(() => {
    if (open) setSport(initialSport);
  }, [open, initialSport]);

  const sorted = React.useMemo(
    () => (systems ? sortSystems(systems, sort) : []),
    [systems, sort],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-black/5 px-5 py-4 dark:border-white/10">
          <DialogTitle className="text-lg font-extrabold">Systems Leaderboard</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Sport
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {SPORT_FILTERS.map((opt) => {
              const selected = sport === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSport(opt.id)}
                  className={cn(
                    'h-8 rounded-full border px-3.5 text-xs font-semibold transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-black/8 bg-black/[0.03] text-foreground hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.05]',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !systems || systems.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm leading-relaxed text-muted-foreground">
              Only shared systems with 10+ games of history appear here
              {sport !== 'all' ? ` for ${sportLabel(sport)}` : ''}. Save a system, turn Share on,
              and check back once it has enough matching games.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Sort by
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {SORT_OPTIONS.map((opt) => {
                  const selected = sort === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSort(opt.id)}
                      className={cn(
                        'flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                        selected
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-black/8 bg-black/[0.03] text-foreground hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.05]',
                      )}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                {sorted.map((sys, i) => (
                  <LeaderboardCard
                    key={sys.system_id}
                    sys={sys}
                    rank={i + 1}
                    showSport={sport === 'all'}
                    onClick={() => onApplySystem(sys)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeaderboardCard({
  sys,
  rank,
  showSport,
  onClick,
}: {
  sys: LeaderboardSystem;
  rank: number;
  showSport: boolean;
  onClick: () => void;
}) {
  const at = sys.all_time;
  const roi = at?.roi;
  const units = at?.units;
  const badge = sampleBadge(at?.n);
  const last10 = sys.last10;
  const streak = sys.streak;
  const showStreak = streak && streak.len >= 3;
  const temp = systemTemperature(streak, last10);
  const hotL10 = isHotLast10(last10);
  const coldL10 = isColdLast10(last10);
  const accent =
    temp === 'fire' ? GREEN : temp === 'ice' ? ICE : roi != null && roi >= 0 ? GREEN : GOLD;
  const sportKey: Sport = isSport(sys.sport) ? sys.sport : 'mlb';
  const chips = filterChipLabels(sportKey, sys.filters, sys.bet_type);

  const rankBg =
    rank === 1 ? GOLD : rank === 2 ? '#9ca3af' : rank === 3 ? '#b45309' : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full overflow-hidden rounded-2xl border text-left transition-all duration-200',
        'bg-gradient-to-br from-white to-black/[0.02] shadow-sm',
        'hover:-translate-y-0.5 hover:shadow-md dark:from-white/[0.06] dark:to-white/[0.02]',
        temp === 'fire'
          ? 'border-green-500/35 shadow-green-500/10'
          : temp === 'ice'
            ? 'border-sky-400/40 shadow-sky-400/10'
            : 'border-black/8 dark:border-white/10',
      )}
    >
      <span className="w-1 shrink-0 self-stretch" style={{ backgroundColor: accent }} />
      <span className="min-w-0 flex-1 p-3.5">
        <span className="mb-2 flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-black text-white',
              !rankBg && 'bg-primary',
            )}
            style={rankBg ? { backgroundColor: rankBg } : undefined}
          >
            #{rank}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{sys.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              by {sys.username}
              {showSport ? ` · ${sportLabel(sys.sport)}` : ''}
            </span>
          </span>
          {badge && (
            <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold dark:bg-white/10">
              {badge}
            </span>
          )}
          {temp === 'fire' && <span className="text-lg">🔥</span>}
          {temp === 'ice' && <span className="text-lg">❄️</span>}
        </span>

        <span className="mb-2 block text-[13px] font-semibold text-muted-foreground">
          {verdictLabel(sys.verdict)} · {(sys.bet_type || '').toUpperCase()}
        </span>

        <span className="mb-2 block rounded-xl bg-black/[0.04] p-2.5 dark:bg-black/25">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            In filter&apos;s timeframe
          </span>
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-extrabold tabular-nums">{recordText(at)}</span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: roi == null ? undefined : roi >= 0 ? GREEN : RED }}
            >
              {roi == null ? '— ROI' : `${roi >= 0 ? '+' : ''}${roi}% ROI`}
            </span>
            {units != null && (
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: units >= 0 ? GREEN : RED }}
              >
                {units >= 0 ? '+' : ''}
                {units}u
              </span>
            )}
          </span>
        </span>

        <span className="mb-2 block text-xs font-semibold text-muted-foreground">
          This season{sys.season_label != null ? ` (${sys.season_label})` : ''}:{' '}
          {recordText(sys.current_season)}
        </span>

        <span className="mb-2 flex flex-wrap gap-2">
          {last10 && last10.n > 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-1',
                hotL10
                  ? 'bg-green-500/15'
                  : coldL10
                    ? 'bg-sky-400/15'
                    : 'bg-black/[0.05] dark:bg-white/10',
              )}
            >
              {hotL10 ? <span>🔥</span> : coldL10 ? <span>❄️</span> : null}
              <span className="flex gap-0.5">
                {last10.results.slice(0, 10).map((r, idx) => (
                  <span
                    key={idx}
                    className="h-2.5 w-1.5 rounded-sm"
                    style={{ backgroundColor: r ? GREEN : RED }}
                  />
                ))}
              </span>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: hotL10 ? GREEN : coldL10 ? ICE : undefined }}
              >
                {last10.wins}/{last10.n}
              </span>
            </span>
          )}
          {showStreak && (
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                streak!.kind === 'win' ? 'bg-green-500/15' : 'bg-sky-400/15',
              )}
              style={{ color: streak!.kind === 'win' ? GREEN : ICE }}
            >
              {streak!.kind === 'win'
                ? `🔥 ${streak!.len} straight`
                : `❄️ ${streak!.len} straight misses`}
            </span>
          )}
        </span>

        {chips.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {chips.map((label) => (
              <span
                key={label}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-foreground"
              >
                {label}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}
