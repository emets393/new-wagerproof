import React, { useMemo } from 'react';
import type { BatterSplitRow, BatterVsPitchTypeRow, PitcherArsenalRow, PitchHand } from '@/types/mlb-matchups';
import { useBatterVsPitchType } from '@/hooks/useBatterVsPitchType';
import { formatPct, formatRate, formatSlash, hasEnoughPa, hasEnoughPitchesSeen } from '@/utils/mlbPitcherMatchups';
import { PitchTypeChip } from './PitchTypeChip';
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
  opposingArsenal: PitcherArsenalRow[];
  vsPitcherHand: PitchHand;
  season: number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function BatterDrilldown({
  split,
  opposingArsenal,
  vsPitcherHand,
  season,
}: BatterDrilldownProps) {
  const pitchTypes = useMemo(
    () =>
      opposingArsenal
        .filter(p => (p.pitches_thrown ?? 0) >= 25)
        .map(p => p.pitch_type),
    [opposingArsenal],
  );

  const { data: vsPitch = [], isLoading } = useBatterVsPitchType(
    split.batter_id,
    vsPitcherHand,
    pitchTypes,
    season,
    true,
  );

  const vsPitchByType = new Map(vsPitch.map(r => [r.pitch_type, r]));

  if (!hasEnoughPa(split.pa)) {
    return (
      <p className="text-sm text-muted-foreground italic py-3 px-2">
        Not enough data this season (fewer than 5 plate appearances in this split)
      </p>
    );
  }

  return (
    <div className="bg-muted/30 border-t border-border px-2 sm:px-4 py-4 space-y-4">
      <div>
        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">
          Full split vs {vsPitcherHand === 'R' ? 'right' : 'left'}-handed pitching
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <Stat label="Plate appearances" value={String(split.pa)} />
          <Stat label="AVG / OBP / SLG" value={formatSlash(split.avg, split.obp, split.slg)} />
          <Stat label="On-base plus slugging" value={formatRate(split.ops)} />
          <Stat label="Isolated power" value={formatRate(split.iso)} />
          <Stat label="Weighted on-base average" value={formatRate(split.woba)} />
          <Stat label="Expected weighted on-base average" value={formatRate(split.xwoba)} />
          <Stat label="Batting average on balls in play" value={formatRate(split.babip)} />
          <Stat label="Strikeout rate" value={formatPct(split.k_pct)} />
          <Stat label="Walk rate" value={formatPct(split.bb_pct)} />
          <Stat label="Average exit velocity" value={split.avg_exit_velo?.toFixed(1) ?? '—'} />
          <Stat label="Hard-hit rate" value={formatPct(split.hard_hit_pct)} />
          <Stat label="Barrel rate" value={formatPct(split.barrel_pct)} />
          <Stat label="Ground-ball rate" value={formatPct(split.gb_pct)} />
          <Stat label="Fly-ball rate" value={formatPct(split.fb_pct)} />
          <Stat label="Line-drive rate" value={formatPct(split.ld_pct)} />
          <Stat label="Infield fly-ball rate" value={formatPct(split.iffb_pct)} />
          <Stat label="Home runs per fly ball" value={formatPct(split.hr_per_fb_pct)} />
          <Stat label="Pull rate" value={formatPct(split.pull_pct)} />
          <Stat label="Pull-air rate" value={formatPct(split.pull_air_pct)} />
          <Stat label="Center rate" value={formatPct(split.center_pct)} />
          <Stat label="Opposite-field rate" value={formatPct(split.oppo_pct)} />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">
          vs opposing pitcher&apos;s arsenal
        </h4>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading pitch-type matchup…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[4.75rem]">Pitch</TableHead>
                  <TableHead className="text-xs">Pitches seen</TableHead>
                  <TableHead className="text-xs">Average</TableHead>
                  <TableHead className="text-xs">Slugging</TableHead>
                  <TableHead className="text-xs">xwOBA</TableHead>
                  <TableHead className="text-xs">Whiff%</TableHead>
                  <TableHead className="text-xs">Ground%</TableHead>
                  <TableHead className="text-xs">Fly%</TableHead>
                  <TableHead className="text-xs">HR/FB%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pitchTypes.map(pt => {
                  const arsenalPitch = opposingArsenal.find(p => p.pitch_type === pt);
                  const row = vsPitchByType.get(pt);
                  const label = arsenalPitch?.pitch_type_label ?? pt;
                  if (!row || !hasEnoughPitchesSeen(row.pitches_seen)) {
                    return (
                      <TableRow key={pt}>
                        <TableCell className="w-[4.75rem] py-1.5">
                          <PitchTypeChip pitchType={pt} label={label} />
                        </TableCell>
                        <TableCell colSpan={7} className="text-xs italic text-muted-foreground">
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
