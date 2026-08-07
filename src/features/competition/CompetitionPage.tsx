import * as React from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { FilterPill, SegmentedControl } from '@/components/ios';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { GamePickCard } from './components/GamePickCard';
import { GradedPicksView } from './components/GradedPicksView';
import { LeaderboardTab } from './components/LeaderboardTab';
import { MostPickedTab } from './components/MostPickedTab';
import { MyRecordStrip } from './components/MyRecordStrip';
import { PickTray } from './components/PickTray';
import { RulesTab } from './components/RulesTab';
import {
  dayGroupLabel,
  displayWeekTitle,
  formatCountdown,
  formatDeadlinePair,
  isPracticeWeek,
  timeAgo,
} from './format';
import {
  isPastDeadline,
  isWeekLocked,
  useCompGames,
  useCompLeaderboard,
  useCompWeekStats,
  useEnsureCompTeamAssets,
  useMyCompEntry,
  useNowTicker,
  useResolvedCompWeek,
  useSaveCompPicks,
  useSubmitCompPicks,
} from './hooks';
import type {
  CompDraftPick,
  CompMarket,
  CompSide,
  CompSport,
  CompetitionTab,
} from './types';

/**
 * /competition — weekly NFL/CFB pick'em for Pro subscribers.
 * Server is source of truth for drafts, stamps, and reveal timing.
 */
