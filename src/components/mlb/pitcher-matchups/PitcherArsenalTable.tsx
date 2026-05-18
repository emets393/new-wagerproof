import React, { useMemo, useState } from 'react';
import type { PitcherArsenalRow } from '@/types/mlb-matchups';
import { PitchTypeChip } from './PitchTypeChip';
import { formatPct, formatRate } from '@/utils/mlbPitcherMatchups';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type SortKey = 'usage_pct' | 'avg_velo' | 'whiff_pct' | 'xwoba_allowed';

interface PitcherArsenalTableProps {
  arsenal: PitcherArsenalRow[];
}

export function PitcherArsenalTable({ arsenal }: PitcherArsenalTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('usage_pct');
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    const filtered = arsenal.filter(p => (p.pitches_thrown ?? 0) >= 25);
    return [...filtered].sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? 0;
      const bv = (b[sortKey] as number | null) ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
  }, [arsenal, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const th = (key: SortKey, label: string, title: string) => (
    <TableHead
      className="cursor-pointer whitespace-nowrap text-xs"
      onClick={() => toggleSort(key)}
      title={title}
    >
      {label}
      {sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </TableHead>
  );

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4">No arsenal data available</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs w-[4.75rem]">Pitch</TableHead>
            {th('usage_pct', 'Usage', 'Usage percentage')}
            {th('avg_velo', 'Velocity', 'Average velocity (mph)')}
            <TableHead className="text-xs" title="Average spin rate">
              Spin
            </TableHead>
            <TableHead className="text-xs" title="Horizontal and vertical break">
              Movement
            </TableHead>
            {th('whiff_pct', 'Whiff%', 'Whiff percentage')}
            {th('xwoba_allowed', 'xwOBA', 'Expected weighted on-base average allowed')}
            <TableHead className="text-xs">Ground%</TableHead>
            <TableHead className="text-xs">Fly%</TableHead>
            <TableHead className="text-xs">Line%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(p => {
            const smallSample = (p.pitches_thrown ?? 0) < 100;
            const badXwoba = (p.xwoba_allowed ?? 0) > 0.35;
            return (
              <TableRow key={p.pitch_type}>
                <TableCell className="py-1.5 w-[4.75rem]">
                  <PitchTypeChip pitchType={p.pitch_type} label={p.pitch_type_label} />
                  {smallSample ? (
                    <span className="text-[10px] text-muted-foreground ml-1" title="Fewer than 100 pitches">
                      *
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs tabular-nums">{formatPct(p.usage_pct)}</TableCell>
                <TableCell className="text-xs tabular-nums">
                  {p.avg_velo?.toFixed(1) ?? '—'}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {p.avg_spin_rpm != null ? Math.round(p.avg_spin_rpm) : '—'}
                </TableCell>
                <TableCell className="text-xs tabular-nums whitespace-nowrap">
                  {p.avg_horizontal_break != null && p.avg_vertical_break != null
                    ? `${p.avg_horizontal_break.toFixed(0)}" H / ${p.avg_vertical_break.toFixed(0)}" V`
                    : '—'}
                </TableCell>
                <TableCell className="text-xs tabular-nums">{formatPct(p.whiff_pct)}</TableCell>
                <TableCell
                  className={cn('text-xs tabular-nums', badXwoba && 'text-red-600 dark:text-red-400')}
                >
                  {formatRate(p.xwoba_allowed)}
                </TableCell>
                <TableCell className="text-xs tabular-nums">{formatPct(p.gb_pct)}</TableCell>
                <TableCell className="text-xs tabular-nums">{formatPct(p.fb_pct)}</TableCell>
                <TableCell className="text-xs tabular-nums">{formatPct(p.ld_pct)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
