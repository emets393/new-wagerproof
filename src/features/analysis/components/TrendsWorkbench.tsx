import * as React from 'react';
import { flushSync } from 'react-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AlertTriangle, Bookmark, Ellipsis, Plus, Save, SlidersHorizontal, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import { GlassCard } from '@/components/ios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { TrendsChatBar } from './TrendsChatBar';
import { TrendsSkeleton } from './TrendsSkeleton';
import { RecentSearchesDock } from './RecentSearchesDock';
import { useTrendsRecents } from './useTrendsRecents';
import { SaveSystemDialog } from '../systems/SaveSystemDialog';
import { MySystemsSheet } from '../systems/MySystemsSheet';
import { SystemsLeaderboardDialog } from '../systems/SystemsLeaderboardDialog';
import { useSaveSystem } from '../systems/useAnalysisSystems';
import {
  isSport,
  verdictSideWord,
  type LeaderboardSystem,
  type SavedSystemRow,
  type SystemVerdict,
} from '../systems/analysisSystemsService';

type ViewingSystem = {
  name: string;
  username: string;
  verdict: SystemVerdict;
  /** Own My Systems restore — copy differs from leaderboard click-through. */
  own?: boolean;
};

const TOAST = { duration: 2400 } as const;

/**
 * Debounce a value. When `flushKey` increments, commit immediately during render
 * (My Systems / leaderboard restore) so betType + filters never query as a mismatched
 * pair and stale empty keepPreviousData isn't painted under the new chips.
 */