export default function CompetitionPage() {
  const { user } = useAuth();
  const now = useNowTicker(1000);
  const assetsQ = useEnsureCompTeamAssets();
  const assetsReady = assetsQ.isSuccess;
  const [selectedWeekId, setSelectedWeekId] = React.useState<number | null>(null);
  const [tab, setTab] = React.useState<CompetitionTab>('picks');
  const [sportFilter, setSportFilter] = React.useState<'all' | CompSport>('all');
  const [search, setSearch] = React.useState('');
  const [lbMode, setLbMode] = React.useState<'week' | 'season'>('season');
  const [draft, setDraft] = React.useState<CompDraftPick[]>([]);
  const hydratedRef = React.useRef<number | null>(null);

  const { weeksQ, weeks, week } = useResolvedCompWeek(selectedWeekId, tab);
  const weekId = week?.id;
  const gamesQ = useCompGames(weekId);
  const entryQ = useMyCompEntry(weekId);
  const saveMut = useSaveCompPicks(weekId);
  const submitMut = useSubmitCompPicks(weekId);

  const locked = isWeekLocked(week, now);
  const pastDeadline = isPastDeadline(week, now);
  const statsQ = useCompWeekStats(weekId, pastDeadline && tab === 'most');
  const lbQ = useCompLeaderboard(
    week?.season,
    lbMode === 'week' ? weekId ?? null : null
  );
  // Season standings always — powers the header record strip.
  const seasonLbQ = useCompLeaderboard(week?.season, null);
  const mySeasonRow = React.useMemo(
    () => seasonLbQ.data?.find((r) => r.user_id === user?.id) ?? null,
    [seasonLbQ.data, user?.id]
  );

  const games = gamesQ.data ?? [];
  const gamesById = React.useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  // Hydrate tray from server once per week/entry state (survives navigation).
  React.useEffect(() => {
    if (!weekId || entryQ.data === undefined) return;
    const { entry, picks } = entryQ.data;
    const key = `${weekId}:${entry?.status ?? 'none'}:${entry?.submitted_at ?? ''}:${picks.length}`;
    if (hydratedRef.current === key) return;
    hydratedRef.current = key;
    setDraft(
      picks.map((p) => ({
        game_id: p.game_id,
        market: p.market,
        side: p.side,
        is_potw: p.is_potw,
      }))
    );
  }, [weekId, entryQ.data]);

  const persist = React.useCallback(
    (next: CompDraftPick[]) => {
      setDraft(next);
      if (weekId == null || locked) return;
      const entry = entryQ.data?.entry;
      if (entry?.status === 'submitted') {
        const until = entry.editable_until ? new Date(entry.editable_until).getTime() : 0;
        if (until <= Date.now()) return;
      }
      saveMut.mutate(next);
    },
    [weekId, locked, saveMut, entryQ.data?.entry]
  );

  const selectedByGame = React.useMemo(() => {
    const map = new Map<number, Partial<Record<CompMarket, CompSide>>>();
    for (const p of draft) {
      const cur = map.get(p.game_id) ?? {};
      cur[p.market] = p.side;
      map.set(p.game_id, cur);
    }
    return map;
  }, [draft]);

  const togglePick = (gameId: number, market: CompMarket, side: CompSide) => {
    if (locked) return;
    const entry = entryQ.data?.entry;
    if (entry?.status === 'submitted') {
      const until = entry.editable_until ? new Date(entry.editable_until).getTime() : 0;
      if (until <= now) return;
    }

    const existing = draft.find((p) => p.game_id === gameId && p.market === market);
    let next: CompDraftPick[];
    if (existing && existing.side === side) {
      next = draft.filter((p) => !(p.game_id === gameId && p.market === market));
    } else if (existing) {
      next = draft.map((p) =>
        p.game_id === gameId && p.market === market ? { ...p, side, is_potw: p.is_potw } : p
      );
    } else {
      if (draft.length >= 6) {
        toast.error('max 6 picks');
        return;
      }
      next = [...draft, { game_id: gameId, market, side, is_potw: false }];
    }
    persist(next);
  };

  const starPick = (gameId: number, market: CompMarket) => {
    const next = draft.map((p) => ({
      ...p,
      is_potw: p.game_id === gameId && p.market === market ? !p.is_potw : false,
    }));
    // If toggling off the only star, clear; if toggling on, exclusive.
    const target = draft.find((p) => p.game_id === gameId && p.market === market);
    if (target?.is_potw) {
      persist(draft.map((p) => ({ ...p, is_potw: false })));
      return;
    }
    persist(next.map((p) => ({ ...p, is_potw: p.game_id === gameId && p.market === market })));
  };

  const removePick = (gameId: number, market: CompMarket) => {
    persist(draft.filter((p) => !(p.game_id === gameId && p.market === market)));
  };

  const handleEdit = () => {
    // Re-save current tray → server reverts submitted → draft (clears stamps).
    persist(draft);
  };

  const filteredGames = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return games.filter((g) => {
      if (sportFilter !== 'all' && g.sport !== sportFilter) return false;
      if (!q) return true;
      return (
        g.home_team.toLowerCase().includes(q) || g.away_team.toLowerCase().includes(q)
      );
    });
  }, [games, search, sportFilter]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof filteredGames>();
    for (const g of filteredGames) {
      const label = dayGroupLabel(g.kickoff);
      const list = map.get(label) ?? [];
      list.push(g);
      map.set(label, list);
    }
    return [...map.entries()];
  }, [filteredGames]);

  const booksN = games.find((g) => g.books_n)?.books_n ?? null;
  const linesUpdated = games.find((g) => g.lines_updated_at)?.lines_updated_at ?? null;
  const deadlineMs = week ? Math.max(0, new Date(week.deadline).getTime() - now) : 0;
  const deadlinePair = week ? formatDeadlinePair(week.deadline) : null;
  const practice = isPracticeWeek(week, weeks);
  const weekTitle = displayWeekTitle(week, weeks);

  const showGraded = pastDeadline;
  const entrantEstimate = React.useMemo(() => {
    const rows = statsQ.data ?? [];
    if (!rows.length) return 1;
    const totalPicks = rows.reduce((s, r) => s + Number(r.n_picks), 0);
    return Math.max(1, Math.round(totalPicks / 6));
  }, [statsQ.data]);

  const tray = (
    <PickTray
      picks={draft}
      gamesById={gamesById}
      entry={entryQ.data?.entry ?? null}
      stampedPicks={entryQ.data?.picks ?? []}
      locked={locked}
      now={now}
      saving={saveMut.isPending}
      submitting={submitMut.isPending}
      onStar={starPick}
      onRemove={removePick}
      onSubmit={() => submitMut.mutate()}
      onEdit={handleEdit}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-black/5 bg-background/85 px-4 py-3 backdrop-blur-xl dark:border-white/10 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Competition
              {practice && (
                <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold tracking-[0.08em] text-amber-800 dark:text-amber-200">
                  Practice Round
                </span>
              )}
            </div>
            <h1 className="text-xl font-black tracking-tight md:text-2xl">
              {weeksQ.isLoading ? 'Loading…' : week ? weekTitle : 'No week yet'}
            </h1>
            {practice && (
              <p className="mt-0.5 text-[12px] font-semibold text-amber-800 dark:text-amber-200">
                Practice Round — does not count toward season standings
              </p>
            )}
            {deadlinePair && !pastDeadline && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Picks lock in{' '}
                <span className="font-mono font-bold text-foreground">
                  {formatCountdown(deadlineMs)}
                </span>
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                {deadlinePair.et} · {deadlinePair.local}
              </p>
            )}
            {pastDeadline && (
              <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground">
                This week is locked · picks revealed
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <MyRecordStrip row={mySeasonRow} practice={practice} />
            {weeks.length > 0 && (
              <FilterPill
                label="Week"
                value={String(week?.id ?? '')}
                onChange={(v) => setSelectedWeekId(Number(v))}
                options={weeks.map((w) => ({
                  value: String(w.id),
                  label: displayWeekTitle(w, weeks),
                }))}
              />
            )}
          </div>
        </div>

        <div className="mt-3">
          <SegmentedControl
            layoutId="comp-main-tabs"
            size="sm"
            options={[
              { value: 'picks' as const, label: 'My Picks' },
              { value: 'most' as const, label: 'Most Picked' },
              { value: 'leaderboard' as const, label: 'Leaderboard' },
              { value: 'rules' as const, label: 'Rules' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'picks' && (
          <div className="flex h-full min-h-0 flex-col lg:flex-row">
            {/* Mobile: tray first so Submit is on-screen without scrolling the slate. */}
            {!showGraded && (
              <div className="shrink-0 border-b border-black/5 bg-background/95 p-2 backdrop-blur-xl dark:border-white/10 lg:hidden">
                <div className="flex max-h-[min(42vh,380px)] min-h-0 flex-col">{tray}</div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 lg:pb-4">
              {showGraded ? (
                <GradedPicksView
                  picks={entryQ.data?.picks ?? []}
                  gamesById={gamesById}
                />
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[180px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search teams…"
                        className="h-9 w-full rounded-full border border-black/5 bg-white/60 pl-9 pr-3 text-[13px] font-semibold backdrop-blur-xl outline-none placeholder:text-muted-foreground focus:border-amber-500/40 dark:border-white/10 dark:bg-white/[0.06]"
                      />
                    </div>
                    <div className="flex gap-1 rounded-full border border-black/5 bg-white/60 p-0.5 dark:border-white/10 dark:bg-white/[0.06]">
                      {(['all', 'nfl', 'cfb'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSportFilter(s)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-[12px] font-bold uppercase',
                            sportFilter === s
                              ? 'bg-amber-500/20 text-amber-900 dark:text-amber-100'
                              : 'text-muted-foreground'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {gamesQ.isLoading || weeksQ.isLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted/40" />
                      ))}
                    </div>
                  ) : games.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-[13px] text-muted-foreground dark:border-white/15">
                      No eligible games for this week yet. The sync job fills the slate
                      automatically.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {grouped.map(([label, list]) => (
                        <section key={label}>
                          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            {label}
                          </h2>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {list.map((g) => (
                              <GamePickCard
                                key={`${g.id}-${assetsReady ? 'a' : 'p'}`}
                                game={g}
                                selected={selectedByGame.get(g.id) ?? {}}
                                locked={
                                  locked ||
                                  (entryQ.data?.entry?.status === 'submitted' &&
                                    !(
                                      entryQ.data.entry.editable_until &&
                                      new Date(entryQ.data.entry.editable_until).getTime() > now
                                    ))
                                }
                                onToggle={(m, s) => togglePick(g.id, m, s)}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                      <p className="pb-4 text-center text-[11px] text-muted-foreground">
                        Consensus of {booksN ?? '—'} books · updated {timeAgo(linesUpdated)} ·{' '}
                        <strong>your lines lock when you submit</strong>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Desktop tray */}
            {!showGraded && (
              <aside className="hidden w-[360px] shrink-0 border-l border-black/5 p-4 dark:border-white/10 lg:block">
                <div className="sticky top-4 h-[calc(100vh-12rem)] min-h-0">{tray}</div>
              </aside>
            )}
          </div>
        )}

        {tab === 'most' && (
          <div className="h-full overflow-y-auto px-4 py-4 md:px-6">
            <MostPickedTab
              week={week}
              now={now}
              pastDeadline={pastDeadline}
              stats={statsQ.data}
              gamesById={gamesById}
              isLoading={statsQ.isLoading}
              error={
                statsQ.isError
                  ? (statsQ.error as Error)?.message ?? 'Could not load stats'
                  : null
              }
              entrantEstimate={entrantEstimate}
            />
          </div>
        )}

        {tab === 'leaderboard' && (
          <div className="h-full overflow-y-auto px-4 py-4 md:px-6">
            <LeaderboardTab
              mode={lbMode}
              onModeChange={setLbMode}
              rows={lbQ.data}
              isLoading={lbQ.isLoading}
              error={lbQ.isError ? (lbQ.error as Error)?.message ?? 'Could not load' : null}
            />
          </div>
        )}

        {tab === 'rules' && (
          <div className="h-full overflow-y-auto px-4 py-4 md:px-6">
            <RulesTab />
          </div>
        )}
      </div>
    </div>
  );
}
