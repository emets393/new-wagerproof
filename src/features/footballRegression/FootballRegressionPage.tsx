import * as React from 'react';
import { Activity, CalendarDays, RefreshCcw } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SignalBacktestChart } from '@/features/games/detail/signals';
import { useEnsureCompTeamAssets } from '@/features/competition/hooks';
import { getCfbTeamLogo } from '@/utils/cfbTeamAssets';
import { getNflTeamLogo } from '@/utils/nflTeamAssets';
import type { SignalPerformanceRow } from '@/utils/signalPerformance';
import { cn } from '@/lib/utils';

type SignalDefRow = {
  signal_key: string;
  display_name?: string | null;
  one_liner?: string | null;
  definition?: string | null;
  why_it_works?: string | null;
  bet_direction?: string | null;
  typical_hit?: string | null;
  market?: string | null;
};

const SIGNAL_DEFS_TABLE: Record<'nfl' | 'cfb', string> = {
  nfl: 'nfl_signal_defs',
  cfb: 'cfb_signal_defs',
};

/**
 * NFL/CFB weekly regression report (owner spec 2026-08-30).
 *
 * ONE living document per sport-week: the daily generator appends storylines,
 * updates them in place, and resolves the ones reality closed — nothing is
 * deleted, so a reader arriving Friday sees the whole week's evolution.
 * NO PICKS anywhere by owner rule — the report says what to watch.
 */

interface ReportRow {
  sport: string;
  season: number;
  week: number;
  narrative: string | null;
  changelog: Array<{ date: string; entries: Array<{ type: string; title?: string; key: string }> }>;
  summary: {
    games?: number;
    storylines?: number;
    families?: Record<string, number>;
    coming_soon?: Array<{ emoji: string; label: string; note: string }>;
    model_record?: Array<{
      market: string; label: string;
      wins: number; losses: number; pushes: number; roi_units: number | null;
    }>;
  } | null;
  updated_at: string;
}

interface RecordSplitRow {
  market: string;
  scope: 'edge' | 'team';
  scope_key: string;
  wins: number;
  losses: number;
  pushes: number;
  roi_units: number | null;
  roi_n: number;
}

const MARKET_LABEL: Record<string, string> = {
  fg_spread: 'Spread', fg_total: 'Total', fg_ml: 'Moneyline', tt: 'Team Totals',
  h1_spread: '1H Spread', h1_total: '1H Total', h1_ml: '1H ML',
};
const MARKET_ORDER = ['fg_spread', 'fg_total', 'fg_ml', 'tt', 'h1_spread', 'h1_total', 'h1_ml'];
// Edge means something different per market: points off the closing line for
// spreads/totals, win-probability distance from 50/50 for moneylines.
const PT_BUCKETS = ['0-3', '3-6', '6-10', '10+'];
const PP_BUCKETS = ['0-5', '5-10', '10-20', '20+'];
const EDGE_META: Record<string, { buckets: string[]; unit: string; note: string }> = {
  fg_ml: {
    buckets: PP_BUCKETS, unit: 'pp',
    note: "How far the model's win probability sat from a coin flip, in percentage points — 20+ means it saw a near-lock.",
  },
  h1_ml: {
    buckets: PT_BUCKETS, unit: 'pts',
    note: "How big the model's predicted first-half margin was — the bigger the margin, the stronger its 1H moneyline conviction.",
  },
};
const EDGE_DEFAULT = (m: string) => EDGE_META[m] ?? {
  buckets: PT_BUCKETS, unit: 'pts',
  note: m.includes('total') || m === 'tt'
    ? "How many points the model's projected total was off the closing number — bigger gap, stronger disagreement."
    : "How many points the model's own line was off the closing spread — bigger gap, stronger disagreement.",
};

