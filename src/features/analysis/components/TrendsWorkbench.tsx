import * as React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { GlassCard } from '@/components/ios';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { TREND_ADAPTERS } from '../sportAdapters';
import type { Sport } from './adapters/types';
import type { AnalysisResponse, Overall, TrendsSportAdapter } from './adapters/types';
import { pickSideSlices, recoverGameLevelOverall } from './adapters/shared';
import { CoverageBadge } from './CoverageBadge';
import { TrendsHero, SymmetricSplitHero } from './TrendsHero';
import { BreakdownTable } from './BreakdownTable';
import { SituationsGrid } from './SituationsGrid';
import { UpcomingMatches } from './UpcomingMatches';
import { FilterDrawer, InlineFilterPanel, useIsXl } from './FilterDrawer';
import { SavedFiltersMenu } from './SavedFiltersMenu';
import { TrendsChatBar } from './TrendsChatBar';
import { TrendsSkeleton } from './TrendsSkeleton';
import { RecentSearchesDock } from './RecentSearchesDock';
import { useTrendsRecents } from './useTrendsRecents';

const TOAST = { duration: 2400 } as const;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [v, setV] = React.useState(value);
  const key = JSON.stringify(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay]);
  return v;
}

function validBetType(adapter: TrendsSportAdapter, bt?: string): string {
  if (!bt) return adapter.defaultBetType;
  const all = adapter.betGroups.flatMap((g) => g.items.map((i) => i.key));
  return all.includes(bt) ? bt : adapter.defaultBetType;
}

/**
 * Inner, per-sport workbench — keyed by sport so the active adapter's hooks (useAdapterData, the
 * two RQ queries, recents) stay in a stable order across renders. Owns data fetch, the chat
 * round-trip, the filter drawer, and the bottom dock; snapshot state itself lives in the outer
 * component so it survives sport switches.
 */
