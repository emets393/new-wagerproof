import debug from '@/utils/debug';
import { useLiveScores } from "@/hooks/useLiveScores";
import { useSportsFilter } from "@/hooks/useSportsFilter";
import { LiveScoreCard } from "./LiveScoreCard";
import { Marquee } from "@/components/magicui/marquee";
import { cn } from "@/lib/utils";

export function LiveScoreTicker() {
  const { games, hasLiveGames, isLoading } = useLiveScores();
  const { isSportEnabled } = useSportsFilter();

  // Don't render if no live games or still loading
  if (!hasLiveGames || isLoading) {
    return null;
  }

  // Filter games based on user preferences
  const filteredGames = games.filter(game => isSportEnabled(game.league));
  
  // Don't render if all games are filtered out
  if (filteredGames.length === 0) {
    return null;
  }

  // Count games with predictions for debugging
  const gamesWithPredictions = filteredGames.filter(g => g.predictions).length;
  const gamesWithHitting = filteredGames.filter(g => g.predictions?.hasAnyHitting).length;
  
  debug.log(`🏈 Live Score Ticker: ${filteredGames.length} games (filtered from ${games.length}), ${gamesWithPredictions} with predictions, ${gamesWithHitting} with hitting predictions`);

  return (
    <div
      className={cn(
        "sticky top-0 w-full",
        "bg-background/95 backdrop-blur-sm border-b border-honeydew-500/20"
        // Removed "hidden sm:block" to show on mobile
      )}
      style={{ 
        zIndex: 40,
        overflow: 'visible', // Changed from 'hidden' to allow HoverCard to show
        maxWidth: '100%'
      }}
    >
      <div 
        className="py-1"
        style={{
          overflow: 'visible', // Changed from 'hidden' to allow HoverCard to show
          maxWidth: '100%'
        }}
      >
        <Marquee
          pauseOnHover
          className="[--duration:40s] !overflow-visible"
          repeat={3}
        >
          {filteredGames.map((game) => (
            <div key={game.id} className="mx-1.5 flex-shrink-0">
              <LiveScoreCard game={game} />
            </div>
          ))}
        </Marquee>
      </div>
    </div>
  );
}

