import React, { useState } from 'react';
import type { BatterSplitRow, LeagueBenchmarks, PitchHand } from '@/types/mlb-matchups';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import {
  formatPropLine,
  formatPropOdds,
  marketLabel,
  pickHeadlineProp,
} from '@/utils/mlbPlayerProps';
import { PropMiniViz } from './PropMiniViz';
import { PlayerPropDetail } from './PlayerPropDetail';
import { Headshot } from '@/components/mlb/pitcher-matchups/Headshot';
import type { PitcherArchetypeProfile } from '@/utils/mlbPitcherArchetypes';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerPropCardProps {
  playerId: number;
  playerName: string;
  battingOrder?: number;
  position?: string | null;
  batSide?: string | null;
  playerProps: MlbPlayerPropRow[];
  opposingStarterName: string;
  opposingStarterHand: PitchHand;
  opposingArchetype: PitcherArchetypeProfile | null;
  split?: BatterSplitRow;
  benchmarks: LeagueBenchmarks;
  isPitcher?: boolean;
}

export function PlayerPropCard({
  playerId,
  playerName,
  battingOrder,
  position,
  batSide,
  playerProps,
  opposingStarterName,
  opposingStarterHand,
  opposingArchetype,
  split,
  benchmarks,
  isPitcher = false,
}: PlayerPropCardProps) {
  const [expanded, setExpanded] = useState(false);
  const myProps = playerProps.filter(p => p.player_id === playerId);
  const headline = pickHeadlineProp(myProps);

  const hand =
    batSide === 'L' ? 'L' : batSide === 'R' ? 'R' : batSide === 'S' ? 'S' : '';

  if (!headline) return null;

  const { row, computed } = headline;

  return (
    <div className="rounded-lg border border-border/60 bg-card/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={cn(
          'w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 text-left min-h-[44px]',
          'hover:bg-muted/30 transition-colors duration-150 motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        <Headshot playerId={playerId} size={56} alt={playerName} />
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-semibold truncate">
            {battingOrder != null ? `${battingOrder}. ` : ''}
            {playerName}
            {hand ? (
              <span className="text-muted-foreground font-normal"> ({hand})</span>
            ) : null}
            {position ? (
              <span className="text-muted-foreground font-normal"> · {position}</span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{marketLabel(row.market)}</span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              title="The market with this player's highest L10 over rate. Different prop per batter."
            >
              🔥 Best L10
            </span>
            <span className="tabular-nums">
              O {formatPropLine(computed.line)} · {formatPropOdds(computed.overOdds)}
            </span>
            <PropMiniViz strip={computed.miniStrip} />
            <span className="tabular-nums font-semibold text-primary">
              {computed.l10.over}/{computed.l10.games} Over
            </span>
          </div>
        </div>
        <span className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {expanded ? (
        <div className="px-2.5 sm:px-3 pb-3">
          <PlayerPropDetail
            playerProps={myProps}
            playerId={playerId}
            playerName={playerName}
            position={position}
            batSide={batSide}
            opposingStarterName={opposingStarterName}
            opposingStarterHand={opposingStarterHand}
            opposingArchetype={opposingArchetype}
            split={split}
            benchmarks={benchmarks}
            isPitcher={isPitcher}
          />
        </div>
      ) : null}
    </div>
  );
}
