import React, { useState } from 'react';
import type {
  BatterSplitRow,
  BatterVsPitchTypeRow,
  LineupRow,
  MatchupGame,
  PitcherArsenalRow,
  PitcherBattedBallProfile,
  PitchHand,
} from '@/types/mlb-matchups';
import { BatterRow } from './BatterRow';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LineupTableProps {
  lineup: LineupRow[];
  batterSplits: BatterSplitRow[];
  opposingPitcherHand: PitchHand;
  opposingPitcherId: number;
  opposingPitcherName: string;
  opposingArsenal: PitcherArsenalRow[];
  opposingBattedBall: PitcherBattedBallProfile;
  batterVsPitchByPlayer: BatterVsPitchTypeRow[];
  game: MatchupGame;
}

export function LineupTable({
  lineup,
  batterSplits,
  opposingPitcherHand,
  opposingPitcherId,
  opposingPitcherName,
  opposingArsenal,
  opposingBattedBall,
  batterVsPitchByPlayer,
  game,
}: LineupTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const splitById = new Map(batterSplits.map(s => [s.batter_id, s]));
  const hasProjected = lineup.some(l => !l.is_confirmed);

  const rowsForBatter = (playerId: number) =>
    batterVsPitchByPlayer.filter(r => Number(r.batter_id) === playerId);

  if (lineup.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-4">Lineup not available yet</p>;
  }

  return (
    <div className="space-y-2">
      {hasProjected ? (
        <Alert className="py-2">
          <AlertDescription className="text-xs leading-snug">
            Projected — manager has not posted the official lineup yet
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        {lineup.map(row => (
          <BatterRow
            key={row.player_id}
            lineup={row}
            split={splitById.get(row.player_id)}
            vsPitcherHand={opposingPitcherHand}
            opposingPitcherId={opposingPitcherId}
            opposingPitcherName={opposingPitcherName}
            opposingArsenal={opposingArsenal}
            opposingBattedBall={opposingBattedBall}
            batterVsPitchType={rowsForBatter(row.player_id)}
            game={game}
            expanded={expandedId === row.player_id}
            onToggle={() =>
              setExpandedId(prev => (prev === row.player_id ? null : row.player_id))
            }
          />
        ))}
      </div>
    </div>
  );
}
