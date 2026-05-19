import React from 'react';
import type { BatterSplitRow, PitchHand } from '@/types/mlb-matchups';
import { useBatterVsArchetype } from '@/hooks/useBatterVsArchetype';
import { formatPct, formatRate, formatSlash, toMilliRate } from '@/utils/mlbPitcherMatchups';
import {
  ARCHETYPE_META,
  archetypeHandLabel,
  MIN_PA_VS_ARCHETYPE_DISPLAY,
  MIN_PA_VS_ARCHETYPE_SMALL_SAMPLE,
  type BatterVsArchetypeRow,
  type DisplayPitcherArchetype,
  type PitcherArchetypeType,
} from '@/utils/mlbPitcherArchetypes';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatterVsArchetypeSectionProps {
  split: BatterSplitRow;
  vsPitcherHand: PitchHand;
  opposingArchetype: PitcherArchetypeType;
  season: number;
  /** When provided (game-level prefetch), skips lazy query */
  prefetched?: BatterVsArchetypeRow | null;
}

function DeltaLine({
  label,
  delta,
  format,
}: {
  label: string;
  delta: number | null;
  format: (v: number) => string;
}) {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < 0.001) return null;
  const up = delta > 0;
  return (
    <span className={cn(up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {label} {format(Math.abs(delta))} {up ? '↑' : '↓'}
    </span>
  );
}

function ArchetypeStatsBody({
  vsArch,
  split,
  archetype,
  vsPitcherHand,
}: {
  vsArch: BatterVsArchetypeRow;
  split: BatterSplitRow;
  archetype: DisplayPitcherArchetype;
  vsPitcherHand: PitchHand;
}) {
  const meta = ARCHETYPE_META[archetype];
  const xwobaDelta =
    vsArch.xwoba != null && split.xwoba != null ? vsArch.xwoba - split.xwoba : null;
  const slgDelta = vsArch.slg != null && split.slg != null ? vsArch.slg - split.slg : null;
  const hrPaDelta =
    vsArch.hr_per_pa != null && split.hr_per_pa != null
      ? vsArch.hr_per_pa - split.hr_per_pa
      : null;

  const powerNeutralized =
    archetype === 'Groundball' &&
    xwobaDelta != null &&
    xwobaDelta <= -0.03 &&
    slgDelta != null &&
    slgDelta <= -0.08;

  const crushesArchetype = xwobaDelta != null && xwobaDelta >= 0.04;
  const smallSample = vsArch.pa < MIN_PA_VS_ARCHETYPE_SMALL_SAMPLE;

  return (
    <div className="space-y-2 text-xs sm:text-sm">
      {smallSample ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Small sample — only {vsArch.pa} PA vs {archetype} {archetypeHandLabel(vsPitcherHand)} this
          season. Treat deltas with caution.
        </p>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-foreground">
        <div>
          <span className="text-muted-foreground">PA</span>
          <p className="font-semibold tabular-nums">{vsArch.pa}</p>
        </div>
        <div>
          <span className="text-muted-foreground">K%</span>
          <p className="font-semibold tabular-nums">{formatPct(vsArch.k_pct)}</p>
        </div>
        <div className="col-span-2 sm:col-span-2">
          <span className="text-muted-foreground">AVG/OBP/SLG</span>
          <p className="font-semibold tabular-nums">
            {formatSlash(vsArch.avg, vsArch.obp, vsArch.slg)}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">xwOBA</span>
          <p className="font-semibold tabular-nums">{formatRate(vsArch.xwoba)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Barrel%</span>
          <p className="font-semibold tabular-nums">{formatPct(vsArch.barrel_pct)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Hard-hit%</span>
          <p className="font-semibold tabular-nums">{formatPct(vsArch.hard_hit_pct)}</p>
        </div>
      </div>

      <div className="rounded-md bg-muted/40 px-2 py-1.5 space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Compared to overall vs {vsPitcherHand}HP
        </p>
        <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
          <DeltaLine label="xwOBA" delta={xwobaDelta} format={v => toMilliRate(v)} />
          <DeltaLine label="SLG" delta={slgDelta} format={v => toMilliRate(v)} />
          <DeltaLine label="HR/PA" delta={hrPaDelta} format={v => v.toFixed(3)} />
        </p>
        {powerNeutralized ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This hitter&apos;s power is neutralized vs {archetype.toLowerCase()} arms.
          </p>
        ) : null}
        {crushesArchetype ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Performs well above their overall vs {archetypeHandLabel(vsPitcherHand)} when facing{' '}
            {meta.label.toLowerCase()}s.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function BatterVsArchetypeSection({
  split,
  vsPitcherHand,
  opposingArchetype,
  season,
  prefetched,
}: BatterVsArchetypeSectionProps) {
  const hasPrefetch = prefetched !== undefined;
  const { data: fetched, isLoading } = useBatterVsArchetype(
    split.batter_id,
    season,
    vsPitcherHand,
    opposingArchetype,
    !hasPrefetch,
  );

  const vsArch = hasPrefetch ? prefetched : fetched;

  if (!ARCHETYPE_META[opposingArchetype as DisplayPitcherArchetype] && opposingArchetype !== 'Balanced') {
    if (opposingArchetype === 'Insufficient') return null;
  }

  const displayArch =
    opposingArchetype === 'Balanced' || opposingArchetype in ARCHETYPE_META
      ? (opposingArchetype as DisplayPitcherArchetype)
      : null;

  if (!displayArch) return null;

  const meta = ARCHETYPE_META[displayArch];
  const handLbl = archetypeHandLabel(vsPitcherHand);

  return (
    <section>
      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-0.5 flex items-center gap-1.5 flex-wrap">
        <span>
          vs {displayArch} Pitchers {meta.icon}
        </span>
        <Tooltip>
          <TooltipTrigger asChild touchTapMode="toggle">
            <span className="text-[10px] font-normal normal-case text-muted-foreground cursor-help underline decoration-dotted">
              ({handLbl} only)
            </span>
          </TooltipTrigger>
          <TooltipContent className="text-xs max-w-xs">
            All batters vs same-hand pitchers classified as {displayArch.toLowerCase()} this season.
          </TooltipContent>
        </Tooltip>
      </h4>
      <p className="text-[10px] text-muted-foreground mb-2 leading-snug">
        Performance vs the {meta.label.toLowerCase()} bucket — not only {split.batter_name}&apos;s
        matchup tonight.
      </p>

      {isLoading && !hasPrefetch ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading vs {displayArch.toLowerCase()} pitchers…
        </div>
      ) : !vsArch || vsArch.pa < MIN_PA_VS_ARCHETYPE_DISPLAY ? (
        <p className="text-sm text-muted-foreground italic py-1">
          Not enough data — only {vsArch?.pa ?? 0} PA vs {displayArch} {handLbl} this season
        </p>
      ) : (
        <ArchetypeStatsBody
          vsArch={vsArch}
          split={split}
          archetype={displayArch}
          vsPitcherHand={vsPitcherHand}
        />
      )}
    </section>
  );
}
