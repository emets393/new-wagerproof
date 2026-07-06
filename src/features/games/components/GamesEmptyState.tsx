import { CalendarOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ios';
import { SPORT_LABELS, type GamesSport } from '../types';

// Rough season windows — copy only, no data effect.
const OFF_SEASON_COPY: Record<GamesSport, string> = {
  nfl: 'The NFL season kicks off in September. Check back then!',
  cfb: 'College Football returns in late August. Check back then!',
  nba: 'The NBA season tips off in October. Check back then!',
  ncaab: 'College Basketball tips off in November. Check back then!',
  mlb: 'No MLB games on the slate right now.',
};

export function GamesEmptyState({
  sport,
  hasSearch,
  onClearSearch,
}: {
  sport: GamesSport;
  hasSearch: boolean;
  onClearSearch: () => void;
}) {
  return (
    <GlassCard className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <CalendarOff className="h-8 w-8 text-muted-foreground" />
      {hasSearch ? (
        <>
          <p className="text-sm font-semibold text-foreground">No matching games</p>
          <p className="text-sm text-muted-foreground">
            No {SPORT_LABELS[sport]} games match your search.
          </p>
          <Button variant="outline" size="sm" className="rounded-full" onClick={onClearSearch}>
            Clear search
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground">No {SPORT_LABELS[sport]} games</p>
          <p className="max-w-[260px] text-sm text-muted-foreground">{OFF_SEASON_COPY[sport]}</p>
        </>
      )}
    </GlassCard>
  );
}

export function GamesErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GlassCard className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertCircle className="h-7 w-7 text-destructive" />
      <p className="text-sm font-semibold text-foreground">Couldn't load games</p>
      <p className="max-w-[280px] break-words text-xs text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </GlassCard>
  );
}
