import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { getNflTeamLogo } from '@/utils/nflTeamAssets';
import { cn } from '@/lib/utils';

/**
 * NFL Player Prop Report — the player-level companion to the regression report.
 *
 * Rows come from `nfl_prop_narratives`, written on the fp-data-inseason job by
 * research/nfl-extreme-outcomes/nfl_prop_narratives.py: for every posted line it gathers every
 * independent thing the data says (route/coverage/alignment stacks, QB vs this coverage mix,
 * run-concept stacks, form vs the line, what the defense allows to the position, injuries,
 * game script) and keeps the players where several things point the same way. Deterministic,
 * no LLM, no picks — every card says "the numbers point toward the OVER/UNDER" and shows why.
 */

interface PropRow {
  id: string;
  season: number;
  week: number;
  game_id: string | null;
  kickoff: string | null;
  player_name: string;
  team: string | null;
  opp: string | null;
  position: string | null;
  market: string;
  line: number | null;
  best_over_line: number | null;
  best_over_price: number | null;
  best_over_book: string | null;
  best_under_line: number | null;
  best_under_price: number | null;
  best_under_book: string | null;
  headshot_url: string | null;
  direction: 'over' | 'under' | null;
  score: number | null;
  n_for: number | null;
  n_against: number | null;
  summary: string | null;
  body: string | null;
  // Graded like every other prop card (grade_nfl_prop_narratives.py): actual vs the line.
  actual_value: number | null;
  result: 'win' | 'loss' | 'push' | null;
}

const MARKET_LABEL: Record<string, string> = {
  player_reception_yds: 'Receiving yards',
  player_receptions: 'Receptions',
  player_rush_yds: 'Rushing yards',
  player_rush_attempts: 'Rushing attempts',
  player_pass_yds: 'Passing yards',
  player_pass_completions: 'Completions',
  player_pass_attempts: 'Pass attempts',
};

// Fantasy Points abbreviates the Rams as LA; the logo helper wants LAR.
const logoAb = (ab: string | null) => (ab === 'LA' ? 'LAR' : ab ?? '');
const price = (p: number | null) => (p == null ? '' : p > 0 ? `+${p}` : `${p}`);

function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>');
}

