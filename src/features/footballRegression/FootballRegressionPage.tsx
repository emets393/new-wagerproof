import * as React from 'react';
import { Activity, CalendarDays, RefreshCcw } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { useEnsureCompTeamAssets } from '@/features/competition/hooks';
import { getCfbTeamLogo } from '@/utils/cfbTeamAssets';
import { getNflTeamLogo } from '@/utils/nflTeamAssets';
import { cn } from '@/lib/utils';

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
  } | null;
  updated_at: string;
}

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
}

// Emoji + accent per storyline family — the visual identity of each card.
const FAMILY_META: Record<string, { label: string; emoji: string; chip: string; border: string }> = {
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
  'confluence', 'injuries', 'signals', 'line_movement',
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

function TeamLogo({ sport, team }: { sport: 'nfl' | 'cfb'; team: string }) {
  const src = sport === 'nfl' ? getNflTeamLogo(team) : getCfbTeamLogo(team);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={team}
      className="h-7 w-7 shrink-0 object-contain"
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
  const { isSuccess: logosReady } = useEnsureCompTeamAssets();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
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
        const { data: rows } = await collegeFootballSupabase
          .from('football_regression_storylines')
          .select('id,family,matchup,title,body,rank,status,updates,created_at')
          .eq('sport', sport)
          .eq('season', r.season)
          .eq('week', r.week)
          .order('rank', { ascending: true, nullsFirst: false });
        if (!cancelled) setStorylines((rows ?? []) as StorylineRow[]);
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

      {grouped.map(({ fam, rows }) => {
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

function StorylineCard({ s, sport, logosReady }: { s: StorylineRow; sport: 'nfl' | 'cfb'; logosReady: boolean }) {
  const m = FAMILY_META[s.family] ?? FAMILY_FALLBACK;
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
