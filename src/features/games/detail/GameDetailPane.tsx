import * as React from 'react';
import { Trophy } from 'lucide-react';
import { TeamAura } from '@/components/ios';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useAiCompletions } from '../hooks/useAiCompletions';
import { DetailHero } from './DetailHero';
import { SportSections } from './sections';
import { useMasonryGrid } from './useMasonryGrid';
import type { GameFeedItem, GamesSport } from '../types';

interface GameDetailPaneProps {
  sport: GamesSport;
  game: GameFeedItem | null;
  extras: Record<string, unknown>;
  isFeedLoading: boolean;
}

/**
 * Right split-view pane: team-color aura, hero, and the per-sport stack of
 * glass widget sections (ported from the legacy GameDetailsModal / MLB inline
 * detail). Scrolls independently; resets to top on selection change.
 */
export function GameDetailPane({ sport, game, extras, isFeedLoading }: GameDetailPaneProps) {
  const { adminModeEnabled } = useAdminMode();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  // Packs the two columns so a short widget doesn't hold open a full-height row.
  useMasonryGrid(gridRef, game?.id);

  const gameIds = React.useMemo(() => (game ? [game.id] : []), [game?.id]);
  const { completions, refreshGame } = useAiCompletions(sport, gameIds);

  React.useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [game?.id]);

  if (!game) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Trophy className="h-9 w-9 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-muted-foreground">
            {isFeedLoading ? 'Loading games…' : 'Select a game to see the full breakdown'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto">
      <TeamAura
        awayColor={game.awayTeam.colors.primary}
        homeColor={game.homeTeam.colors.primary}
      />
      <div className="relative mx-auto max-w-5xl @container">
        <DetailHero game={game} isAdmin={adminModeEnabled} />
        {/* @container reacts to this pane's own rendered width, not the viewport —
            the pane is a resizable ~56-76% slice of the screen (SplitViewLayout),
            so a viewport breakpoint like `lg:` would fire well before there's
            actually room for two columns. */}
        {/* items-start keeps each widget at its natural height — useMasonryGrid
            measures that height to size the row span, so stretching would feed
            it back its own row allocation. */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 items-start gap-3 px-4 pb-10 @xl:grid-cols-2"
        >
          <SportSections
            game={game}
            extras={extras}
            completions={completions[game.id] ?? {}}
            onCompletionGenerated={refreshGame}
          />
        </div>
      </div>
    </div>
  );
}
