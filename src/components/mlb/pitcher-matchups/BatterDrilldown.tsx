import React, { useMemo } from 'react';
import type {
  BatterSplitRow,
  BatterVsArchetypeRow,
  BatterVsPitchTypeRow,
  LeagueBenchmarks,
  PitcherArchetypeType,
  PitcherArsenalByHand,
  PitchHand,
} from '@/types/mlb-matchups';
import { BatterVsArchetypeSection } from './BatterVsArchetypeSection';
import { useBatterRecentForm } from '@/hooks/useBatterRecentForm';
import { useBatterVsPitchType } from '@/hooks/useBatterVsPitchType';
import { resolveBenchmark } from '@/hooks/useLeagueBenchmarks';
import { arsenalPitchTypes } from '@/utils/mlbArsenal';
import { abbrevPitchLabel, formatPct, formatRate, formatSlash, hasEnoughPa } from '@/utils/mlbPitcherMatchups';
import { PitchTypeChip } from './PitchTypeChip';
import { ShadedStat } from './ShadedStat';
import { StatWithRecent } from './StatWithRecent';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BatterDrilldownProps {
  split: BatterSplitRow;
  opposingArsenal: PitcherArsenalByHand;
  opposingPitcherName: string;
  opposingPitcherHand: PitchHand;
  vsPitcherHand: PitchHand;
  benchmarks: LeagueBenchmarks;
  season: number;
  /** Preloaded at game level when matchup details load */
  batterVsPitchType?: BatterVsPitchTypeRow[];
  opposingArchetype?: PitcherArchetypeType;
  batterVsArchetype?: BatterVsArchetypeRow | null;
}

function bench(benchmarks: LeagueBenchmarks, key: string) {
  return resolveBenchmark(benchmarks, key);
}

