import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, X } from 'lucide-react';
import type { PitchHand } from '@/types/mlbF5Splits';

const STORAGE_PREFIX = 'f5-splits-how-to-dismissed:';

interface F5SplitsHowToReadAlertProps {
  gamePk: number;
  awayAbbr: string;
  homeAbbr: string;
  awayOppHand: PitchHand;
  homeOppHand: PitchHand;
}

export function F5SplitsHowToReadAlert({
  gamePk,
  awayAbbr,
  homeAbbr,
  awayOppHand,
  homeOppHand,
}: F5SplitsHowToReadAlertProps) {
  const storageKey = `${STORAGE_PREFIX}${gamePk}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed) return null;

  const awayHand =
    awayOppHand === 'R' ? 'right-handed' : awayOppHand === 'L' ? 'left-handed' : 'the opposing starter';
  const homeHand =
    homeOppHand === 'R' ? 'right-handed' : homeOppHand === 'L' ? 'left-handed' : 'the opposing starter';

  return (
    <Alert className="mb-4 border-blue-500/30 bg-blue-500/5 relative pr-10">
      <Info className="h-4 w-4" />
      <AlertTitle className="text-sm">Reading these splits</AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground">
        Records below show each team&apos;s performance in a narrow slice that matches tonight&apos;s
        matchup: <strong>{awayAbbr} on the road</strong> vs {awayHand} starters, and{' '}
        <strong>{homeAbbr} at home</strong> vs {homeHand} starters. The same team&apos;s record in
        the other location or vs the opposite hand can look very different — that is expected. Season
        averages labeled &quot;all games, all hands&quot; are broader benchmarks, not tonight&apos;s
        split.
      </AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-7 w-7"
        aria-label="Dismiss"
        onClick={() => {
          try {
            window.localStorage.setItem(storageKey, '1');
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </Alert>
  );
}
