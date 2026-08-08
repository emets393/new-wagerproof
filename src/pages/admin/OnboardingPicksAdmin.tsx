import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  buildOnboardingTeaserPreview,
  ONBOARDING_TEASER_FEED_LIMIT,
  type OnboardingTeaserPick,
} from '@/features/admin/onboardingTeaserPicks';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { cn } from '@/lib/utils';
import { fetchTopAgentPicksFeed } from '@/services/agentPicksService';
import { getAvatarBackground } from '@/utils/agentColors';

const EASTERN_TIME_ZONE = 'America/New_York';

function easternDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function formatDay(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function PickCard({ pick, position }: { pick: OnboardingTeaserPick; position: number }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
      <div className="h-1 bg-honeydew-500" aria-hidden />
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary">Pick {position}</Badge>
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {pick.sport === 'ncaab' ? 'CBB' : pick.sport.toUpperCase()}
          </span>
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-black tracking-tight text-foreground">{pick.selection}</h2>
          <span className="shrink-0 font-mono text-sm font-bold text-honeydew-700 dark:text-honeydew-300">
            {pick.odds || '—'}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{pick.matchup}</p>

        <div className="mt-5 flex items-center gap-3 border-t border-border/60 pt-4">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base"
            style={{ background: getAvatarBackground(pick.agentColor) }}
            aria-hidden
          >
            {pick.agentEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{pick.agentName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {pick.source === 'fixture'
                ? 'Bundled fallback'
                : `${pick.agentRank ? `Rank #${pick.agentRank} · ` : ''}${formatTimestamp(pick.createdAt!)}`}
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatDay(pick.gameDate)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OnboardingPicksAdmin() {
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const todayEt = easternDateKey();
  const {
    data: candidates = [],
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'onboarding-teaser-picks'],
    queryFn: () => fetchTopAgentPicksFeed('top10', undefined, undefined, ONBOARDING_TEASER_FEED_LIMIT),
    enabled: isAdmin,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  if (checkingAdmin) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-honeydew-500 motion-reduce:animate-none" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/home" replace />;

  const preview = buildOnboardingTeaserPreview(candidates, [], todayEt);
  const usingFallback = candidates.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-honeydew-500/25 bg-honeydew-500/10 text-honeydew-700 dark:text-honeydew-300">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-foreground">Today&apos;s onboarding picks</h1>
              <Badge variant="outline">Read only</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              The central picks currently teased after a new agent is created.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="self-start rounded-xl sm:self-auto"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin motion-reduce:animate-none')} />
          Refresh
        </Button>
      </header>

      {isLoading ? (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Loading today&apos;s picks…
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            className={cn(
              'flex items-start gap-3 rounded-2xl border px-4 py-3.5',
              usingFallback
                ? 'border-amber-500/25 bg-amber-500/[0.06]'
                : 'border-honeydew-500/25 bg-honeydew-500/[0.06]',
            )}
          >
            {usingFallback ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-honeydew-700 dark:text-honeydew-300" />
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              {usingFallback
                ? `The live feed ${error ? 'could not be loaded' : 'is empty'}, so these are the bundled fallback picks onboarding shows.`
                : error
                  ? 'Showing the last successfully loaded onboarding picks; the latest refresh failed.'
                  : `Live feed loaded. These are the first three picks in today’s central order as of ${formatTimestamp(candidates[0].created_at)}.`}
            </p>
          </div>

          <section aria-label="Onboarding teaser picks" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {preview.picks.map((pick, index) => (
              <PickCard key={pick.id} pick={pick} position={index + 1} />
            ))}
          </section>

          <p className="text-xs leading-5 text-muted-foreground">
            New users who select specific sports see the first three matching picks from this same central feed. These tickets are display-only and are not added to the new agent&apos;s record.
          </p>
        </>
      )}
    </div>
  );
}