export function BatterDrilldown({
  split,
  opposingArsenal,
  opposingPitcherName,
  opposingPitcherHand,
  vsPitcherHand,
  benchmarks,
  season,
  batterVsPitchType: prefetchedVsPitch = [],
  opposingArchetype = 'Insufficient',
  batterVsArchetype,
}: BatterDrilldownProps) {
  const pitchTypes = useMemo(() => arsenalPitchTypes(opposingArsenal), [opposingArsenal]);
  const hasPrefetch = prefetchedVsPitch.length > 0;

  const { data: fetchedVsPitch = [], isLoading: isFetching } = useBatterVsPitchType(
    split.batter_id,
    vsPitcherHand,
    pitchTypes,
    season,
    !hasPrefetch && pitchTypes.length > 0,
  );

  const vsPitch = hasPrefetch ? prefetchedVsPitch : fetchedVsPitch;
  const isLoading = !hasPrefetch && isFetching;

  const { data: recentForm } = useBatterRecentForm(
    split.batter_id,
    season,
    vsPitcherHand,
    hasEnoughPa(split.pa),
  );

  const vsPitchByType = new Map(vsPitch.map(r => [r.pitch_type, r]));
  const handLong = vsPitcherHand === 'R' ? 'right-handed' : 'left-handed';
  const pitcherHandLong = opposingPitcherHand === 'R' ? 'RHP' : 'LHP';

  if (!hasEnoughPa(split.pa)) {
    return (
      <p className="text-sm text-muted-foreground italic py-3 px-2">
        Not enough data this season (fewer than 30 plate appearances in this split)
      </p>
    );
  }

  return (
    <div className="bg-muted/30 border-t border-border px-2 sm:px-4 py-4 space-y-4">
      <div>
        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-1">
          Full split vs {vsPitcherHand}HP this season ({split.pa} PA)
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          🟢 Top 10% · 🟩 Top 25% · ⚪ League avg · 🟠 Bottom 25% · 🔴 Bottom 10%
        </p>
        <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <ShadedStat label="AVG / OBP / SLG" value={formatSlash(split.avg, split.obp, split.slg)} raw={split.avg} benchmark={bench(benchmarks, 'avg')} />
          <ShadedStat label="OPS" value={formatRate(split.ops)} raw={split.ops} benchmark={bench(benchmarks, 'ops')} />
          <ShadedStat label="ISO" value={formatRate(split.iso)} raw={split.iso} benchmark={bench(benchmarks, 'iso')} />
          <ShadedStat label="wOBA" value={formatRate(split.woba)} raw={split.woba} benchmark={bench(benchmarks, 'woba')} />
          <StatWithRecent
            label="xwOBA"
            seasonValue={split.xwoba}
            recentValue={recentForm?.xwoba}
            formatted={formatRate}
            benchmark={bench(benchmarks, 'xwoba')}
          />
          <ShadedStat label="BABIP" value={formatRate(split.babip)} raw={split.babip} benchmark={bench(benchmarks, 'babip')} />
          <StatWithRecent
            label="K%"
            seasonValue={split.k_pct}
            recentValue={recentForm?.k_pct}
            formatted={formatPct}
            benchmark={bench(benchmarks, 'k_pct')}
            higherIsBetter={false}
          />
          <StatWithRecent
            label="BB%"
            seasonValue={split.bb_pct}
            recentValue={recentForm?.bb_pct}
            formatted={formatPct}
            benchmark={bench(benchmarks, 'bb_pct')}
          />
          <StatWithRecent
            label="Avg exit velo"
            seasonValue={split.avg_exit_velo}
            recentValue={recentForm?.avg_exit_velo}
            formatted={v => (v != null && Number.isFinite(v) ? v.toFixed(1) : '—')}
            benchmark={bench(benchmarks, 'avg_exit_velo')}
          />
          <StatWithRecent
            label="Hard-hit%"
            seasonValue={split.hard_hit_pct}
            recentValue={recentForm?.hard_hit_pct}
            formatted={formatPct}
            benchmark={bench(benchmarks, 'hard_hit_pct')}
          />
          <StatWithRecent
            label="Barrel%"
            seasonValue={split.barrel_pct}
            recentValue={recentForm?.barrel_pct}
            formatted={formatPct}
            benchmark={bench(benchmarks, 'barrel_pct')}
          />
          <ShadedStat label="GB%" value={formatPct(split.gb_pct)} raw={split.gb_pct} benchmark={undefined} />
          <ShadedStat label="FB%" value={formatPct(split.fb_pct)} raw={split.fb_pct} benchmark={undefined} />
          <ShadedStat label="LD%" value={formatPct(split.ld_pct)} raw={split.ld_pct} benchmark={bench(benchmarks, 'ld_pct')} />
          <ShadedStat label="IFFB%" value={formatPct(split.iffb_pct)} raw={split.iffb_pct} benchmark={bench(benchmarks, 'iffb_pct')} higherIsBetter={false} />
          <ShadedStat label="HR/FB%" value={formatPct(split.hr_per_fb_pct)} raw={split.hr_per_fb_pct} benchmark={bench(benchmarks, 'hr_per_fb_pct')} />
          <ShadedStat label="Pull%" value={formatPct(split.pull_pct)} raw={split.pull_pct} benchmark={undefined} />
          <StatWithRecent
            label="Pull-air%"
            seasonValue={split.pull_air_pct}
            recentValue={recentForm?.pull_air_pct}
            formatted={formatPct}
            benchmark={bench(benchmarks, 'pull_air_pct')}
          />
          <ShadedStat label="Center%" value={formatPct(split.center_pct)} raw={split.center_pct} benchmark={undefined} />
          <ShadedStat label="Oppo%" value={formatPct(split.oppo_pct)} raw={split.oppo_pct} benchmark={undefined} />
        </div>
        </TooltipProvider>
      </div>

      <BatterVsArchetypeSection
        split={split}
        vsPitcherHand={vsPitcherHand}
        opposingArchetype={opposingArchetype}
        season={season}
        prefetched={batterVsArchetype}
      />

      <div>
        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-1">
          vs {opposingPitcherName}&apos;s pitch mix (as a {pitcherHandLong})
        </h4>
        <p className="text-[10px] text-muted-foreground mb-2 leading-snug">
          Stats below are this batter&apos;s performance vs all {handLong} pitching this season,
          filtered to pitches {opposingPitcherName} actually throws.
        </p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading pitch-type matchup…
          </div>
        ) : pitchTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">
            No pitch mix data for this starter yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[4.75rem]">Pitch</TableHead>
                  <TableHead className="text-xs">Seen</TableHead>
                  <TableHead className="text-xs">AVG</TableHead>
                  <TableHead className="text-xs">SLG</TableHead>
                  <TableHead className="text-xs">xwOBA</TableHead>
                  <TableHead className="text-xs">Whiff%</TableHead>
                  <TableHead className="text-xs">GB%</TableHead>
                  <TableHead className="text-xs">FB%</TableHead>
                  <TableHead className="text-xs">HR/FB%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pitchTypes.map(pt => {
                  const arsenalPitch = [...opposingArsenal.A, ...opposingArsenal.R, ...opposingArsenal.L].find(
                    p => p.pitch_type === pt,
                  );
                  const row = vsPitchByType.get(pt);
                  const label = arsenalPitch?.pitch_type_label ?? pt;
                  if (!row || (row.pitches_seen ?? 0) < 10) {
                    return (
                      <TableRow key={pt}>
                        <TableCell className="w-[4.75rem] py-1.5">
                          <PitchTypeChip pitchType={pt} label={label} />
                        </TableCell>
                        <TableCell colSpan={8} className="text-xs italic text-muted-foreground">
                          Not enough data
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return (
                    <TableRow key={pt}>
                      <TableCell className="w-[4.75rem] py-1.5">
                        <PitchTypeChip pitchType={pt} label={label} />
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{row.pitches_seen}</TableCell>
                      <TableCell className="text-xs tabular-nums">{formatRate(row.avg)}</TableCell>
                      <TableCell className="text-xs tabular-nums">{formatRate(row.slg)}</TableCell>
                      <TableCell className="text-xs tabular-nums">{formatRate(row.xwoba)}</TableCell>
                      <TableCell className="text-xs tabular-nums">{formatPct(row.whiff_pct)}</TableCell>
                      <TableCell className="text-xs tabular-nums">{formatPct(row.gb_pct)}</TableCell>
                      <TableCell className="text-xs tabular-nums">{formatPct(row.fb_pct)}</TableCell>
                      <TableCell className="text-xs tabular-nums">{formatPct(row.hr_per_fb_pct)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