function PropCard({ r }: { r: PropRow }) {
  const [open, setOpen] = React.useState(false);
  const over = r.direction === 'over';
  const teamLogo = getNflTeamLogo(logoAb(r.team));
  const oppLogo = getNflTeamLogo(logoAb(r.opp));
  const kick = r.kickoff ? new Date(r.kickoff) : null;
  return (
    <article className={cn('rounded-xl border border-border border-l-4 bg-card p-4', over ? 'border-l-emerald-500/80' : 'border-l-rose-500/80')}>
      <div className="flex items-start gap-3">
        {r.headshot_url ? (
          <img
            src={r.headshot_url}
            alt={r.player_name}
            className="h-14 w-14 shrink-0 rounded-full border border-border bg-muted object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-black">{r.player_name}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{r.position}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', over ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400')}>
              numbers point {r.direction}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
            {teamLogo && <img src={teamLogo} alt={r.team ?? ''} className="h-5 w-5 object-contain" />}
            <span className="font-semibold text-foreground">{r.team}</span>
            <span>vs</span>
            {oppLogo && <img src={oppLogo} alt={r.opp ?? ''} className="h-5 w-5 object-contain" />}
            <span className="font-semibold text-foreground">{r.opp}</span>
            {kick && <span>· {kick.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[14px] font-bold">
              {MARKET_LABEL[r.market] ?? r.market} <span className="tabular-nums">{r.line}</span>
            </span>
            {r.best_over_line != null && (
              <span className="text-[11px] text-muted-foreground">
                Over <span className="tabular-nums font-semibold text-foreground">{r.best_over_line} {price(r.best_over_price)}</span> {r.best_over_book}
              </span>
            )}
            {r.best_under_line != null && (
              <span className="text-[11px] text-muted-foreground">
                Under <span className="tabular-nums font-semibold text-foreground">{r.best_under_line} {price(r.best_under_price)}</span> {r.best_under_book}
              </span>
            )}
          </div>
        </div>
      </div>
      {r.result && (
        <div className={cn('mt-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-bold', r.result === 'win' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : r.result === 'loss' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-muted text-muted-foreground')}>
          {r.result === 'win' ? '✅ Read was right' : r.result === 'loss' ? '❌ Read was wrong' : '➖ Push'} · actual {r.actual_value} vs {r.line}
        </div>
      )}
      {r.summary && <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{r.summary}</p>}
      {r.body && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            aria-expanded={open}
          >
            {open ? '▲ Hide the numbers' : '▼ See every number behind this'}
          </button>
          {open && (
            <div
              className="mt-3 space-y-1 text-[13px] leading-relaxed text-muted-foreground [&_h4]:mt-3 [&_h4]:text-[13px] [&_h4]:font-bold [&_h4]:text-foreground [&_li]:ml-4 [&_li]:list-disc"
              dangerouslySetInnerHTML={{ __html: mdToHtml(r.body) }}
            />
          )}
        </div>
      )}
    </article>
  );
}

export function PropNarrativesPage() {
  const [rows, setRows] = React.useState<PropRow[]>([]);
  const [graded, setGraded] = React.useState<PropRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pos, setPos] = React.useState<'ALL' | 'QB' | 'WR/TE' | 'RB'>('ALL');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Latest week on file for the live cards; every graded read this season for the record.
      const { data: latest } = await collegeFootballSupabase
        .from('nfl_prop_narratives')
        .select('season,week')
        .order('season', { ascending: false })
        .order('week', { ascending: false })
        .limit(1);
      const wk = latest?.[0];
      if (!wk) { if (!cancelled) { setRows([]); setLoading(false); } return; }
      const [{ data }, { data: past }] = await Promise.all([
        collegeFootballSupabase
          .from('nfl_prop_narratives')
          .select('*')
          .eq('season', wk.season)
          .eq('week', wk.week)
          .order('score', { ascending: false }),
        collegeFootballSupabase
          .from('nfl_prop_narratives')
          .select('*')
          .eq('season', wk.season)
          .not('result', 'is', null)
          .order('week', { ascending: false })
          .order('score', { ascending: false }),
      ]);
      if (!cancelled) {
        const now = Date.now();
        setRows(((data ?? []) as PropRow[]).filter((r) => !r.kickoff || new Date(r.kickoff).getTime() > now));
        setGraded((past ?? []) as PropRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const shown = rows.filter((r) =>
    pos === 'ALL' ? true : pos === 'WR/TE' ? r.position === 'WR' || r.position === 'TE' : r.position === pos,
  );
  const wk = rows[0] ?? graded[0];
  const record = {
    w: graded.filter((r) => r.result === 'win').length,
    l: graded.filter((r) => r.result === 'loss').length,
    p: graded.filter((r) => r.result === 'push').length,
  };
  const lastGradedWeek = graded[0]?.week;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <header>
        <Link to="/nfl/regression-report" className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the NFL regression report
        </Link>
        <h1 className="mt-2 text-3xl font-black">🎯 Player Prop Report{wk ? ` · Week ${wk.week}` : ''}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Players whose numbers stand out against the defense they face this week, with the real posted lines.
          Every card shows what points which way. Nothing here is a pick.
        </p>
        {graded.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-[12px] font-bold">
            📊 Reads this season: {record.w}-{record.l}{record.p ? `-${record.p}` : ''}
            <span className="font-normal text-muted-foreground">
              · {record.w + record.l ? Math.round((100 * record.w) / (record.w + record.l)) : 0}% right, graded vs the line after each game
            </span>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(['ALL', 'QB', 'WR/TE', 'RB'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPos(p)}
              className={cn('rounded-full px-3 py-1 text-[11px] font-bold', pos === p ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      {loading && <p className="text-[13px] text-muted-foreground">Loading…</p>}
      {!loading && shown.length === 0 && (
        <section className="rounded-xl border border-border bg-card p-4 text-[13px] text-muted-foreground">
          No featured props right now. The report rebuilds after the Tuesday and Thursday data pulls, and cards drop off once their game kicks off.
        </section>
      )}
      {shown.map((r) => <PropCard key={r.id} r={r} />)}

      {graded.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            📋 Graded reads{lastGradedWeek ? ` · through week ${lastGradedWeek}` : ''} ({graded.length})
          </h2>
          {graded.slice(0, 20).map((r) => <PropCard key={r.id} r={r} />)}
        </section>
      )}
    </div>
  );
}

export default PropNarrativesPage;
