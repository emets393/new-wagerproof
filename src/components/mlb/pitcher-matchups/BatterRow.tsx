import React, { useMemo } from 'react';
import type {
  BatterSplitRow,
  BatterVsPitchTypeRow,
  LineupRow,
  MatchupGame,
  PitcherArsenalRow,
  PitcherBattedBallProfile,
  PitchHand,
} from '@/types/mlb-matchups';
import { Headshot } from './Headshot';
import { BatterDrilldown } from './BatterDrilldown';
import { InsightChips } from './InsightChips';
import { generateBatterInsights } from './insightEngine';
import { formatRate, formatSlash, hasEnoughPa } from '@/utils/mlbPitcherMatchups';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface BatterRowProps {
  lineup: LineupRow;
  split: BatterSplitRow | undefined;
  vsPitcherHand: PitchHand;
  opposingPitcherId: number;
  opposingPitcherName: string;
  opposingArsenal: PitcherArsenalRow[];
  opposingBattedBall: PitcherBattedBallProfile;
  batterVsPitchType: BatterVsPitchTypeRow[];
  game: MatchupGame;
  expanded: boolean;
  onToggle: () => void;
}

export function BatterRow({
  lineup,
  split,
  vsPitcherHand,
  opposingPitcherId,
  opposingPitcherName,
  opposingArsenal,
  opposingBattedBall,
  batterVsPitchType,
  game,
  expanded,
  onToggle,
}: BatterRowProps) {
  const hand =
    lineup.bat_side === 'L' ? 'Left' : lineup.bat_side === 'R' ? 'Right' : 'Switch';

  const batterInsights = useMemo(() => {
    if (!split) return [];
    return generateBatterInsights({
      batter: split,
      lineup,
      opposingPitcherId,
      opposingPitcherName,
      opposingPitcherHand: vsPitcherHand,
      opposingArsenal,
      opposingBattedBall,
      batterVsPitchType,
      game,
    });
  }, [
    split,
    lineup,
    opposingPitcherId,
    opposingPitcherName,
    vsPitcherHand,
    opposingArsenal,
    opposingBattedBall,
    batterVsPitchType,
    game,
  ]);

  const enough = split && hasEnoughPa(split.pa);

  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2 sm:gap-3 py-3 px-1 sm:px-2 text-left hover:bg-muted/40 transition-colors"
      >
        <Headshot playerId={lineup.player_id} size={60} alt={lineup.player_name} />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {lineup.batting_order}. {lineup.player_name}{' '}
            <span className="text-muted-foreground font-normal">
              ({hand}){lineup.position ? ` · ${lineup.position}` : ''}
            </span>
          </p>
          {enough && split ? (
            <p className="text-xs text-muted-foreground leading-snug">
              vs {vsPitcherHand === 'R' ? 'right' : 'left'}: {split.pa} PA · AVG/OBP/SLG{' '}
              {formatSlash(split.avg, split.obp, split.slg)} · {formatRate(split.xwoba)} xwOBA
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Not enough data this season</p>
          )}
          <InsightChips insights={batterInsights} size="sm" />
        </div>
        <span className="shrink-0 text-muted-foreground pt-1">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {expanded && split ? (
        <BatterDrilldown
          split={split}
          opposingArsenal={opposingArsenal}
          vsPitcherHand={vsPitcherHand}
          season={new Date(game.official_date).getFullYear()}
        />
      ) : null}
    </div>
  );
}
