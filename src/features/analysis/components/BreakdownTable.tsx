import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  CalendarClock,
  Landmark,
  MapPin,
  Scale,
  Search,
  Shield,
  Trophy,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BreakdownRow, BreakdownTabDef } from './adapters/types';
import { significance } from './adapters/shared';

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  team: Shield,
  coach: UserRound,
  ref: Scale,
  conf: Trophy,
  venue: Landmark,
  upcoming: CalendarClock,
};

/** Animated inline hit-rate bar with a baseline tick — turns table rows into small infographics. */
function RowBar({ hit, baseline }: { hit: number; baseline: number }) {
  const good = hit >= 52.4;
  const bad = hit < 48;
  return (
    <div className="relative hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08] sm:block">
      <motion.div
        className={cn(
          'absolute inset-y-0 left-0 rounded-full',
          good ? 'bg-emerald-500/80' : bad ? 'bg-red-400/70' : 'bg-slate-400/70',
        )}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(hit, 100)}%` }}
        transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
      />
      <div className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${baseline}%` }} />
    </div>
  );
}

/**
 * One breakdown tab's table: a square segmented sort picker pinned top-right (right above the
 * metric columns it orders) + every row (no cap, no inner scroll — the long list flows with the
 * page and scrolls under the chat dock). Search text is owned by BreakdownTable (lives in the
 * folder-tab row) and passed in as `query`.
 */