function SportWorkbench({
  adapter,
  sport,
  snapshot,
  update,
  setSnapshot,
  resetAll,
  onSportChange,
  onBetTypeChange,
  onApplyPreset,
  onRestoreSaved,
  filtersOpen,
  setFiltersOpen,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: TrendsSportAdapter<any>;
  sport: Sport;
  snapshot: Record<string, unknown>;
  update: (patch: Record<string, unknown>) => void;
  setSnapshot: (next: Record<string, unknown>) => void;
  resetAll: () => void;
  onSportChange: (s: Sport) => void;
  onBetTypeChange: (bt: string) => void;
  onApplyPreset: (preset: (typeof adapter.presets)[number]) => void;
  onRestoreSaved: (filters: Record<string, unknown>, betType: string) => void;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const data = adapter.useAdapterData();
  const { recents, push, remove, clear } = useTrendsRecents(sport);
  const [processing, setProcessing] = React.useState(false);
  const isXl = useIsXl();
  const betType = String(snapshot.betType);

  const rpcFilters = React.useMemo(() => adapter.toRpcFilters(snapshot, data), [adapter, snapshot, data]);
  const debounced = useDebouncedValue(rpcFilters, 350);

  const analysisQuery = useQuery({
    queryKey: ['trends', sport, betType, debounced],
    queryFn: async () => {
      const { data: res, error } = await collegeFootballSupabase.rpc(adapter.analysisRpc, {
        p_bet_type: betType,
        p_filters: debounced,
      });
      if (error) throw error;
      return res as AnalysisResponse;
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const upcomingFilters = adapter.upcomingRpcFilters
    ? adapter.upcomingRpcFilters(snapshot, debounced)
    : debounced;
  const upcomingQuery = useQuery({
    queryKey: ['trends-upcoming', sport, betType, upcomingFilters],
    queryFn: async () => {
      const { data: res, error } = await collegeFootballSupabase.rpc(adapter.upcomingRpc, {
        p_bet_type: betType,
        p_filters: upcomingFilters,
      });
      if (error) throw error;
      return (res as Record<string, unknown>[]) || [];
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const analysis = (analysisQuery.data as AnalysisResponse | undefined) ?? null;
  const upcoming = (upcomingQuery.data as Record<string, unknown>[] | undefined) ?? [];
  const isFetching = analysisQuery.isFetching;
  const firstLoad = analysisQuery.isLoading;
  const fetchError = analysisQuery.error ? 'Something went wrong loading this analysis. Try adjusting the filters.' : null;

  const isTotalMkt = adapter.isTotalMarket(betType);
  const overall = React.useMemo<Overall | null>(() => {
    if (!analysis) return null;
    if (analysis.overall && analysis.overall.n > 0) return analysis.overall;
    if (adapter.recoverTotalOverall && isTotalMkt) return recoverGameLevelOverall(analysis);
    return analysis.overall;
  }, [analysis, adapter, isTotalMkt]);

  const symmetricSlices = React.useMemo(() => {
    if (!analysis || !adapter.isSideSymmetric(snapshot)) return null;
    const sl = pickSideSlices(analysis.bars);
    return sl.length ? sl : null;
  }, [analysis, adapter, snapshot]);

  const breakdownTabs = React.useMemo(
    () => (analysis ? adapter.breakdownTabs(snapshot, analysis) : []),
    [analysis, adapter, snapshot],
  );

  const chips = React.useMemo(() => adapter.activeChips(snapshot), [adapter, snapshot]);
  const drawerMeta = React.useMemo(
    () => ({
      snapshot,
      defaults: adapter.reset(betType) as Record<string, unknown>,
      groupFields: adapter.groupFields,
    }),
    [adapter, snapshot, betType],
  );

  const limited = adapter.limitedBetTypes.has(betType);
  const showsROI = adapter.showsROI(betType);
  const focusSide = (dimension: string, side: string) => update(adapter.focusSide(snapshot, dimension, side));

  const sendChat = async (sentence: string) => {
    if (!user || processing) return;
    setProcessing(true);
    push(sentence);
    try {
      const currentFilter = adapter.toCurrentFilterPayload(snapshot);
      const body = { sentence, currentFilter, sport, ...adapter.chatBodyExtras(data) };
      const { data: patchData, error } = await supabase.functions.invoke('nl-filter-patch', { body });
      if (error || (patchData && patchData.error)) {
        toast.error("Couldn't process that, try again.", TOAST);
        return;
      }
      const ops = Array.isArray(patchData?.ops) ? patchData.ops : [];
      const result = adapter.applyChat(snapshot, ops, { sentence, data });
      if (result.applied.length) setSnapshot(result.snapshot);
      const skipped =
        (patchData?.couldnt_map?.length ?? 0) + (patchData?.ambiguous?.length ?? 0) + result.rejected.length;
      if (result.applied.length) {
        toast.success(
          `Updated ${result.applied.length} filter${result.applied.length === 1 ? '' : 's'}${skipped > 0 ? ` · ${skipped} skipped` : ''}`,
          TOAST,
        );
      } else if (patchData?.noChange || (result.noChange && ops.length > 0 && skipped === 0)) {
        toast.success('Filters already match that', TOAST);
      } else if (skipped > 0) {
        toast("Couldn't map that — try rephrasing", TOAST);
      } else {
        toast("I didn't catch a filter in that", TOAST);
      }
    } catch {
      toast.error("Couldn't process that, try again.", TOAST);
    } finally {
      setProcessing(false);
    }
  };

  const upcomingNode =
    analysis && upcoming.length > 0 ? (
      <UpcomingMatches
        games={upcoming}
        betType={betType}
        title={adapter.upcomingLabel(upcoming.length)}
        note={adapter.upcomingNote ? adapter.upcomingNote(snapshot, upcomingFilters) : null}
        lineForBet={adapter.lineForBet}
        timeLabel={adapter.upcomingTime}
        logoForGame={(g) => adapter.logoFor({ ...g, n: 0, hit_pct: 0, roi: null }, breakdownTabs[0], data)}
        chipsFor={adapter.upcomingChips}
        onChipClick={
          adapter.upcomingChips
            ? (g, chip) => {
                // MLB: tapping an opposing-starter chip focuses that pitcher matchup.
                if (g.opp_sp_id != null && chip === String(g.opp_sp_name ?? '')) {
                  const patch: Record<string, unknown> = {
                    oppSp: [
                      {
                        id: Number(g.opp_sp_id),
                        name: String(g.opp_sp_name),
                        hand: g.opp_sp_hand ? String(g.opp_sp_hand) : null,
                        team: g.opponent ? String(g.opponent) : null,
                      },
                    ],
                  };
                  if (g.team) patch.teams = [String(g.team)];
                  update(patch);
                }
              }
            : undefined
        }
      />
    ) : null;

  const filterPanelProps = {
    meta: drawerMeta,
    chips,
    onClearChip: (patch: Record<string, unknown>) => update(patch),
    onResetAll: resetAll,
  };

  return (
    // full-height column: everything above scrolls internally, the chat dock pins to the bottom
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-44 pt-6 md:px-8 md:pt-8">
        {/* container widens when the inline panel takes its column — content shifts, never overlaps */}
        <div
          className={cn(
            'mx-auto w-full transition-[max-width] duration-300 ease-out',
            filtersOpen && isXl ? 'max-w-7xl' : 'max-w-4xl',
          )}
        >
          <div className="flex items-start gap-6">
            {/* results — kept mounted across refetches (dim, don't unmount) */}
            <div className="min-w-0 flex-1 space-y-4">
              {/* saved filters + filter summon sit above the first card — the page title lives
                  in the breadcrumb, so there's no header row up top */}
              <div className="flex items-center justify-end gap-2">
                <SavedFiltersMenu
                  table={adapter.savedTable}
                  betType={betType}
                  buildSnapshot={() => snapshot}
                  onRestore={onRestoreSaved}
                />
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-all duration-200 active:scale-95',
                    chips.length > 0
                      ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
                      : 'border-black/5 bg-white/60 text-foreground hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]',
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {chips.length > 0 && (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground">
                      {chips.length}
                    </span>
                  )}
                </button>
              </div>
              {fetchError && (
                <div className="flex items-center gap-2 text-sm font-medium text-orange-500">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {fetchError}
                </div>
              )}
              <div className={cn('space-y-4 transition-opacity duration-300', isFetching && analysis && 'opacity-55')}>
                <CoverageBadge data={analysis} loading={firstLoad} limited={limited} mlbCoverageText={sport === 'mlb'} />

                {firstLoad ? (
                  <TrendsSkeleton showsROI={showsROI} />
                ) : symmetricSlices ? (
                  <SymmetricSplitHero
                    betType={betType}
                    slices={symmetricSlices}
                    data={analysis!}
                    sideLabel={adapter.sideLabel}
                    isMoneyline={betType.includes('ml')}
                    showsROI={showsROI}
                    limited={limited}
                    onFocus={focusSide}
                  />
                ) : overall && analysis && overall.n > 0 ? (
                  <TrendsHero
                    betType={betType}
                    overall={overall}
                    data={analysis}
                    subject={adapter.headlineSubject(snapshot, analysis)}
                    scopeNote={adapter.scopeNote(snapshot, data)}
                    verb={adapter.verb(betType)}
                    nounFor={adapter.nounFor(betType)}
                    outcomeWord={adapter.outcomeWord(betType)}
                    showsROI={showsROI}
                    limited={limited}
                  />
                ) : (
                  <GlassCard radius={24} className="p-8 text-center text-sm text-muted-foreground">
                    No games match these filters — try widening them.
                  </GlassCard>
                )}

                {/* situations, multi-market: same filtered games' splits for up to 6 markets (2×3) */}
                {analysis && (
                  <SituationsGrid
                    adapter={adapter}
                    sport={sport}
                    filters={debounced}
                    activeBetType={betType}
                    onFocus={focusSide}
                  />
                )}

                {analysis && (
                  <BreakdownTable
                    baseline={analysis.baseline_pct}
                    tabs={breakdownTabs}
                    outcomeWord={adapter.outcomeWord(betType)}
                    showsROI={showsROI}
                    logoFor={(row, tab) => adapter.logoFor(row, tab, data)}
                    upcoming={upcomingNode}
                    upcomingCount={upcoming.length}
                  />
                )}
              </div>
            </div>

            {/* xl+: filters live beside the data so tweaks read back instantly */}
            {isXl && (
              <InlineFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} {...filterPanelProps}>
                <adapter.RailSections snapshot={snapshot} update={update} data={data} />
              </InlineFilterPanel>
            )}
          </div>
        </div>
      </div>

      {/* below xl there's no room to split the viewport — same panel as a modal sheet */}
      {!isXl && (
        <FilterDrawer open={filtersOpen} onOpenChange={setFiltersOpen} {...filterPanelProps}>
          <adapter.RailSections snapshot={snapshot} update={update} data={data} />
        </FilterDrawer>
      )}

      <TrendsChatBar
        examples={adapter.nlExamples}
        presets={adapter.presets}
        onApplyPreset={onApplyPreset}
        processing={processing}
        signedIn={!!user}
        onSend={sendChat}
        sport={sport}
        onSportChange={onSportChange}
        betGroups={adapter.betGroups}
        betType={betType}
        onBetTypeChange={onBetTypeChange}
        filtersActive={chips.length}
        onOpenFilters={() => setFiltersOpen(true)}
        leftAccessory={
          <RecentSearchesDock
            recents={recents}
            onPick={sendChat}
            onRemove={remove}
            onClear={clear}
            disabled={processing || !user}
          />
        }
      />
    </div>
  );
}

/**
 * Outer workbench — owns the per-sport snapshot record (session memory), the URL sync, and the
 * drawer open state. There's no page-level header (the title lives in the breadcrumb); saved
 * filters + the filter summon render inside the results column. Sport + bet-market switching lives
 * in the bottom dock (TrendsChatBar). Renders the keyed inner workbench.
 */
export function TrendsWorkbench({
  sport,
  betType,
  setUrl,
}: {
  sport: Sport;
  betType?: string;
  setUrl: (sport: Sport, betType: string) => void;
}) {
  // one snapshot per sport, initialized once (URL bet hydrates the active sport)
  const [snapshots, setSnapshots] = React.useState<Record<Sport, Record<string, unknown>>>(() => ({
    nfl: TREND_ADAPTERS.nfl.reset(validBetType(TREND_ADAPTERS.nfl, sport === 'nfl' ? betType : undefined)),
    cfb: TREND_ADAPTERS.cfb.reset(validBetType(TREND_ADAPTERS.cfb, sport === 'cfb' ? betType : undefined)),
    mlb: TREND_ADAPTERS.mlb.reset(validBetType(TREND_ADAPTERS.mlb, sport === 'mlb' ? betType : undefined)),
  }));
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const adapter = TREND_ADAPTERS[sport];
  const snapshot = snapshots[sport];
  const activeBet = String(snapshot.betType);

  // keep the URL bet in sync with the active snapshot's bet type
  React.useEffect(() => {
    setUrl(sport, activeBet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, activeBet]);

  const update = (patch: Record<string, unknown>) =>
    setSnapshots((prev) => ({ ...prev, [sport]: { ...prev[sport], ...patch } }));
  const setSnapshot = (next: Record<string, unknown>) =>
    setSnapshots((prev) => ({ ...prev, [sport]: next }));

  const setBetType = (bt: string) =>
    setSnapshots((prev) => ({ ...prev, [sport]: adapter.withBetType(prev[sport], bt) }));
  const resetAll = () => setSnapshots((prev) => ({ ...prev, [sport]: adapter.reset(activeBet) }));
  const applyPreset = (preset: (typeof adapter.presets)[number]) =>
    setSnapshots((prev) => ({ ...prev, [sport]: adapter.applyPreset(preset) }));
  const restoreSaved = (filters: Record<string, unknown>, savedBet: string) =>
    setSnapshots((prev) => ({ ...prev, [sport]: adapter.normalize(filters, savedBet) }));

  const handleSportChange = (next: Sport) => setUrl(next, String(snapshots[next].betType));

  // No page-level header: the title lives in the breadcrumb, and the saved-filters + filter
  // controls render inside the results column (above the first card) via SportWorkbench.
  return (
    <SportWorkbench
      key={sport}
      adapter={adapter}
      sport={sport}
      snapshot={snapshot}
      update={update}
      setSnapshot={setSnapshot}
      resetAll={resetAll}
      onSportChange={handleSportChange}
      onBetTypeChange={setBetType}
      onApplyPreset={applyPreset}
      onRestoreSaved={restoreSaved}
      filtersOpen={filtersOpen}
      setFiltersOpen={setFiltersOpen}
    />
  );
}
