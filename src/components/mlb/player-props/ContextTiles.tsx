import React from 'react';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import type { PropComputedAtLine } from '@/types/mlb-player-props';
import { lowConfidence, splitFractionLabel, splitPctLabel } from '@/utils/mlbPlayerProps';
import { cn } from '@/lib/utils';

interface ContextTilesProps {
  row: MlbPlayerPropRow;
  computed: PropComputedAtLine;
}

function Tile({
  label,
  split,
  sub,
  muted,
  tooltip,
}: {
  label: string;
  split: { over: number; games: number; pct: number | null };
  sub?: string;
  muted?: boolean;
  tooltip: string;
}) {
  return (
    <div
      title={tooltip}
      className={cn(
        'rounded-lg border px-3 py-2.5 min-h-[64px] flex flex-col justify-center cursor-help',
        muted ? 'border-border/40 bg-muted/10 opacity-75' : 'border-border/60 bg-card/50',
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-xl font-bold tabular-nums text-primary leading-tight mt-0.5">
        {splitFractionLabel(split)}
      </p>
      <p className="text-[11px] text-muted-foreground tabular-nums leading-tight">
        {splitPctLabel(split)} over{sub ? ` · ${sub}` : ''}
      </p>
    </div>
  );
}

export function ContextTiles({ row, computed }: ContextTilesProps) {
  const dayLabel = row.game_is_day ? '☀️ Day games' : '🌙 Night games';
  const dayWord = row.game_is_day ? 'day' : 'night';
  const showArchetype =
    !row.is_pitcher && computed.contextualArchetype != null && row.opp_archetype_today != null;

  const tiles: React.ReactNode[] = [
    <Tile
      key="l10"
      label="Last 10"
      split={computed.l10}
      muted={lowConfidence(computed.l10)}
      tooltip="How often this player went over the selected line in their last 10 games."
    />,
  ];

  if (computed.contextualDayNight) {
    tiles.push(
      <Tile
        key="dn"
        label={dayLabel}
        split={computed.contextualDayNight}
        muted={lowConfidence(computed.contextualDayNight)}
        tooltip={`How often this player went over the selected line in ${dayWord} games this season (tonight is a ${dayWord} game).`}
      />,
    );
  }

  if (showArchetype && computed.contextualArchetype && row.opp_archetype_today) {
    tiles.push(
      <Tile
        key="arch"
        label={`vs ${row.opp_archetype_today} SP`}
        split={computed.contextualArchetype}
        sub="starting pitchers"
        muted={lowConfidence(computed.contextualArchetype)}
        tooltip={`How often this batter went over the selected line in games started by a "${row.opp_archetype_today}" type starting pitcher — the same archetype as tonight's opposing starter. Reliever appearances are not counted.`}
      />,
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'grid gap-2',
          tiles.length >= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2',
        )}
      >
        {tiles}
      </div>
      {showArchetype ? (
        <p className="text-[10px] text-muted-foreground italic px-1">
          Archetype split is based on the opposing starting pitcher only — relievers are not included.
        </p>
      ) : null}
    </div>
  );
}
