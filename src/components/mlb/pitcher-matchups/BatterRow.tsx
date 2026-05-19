import React, { useMemo } from 'react';
import type { ParkHRFactors } from '@/hooks/usePark';
import type {
  BatterSplitRow,
  BatterVsPitchTypeRow,
  LineupRow,
  MatchupGame,
  LeagueBenchmarks,
  PitcherArsenalByHand,
  PitcherBattedBallProfile,
  PitchHand,
} from '@/types/mlb-matchups';
import { Headshot } from './Headshot';
import { BatterDrilldown } from './BatterDrilldown';
import { InsightChips } from './InsightChips';
import { generateBatterInsights } from './insightEngine';
import { formatRate, formatSlash, hasEnoughPa } from '@/utils/mlbPitcherMatchups';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function wobaMilli(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(3).replace(/^0/, '');
}

interface BatterRowProps {
  lineup: LineupRow;
  split: BatterSplitRow | undefined;
  vsPitcherHand: PitchHand;
  opposingPitcherId: number;
  opposingPitcherName: string;
  opposingArsenal: PitcherArsenalByHand;
  opposingBattedBall: PitcherBattedBallProfile;
  batterVsPitchType: BatterVsPitchTypeRow[];
  benchmarks: LeagueBenchmarks;
  game: MatchupGame;
  park: ParkHRFactors | null;
  expanded: boolean;
  onToggle: () => void;
}

function PlatoonStatTooltip({
  split,
  vsPitcherHand,
  slashLine,
  xwobaLine,
}: {
  split: BatterSplitRow;
  vsPitcherHand: PitchHand;
  slashLine: string;
  xwobaLine: string;
}) {
  const otherHand = vsPitcherHand === 'R' ? 'L' : 'R';
  const delta = split.woba_delta_vs_other_hand;
  const hasPlatoon =
    split.other_hand_woba != null || split.woba_delta_vs_other_hand != null;

  if (!hasPlatoon) {
    return (
      <span>
        {slashLine} · {xwobaLine}
      </span>
    );
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          {slashLine} · {xwobaLine}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[100] max-w-xs">
        <div className="space-y-1 text-sm">
          <div>
            vs {vsPitcherHand}HP: {wobaMilli(split.woba)} wOBA ({split.pa} PA)
          </div>
          {split.other_hand_woba != null ? (
            <div className="text-muted-foreground">
              vs {otherHand}HP: {wobaMilli(split.other_hand_woba)} wOBA (
              {split.other_hand_pa ?? '—'} PA)
            </div>
          ) : null}
          {delta != null ? (
            <div
              className={cn(
                'font-medium',
                delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}
            >
              Delta: {delta > 0 ? '+' : ''}
              {Math.round(delta * 1000)} wOBA pts
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
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
  benchmarks,
  game,
  park,
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
      park,
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
    park,
  ]);

  const enough = split && hasEnoughPa(split.pa);
  const slashLine = split ? formatSlash(split.avg, split.obp, split.slg) : '—';
  const xwobaLine = split ? `${formatRate(split.xwoba)} xwOBA` : '';

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="border-b border-border/60 last:border-0">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleRowKeyDown}
        className="w-full flex items-start gap-2 sm:gap-3 py-3 px-1 sm:px-2 text-left hover:bg-muted/40 transition-colors cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <PlatoonStatTooltip
                split={split}
                vsPitcherHand={vsPitcherHand}
                slashLine={slashLine}
                xwobaLine={xwobaLine}
              />
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Not enough data this season</p>
          )}
          <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            <InsightChips insights={batterInsights} size="sm" />
          </div>
        </div>
        <span className="shrink-0 text-muted-foreground pt-1 pointer-events-none">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </div>
      {expanded && split ? (
        <BatterDrilldown
          split={split}
          opposingArsenal={opposingArsenal}
          opposingPitcherName={opposingPitcherName}
          opposingPitcherHand={vsPitcherHand}
          vsPitcherHand={vsPitcherHand}
          benchmarks={benchmarks}
          season={new Date(game.official_date).getFullYear()}
          batterVsPitchType={batterVsPitchType}
        />
      ) : null}
    </div>
  );
}
