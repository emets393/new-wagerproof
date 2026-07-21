import * as React from 'react';
import { useQueries, keepPreviousData } from '@tanstack/react-query';
import { ChevronDown, Layers } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassCard, SkeletonBlock, SkeletonCapsule } from '@/components/ios';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { cn } from '@/lib/utils';
import type { AnalysisResponse, BetGroup, Bar, TrendsSportAdapter } from './adapters/types';
import { filterShownBars, recoverTotalBars, recoverGameLevelOverall } from './adapters/shared';
import { ResultBar } from './SplitBars';

/** How many markets can share the Situations grid at once (2×3). */
const MAX_MARKETS = 6;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Adapter = TrendsSportAdapter<any>;

function marketLabel(betGroups: BetGroup[], key: string): string {
  return betGroups.flatMap((g) => g.items).find((i) => i.key === key)?.label ?? key;
}

/**
 * The bet-market picker lifted from the chat bar, made multi-select (min 1, max 6). Quiet text
 * trigger + grouped menu; toggling keeps the menu open so several markets can be picked at once.
 */
function MarketMultiSelect({
  betGroups,
  selected,
  onToggle,
}: {
  betGroups: BetGroup[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const atCap = selected.length >= MAX_MARKETS;
  const label =
    selected.length === 1 ? marketLabel(betGroups, selected[0]) : `${selected.length} markets`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        >
          <span className="max-w-[140px] truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-56 overflow-y-auto rounded-2xl">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Compare markets · up to {MAX_MARKETS}
        </DropdownMenuLabel>
        {betGroups.map((g) => (
          <React.Fragment key={g.group}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {g.group}
            </DropdownMenuLabel>
            {g.items.map((it) => {
              const checked = selected.includes(it.key);
              return (
                <DropdownMenuCheckboxItem
                  key={it.key}
                  checked={checked}
                  disabled={!checked && atCap}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => onToggle(it.key)}
                  className="rounded-lg text-[13px]"
                >
                  {it.label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One market's situation split-bars (or a shimmer while its analysis loads). */
function SituationPanel({
  betType,
  label,
  analysis,
  loading,
  adapter,
  onFocus,
}: {
  betType: string;
  label: string;
  analysis: AnalysisResponse | undefined;
  loading: boolean;
  adapter: Adapter;
  onFocus?: (dimension: string, side: string) => void;
}) {
  const showsROI = adapter.showsROI(betType);
  const bars = React.useMemo<Bar[]>(() => {
    if (!analysis) return [];
    // standalone panel — show every real split (never hide the side bars the way the hero does)
    let b = filterShownBars(analysis.bars || [], false);
    if (adapter.recoverTotalOverall && adapter.isTotalMarket(betType)) {
      const barN = b.reduce((s, bar) => s + bar.options.reduce((t, o) => t + (o?.n || 0), 0), 0);
      if (barN === 0) {
        const ov =
          analysis.overall && analysis.overall.n > 0
            ? analysis.overall
            : recoverGameLevelOverall(analysis);
        if (ov && ov.n > 0) b = recoverTotalBars(ov);
      }
    }
    return b;
  }, [analysis, adapter, betType]);

  return (
    <div className="rounded-2xl border border-black/5 bg-white/40 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-primary/90">
        {label}
      </div>
      {loading && !analysis ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2">
              <SkeletonBlock className="h-2.5 w-24" />
              <SkeletonCapsule height={10} className="w-full" />
            </div>
          ))}
        </div>
      ) : bars.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No split with enough games.</p>
      ) : (
        <div className="space-y-3">
          {bars.map((bar, i) => (
            <ResultBar
              key={i}
              betType={betType}
              bar={bar}
              baseline={analysis?.baseline_pct ?? 0}
              sideLabel={adapter.sideLabel}
              showsROI={showsROI}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Situations, multi-market: the same filtered games' split-bars for up to 6 bet markets at once,
 * laid out 2×3. Its own market multi-select (top-right) drives which markets show; each market runs
 * the analysis RPC independently (the active market's query key matches the page's, so it's shared,
 * not refetched). Focus-to-filter stays wired only on the active market's panel.
 */
export function SituationsGrid({
  adapter,
  sport,
  filters,
  activeBetType,
  onFocus,
}: {
  adapter: Adapter;
  sport: string;
  filters: Record<string, unknown>;
  activeBetType: string;
  onFocus?: (dimension: string, side: string) => void;
}) {
  const betGroups = adapter.betGroups as BetGroup[];
  const [selected, setSelected] = React.useState<string[]>(() => [activeBetType]);

  // keep the page's primary market present in the grid — switching it via the chat bar adds it
  // (prepended, capped at 6) rather than leaving the grid on a stale market
  React.useEffect(() => {
    setSelected((prev) =>
      prev.includes(activeBetType) ? prev : [activeBetType, ...prev].slice(0, MAX_MARKETS),
    );
  }, [activeBetType]);

  const toggleMarket = (key: string) =>
    setSelected((prev) => {
      if (prev.includes(key)) return prev.length === 1 ? prev : prev.filter((k) => k !== key);
      return prev.length >= MAX_MARKETS ? prev : [...prev, key];
    });

  const results = useQueries({
    queries: selected.map((bt) => ({
      queryKey: ['trends', sport, bt, filters],
      queryFn: async () => {
        const { data, error } = await collegeFootballSupabase.rpc(adapter.analysisRpc, {
          p_bet_type: bt,
          p_filters: filters,
        });
        if (error) throw error;
        return data as AnalysisResponse;
      },
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    })),
  });

  return (
    <GlassCard radius={24} className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="text-sm font-semibold">Situations</div>
            <p className="text-[11px] text-muted-foreground/80">
              {selected.length > 1
                ? `The same games across ${selected.length} markets, split by situation.`
                : 'The same games, split by situation.'}
            </p>
          </div>
        </div>
        <MarketMultiSelect betGroups={betGroups} selected={selected} onToggle={toggleMarket} />
      </div>

      <div className={cn('grid grid-cols-1 items-start gap-4', selected.length > 1 && 'sm:grid-cols-2')}>
        {selected.map((bt, i) => (
          <SituationPanel
            key={bt}
            betType={bt}
            label={marketLabel(betGroups, bt)}
            analysis={results[i]?.data as AnalysisResponse | undefined}
            loading={results[i]?.isLoading ?? true}
            adapter={adapter}
            onFocus={bt === activeBetType ? onFocus : undefined}
          />
        ))}
      </div>
    </GlassCard>
  );
}
