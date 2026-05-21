import React, { useMemo, useState } from 'react';
import { useTodaysMatchupGames } from '@/hooks/useTodaysMatchupGames';
import { useAllMatchupData } from '@/hooks/useAllMatchupData';
import { useLeagueBenchmarks } from '@/hooks/useLeagueBenchmarks';
import {
  useMLBPitcherMatchupsReport,
  type MLBPitcherMatchupsReport,
  type PitcherReportHROpportunity,
  type PitcherReportPitchMatchup,
} from '@/hooks/useMLBPitcherMatchupsReport';
import { GameMatchupCard } from '@/components/mlb/pitcher-matchups/GameMatchupCard';
import { formatGameDateLabel, seasonFromDate } from '@/utils/mlbPitcherMatchups';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, BarChart3, Clock, Flame, RefreshCw, Target, Zap } from 'lucide-react';

function GameCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const diff = Date.now() - then;
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(3).replace(/^0/, '');
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(1).replace(/\.0$/, '')}%`;
}

function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-lg font-bold mt-5 mb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-2">$1</h2>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-primary/50 pl-4 py-1 my-3 bg-primary/5 rounded-r italic">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="my-4 border-muted-foreground/20"/>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br/>');
}

function ReportStatusBadge({ status }: { status: string | null | undefined }) {
  if (status === 'confirmed') return null;
  return (
    <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
      Preliminary — projected lineups
    </Badge>
  );
}

function reportTeaser(report: MLBPitcherMatchupsReport | null): string {
  if (!report) return 'Report not yet generated — check back closer to first pitch';
  const topPlays = report.top_plays ?? {};
  const hr = topPlays.hr_opportunities?.[0];
  if (hr?.batter) return `🔥 Top HR spot: ${hr.batter}${hr.vs ? ` vs ${hr.vs}` : ''}`;
  const hot = topPlays.hottest_batters?.[0];
  if (hot?.batter) return `📈 Hot bat: ${hot.batter}${hot.matchup ? ` · ${hot.matchup}` : ''}`;
  const notable = topPlays.notable_pitch_matchups?.length ?? 0;
  if (notable > 0) return `${notable} notable pitch matchups`;
  return 'Daily AI breakdown of hitter, pitcher, and pitch-mix edges';
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  const n = Number(score ?? 0);
  const className = n >= 80
    ? 'bg-emerald-500 text-white'
    : n >= 65
      ? 'bg-amber-500 text-white'
      : 'bg-muted text-muted-foreground';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${className}`}>{Number.isFinite(n) && n > 0 ? Math.round(n) : '—'}</span>;
}

function ReportRow({
  title,
  meta,
  score,
  tone = 'neutral',
  limited,
}: {
  title: string;
  meta?: string;
  score?: number | null;
  tone?: 'hitter' | 'pitcher' | 'neutral';
  limited?: boolean | null;
}) {
  const borderClass = tone === 'hitter'
    ? 'border-emerald-500/35'
    : tone === 'pitcher'
      ? 'border-red-500/35'
      : 'border-border';

  return (
    <div className={`rounded-lg border ${borderClass} p-3 space-y-1`}>
      <div className="flex items-start gap-2">
        <p className="text-sm font-semibold text-foreground flex-1 min-w-0">{title}</p>
        {score != null ? <ScoreBadge score={score} /> : null}
      </div>
      {meta ? <p className="text-xs text-muted-foreground leading-relaxed">{meta}</p> : null}
      {limited ? <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">limited</Badge> : null}
    </div>
  );
}

function HRReportSection({ items }: { items: PitcherReportHROpportunity[] | undefined }) {
  if (!items?.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold flex items-center gap-2"><Flame className="h-4 w-4 text-emerald-500" /> HR Opportunities</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.slice(0, 8).map((item, idx) => (
          <ReportRow
            key={`${item.batter}-${idx}`}
            title={`${item.batter}${item.vs ? ` vs ${item.vs}` : ''}`}
            meta={`${item.matchup ?? item.team ?? ''}${item.l10_xwoba != null ? ` · L10 xwOBA ${formatRate(item.l10_xwoba)}` : ''}`}
            score={item.hr_score}
            tone="hitter"
            limited={item.limited_sample}
          />
        ))}
      </div>
    </section>
  );
}

function HottestBatsSection({ items }: { items: PitcherReportHROpportunity[] | undefined }) {
  if (!items?.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-500" /> Hottest Bats</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.slice(0, 8).map((item, idx) => (
          <ReportRow
            key={`${item.batter}-${idx}`}
            title={item.batter}
            meta={`L10 xwOBA ${formatRate(item.l10_xwoba)}${item.matchup ? ` · ${item.matchup}` : ''}`}
            score={item.hr_score}
            tone="hitter"
            limited={item.limited_sample}
          />
        ))}
      </div>
    </section>
  );
}

