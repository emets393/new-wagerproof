import { useLiveScores } from "@/hooks/useLiveScores";
import { LiveScoreCard } from "./LiveScoreCard";
import { Marquee } from "@/components/magicui/marquee";
import { cn } from "@/lib/utils";

export function LiveScoreTicker() {
  const { games, hasLiveGames, isLoading } = useLiveScores();

  // Don't render if no live games or still loading
  if (!hasLiveGames || isLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        "sticky top-0 w-full",
        "bg-background/95 backdrop-blur-sm border-b border-honeydew-500/20",
        "hidden sm:block"
      )}
      style={{ 
        zIndex: 40,
        overflow: 'hidden',
        maxWidth: '100%'
      }}
    >
      <div 
        className="py-1"
        style={{
          overflow: 'hidden',
          maxWidth: '100%'
        }}
      >
        <Marquee
          pauseOnHover
          className="[--duration:40s]"
          repeat={3}
        >
          {games.map((game) => (
            <div key={game.id} className="mx-1.5 flex-shrink-0">
              <LiveScoreCard game={game} />
            </div>
          ))}
        </Marquee>
      </div>
    </div>
  );
}