function useDebouncedValue<T>(value: T, delay: number, flushKey = 0): T {
  const [v, setV] = React.useState(value);
  const key = JSON.stringify(value);
  const prevFlush = React.useRef(flushKey);
  const flushing = flushKey !== prevFlush.current;
  if (flushing) {
    prevFlush.current = flushKey;
    setV(value);
  }

  React.useEffect(() => {
    if (flushing) return;
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay, flushKey]);

  return flushing ? value : v;
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
  onApplySystem,
  viewingSystem,
  setViewingSystem,
  filtersOpen,
  setFiltersOpen,
  resultsTopRef,
  restoreNonce,
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
  /** Apply a saved/leaderboard system — may switch sport. */
  onApplySystem: (args: {
    targetSport: Sport;
    filters: Record<string, unknown>;
    betType: string;
    viewing?: ViewingSystem;
  }) => void;
  viewingSystem: ViewingSystem | null;
  setViewingSystem: (next: ViewingSystem | null) => void;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  resultsTopRef: React.RefObject<HTMLDivElement | null>;
  /** Incremented on My Systems / leaderboard restore — flushes the query debounce. */
  restoreNonce: number;
}) {
  const { user } = useAuth();
  const data = adapter.useAdapterData();
  const { recents, push, remove, clear } = useTrendsRecents(sport);
  const [processing, setProcessing] = React.useState(false);
  const isXl = useIsXl();
  const betType = String(snapshot.betType);

  const [saveOpen, setSaveOpen] = React.useState(false);
  const [mySystemsOpen, setMySystemsOpen] = React.useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = React.useState(false);
  const saveMutation = useSaveSystem();

  const rpcFilters = React.useMemo(() => adapter.toRpcFilters(snapshot, data), [adapter, snapshot, data]);
  // Debounce betType + filters as one payload. Updating betType immediately while filters
  // lagged 350ms used to fire a mismatched RPC that could paint "No games match".
  const queryPayload = React.useMemo(
    () => ({ betType, filters: rpcFilters }),
    [betType, rpcFilters],
  );
  const debounced = useDebouncedValue(queryPayload, 350, restoreNonce);
  const queryBetType = debounced.betType;
  const queryFilters = debounced.filters;

  const analysisQuery = useQuery({
    queryKey: ['trends', sport, queryBetType, queryFilters],
    queryFn: async () => {
      const { data: res, error } = await collegeFootballSupabase.rpc(adapter.analysisRpc, {
        p_bet_type: queryBetType,
        p_filters: queryFilters,
      });
      if (error) throw error;
      return res as AnalysisResponse;
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const upcomingFilters = adapter.upcomingRpcFilters
    ? adapter.upcomingRpcFilters(snapshot, queryFilters)
    : queryFilters;
  const upcomingQuery = useQuery({
    queryKey: ['trends-upcoming', sport, queryBetType, upcomingFilters],
    queryFn: async () => {
      const { data: res, error } = await collegeFootballSupabase.rpc(adapter.upcomingRpc, {
        p_bet_type: queryBetType,
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

  const handleSaveSystem = (args: { name: string; verdict: SystemVerdict; isPublic: boolean }) => {
    saveMutation.mutate(
      {
        sport,
        name: args.name,
        betType,
        filters: snapshot,
        verdict: args.verdict,
        rpcFilters,
        isPublic: args.isPublic,
      },
      {
        onSuccess: () => {
          setSaveOpen(false);
          if (args.isPublic) {
            toast.success('System saved & shared — scoring for the leaderboard…', {
              duration: 3600,
            });
          } else {
            toast.success('System saved (private — turn Share on to list it)', TOAST);
          }
        },
        onError: () => toast.error("Couldn't save system, try again.", TOAST),
      },
    );
  };

  const coerceFilters = (raw: unknown): Record<string, unknown> => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  };

  const handleApplyMySystem = (row: SavedSystemRow) => {
    const verdict = row.verdict;
    onApplySystem({
      targetSport: row.sport,
      filters: coerceFilters(row.filters),
      betType: row.bet_type,
      viewing:
        verdict != null
          ? { name: row.name, username: 'you', verdict, own: true }
          : undefined,
    });
    setMySystemsOpen(false);
  };

  const handleApplyLeaderboardSystem = (sys: LeaderboardSystem) => {
    const target: Sport = isSport(sys.sport) ? sys.sport : sport;
    const viewing: ViewingSystem = {
      name: sys.name,
      username: sys.username,
      verdict: sys.verdict,
    };
    onApplySystem({
      targetSport: target,
      filters: coerceFilters(sys.filters),
      betType: sys.bet_type,
      viewing,
    });
    setLeaderboardOpen(false);
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
            <div ref={resultsTopRef} className="min-w-0 flex-1 space-y-4">
              {viewingSystem && (
                <div
                  className={cn(
                    'flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3.5 py-3',
                  )}
                >
                  <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground">
                    {viewingSystem.own ? (
                      <>
                        Viewing your system <span className="font-bold">{viewingSystem.name}</span>
                        {viewingSystem.verdict
                          ? ` — bets ${verdictSideWord(viewingSystem.verdict)}`
                          : ''}
                        .
                      </>
                    ) : (
                      <>
                        Viewing {viewingSystem.name} by {viewingSystem.username} — bets{' '}
                        {verdictSideWord(viewingSystem.verdict)}. Save your own copy to track it.
                      </>
                    )}
                  </p>
                  {user && !viewingSystem.own && (
                    <button
                      type="button"
                      onClick={() => setSaveOpen(true)}
                      className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
                    >
                      Save
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setViewingSystem(null)}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex items-center gap-1 rounded-full border border-black/5 bg-white/60 p-1 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
                  {user && (
                    <button
                      type="button"
                      aria-label="Save current system"
                      title="Save current system"
                      onClick={() => setSaveOpen(true)}
                      className="grid h-8 w-8 place-items-center rounded-full text-foreground transition-colors hover:bg-primary/12 hover:text-primary active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Systems leaderboard"
                    title="Systems leaderboard"
                    onClick={() => setLeaderboardOpen(true)}
                    className="grid h-8 w-8 place-items-center rounded-full text-foreground transition-colors hover:bg-amber-500/12 hover:text-amber-500 active:scale-95"
                  >
                    <Trophy className="h-4 w-4" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="More system options"
                        title="More system options"
                        className="grid h-8 w-8 place-items-center rounded-full text-foreground transition-colors hover:bg-muted active:scale-95"
                      >
                        <Ellipsis className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-xl">
                      {user && (
                        <>
                          <DropdownMenuItem className="gap-2 rounded-lg" onSelect={() => setSaveOpen(true)}>
                            <Save className="h-4 w-4" /> Save current system
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 rounded-lg" onSelect={() => setMySystemsOpen(true)}>
                            <Bookmark className="h-4 w-4" /> My Systems
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem className="gap-2 rounded-lg" onSelect={() => setLeaderboardOpen(true)}>
                        <Trophy className="h-4 w-4" /> Systems Leaderboard
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
                ) : isFetching ? (
                  // Stale keepPreviousData can be empty while the restored-system query is in flight —
                  // never flash "No games" over chips that already show the new filters.
                  <TrendsSkeleton showsROI={showsROI} />
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
                    filters={queryFilters}
                    activeBetType={queryBetType}
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

      <SaveSystemDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        sport={sport}
        betType={betType}
        snapshot={snapshot}
        patchFilters={update}
        saving={saveMutation.isPending}
        onSave={handleSaveSystem}
      />
      <MySystemsSheet
        open={mySystemsOpen}
        onOpenChange={setMySystemsOpen}
        currentSport={sport}
        onApply={handleApplyMySystem}
        onSaveCurrent={() => {
          setMySystemsOpen(false);
          requestAnimationFrame(() => setSaveOpen(true));
        }}
        onOpenLeaderboard={() => {
          setMySystemsOpen(false);
          requestAnimationFrame(() => setLeaderboardOpen(true));
        }}
      />
      <SystemsLeaderboardDialog
        open={leaderboardOpen}
        onOpenChange={setLeaderboardOpen}
        initialSport={sport}
        onApplySystem={handleApplyLeaderboardSystem}
        onOpenMySystems={
          user
            ? () => {
                setLeaderboardOpen(false);
                requestAnimationFrame(() => setMySystemsOpen(true));
              }
            : undefined
        }
      />
    </div>
  );
}

/**
 * Outer workbench — owns the per-sport snapshot record (session memory), the URL sync, and the
 * drawer open state. There's no page-level header (the title lives in the breadcrumb); systems
 * controls + the filter summon render inside the results column. Sport + bet-market switching lives
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
  const [viewingSystem, setViewingSystem] = React.useState<ViewingSystem | null>(null);
  const [restoreNonce, setRestoreNonce] = React.useState(0);
  const resultsTopRef = React.useRef<HTMLDivElement | null>(null);

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

  /**
   * Restore a system onto the right sport's snapshot, switching sport in the URL when needed.
   * flushSync so keyed SportWorkbench remounts (sport change) already sees the restored
   * snapshot — otherwise the URL can flip a frame early and paint defaults.
   * restoreNonce flushes the query debounce so the RPC fires with the restored bet+filters
   * immediately (no 350ms mismatched pair).
   */
  const applySystem = (args: {
    targetSport: Sport;
    filters: Record<string, unknown>;
    betType: string;
    viewing?: ViewingSystem;
  }) => {
    const targetAdapter = TREND_ADAPTERS[args.targetSport];
    const raw = { ...args.filters };
    if (args.betType) raw.betType = args.betType;
    const next = targetAdapter.normalize(raw, args.betType);
    flushSync(() => {
      setSnapshots((prev) => ({ ...prev, [args.targetSport]: next }));
      setViewingSystem(args.viewing ?? null);
      setRestoreNonce((n) => n + 1);
    });
    setUrl(args.targetSport, String(next.betType));
    // Next paint: scroll hero into view so "system page" is obvious after the sheet closes.
    requestAnimationFrame(() => {
      resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSportChange = (next: Sport) => {
    setViewingSystem(null);
    setUrl(next, String(snapshots[next].betType));
  };

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
      onApplySystem={applySystem}
      viewingSystem={viewingSystem}
      setViewingSystem={setViewingSystem}
      filtersOpen={filtersOpen}
      setFiltersOpen={setFiltersOpen}
      resultsTopRef={resultsTopRef}
      restoreNonce={restoreNonce}
    />
  );
}