function PitchMatchupsSection({ items }: { items: PitcherReportPitchMatchup[] | undefined }) {
  if (!items?.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Pitch Matchups</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.slice(0, 10).map((item, idx) => {
          const hitterFav = item.type !== 'pitcher';
          const title = hitterFav
            ? `${item.batter ?? 'Batter'} vs ${item.opp_pitcher ?? 'pitcher'} ${item.pitch ?? ''}`
            : `${item.opp_pitcher ?? 'Pitcher'} ${item.pitch ?? ''} vs ${item.batter ?? 'batter'}`;
          const meta = hitterFav
            ? `${formatPct(item.usage)} usage · ${formatRate(item.xwoba)} xwOBA`
            : `${formatPct(item.usage)} usage · ${formatPct(item.whiff)} whiff`;
          return (
            <ReportRow
              key={`${title}-${idx}`}
              title={title}
              meta={`${meta}${item.matchup ? ` · ${item.matchup}` : ''}`}
              tone={hitterFav ? 'hitter' : 'pitcher'}
              limited={item.limited}
            />
          );
        })}
      </div>
    </section>
  );
}

function PitcherMatchupsReportDialog({
  open,
  report,
  onOpenChange,
}: {
  open: boolean;
  report: MLBPitcherMatchupsReport | null | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const html = report?.narrative_text ? simpleMarkdownToHtml(report.narrative_text) : '';
  const topPlays = report?.top_plays ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <DialogTitle>Pitcher Matchups Report — {report?.report_date ?? ''}</DialogTitle>
              {report ? (
                <p className="text-xs text-muted-foreground">
                  Updated {timeAgo(report.generated_at)} · {report.games_count} games
                </p>
              ) : null}
            </div>
            <ReportStatusBadge status={report?.lineups_status} />
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {html ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="py-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" /> AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="max-w-none text-sm leading-relaxed">
                <div dangerouslySetInnerHTML={{ __html: html }} />
              </CardContent>
            </Card>
          ) : null}

          {topPlays ? (
            <div className="space-y-5">
              <HRReportSection items={topPlays.hr_opportunities} />
              <HottestBatsSection items={topPlays.hottest_batters} />
              <PitchMatchupsSection items={topPlays.notable_pitch_matchups} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PitcherMatchups() {
  const { data: games = [], isLoading, isError, error, refetch } = useTodaysMatchupGames();
  const {
    data: report = null,
    isLoading: reportLoading,
    refetch: refetchReport,
  } = useMLBPitcherMatchupsReport();
  const season = games[0] ? seasonFromDate(games[0].official_date) : new Date().getFullYear();

  const { dataByGamePk, isLoading: matchupLoading } = useAllMatchupData(games, games.length > 0);

  const { data: benchmarksR = {} } = useLeagueBenchmarks(season, 'R');
  const { data: benchmarksL = {} } = useLeagueBenchmarks(season, 'L');

  const [reportOpen, setReportOpen] = useState(false);

  const gamesByDate = useMemo(() => {
    const map = new Map<string, typeof games>();
    for (const game of games) {
      const key = game.official_date || 'unknown';
      const list = map.get(key) ?? [];
      list.push(game);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [games]);

  const errorMessage = error instanceof Error ? error.message : 'Failed to load pitcher matchups';

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl space-y-5 sm:space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground leading-tight">
            ⚾ Pitcher Matchups
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Tonight&apos;s starters, arsenals, platoon edges, and AI report breakdown
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {reportLoading ? (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading report
              </span>
            ) : report ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Report updated {timeAgo(report.generated_at)}
                </span>
                <ReportStatusBadge status={report.lineups_status} />
              </>
            ) : (
              <span>Report not yet generated — check back closer to first pitch</span>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
          <Button
            size="sm"
            onClick={() => setReportOpen(true)}
            disabled={reportLoading || !report}
            className="w-full sm:w-auto"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            View Pitcher Matchups Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch();
              refetchReport();
            }}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>{errorMessage}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <GameCardSkeleton />
          <GameCardSkeleton />
        </div>
      ) : games.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No MLB games scheduled
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {gamesByDate.map(([dateKey, dateGames]) => (
            <section key={dateKey} className="space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-foreground border-b border-border pb-2 flex flex-wrap items-baseline gap-x-2">
                <span>📅 {formatGameDateLabel(dateKey)}</span>
                <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                  {dateGames.length} {dateGames.length === 1 ? 'game' : 'games'}
                </span>
              </h2>
              <div className="space-y-4 sm:space-y-6">
                {dateGames.map((game, idx) => (
                  <GameMatchupCard
                    key={game.game_pk}
                    game={game}
                    eagerLoad={idx < 5}
                    prefetchedData={dataByGamePk.get(game.game_pk) ?? null}
                    prefetchedLoading={matchupLoading}
                    benchmarksR={benchmarksR}
                    benchmarksL={benchmarksL}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <PitcherMatchupsReportDialog
        open={reportOpen}
        report={report}
        onOpenChange={setReportOpen}
      />
    </div>
  );
}
