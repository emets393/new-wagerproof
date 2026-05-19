import React, { useMemo, useState } from 'react';
import type { PitcherArsenalByHand, PitcherArsenalRow } from '@/types/mlb-matchups';
import { PitchTypeChip } from './PitchTypeChip';
import { InsightChips } from './InsightChips';
import type { Insight } from '@/types/mlb-matchups';
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
  arsenal: PitcherArsenalByHand;
  pitcherName: string;
  pitcherId: number;
}

function mixShiftInsights(
  arsenal: PitcherArsenalByHand,
  pitcherId: number,
  pitcherName: string,
): Insight[] {
  const out: Insight[] = [];
  const byType = new Map<string, { r?: PitcherArsenalRow; l?: PitcherArsenalRow }>();
  for (const row of arsenal.R) {
    const cur = byType.get(row.pitch_type) ?? {};
    cur.r = row;
    byType.set(row.pitch_type, cur);
  }
  for (const row of arsenal.L) {
    const cur = byType.get(row.pitch_type) ?? {};
    cur.l = row;
    byType.set(row.pitch_type, cur);
  }
  for (const [pitchType, { r, l }] of byType) {
    if (!r || !l) continue;
    const diff = Math.abs((r.usage_pct ?? 0) - (l.usage_pct ?? 0));
    if (diff < 15) continue;
    const moreVs = (r.usage_pct ?? 0) > (l.usage_pct ?? 0) ? 'RHB' : 'LHB';
    const label = r.pitch_type_label || l.pitch_type_label || pitchType;
    out.push({
      id: `table_mix_${pitcherId}_${pitchType}`,
      icon: '💡',
      tone: 'neutral',
      scope: 'pitcher',
      pitcher_id: pitcherId,
      priority: 60,
      headline: `💡 Platoon mix shift: ${label} +${Math.round(diff)}pp vs ${moreVs}`,
      detail: `${pitcherName} throws ${label} ${Math.round(r.usage_pct ?? 0)}% vs RHB and ${Math.round(l.usage_pct ?? 0)}% vs LHB.`,
    });
    if (out.length >= 2) break;
  }
  return out;
}

function ArsenalBody({
  rows,
  sortKey,
  sortAsc,
  onSort,
}: {
  rows: PitcherArsenalRow[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? 0;
      const bv = (b[sortKey] as number | null) ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
  }, [rows, sortKey, sortAsc]);

  const th = (key: SortKey, label: string, title: string) => (
    <TableHead
      className="cursor-pointer whitespace-nowrap text-xs"
      onClick={() => onSort(key)}
      title={title}
    >
      {label}
      {sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </TableHead>
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-2">No arsenal data for this split</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs w-[4.75rem]">Pitch</TableHead>
            {th('usage_pct', 'Usage', 'Usage percentage')}
            {th('avg_velo', 'Velo', 'Average velocity (mph)')}
            <TableHead className="text-xs">Spin</TableHead>
            <TableHead className="text-xs">Movement</TableHead>
            {th('whiff_pct', 'Whiff%', 'Whiff percentage')}
            {th('xwoba_allowed', 'xwOBA', 'Expected weighted on-base average allowed')}
            <TableHead className="text-xs">GB%</TableHead>
            <TableHead className="text-xs">FB%</TableHead>
            <TableHead className="text-xs">LD%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(p => {
            const smallSample = (p.pitches_thrown ?? 0) < 25;
            const badXwoba = (p.xwoba_allowed ?? 0) > 0.35;
            return (
              <TableRow
                key={`${p.pitch_type}-${p.vs_batter_hand}`}
                className={cn(smallSample && 'opacity-60 italic')}
              >
                <TableCell className="py-1.5 w-[4.75rem] whitespace-nowrap">
                  <PitchTypeChip pitchType={p.pitch_type} label={p.pitch_type_label} />
                </TableCell>
                <TableCell className="text-xs tabular-nums">{formatPct(p.usage_pct)}</TableCell>
                <TableCell className="text-xs tabular-nums">{p.avg_velo?.toFixed(1) ?? '—'}</TableCell>
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
      <p className="text-[10px] text-muted-foreground mt-2">
        * Small sample (&lt;25 pitches) — interpret with caution.
      </p>
    </div>
  );
}

function ArsenalSection({
  title,
  rows,
  sortKey,
  sortAsc,
  onSort,
}: {
  title: string;
  rows: PitcherArsenalRow[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const visible = rows.filter(p => (p.pitches_thrown ?? 0) > 0);
  if (visible.length === 0) return null;

  return (
    <section className="space-y-2">
      <h5 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h5>
      <ArsenalBody rows={visible} sortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
    </section>
  );
}

export function PitcherArsenalTable({ arsenal, pitcherName, pitcherId }: PitcherArsenalTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('usage_pct');
  const [sortAsc, setSortAsc] = useState(false);

  const mixInsights = useMemo(
    () => mixShiftInsights(arsenal, pitcherId, pitcherName),
    [arsenal, pitcherId, pitcherName],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const hasOverall = arsenal.A.some(p => (p.pitches_thrown ?? 0) > 0);
  const hasR = arsenal.R.some(p => (p.pitches_thrown ?? 0) > 0);
  const hasL = arsenal.L.some(p => (p.pitches_thrown ?? 0) > 0);

  if (!hasOverall && !hasR && !hasL) {
    return <p className="text-sm text-muted-foreground italic py-4">No arsenal data available</p>;
  }

  return (
    <div className="space-y-5">
      {mixInsights.length > 0 ? <InsightChips insights={mixInsights} size="sm" /> : null}
      {hasOverall ? (
        <ArsenalSection
          title="Overall"
          rows={arsenal.A}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={toggleSort}
        />
      ) : null}
      <ArsenalSection
        title="vs RHB"
        rows={arsenal.R}
        sortKey={sortKey}
        sortAsc={sortAsc}
        onSort={toggleSort}
      />
      <ArsenalSection
        title="vs LHB"
        rows={arsenal.L}
        sortKey={sortKey}
        sortAsc={sortAsc}
        onSort={toggleSort}
      />
    </div>
  );
}
