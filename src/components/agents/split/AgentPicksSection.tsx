import * as React from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, History, Lock, Search, Target, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FilterPill, GlassCard, WidgetCard } from '@/components/ios';
import { AgentPickCard, parseMatchup, PickRouteRow, teamAbbr } from '../AgentPickCard';
import { AgentParlayCard } from '../AgentParlayCard';
import { AgentTicketShell, resolveTicketLogo, TICKET_STATUS, TicketSportIcon, teamColorPair } from '../AgentTicketShell';
import { useAgentParlays, useAgentPicks } from '@/hooks/useAgents';
import {
  AgentParlay,
  AgentPick,
  PICK_RESULTS,
  PickResult,
  SPORTS,
  Sport,
} from '@/types/agent';

function LockedPlaceholderCard() {
  return (
    <GlassCard radius={16} className="flex min-h-[150px] flex-col items-center justify-center gap-2 p-4">
      <Lock className="h-6 w-6 text-muted-foreground" />
      <p className="text-center text-sm text-muted-foreground">Upgrade to Pro to view picks</p>
    </GlassCard>
  );
}

// History mixes straight picks (avatar_picks) and parlay tickets
// (avatar_parlays) — parlay agents write ONLY to the latter, so without this
// merge their history renders empty.
export type AgentHistoryItem =
  | { kind: 'pick'; date: string; createdAt: string; pick: AgentPick }
  | { kind: 'parlay'; date: string; createdAt: string; parlay: AgentParlay };

type HistoryItem = AgentHistoryItem;

