import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  handHpLabel,
  otherHomeAway,
  splitLocationLabel,
  splitQualifierLong,
  splitQualifierShort,
  splitQualifierTitle,
  type HomeAway,
} from '@/utils/f5SplitLabels';

interface F5SplitHandednessLabelProps {
  homeAway: HomeAway;
  oppSpHand: 'R' | 'L';
  games?: number | null;
  variant?: 'short' | 'title' | 'inline';
  className?: string;
}

function labelText(variant: F5SplitHandednessLabelProps['variant'], homeAway: HomeAway, hand: 'R' | 'L') {
  if (variant === 'title') return splitQualifierTitle(homeAway, hand);
  if (variant === 'inline') return splitQualifierShort(homeAway, hand);
  return `vs ${handHpLabel(hand)} (${homeAway})`;
}

export function F5SplitHandednessLabel({
  homeAway,
  oppSpHand,
  games,
  variant = 'inline',
  className,
}: F5SplitHandednessLabelProps) {
  const text = labelText(variant, homeAway, oppSpHand);
  const other = otherHomeAway(homeAway);
  const gamesPhrase =
    games != null && games > 0 ? ` (${games} game${games === 1 ? '' : 's'})` : '';

  return (
    <Tooltip>
      <TooltipTrigger asChild touchTapMode="toggle">
        <span
          className={
            className ??
            'cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2 touch-manipulation'
          }
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-sm leading-relaxed">
        <p>
          This team&apos;s record when playing <strong>{splitQualifierLong(homeAway, oppSpHand)}</strong>{' '}
          starting pitchers this season{gamesPhrase}.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Their {splitLocationLabel(other).toLowerCase()}-vs-{handHpLabel(oppSpHand)} and vs-
          {oppSpHand === 'R' ? 'LHP' : 'RHP'} records are different and not included in this number.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