function TabTable({
  tab,
  query,
  baseline,
  outcomeWord,
  showsROI,
  logoFor,
}: {
  tab: BreakdownTabDef;
  query: string;
  baseline: number;
  outcomeWord: string;
  showsROI: boolean;
  logoFor: (row: BreakdownRow, tab: BreakdownTabDef) => string | null;
}) {
  const [sort, setSort] = React.useState<'n' | 'hit' | 'roi'>('n');
  // reset the sort metric when switching dimension tabs
  React.useEffect(() => {
    setSort('n');
  }, [tab.key]);
  const rows = tab.rows || [];
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r[tab.labelKey] ?? '').toLowerCase().includes(q));
  }, [rows, query, tab.labelKey]);
  const effectiveSort = !showsROI && sort === 'roi' ? 'n' : sort;
  const sorted = React.useMemo(
    () =>
      [...filtered].sort((x, y) =>
        effectiveSort === 'n'
          ? Number(y.n) - Number(x.n)
          : effectiveSort === 'hit'
            ? Number(y.hit_pct) - Number(x.hit_pct)
            : (Number(y.roi) ?? -999) - (Number(x.roi) ?? -999),
      ),
    [filtered, effectiveSort],
  );

  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No results with enough games (min 3).
      </p>
    );
  }

  const sortOptions: { value: 'n' | 'hit' | 'roi'; label: string }[] = [
    { value: 'n', label: 'Games' },
    { value: 'hit', label: `${outcomeWord} %` },
    ...(showsROI ? [{ value: 'roi' as const, label: 'ROI' }] : []),
  ];

  return (
    <div>
      {/* sort sits top-right, right above the metric columns it orders — square (rounded) 3-way slider */}
      <div className="mb-2 flex justify-end">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-black/5 bg-white/50 p-0.5 dark:border-white/10 dark:bg-white/[0.06]">
          {sortOptions.map((o) => {
            const selected = effectiveSort === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setSort(o.value)}
                className={cn(
                  'relative rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                  selected ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {selected && (
                  <motion.span
                    layoutId={`sort-thumb-${tab.key}`}
                    className="absolute inset-0 rounded-md bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative z-10">{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* every row, no cap and no inner scroll — the page scroll region carries it under the dock */}
      <div className="divide-y divide-black/5 dark:divide-white/[0.07]">
        {sorted.map((r, i) => {
          const n = Number(r.n);
          const hit = Number(r.hit_pct);
          const roi = r.roi as number | null;
          const sig = significance(n, hit);
          const logo = tab.hasLogos ? logoFor(r, tab) : null;
          return (
            <div
              key={`${String(r[tab.labelKey])}-${i}`}
              className="flex items-center gap-3 px-2 py-2.5 text-sm transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04]"
            >
              {tab.hasLogos ? (
                logo ? (
                  <img
                    src={logo}
                    alt=""
                    className="h-6 w-6 shrink-0 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                ) : (
                  <div className="h-6 w-6 shrink-0" />
                )
              ) : (
                <div className="w-1 shrink-0" />
              )}
              <span className="flex-1 truncate font-medium">{String(r[tab.labelKey] ?? '')}</span>
              <Badge variant="secondary" className={`text-[10px] tabular-nums ${sig.tone}`}>
                {n}g
              </Badge>
              <RowBar hit={hit} baseline={baseline} />
              <span
                className={cn(
                  'w-14 shrink-0 text-right font-semibold tabular-nums',
                  hit > 52
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : hit < 48
                      ? 'text-red-600 dark:text-red-400'
                      : '',
                )}
              >
                {hit}%
              </span>
              {showsROI && (
                <span
                  className={cn(
                    'w-14 shrink-0 text-right text-xs tabular-nums',
                    (roi ?? 0) >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {roi != null ? `${roi >= 0 ? '+' : ''}${roi}%` : '—'}
                </span>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No matches for “{query}”.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Tabbed data section: container-less, modern folder tabs (search shares the tab row) over the
 * adapter's dimension tables (Team / Coach / Referee / Conference / Ballpark…) and the upcoming
 * games that match. The hero and SituationsGrid stay above; this is the deep-dive data below them.
 */
export function BreakdownTable({
  baseline,
  tabs,
  outcomeWord,
  showsROI,
  logoFor,
  upcoming,
  upcomingCount = 0,
  upcomingLabel,
}: {
  baseline: number;
  tabs: BreakdownTabDef[];
  outcomeWord: string;
  showsROI: boolean;
  logoFor: (row: BreakdownRow, tab: BreakdownTabDef) => string | null;
  /** Rendered "This week's games that match" panel — shown as the final tab. */
  upcoming?: React.ReactNode;
  upcomingCount?: number;
  upcomingLabel?: string;
}) {
  type TabEntry = { key: string; label: string; count?: number; def?: BreakdownTabDef };
  const entries = React.useMemo<TabEntry[]>(() => {
    const out: TabEntry[] = [];
    for (const t of tabs) {
      if (t.rows.length > 0) out.push({ key: t.key, label: t.label.replace(/^By /i, ''), def: t });
    }
    if (upcoming && upcomingCount > 0)
      out.push({ key: 'upcoming', label: upcomingLabel ?? 'Upcoming', count: upcomingCount });
    return out;
  }, [tabs, upcoming, upcomingCount, upcomingLabel]);

  const [tabKey, setTabKey] = React.useState(entries[0]?.key ?? 'team');
  const [query, setQuery] = React.useState('');
  // keep the active tab valid when the set changes (CFB conference tab appears/disappears)
  React.useEffect(() => {
    if (!entries.some((t) => t.key === tabKey)) setTabKey(entries[0]?.key ?? 'team');
  }, [entries, tabKey]);
  // clear the search text when switching tabs
  React.useEffect(() => {
    setQuery('');
  }, [tabKey]);
  const active = entries.find((t) => t.key === tabKey) ?? entries[0];

  if (!entries.length) return null;

  // search only earns its place once a tab has enough rows to hunt through
  const searchable = !!active?.def && (active.def.rows?.length ?? 0) > 8;

  return (
    // no outer card — the section is flush with the results column and scrolls under the chat dock
    <div>
      {/* folder-tab spine + search share a row; the baseline border gives the old-school folder feel */}
      <div className="flex items-end justify-between gap-3 border-b border-black/10 dark:border-white/10">
        <div className="-mb-px flex items-end gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {entries.map((t) => {
            const Icon = TAB_ICONS[t.key] ?? BarChart3;
            const selected = t.key === active?.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTabKey(t.key)}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border px-3.5 text-[13px] font-semibold transition-colors',
                  // active tab is opaque (bg-white/dark:bg-black matches the page) with no bottom
                  // border, so it "cuts" the baseline like a raised folder tab
                  selected
                    ? 'border-black/10 border-b-transparent bg-white text-foreground dark:border-white/10 dark:bg-black'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4', selected && 'text-primary')} />
                <span>{t.label}</span>
                {t.count != null && (
                  <span
                    className={cn(
                      'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                      selected ? 'bg-primary/10 text-primary' : 'bg-black/5 text-muted-foreground dark:bg-white/10',
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {searchable && (
          <div className="relative mb-1.5 shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Find a ${(active?.label ?? '').toLowerCase()}…`}
              className="h-8 w-44 rounded-lg border border-black/5 bg-white/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 dark:border-white/10 dark:bg-white/[0.06]"
            />
          </div>
        )}
      </div>

      <div className="pt-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active?.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {active?.key === 'upcoming' ? (
              upcoming
            ) : active?.def ? (
              <TabTable
                tab={active.def}
                query={query}
                baseline={baseline}
                outcomeWord={outcomeWord}
                showsROI={showsROI}
                logoFor={logoFor}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
