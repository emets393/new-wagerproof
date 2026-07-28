import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard, WidgetCard } from '@/components/ios';
import {
  useMLBPitcherMatchupsReport,
  type PropPick,
} from '@/hooks/useMLBPitcherMatchupsReport';
import { pickIsLocked, useSnapshotPlayerPropPicks } from '@/hooks/useSnapshotPlayerPropPicks';
import { Link } from 'react-router-dom';
import { PickCard } from './PickCard';
import { todayET } from './format';

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{title}</h2>
      <span className="text-xs tabular-nums text-muted-foreground">
        {count} {count === 1 ? 'pick' : 'picks'}
      </span>
    </div>
  );
}

function TierGroup({
  label,
  picks,
  context,
  lockedKeys,
}: {
  label: string;
  picks: PropPick[];
  context: ReturnType<typeof useMLBPitcherMatchupsReport>;
  lockedKeys: Set<string>;
}) {
  if (picks.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {picks.map((p) => (
        <PickCard
          key={`${p.kind}-${p.player_id}-${p.market}`}
          pick={p}
          context={context}
          locked={pickIsLocked(p, lockedKeys)}
        />
      ))}
    </div>
  );
}

function filterTier(picks: PropPick[], tier: PropPick['tier']) {
  return picks.filter((p) => p.tier === tier);
}

export function TodaysPicksPanel() {
  const context = useMLBPitcherMatchupsReport();
  const { report, isLoading, isError } = context;

  const allPicks = React.useMemo(
    () => [...(report?.batter_picks ?? []), ...(report?.pitcher_picks ?? [])],
    [report],
  );
  const lockedKeys = useSnapshotPlayerPropPicks(
    report ? todayET() : null,
    allPicks,
    !isLoading && !!report && allPicks.length > 0,
  );

  const batters = report?.batter_picks ?? [];
  const pitchers = report?.pitcher_picks ?? [];

  return (
    <div className="space-y-5">
      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load today&apos;s data.</AlertDescription>
        </Alert>
      ) : null}

      <WidgetCard
        title="How picks are ranked"
        subtitle="Every posted prop is scored out of 100. Tap a card for the score breakdown and full matchup detail."
      >
        <div className="space-y-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <p>
            <span className="font-semibold text-foreground">L10 hit rate</span> is the spine
            (40 pts). Credit is added for{' '}
            <span className="font-semibold text-foreground">day/night fit</span>,{' '}
            <span className="font-semibold text-foreground">opposing-pitcher archetype</span>{' '}
            (batters),{' '}
            <span className="font-semibold text-foreground">opposing-lineup K% vulnerability</span>{' '}
            (pitchers), and{' '}
            <span className="font-semibold text-foreground">underlying form</span> from L10 splits.
            Plus-money Overs get a small boost; juiced Overs get a haircut.
          </p>
          <p>
            Tiers:{' '}
            <span className="font-semibold text-foreground">Elite 75+</span>
            {' · '}
            <span className="font-semibold text-foreground">Strong 62–74</span>
            {' · '}
            <span className="font-semibold text-foreground">Lean 50–61</span>
            . Explore every posted line on{' '}
            <Link to="/mlb/pitcher-matchups" className="font-semibold text-primary hover:underline">
              Prop Matchups
            </Link>
            .
          </p>
        </div>
      </WidgetCard>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : !report || (batters.length === 0 && pitchers.length === 0) ? (
        <GlassCard radius={20} className="px-4 py-12 text-center">
          <p className="text-lg font-semibold text-foreground">No qualified picks right now</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Props score by L10 hit rate + day/night + archetype + recent form. Check back closer to
            first pitch — the slate may not have enough sample yet.
          </p>
        </GlassCard>
      ) : (
        <>
          {batters.length > 0 ? (
            <section className="space-y-3">
              <SectionHeader title="Batter picks" count={batters.length} />
              <TierGroup
                label="Elite"
                picks={filterTier(batters, 'elite')}
                context={context}
                lockedKeys={lockedKeys}
              />
              <TierGroup
                label="Strong"
                picks={filterTier(batters, 'strong')}
                context={context}
                lockedKeys={lockedKeys}
              />
              <TierGroup
                label="Lean"
                picks={filterTier(batters, 'lean')}
                context={context}
                lockedKeys={lockedKeys}
              />
            </section>
          ) : null}

          {pitchers.length > 0 ? (
            <section className="space-y-3">
              <SectionHeader title="Pitcher picks" count={pitchers.length} />
              <TierGroup
                label="Elite"
                picks={filterTier(pitchers, 'elite')}
                context={context}
                lockedKeys={lockedKeys}
              />
              <TierGroup
                label="Strong"
                picks={filterTier(pitchers, 'strong')}
                context={context}
                lockedKeys={lockedKeys}
              />
              <TierGroup
                label="Lean"
                picks={filterTier(pitchers, 'lean')}
                context={context}
                lockedKeys={lockedKeys}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