interface StorylineRow {
  id: number;
  family: string;
  matchup: string | null;
  title: string;
  body: string;
  rank: number | null;
  status: 'active' | 'updated' | 'resolved';
  updates: Array<{ date: string; note: string; status: string }>;
  created_at: string;
  // Featured matchups carry the full facet-by-facet rundown here (markdown); `body` is the
  // short summary shown on the collapsed card. Other families leave it null.
  data?: { full?: string; direction?: string } | null;
}

// Emoji + accent per storyline family — the visual identity of each card.
const FAMILY_META: Record<string, { label: string; emoji: string; chip: string; border: string }> = {
  // Featured matchups: Fantasy Points scheme/matchup facts crossed with our model, signals,
  // weather, referee and injuries (research/nfl-extreme-outcomes/nfl_matchup_facts.py). Top billing.
  matchups: { label: 'Featured Matchup', emoji: '🔎', chip: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', border: 'border-l-indigo-500/80' },
  injuries: { label: 'Injuries', emoji: '🏥', chip: 'bg-red-500/15 text-red-500 dark:text-red-400', border: 'border-l-red-500/70' },
  signals: { label: 'Signal', emoji: '🎯', chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', border: 'border-l-emerald-500/70' },
  line_movement: { label: 'Line Movement', emoji: '📈', chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', border: 'border-l-sky-500/70' },
  ref_trends: { label: 'Referee', emoji: '🦓', chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', border: 'border-l-amber-500/70' },
  coach_trends: { label: 'Coach', emoji: '🧠', chip: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', border: 'border-l-violet-500/70' },
  coach: { label: 'Coach', emoji: '🧠', chip: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', border: 'border-l-violet-500/70' },
  confluence: { label: 'Ref + Coach', emoji: '⚡', chip: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400', border: 'border-l-yellow-500/80' },
  luck: { label: 'Regression', emoji: '🎲', chip: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400', border: 'border-l-fuchsia-500/70' },
  situational: { label: 'Situational', emoji: '📅', chip: 'bg-teal-500/15 text-teal-600 dark:text-teal-400', border: 'border-l-teal-500/70' },
  roster: { label: 'Roster', emoji: '👥', chip: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', border: 'border-l-orange-500/70' },
};
const FAMILY_FALLBACK = { label: 'Storyline', emoji: '📌', chip: 'bg-muted text-muted-foreground', border: 'border-l-border' };

// Cards render grouped by family (owner: interleaving injury cards between
// signal cards reads as disorder). Rank still orders WITHIN a family.
const FAMILY_ORDER = [
  'matchups', 'confluence', 'injuries', 'signals', 'line_movement',
  'ref_trends', 'coach_trends', 'coach', 'luck', 'situational', 'roster',
];

function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '<br/><br/>');
}

function TeamLogo({ sport, team, size = 'h-7 w-7' }: { sport: 'nfl' | 'cfb'; team: string; size?: string }) {
  const src = sport === 'nfl' ? getNflTeamLogo(team) : getCfbTeamLogo(team);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={team}
      className={cn('shrink-0 object-contain', size)}
      loading="lazy"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

/** "Away @ Home" matchup strip with both logos. */
function MatchupStrip({ sport, matchup }: { sport: 'nfl' | 'cfb'; matchup: string }) {
  const [away, home] = matchup.split(' @ ');
  if (!home) return <span className="text-[12px] font-semibold text-muted-foreground">{matchup}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <TeamLogo sport={sport} team={away} />
      <span className="text-[12px] font-bold">{away}</span>
      <span className="text-[11px] text-muted-foreground">@</span>
      <TeamLogo sport={sport} team={home} />
      <span className="text-[12px] font-bold">{home}</span>
    </span>
  );
}

export function FootballRegressionPage({ sport }: { sport: 'nfl' | 'cfb' }) {
  const [report, setReport] = React.useState<ReportRow | null>(null);
  const [storylines, setStorylines] = React.useState<StorylineRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [splits, setSplits] = React.useState<RecordSplitRow[]>([]);
  const [teamQuery, setTeamQuery] = React.useState('');
  const [signalPerf, setSignalPerf] = React.useState<SignalPerformanceRow[]>([]);
  const [signalDefs, setSignalDefs] = React.useState<Record<string, SignalDefRow>>({});
  const { isSuccess: logosReady } = useEnsureCompTeamAssets();

  // Edge/team splits live behind an authed edge function — the raw table is
  // server-only so external anon-key readers never see this depth.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('football-model-record', {
          body: { sport },
        });
        if (!cancelled && data?.rows) setSplits(data.rows as RecordSplitRow[]);
      } catch { /* section simply hides */ }
    })();
    return () => { cancelled = true; };
  }, [sport]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSignalPerf([]);
      setSignalDefs({});
      const { data: reports } = await collegeFootballSupabase
        .from('football_regression_reports')
        .select('*')
        .eq('sport', sport)
        .order('season', { ascending: false })
        .order('week', { ascending: false })
        .limit(1);
      const r = (reports?.[0] as ReportRow | undefined) ?? null;
      if (cancelled) return;
      setReport(r);
      if (r) {
        const [
          { data: rows, error: storyErr },
          { data: perfRows, error: perfErr },
          { data: defRows, error: defErr },
        ] = await Promise.all([
          collegeFootballSupabase
            .from('football_regression_storylines')
            .select('id,family,matchup,title,body,rank,status,updates,created_at,data')
            .eq('sport', sport)
            .eq('season', r.season)
            .eq('week', r.week)
            .order('rank', { ascending: true, nullsFirst: false }),
          collegeFootballSupabase
            .from('signal_performance')
            .select('signal_key,n,wins,losses,pushes,hit_rate,units,roi,season,sport')
            .eq('sport', sport)
            .eq('season', r.season),
          collegeFootballSupabase
            .from(SIGNAL_DEFS_TABLE[sport])
            .select('signal_key,display_name,one_liner,definition,why_it_works,bet_direction,typical_hit,market'),
        ]);
        if (storyErr) console.warn('[football-regression] storylines', storyErr.message);
        if (perfErr) console.warn('[football-regression] signal_performance', perfErr.message);
        if (defErr) console.warn('[football-regression] signal_defs', defErr.message);
        if (cancelled) return;
        setStorylines((rows ?? []) as StorylineRow[]);
        // Coerce n — PostgREST occasionally returns numeric columns as strings.
        const perf = ((perfRows ?? []) as SignalPerformanceRow[]).filter(
          (p) => Number(p.n) > 0,
        );
        setSignalPerf(perf);
        const byKey: Record<string, SignalDefRow> = {};
        for (const d of (defRows ?? []) as SignalDefRow[]) {
          if (d.signal_key) byKey[d.signal_key] = d;
        }
        setSignalDefs(byKey);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sport]);

  const league = sport === 'nfl' ? 'NFL' : 'College Football';
  // Resolved storylines never render — they stay in the DB for history only.
  const active = storylines.filter((s) => s.status !== 'resolved');
  const grouped = FAMILY_ORDER
    .concat([...new Set(active.map((s) => s.family))].filter((f) => !FAMILY_ORDER.includes(f)))
    .map((fam) => ({ fam, rows: active.filter((s) => s.family === fam) }))
    .filter((g) => g.rows.length > 0);
  const today = report?.changelog?.[0];
  // The digest shows only what a returning reader cares about: new + updated,
  // by title. Internal keys and removals never render (owner feedback).
  const todayEntries = (today?.entries ?? []).filter(
    (e) => (e.type === 'new' || e.type === 'updated') && e.title,
  );
  const famCounts = report?.summary?.families ?? {};
  // Server-driven early-season banner: each generator drops an item the first
  // run its data exists; when the list is empty the banner is gone for good.
  const comingSoon = report?.summary?.coming_soon ?? [];
  const modelRecord = (report?.summary?.model_record ?? []).filter((m) => m.wins + m.losses + m.pushes > 0);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading the {league} report…</div>;
  }
  if (!report) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        🏈 The {league} regression report opens with the first slate of the week.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16">
      <header className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-4 w-4" /> {league} Weekly Regression Report
        </div>
        <h1 className="mt-1 text-3xl font-black">
          🏈 Week {report.week} · {report.season}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">
            🏟️ {report.summary?.games ?? '—'} games
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">
            📚 {active.length} live storylines
          </span>
          {Object.entries(famCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([fam, n]) => {
              const m = FAMILY_META[fam] ?? FAMILY_FALLBACK;
              return (
                <span key={fam} className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', m.chip)}>
                  {m.emoji} {n} {m.label.toLowerCase()}
                </span>
              );
            })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          A living report — storylines update in place all week; resolved ones stay on the record.
          Nothing here is a pick. Updated {new Date(report.updated_at).toLocaleString()}.
        </p>
      </header>

      {/* Above model edge/team splits — those tables are long and were burying this. */}
      {signalPerf.length > 0 && (
        <SeasonSignalsSection
          season={report.season}
          rows={signalPerf}
          defs={signalDefs}
        />
      )}

      {modelRecord.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            📊 Model record this season · graded vs the closing line
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {modelRecord.map((m) => {
              const winPct = m.wins + m.losses > 0 ? m.wins / (m.wins + m.losses) : 0;
              const positive = m.roi_units != null ? m.roi_units > 0 : winPct > 0.5;
              return (
                <div key={m.market} className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {m.label}
                  </div>
                  <div className={cn('text-[15px] font-black tabular-nums',
                    positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                    {m.wins}-{m.losses}{m.pushes > 0 ? `-${m.pushes}` : ''}
                  </div>
                  {m.roi_units != null && (
                    <div className="text-[11px] tabular-nums text-muted-foreground">
                      {m.roi_units > 0 ? '+' : ''}{m.roi_units.toFixed(1)}u
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {splits.length > 0 && (
            <RecordSplits
              splits={splits}
              sport={sport}
              logosReady={logosReady}
              teamQuery={teamQuery}
              setTeamQuery={setTeamQuery}
            />
          )}
        </section>
      )}

      {comingSoon.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            🔜 More data unlocks as the season progresses
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            It&apos;s early in the season — these sections join the report automatically the day
            their data starts coming in:
          </p>
          <ul className="mt-2 space-y-1.5">
            {comingSoon.map((c, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground">
                  {c.emoji} {c.label}
                </span>{' '}
                — {c.note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {todayEntries.length > 0 && (
        <section className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <RefreshCcw className="h-3.5 w-3.5" /> Today&apos;s update · {today?.date}
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
              🆕 {todayEntries.filter((e) => e.type === 'new').length} new
            </span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
              ✏️ {todayEntries.filter((e) => e.type === 'updated').length} updated
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-[13px]">
            {todayEntries.slice(0, 10).map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 leading-5">{e.type === 'new' ? '🆕' : '✏️'}</span>
                <span className="text-muted-foreground">{e.title}</span>
              </li>
            ))}
            {todayEntries.length > 10 && (
              <li className="text-[12px] text-muted-foreground">
                …and {todayEntries.length - 10} more below.
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Featured matchups sit directly under Today's update (owner 2026-09-18), ahead of the
          AI narrative — they are the week's headline content, not one family among many. */}
      {grouped.filter((g) => g.fam === 'matchups').map(({ fam, rows }) => {
        const m = FAMILY_META[fam] ?? FAMILY_FALLBACK;
        return (
          <section key={fam} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {m.emoji} {m.label}s ({rows.length})
            </h2>
            {rows.map((s) => (
              <StorylineCard key={s.id} s={s} sport={sport} logosReady={logosReady} />
            ))}
          </section>
        );
      })}

      {report.narrative && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            ✨ This week&apos;s read · AI-written from the data below
          </div>
          <div
            className="prose-sm mt-2 text-[13px] leading-relaxed text-muted-foreground [&_h2]:mt-4 [&_h2]:text-[16px] [&_h2]:font-black [&_h2]:text-foreground [&_h3]:mt-4 [&_h3]:text-[14px] [&_h3]:font-bold [&_h3]:text-foreground [&_h4]:mt-3 [&_h4]:text-[13px] [&_h4]:font-bold [&_h4]:text-foreground [&_li]:ml-4 [&_li]:list-disc"
            dangerouslySetInnerHTML={{ __html: mdToHtml(report.narrative) }}
          />
        </section>
      )}

      {grouped.filter((g) => g.fam !== 'matchups').map(({ fam, rows }) => {
        const m = FAMILY_META[fam] ?? FAMILY_FALLBACK;
        return (
          <section key={fam} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {m.emoji} {m.label} ({rows.length})
            </h2>
            {rows.map((s) => (
              <StorylineCard key={s.id} s={s} sport={sport} logosReady={logosReady} />
            ))}
          </section>
        );
      })}

    </div>
  );
}

function rec(r: { wins: number; losses: number; pushes: number }) {
  return `${r.wins}-${r.losses}${r.pushes > 0 ? `-${r.pushes}` : ''}`;
}

const MARKET_SHORT: Record<string, string> = {
  fg_spread: 'Spread', fg_total: 'Total', fg_ml: 'ML', tt: 'TT',
  h1_spread: '1H Spr', h1_total: '1H Tot', h1_ml: '1H ML',
};

function RecordCell({ c }: { c?: RecordSplitRow }) {
  if (!c) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span className={cn('font-bold tabular-nums',
      c.wins > c.losses && 'text-emerald-600 dark:text-emerald-400',
      c.wins < c.losses && 'text-red-500 dark:text-red-400')}>
      {rec(c)}
    </span>
  );
}

/** ROI% = profit / units risked, over the priced subset (roi_n). */
function roiPct(r: RecordSplitRow): number | null {
  if (r.roi_units == null || !r.roi_n) return null;
  return (r.roi_units / r.roi_n) * 100;
}

function RecordSplits({ splits, sport, logosReady, teamQuery, setTeamQuery }: {
  splits: RecordSplitRow[];
  sport: 'nfl' | 'cfb';
  logosReady: boolean;
  teamQuery: string;
  setTeamQuery: (v: string) => void;
}) {
  const edge = splits.filter((s) => s.scope === 'edge');
  const teams = splits.filter((s) => s.scope === 'team');
  const markets = MARKET_ORDER.filter((m) => splits.some((s) => s.market === m));
  const th = 'px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground';
  const td = 'px-2 py-1.5 whitespace-nowrap';
  // One market at a time in both tables (owner spec) — edge is defined
  // differently per market, and the team list scales to a full season.
  const [teamMarket, setTeamMarket] = React.useState(markets[0] ?? 'fg_spread');
  const [edgeMarket, setEdgeMarket] = React.useState(markets[0] ?? 'fg_spread');
  const [sortKey, setSortKey] = React.useState<'roi' | 'record'>('roi');
  const [sortDesc, setSortDesc] = React.useState(true);
  /** Collapsed: top 20 by ROI. Expand (or search) reveals the full team list. */
  const [teamsExpanded, setTeamsExpanded] = React.useState(false);
  const TOP_TEAMS = 20;

  const q = teamQuery.trim().toLowerCase();
  const marketTeams = teams.filter((s) => s.market === teamMarket);
  const sortRows = (rows: RecordSplitRow[]) =>
    [...rows].sort((a, b) => {
      const val = (r: RecordSplitRow) =>
        sortKey === 'roi'
          ? (roiPct(r) ?? -Infinity)
          : (r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : -Infinity) + r.wins * 1e-6;
      const d = val(b) - val(a);
      return (sortDesc ? d : -d) || a.scope_key.localeCompare(b.scope_key);
    });

  const matchedTeams = marketTeams.filter(
    (s) => !q || s.scope_key.toLowerCase().includes(q),
  );
  // Searching or expanding unlocks the full sorted list; otherwise only the
  // top-20 ROI teams (still re-sorted by the active column).
  const topRoiKeys = new Set(
    [...marketTeams]
      .sort(
        (a, b) => (roiPct(b) ?? -Infinity) - (roiPct(a) ?? -Infinity)
          || a.scope_key.localeCompare(b.scope_key),
      )
      .slice(0, TOP_TEAMS)
      .map((r) => r.scope_key),
  );

  const showAllTeams = teamsExpanded || Boolean(q);
  const teamRows = sortRows(
    showAllTeams ? matchedTeams : matchedTeams.filter((r) => topRoiKeys.has(r.scope_key)),
  );
  const hiddenCount = showAllTeams
    ? 0
    : Math.max(0, matchedTeams.length - teamRows.length);

  React.useEffect(() => {
    setTeamsExpanded(false);
  }, [teamMarket]);

  const onSort = (key: 'roi' | 'record') => {
    if (sortKey === key) setSortDesc((v) => !v);
    else { setSortKey(key); setSortDesc(true); }
  };
  const arrow = (key: 'roi' | 'record') => (sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : '');

  const edgeMeta = EDGE_DEFAULT(edgeMarket);
  const edgeRows = edgeMeta.buckets
    .map((b) => ({ b, c: edge.find((s) => s.market === edgeMarket && s.scope_key === b) }));

  return (
    <div className="mt-3 space-y-5 border-t border-border pt-3">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          📐 By model edge · how the model does when it disagrees with the close
        </div>
        <div className="mt-2 flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1 w-fit">
          {markets.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setEdgeMarket(m)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-bold',
                edgeMarket === m
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {MARKET_SHORT[m] ?? m}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{edgeMeta.note}</p>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40">
              <tr>
                <th className={th}>Model edge ({edgeMeta.unit})</th>
                <th className={cn(th, 'text-center')}>Record</th>
                <th className={cn(th, 'text-center')}>ROI%</th>
              </tr>
            </thead>
            <tbody>
              {edgeRows.map(({ b, c }) => {
                const pct = c ? roiPct(c) : null;
                return (
                  <tr key={b} className="border-t border-border/50">
                    <td className={cn(td, 'font-semibold')}>{b} {edgeMeta.unit}</td>
                    <td className={cn(td, 'text-center')}><RecordCell c={c} /></td>
                    <td className={cn(td, 'text-center tabular-nums font-semibold',
                      pct != null && pct > 0 && 'text-emerald-600 dark:text-emerald-400',
                      pct != null && pct < 0 && 'text-red-500 dark:text-red-400')}>
                      {pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          🏟️ By team · model record in that team&apos;s games (TT = that team&apos;s total only)
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
            {markets.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTeamMarket(m)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-bold',
                  teamMarket === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {MARKET_SHORT[m] ?? m}
              </button>
            ))}
          </div>
          <input
            value={teamQuery}
            onChange={(e) => setTeamQuery(e.target.value)}
            placeholder="Search team…"
            className="w-40 rounded-lg border border-border bg-background px-3 py-1 text-[12px]"
          />
        </div>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40">
              <tr>
                <th className={th}>Team</th>
                <th className={cn(th, 'cursor-pointer select-none text-center')} onClick={() => onSort('record')}>
                  {MARKET_LABEL[teamMarket] ?? teamMarket} Record{arrow('record')}
                </th>
                <th className={cn(th, 'cursor-pointer select-none text-center')} onClick={() => onSort('roi')}>
                  ROI%{arrow('roi')}
                </th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((c) => {
                const pct = roiPct(c);
                return (
                  <tr key={c.scope_key} className="border-t border-border/50">
                    <td className={cn(td, 'font-bold')}>
                      <span className="inline-flex items-center gap-1.5">
                        {logosReady && <TeamLogo sport={sport} team={c.scope_key} size="h-5 w-5" />}
                        {c.scope_key}
                      </span>
                    </td>
                    <td className={cn(td, 'text-center')}><RecordCell c={c} /></td>
                    <td className={cn(td, 'text-center tabular-nums font-semibold',
                      pct != null && pct > 0 && 'text-emerald-600 dark:text-emerald-400',
                      pct != null && pct < 0 && 'text-red-500 dark:text-red-400')}>
                      {pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
              {teamRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-4 text-center text-[12px] text-muted-foreground">
                    {q ? 'No teams match that search.' : 'No graded team splits yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!q && matchedTeams.length > TOP_TEAMS && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setTeamsExpanded((v) => !v)}
              className="rounded-full border border-border bg-background px-3.5 py-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground"
            >
              {teamsExpanded
                ? 'Show top 20 by ROI'
                : `Show all ${matchedTeams.length} teams (+${hiddenCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function signalRecord(p: SignalPerformanceRow): string {
  return p.pushes > 0
    ? `${p.wins}-${p.losses}-${p.pushes}`
    : `${p.wins}-${p.losses}`;
}

function formatRoiPct(roi: number): string {
  const pct = roi * 100;
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  if (pct < 0) return `${pct.toFixed(1)}%`;
  return '0.0%';
}

/** Current-season signal leaderboard — click a row for the glossary definition. */
function SeasonSignalsSection({
  season,
  rows,
  defs,
}: {
  season: number;
  rows: SignalPerformanceRow[];
  defs: Record<string, SignalDefRow>;
}) {
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<'roi' | 'hit' | 'n'>('roi');
  const [sortDesc, setSortDesc] = React.useState(true);

  const sorted = React.useMemo(() => {
    const val = (p: SignalPerformanceRow) => {
      if (sortKey === 'hit') return p.hit_rate;
      if (sortKey === 'n') return p.n;
      return Number(p.roi) || 0;
    };
    return [...rows].sort((a, b) => {
      const d = val(b) - val(a);
      return (sortDesc ? d : -d) || a.signal_key.localeCompare(b.signal_key);
    });
  }, [rows, sortKey, sortDesc]);

  const selected = selectedKey
    ? {
        perf: rows.find((r) => r.signal_key === selectedKey),
        def: defs[selectedKey],
      }
    : null;

  const onSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDesc((v) => !v);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };
  const arrow = (key: typeof sortKey) =>
    sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : '';

  const th =
    'px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground';
  const td = 'px-2 py-1.5 whitespace-nowrap';

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        🎯 Signal record · {season} season
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Graded picks this season. Tap a signal for what it means.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40">
            <tr>
              <th className={th}>Signal</th>
              <th className={cn(th, 'cursor-pointer select-none')} onClick={() => onSort('hit')}>
                Win%{arrow('hit')}
              </th>
              <th className={th}>Record</th>
              <th className={cn(th, 'cursor-pointer select-none')} onClick={() => onSort('roi')}>
                ROI{arrow('roi')}
              </th>
              <th className={cn(th, 'cursor-pointer select-none text-right')} onClick={() => onSort('n')}>
                N{arrow('n')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const name = defs[p.signal_key]?.display_name || p.signal_key;
              const positive = Number(p.roi) > 0;
              const negative = Number(p.roi) < 0;
              return (
                <tr
                  key={p.signal_key}
                  className="cursor-pointer border-t border-border/60 hover:bg-muted/40"
                  onClick={() => setSelectedKey(p.signal_key)}
                >
                  <td className={cn(td, 'max-w-[14rem] truncate font-semibold text-foreground')}>
                    {name}
                  </td>
                  <td className={cn(td, 'tabular-nums')}>
                    {(p.hit_rate * 100).toFixed(1)}%
                  </td>
                  <td className={cn(td, 'tabular-nums font-bold')}>{signalRecord(p)}</td>
                  <td
                    className={cn(
                      td,
                      'tabular-nums font-bold',
                      positive && 'text-emerald-600 dark:text-emerald-400',
                      negative && 'text-red-500 dark:text-red-400',
                    )}
                  >
                    {formatRoiPct(Number(p.roi))}
                  </td>
                  <td className={cn(td, 'text-right tabular-nums text-muted-foreground')}>
                    {p.n}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(selectedKey)} onOpenChange={(open) => !open && setSelectedKey(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selected?.def?.display_name || selectedKey}
            </DialogTitle>
            {selected?.def?.one_liner && (
              <DialogDescription>{selected.def.one_liner}</DialogDescription>
            )}
          </DialogHeader>
          {selected?.def?.definition && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {selected.def.definition}
            </p>
          )}
          {selected?.def?.why_it_works && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Why it works:</span>{' '}
              {selected.def.why_it_works}
            </p>
          )}
          {selected?.def?.bet_direction && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Direction:</span>{' '}
              {selected.def.bet_direction}
            </p>
          )}
          {!selected?.def?.definition && !selected?.def?.why_it_works && (
            <p className="text-[13px] text-muted-foreground">
              No definition on file for this signal yet.
            </p>
          )}
          {selected?.perf && (
            <SignalBacktestChart
              className="mt-2"
              backtestRaw={selected.def?.typical_hit}
              performance={selected.perf}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StorylineCard({ s, sport, logosReady }: { s: StorylineRow; sport: 'nfl' | 'cfb'; logosReady: boolean }) {
  const m = FAMILY_META[s.family] ?? FAMILY_FALLBACK;
  // Featured matchups: the card shows the summary; the facet-by-facet rundown expands
  // in place (owner 2026-09-18: one summary card + "full rundown", not two copies).
  const [open, setOpen] = React.useState(false);
  const full = s.family === 'matchups' ? s.data?.full ?? null : null;
  return (
    <article className={cn('rounded-xl border border-border border-l-4 bg-card p-4', m.border)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', m.chip)}>
          {m.emoji} {m.label}
        </span>
        {s.status === 'updated' && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-300">
            updated
          </span>
        )}
      </div>
      {s.matchup && (
        <div className="mt-2">
          {logosReady
            ? <MatchupStrip sport={sport} matchup={s.matchup} />
            : <span className="text-[12px] font-semibold text-muted-foreground">{s.matchup}</span>}
        </div>
      )}
      {/* Generator titles append "— {matchup}"; the logo strip already shows it. */}
      <h3 className="mt-1.5 text-[14px] font-bold">
        {s.matchup ? s.title.replace(` — ${s.matchup}`, '') : s.title}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
      {full && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            aria-expanded={open}
          >
            {open ? '▲ Hide full rundown' : '▼ Full rundown — facet by facet'}
          </button>
          {open && (
            <div
              className="rundown mt-3 space-y-2 text-[13px] leading-relaxed text-muted-foreground [&_h4]:mt-3 [&_h4]:text-[13px] [&_h4]:font-bold [&_h4]:text-foreground [&_li]:ml-4 [&_li]:list-disc"
              dangerouslySetInnerHTML={{ __html: mdToHtml(full) }}
            />
          )}
        </div>
      )}
      {/* Only substantive update notes — the generic daily-refresh note is noise. */}
      {(s.updates ?? []).filter((u) => u.note && !u.note.startsWith('Details refreshed')).length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {s.updates
            .filter((u) => u.note && !u.note.startsWith('Details refreshed'))
            .map((u, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">
                <span className="font-semibold">{u.date}:</span> {u.note}
              </li>
            ))}
        </ul>
      )}
    </article>
  );
}