function useTicketScroller(itemCount: number) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = React.useState({ overflow: false, left: false, right: false });

  React.useLayoutEffect(() => {
    const viewport = ref.current;
    if (!viewport) return;
    const update = () => setBounds({
      overflow: viewport.scrollWidth > viewport.clientWidth + 2,
      left: viewport.scrollLeft > 2,
      right: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 2,
    });
    update();
    viewport.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    return () => {
      viewport.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [itemCount]);

  const scroll = (direction: -1 | 1) => ref.current?.scrollBy({ left: direction * 190, behavior: 'smooth' });
  return { ref, bounds, scroll };
}

function TicketScrollerButtons({ bounds, onPrevious, onNext }: { bounds: { overflow: boolean; left: boolean; right: boolean }; onPrevious: () => void; onNext: () => void }) {
  return (
    <div className={`ml-auto flex items-center gap-1 transition-all duration-200 ${bounds.overflow ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'}`} aria-hidden={!bounds.overflow}>
      <button type="button" onClick={onPrevious} disabled={!bounds.left} aria-label="Previous tickets" className="grid h-7 w-7 place-items-center rounded-full border border-border/60 bg-background/65 text-foreground shadow-sm transition hover:bg-background disabled:cursor-default disabled:opacity-30">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" onClick={onNext} disabled={!bounds.right} aria-label="Next tickets" className="grid h-7 w-7 place-items-center rounded-full border border-border/60 bg-background/65 text-foreground shadow-sm transition hover:bg-background disabled:cursor-default disabled:opacity-30">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function TicketDayScroller({ date, items, accent, selectedTicketId, onSelect, compact = false }: { date: string; items: HistoryItem[]; accent?: string; selectedTicketId: string | null; onSelect: (item: HistoryItem) => void; compact?: boolean }) {
  const scroller = useTicketScroller(items.length);
  return (
    <section>
      <div className={`mb-2 flex items-center gap-2 ${compact ? '' : 'px-1'}`}>
        <p className={compact ? 'text-sm font-black' : 'text-xs font-bold text-foreground'}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, compact ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'long' })}</p>
        <span className={compact ? 'text-[11px] text-muted-foreground' : 'text-[10px] text-muted-foreground'}>{items.length} ticket{items.length === 1 ? '' : 's'}</span>
        <TicketScrollerButtons bounds={scroller.bounds} onPrevious={() => scroller.scroll(-1)} onNext={() => scroller.scroll(1)} />
      </div>
      <div ref={scroller.ref} className={`${compact ? '' : '-mr-4 pr-4 pt-1'} overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        <div className="flex w-max snap-x snap-mandatory gap-3 pr-10">
          {items.map((item) => {
            const id = item.kind === 'pick' ? item.pick.id : item.parlay.id;
            return <MiniHistoryTicket key={id} item={item} accent={accent} selected={selectedTicketId === id} onSelect={() => onSelect(item)} />;
          })}
        </div>
      </div>
    </section>
  );
}

const RESULT_STYLE: Record<PickResult, string> = {
  won: 'bg-emerald-500/15 text-emerald-500',
  lost: 'bg-red-500/15 text-red-500',
  push: 'bg-amber-500/15 text-amber-500',
  pending: 'bg-slate-500/15 text-slate-400',
};

export function MiniHistoryTicket({ item, accent, selected, onSelect }: { item: HistoryItem; accent?: string; selected: boolean; onSelect: () => void }) {
  const isPick = item.kind === 'pick';
  const sport = isPick ? item.pick.sport : item.parlay.sport;
  const result = isPick ? item.pick.result : item.parlay.result;
  const selection = isPick ? item.pick.pick_selection : `${item.parlay.legs_count}-leg parlay`;
  const matchup = isPick ? item.pick.matchup : item.parlay.legs.map((leg) => leg.matchup).slice(0, 2).join(' · ');
  const market = isPick ? item.pick.bet_type.replace('_', ' ') : 'parlay';
  const odds = isPick ? item.pick.odds : item.parlay.combined_odds;
  const units = isPick ? item.pick.units : item.parlay.units;
  const reasoning = isPick ? item.pick.reasoning_text : item.parlay.reasoning_text;

  if (isPick) {
    const { away, home } = parseMatchup(item.pick.matchup);
    const awayAbbr = teamAbbr(away, item.pick.sport);
    const homeAbbr = teamAbbr(home, item.pick.sport);
    const awayColors = teamColorPair(away, item.pick.sport, awayAbbr);
    const homeColors = teamColorPair(home, item.pick.sport, homeAbbr);
    const status = TICKET_STATUS[item.pick.result];
    return (
      <div className={`h-[264px] w-[178px] shrink-0 snap-start rounded-[18px] transition duration-200 hover:-translate-y-1 ${selected ? 'z-10 ring-2 ring-inset' : ''}`} style={{ '--tw-ring-color': accent } as React.CSSProperties}>
        <AgentTicketShell tear={116} interactive onClick={onSelect} className="h-[264px] w-[178px] overflow-hidden rounded-[18px] shadow-[0_10px_24px_rgba(50,42,28,0.16)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.45)]">
          <TicketSportIcon sport={item.pick.sport} className="pointer-events-none absolute -right-6 -top-5 h-[92px] w-[92px] text-slate-900 opacity-[0.04] dark:text-white dark:opacity-[0.055]" />
          <div className="flex h-[116px] flex-col px-[14px] pt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-500 dark:text-white/55">{item.pick.sport}</span>
              <span className="ml-auto">
                {item.pick.result === 'pending' ? (
                  <span className="text-[10px] font-bold" style={{ color: accent }}>{item.pick.confidence}/5</span>
                ) : (
                  <span className="rounded-full px-[7px] py-[3px] text-[9px] font-black tracking-[0.05em]" style={{ color: status.color, background: `${status.color}29` }}>{status.text}</span>
                )}
              </span>
            </div>
            <div className="my-auto">
              <PickRouteRow awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayColors={awayColors} homeColors={homeColors} awayLogo={resolveTicketLogo(away, item.pick.sport, awayAbbr)} homeLogo={resolveTicketLogo(home, item.pick.sport, homeAbbr)} sport={item.pick.sport} dotColor={item.pick.result === 'pending' ? 'rgba(255,255,255,.4)' : status.color} />
            </div>
          </div>
          <div className="flex h-[148px] flex-col overflow-hidden px-[14px] pb-[14px] pt-[11px]">
            <p className="line-clamp-2 h-[34px] shrink-0 text-[15px] font-black leading-[17px] text-slate-950 dark:text-white">{item.pick.pick_selection}</p>
            <div className="mt-[7px] flex h-[27px] shrink-0 items-start justify-between gap-1">
              <span className="min-w-0"><small className="block text-[9px] font-medium text-slate-500 dark:text-white/45">Market</small><b className="block max-w-[54px] truncate text-[11px] font-semibold capitalize text-slate-900 dark:text-white">{market}</b></span>
              <span className="text-center"><small className="block text-[9px] font-medium text-slate-500 dark:text-white/45">Odds</small><b className="font-mono text-[13px] font-semibold text-slate-900 dark:text-white">{odds || '—'}</b></span>
              <span className="text-right"><small className="block text-[9px] font-medium text-slate-500 dark:text-white/45">Units</small><b className="font-mono text-[13px] font-semibold" style={{ color: accent }}>{units}u</b></span>
            </div>
            {reasoning && (
              <div className="mt-[7px] min-h-0 flex-1 overflow-hidden border-t border-stone-300 dark:border-white/[0.07] pt-[5px]">
                <p className="line-clamp-3 text-[10px] leading-[13px] text-slate-500 dark:text-white/50">{reasoning}</p>
              </div>
            )}
          </div>
        </AgentTicketShell>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative h-[264px] w-[178px] shrink-0 snap-start overflow-hidden rounded-[18px] border border-stone-300/80 bg-gradient-to-b from-[#fffdf8] to-[#f3efe5] text-left text-slate-950 shadow-[0_10px_24px_rgba(50,42,28,0.16)] transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset dark:border-white/[0.07] dark:from-[#141927] dark:to-[#0D101A] dark:text-white dark:shadow-[0_10px_20px_rgba(0,0,0,0.45)] ${selected ? 'z-10 ring-2 ring-inset' : ''}`}
      style={{ borderColor: selected ? accent : undefined, '--tw-ring-color': accent } as React.CSSProperties}
    >
      <span aria-hidden className="pointer-events-none absolute -right-5 -top-4 text-[82px] font-black leading-none text-slate-900 opacity-[0.035] dark:text-white dark:opacity-[0.045]">↗</span>
      <div className="flex h-[116px] flex-col px-[14px] pt-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.06em]" style={{ color: accent }}>↗ PARLAY</span>
          <span className="ml-auto" />
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${RESULT_STYLE[result]}`}>{result}</span>
        </div>
        <div className="mt-2 space-y-1 overflow-hidden">
          {item.parlay.legs.slice(0, 4).map((leg) => (
            <div key={leg.id} className="flex min-w-0 items-center gap-[5px]">
              <span className={`h-1 w-1 shrink-0 rounded-full ${leg.leg_result === 'won' ? 'bg-emerald-500' : leg.leg_result === 'lost' ? 'bg-red-500' : leg.leg_result === 'push' ? 'bg-amber-500' : 'bg-white/35'}`} />
              <span className="truncate text-[11px] font-semibold leading-[14px] text-slate-900 dark:text-white">{leg.pick_selection}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="relative flex h-[148px] flex-col overflow-hidden border-t border-dashed border-stone-400/50 px-[14px] pb-[14px] pt-[11px] dark:border-white/15">
        <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-[hsl(var(--widget-card-bg,var(--background)))]" />
        <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-[hsl(var(--widget-card-bg,var(--background)))]" />
        <p className="h-[18px] shrink-0 truncate text-[15px] font-black leading-[18px] text-slate-950 dark:text-white">{item.parlay.legs_count}-Leg Ticket</p>
        <div className="mt-[7px] grid h-[27px] shrink-0 grid-cols-3 gap-1">
          <span><small className="block text-[9px] text-slate-500 dark:text-white/45">Legs</small><b className="block truncate text-[11px]">{item.parlay.legs_count}</b></span>
          <span className="text-center"><small className="block text-[9px] text-slate-500 dark:text-white/45">Odds</small><b className="font-mono text-[13px]">{odds || '—'}</b></span>
          <span className="text-right"><small className="block text-[9px] text-slate-500 dark:text-white/45">Units</small><b className="font-mono text-[13px]" style={{ color: accent }}>{units}u</b></span>
        </div>
        {reasoning && (
          <div className="mt-[7px] min-h-0 flex-1 overflow-hidden border-t border-stone-300 pt-[5px] dark:border-white/[0.07]">
            <p className="line-clamp-3 text-[10px] leading-[13px] text-slate-500 dark:text-white/50">{reasoning}</p>
          </div>
        )}
      </div>
    </button>
  );
}

interface AgentTodaysPicksSectionProps {
  agentId: string;
  accent?: string;
  selectedTicketId: string | null;
  onSelectTicket: (item: AgentHistoryItem) => void;
}

export function AgentTodaysPicksSection({
  agentId,
  accent,
  selectedTicketId,
  onSelectTicket,
}: AgentTodaysPicksSectionProps) {
  const { data: picks = [] } = useAgentPicks(agentId);
  const { data: parlays = [] } = useAgentParlays(agentId);
  const today = React.useMemo(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, []);
  const items: HistoryItem[] = React.useMemo(() => [
    ...picks.filter((pick) => pick.game_date === today).map((pick) => ({ kind: 'pick' as const, date: pick.game_date, createdAt: pick.created_at, pick })),
    ...parlays.filter((parlay) => (parlay.target_date ?? parlay.created_at.slice(0, 10)) === today).map((parlay) => ({ kind: 'parlay' as const, date: today, createdAt: parlay.created_at, parlay })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [picks, parlays, today]);
  const scroller = useTicketScroller(items.length);
  if (!items.length) return null;
  return (
    <WidgetCard icon={<Target />} title="Today's Picks" subtitle={`${items.length} published ticket${items.length === 1 ? '' : 's'} from today's research.`} accessory={<TicketScrollerButtons bounds={scroller.bounds} onPrevious={() => scroller.scroll(-1)} onNext={() => scroller.scroll(1)} />}>
      <div ref={scroller.ref} className="-mx-4 overflow-x-auto px-4 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max snap-x snap-mandatory gap-3 pr-12">
          {items.map((item) => {
            const id = item.kind === 'pick' ? item.pick.id : item.parlay.id;
            return <MiniHistoryTicket key={id} item={item} accent={accent} selected={selectedTicketId === id} onSelect={() => onSelectTicket(item)} />;
          })}
        </div>
      </div>
    </WidgetCard>
  );
}

