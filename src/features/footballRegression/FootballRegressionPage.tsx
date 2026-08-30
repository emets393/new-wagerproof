import * as React from 'react';
import { Sparkles, Activity, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { cn } from '@/lib/utils';

/**
 * NFL/CFB weekly regression report (owner spec 2026-08-30).
 *
 * ONE living document per sport-week: the daily generator appends storylines,
 * updates them in place, and resolves the ones reality closed — nothing is
 * deleted, so a reader arriving Friday sees the whole week's evolution. The
 * "What changed today" timeline is the diff a returning reader scans first.
 * NO PICKS anywhere by owner rule — the report says what to watch.
 *
 * v1 is a single-column read (narrative + changelog + ranked storyline cards);
 * the MLB-style split view is the planned upgrade once per-game depth grows.
 */

interface ReportRow {
  sport: string;
  season: number;
  week: number;
  narrative: string | null;
  changelog: Array<{ date: string; entries: Array<{ type: string; title?: string; key: string }> }>;
  summary: { games?: number; storylines?: number; families?: Record<string, number> } | null;
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

const FAMILY_LABEL: Record<string, string> = {
  injuries: 'Injuries',
  signals: 'Signals',
  line_movement: 'Line Movement',
  ref_trends: 'Referee',
  coach_trends: 'Coach',
  confluence: 'Ref + Coach Confluence',
  coach: 'Coach Disposition',
  luck: 'Regression',
  situational: 'Situational',
  roster: 'Roster',
};

function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '<br/><br/>');
}

export function FootballRegressionPage({ sport }: { sport: 'nfl' | 'cfb' }) {
  const [report, setReport] = React.useState<ReportRow | null>(null);
  const [storylines, setStorylines] = React.useState<StorylineRow[]>([]);
  const [loading, setLoading] = React.useState(true);

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
  const active = storylines.filter((s) => s.status !== 'resolved');
  const resolved = storylines.filter((s) => s.status === 'resolved');
  const today = report?.changelog?.[0];

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading the {league} report…</div>;
  }
  if (!report) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        The {league} regression report opens with the first slate of the week.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16">
      <header>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-4 w-4" /> {league} Weekly Regression Report
        </div>
        <h1 className="mt-1 text-2xl font-black">
          Week {report.week} · {report.season}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          A living report: storylines accumulate all week and update in place — resolved ones stay
          on the record. Nothing here is a pick; it&apos;s what the data says to watch.
          Updated {new Date(report.updated_at).toLocaleString()}.
        </p>
      </header>

      {today && today.entries?.length > 0 && (
        <section className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <RefreshCcw className="h-3.5 w-3.5" /> What changed · {today.date}
          </div>
          <ul className="mt-2 space-y-1 text-[13px]">
            {today.entries.slice(0, 12).map((e, i) => (
              <li key={i} className="flex gap-2">
                <span
                  className={cn(
                    'shrink-0 rounded px-1.5 text-[10px] font-bold uppercase leading-5',
                    e.type === 'new' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
                    e.type === 'updated' && 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
                    (e.type === 'resolved' || e.type === 'reactivated') &&
                      'bg-muted text-muted-foreground',
                  )}
                >
                  {e.type}
                </span>
                <span className="text-muted-foreground">{e.title ?? e.key}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.narrative && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> This week&apos;s read · AI-written from the data below
          </div>
          <div
            className="prose-sm mt-2 text-[13px] leading-relaxed text-muted-foreground [&_h2]:mt-3 [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-3 [&_h3]:text-[14px] [&_h3]:font-bold [&_h3]:text-foreground [&_li]:ml-4 [&_li]:list-disc"
            dangerouslySetInnerHTML={{ __html: mdToHtml(report.narrative) }}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Storylines ({active.length})
        </h2>
        {active.map((s) => (
          <StorylineCard key={s.id} s={s} />
        ))}
      </section>

      {resolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Resolved this week ({resolved.length}) — kept for the record
          </h2>
          {resolved.map((s) => (
            <StorylineCard key={s.id} s={s} />
          ))}
        </section>
      )}
    </div>
  );
}

function StorylineCard({ s }: { s: StorylineRow }) {
  const resolved = s.status === 'resolved';
  return (
    <article
      className={cn(
        'rounded-xl border border-border bg-card p-4',
        resolved && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {FAMILY_LABEL[s.family] ?? s.family}
        </span>
        {s.matchup && <span className="text-[11px] font-semibold text-muted-foreground">{s.matchup}</span>}
        {s.status === 'updated' && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-300">
            updated
          </span>
        )}
        {resolved && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" /> resolved
          </span>
        )}
      </div>
      <h3 className="mt-1.5 text-[14px] font-bold">{s.title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
      {s.updates?.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {s.updates.map((u, i) => (
            <li key={i} className="text-[11px] text-muted-foreground">
              <span className="font-semibold">{u.date}:</span> {u.note}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