interface AgentPicksSectionProps {
  agentId: string;
  canSeePicks: boolean;
  /** Agent brand tint threaded into the ticket cards (units + confidence). */
  accent?: string;
  selectedTicketId: string | null;
  onSelectTicket: (item: AgentHistoryItem) => void;
}

/**
 * Pick history: sport/result filter pills and a ticket timeline. Ticket detail
 * is owned by /agents so the agent profile remains visible beside it.
 */
export function AgentPicksSection({
  agentId,
  canSeePicks,
  accent,
  selectedTicketId,
  onSelectTicket,
}: AgentPicksSectionProps) {
  const [sportFilter, setSportFilter] = React.useState<Sport | 'all'>('all');
  const [resultFilter, setResultFilter] = React.useState<PickResult | 'all'>('all');
  const [query, setQuery] = React.useState('');
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [explorerTicket, setExplorerTicket] = React.useState<HistoryItem | null>(null);

  React.useEffect(() => {
    setSportFilter('all');
    setResultFilter('all');
    setQuery('');
    setHistoryOpen(false);
  }, [agentId]);

  const { data: picks, isLoading: picksLoading } = useAgentPicks(canSeePicks ? agentId : undefined);
  const { data: parlays, isLoading: parlaysLoading } = useAgentParlays(canSeePicks ? agentId : undefined);
  const isLoading = picksLoading || parlaysLoading;

  const items = React.useMemo<HistoryItem[]>(() => {
    const merged: HistoryItem[] = [
      ...(picks ?? []).map((pick) => ({
        kind: 'pick' as const,
        date: pick.game_date,
        createdAt: pick.created_at,
        pick,
      })),
      ...(parlays ?? []).map((parlay) => ({
        kind: 'parlay' as const,
        date: parlay.target_date ?? parlay.created_at.slice(0, 10),
        createdAt: parlay.created_at,
        parlay,
      })),
    ];
    // Same ordering the picks query used: newest slate first, then newest pick.
    return merged.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [picks, parlays]);

  const recentItems = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 6);
    return items.filter((item) => new Date(`${item.date}T23:59:59`).getTime() >= cutoff.getTime());
  }, [items]);

  const filteredItems = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const sport = item.kind === 'pick' ? item.pick.sport : item.parlay.sport;
      const result = item.kind === 'pick' ? item.pick.result : item.parlay.result;
      if (sportFilter !== 'all' && sport !== sportFilter) return false;
      if (resultFilter !== 'all' && result !== resultFilter) return false;
      if (!needle) return true;
      if (item.kind === 'pick') {
        return [item.pick.matchup, item.pick.pick_selection, item.pick.sport, item.pick.bet_type, item.pick.reasoning_text]
          .some((value) => value?.toLowerCase().includes(needle));
      }
      return [item.parlay.sport, item.parlay.reasoning_text, ...item.parlay.legs.flatMap((leg) => [leg.matchup, leg.pick_selection])]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [items, query, sportFilter, resultFilter]);

  const dayGroups = React.useMemo(() => {
    const groups = new Map<string, HistoryItem[]>();
    for (const item of recentItems) groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
    return [...groups.entries()];
  }, [recentItems]);

  const fullDayGroups = React.useMemo(() => {
    const groups = new Map<string, HistoryItem[]>();
    for (const item of filteredItems) groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
    return [...groups.entries()];
  }, [filteredItems]);


  if (!canSeePicks) {
    return (
      <WidgetCard
        icon={<History />}
        title="Pick History"
        subtitle="Every pick this agent has made, with how it graded out."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LockedPlaceholderCard />
          <LockedPlaceholderCard />
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      icon={<History />}
      title="Pick History"
      subtitle="The last seven days, organized as a daily ticket timeline."
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading picks…</p>}
      {!isLoading && recentItems.length === 0 && (
        <p className="text-sm text-muted-foreground">No picks in the last seven days.</p>
      )}

      <div>
          <div className="relative min-w-0 space-y-0 before:absolute before:bottom-8 before:left-[23px] before:top-6 before:w-px before:bg-border/70">
            {dayGroups.map(([date, dayItems], dayIndex) => (
              <div key={date} className="relative grid grid-cols-[48px_minmax(0,1fr)] gap-3">
                <div className="relative z-10 flex justify-center">
                  <div className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-full border bg-background/95 text-center shadow-[0_4px_12px_rgba(0,0,0,0.12)] backdrop-blur-xl" style={{ borderColor: `${accent}45`, boxShadow: `0 0 0 3px ${accent}12, 0 4px 12px rgba(0,0,0,.12)` }}>
                    <span className="text-[8px] font-black uppercase tracking-[0.08em] text-muted-foreground">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span>
                    <span className="mt-px text-[17px] font-black leading-none text-foreground">{new Date(`${date}T12:00:00`).getDate()}</span>
                  </div>
                </div>
                <div className="min-w-0 pb-5">
                  <TicketDayScroller date={date} items={dayItems} accent={accent} selectedTicketId={selectedTicketId} onSelect={onSelectTicket} />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="group col-span-full mt-2 flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background/35 px-4 py-3 text-left transition-colors hover:bg-background/60"
          >
            <span><span className="block text-sm font-bold text-foreground">View all pick history</span><span className="block text-xs text-muted-foreground">Search and explore all {items.length} tickets</span></span>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </button>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="flex h-[88vh] max-w-[min(1120px,96vw)] flex-col overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-5">
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Full Pick History</DialogTitle>
            <p className="text-sm text-muted-foreground">Search every straight pick and parlay ticket from this agent.</p>
          </DialogHeader>
          <div className="flex flex-col gap-2 border-b border-border/60 px-6 py-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams, picks, markets…" aria-label="Search all pick history" className="h-9 rounded-full bg-background/50 pl-9" />
            </div>
            <div className="flex gap-1.5">
              <FilterPill icon={<Trophy />} label="Sport" defaultValue="all" value={sportFilter} onChange={(v) => setSportFilter(v as Sport | 'all')} options={[{ value: 'all', label: 'All sports' }, ...SPORTS.map((s) => ({ value: s, label: s.toUpperCase() }))]} />
              <FilterPill icon={<Target />} label="Result" defaultValue="all" value={resultFilter} onChange={(v) => setResultFilter(v as PickResult | 'all')} options={[{ value: 'all', label: 'All results' }, ...PICK_RESULTS.map((r) => ({ value: r, label: r.toUpperCase() }))]} />
            </div>
          </div>
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
            {explorerTicket && (
              <div className="min-h-0 overflow-y-auto p-4 lg:hidden">
                <button type="button" onClick={() => setExplorerTicket(null)} className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" /> Back to pick history
                </button>
                {explorerTicket.kind === 'pick' ? (
                  <AgentPickCard pick={explorerTicket.pick} accent={accent} />
                ) : (
                  <AgentParlayCard parlay={explorerTicket.parlay} accent={accent} />
                )}
              </div>
            )}
            <div className={`${explorerTicket ? 'hidden lg:block' : ''} min-h-0 overflow-y-auto border-border/60 px-6 py-4 lg:border-r`}>
              <p className="mb-3 text-xs font-bold text-muted-foreground">{filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}</p>
              <div className="space-y-5">
                {fullDayGroups.map(([date, group]) => (
                  <TicketDayScroller key={date} date={date} items={group} accent={accent} selectedTicketId={explorerTicket?.kind === 'pick' ? explorerTicket.pick.id : explorerTicket?.parlay.id ?? null} onSelect={setExplorerTicket} compact />
                ))}
                {!filteredItems.length && <div className="py-16 text-center text-sm text-muted-foreground">No tickets match those filters.</div>}
              </div>
            </div>
            <div className="hidden min-h-0 overflow-y-auto bg-background/35 p-6 lg:block">
              {explorerTicket ? (
                <div className="mx-auto max-w-2xl">
                  {explorerTicket.kind === 'pick' ? (
                    <AgentPickCard pick={explorerTicket.pick} accent={accent} />
                  ) : (
                    <AgentParlayCard parlay={explorerTicket.parlay} accent={accent} />
                  )}
                </div>
              ) : (
                <div className="flex h-full min-h-64 items-center justify-center text-center">
                  <div>
                    <History className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-bold text-foreground">Select a ticket</p>
                    <p className="mt-1 text-xs text-muted-foreground">Its full details will stay open here while you explore.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </WidgetCard>
  );
}
