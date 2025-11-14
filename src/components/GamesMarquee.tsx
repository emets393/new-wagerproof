import useEmblaCarousel from 'embla-carousel-react';
import { TodayGameSummaryCard } from './TodayGameSummaryCard';

interface GameSummary {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  awayTeam: string;
  homeTeam: string;
  awayLogo?: string;
  homeLogo?: string;
  gameTime?: string;
  awaySpread?: number;
  homeSpread?: number;
  totalLine?: number;
  awayMl?: number;
  homeMl?: number;
  tailCount?: number;
  cfbId?: number;
  nbaId?: string;
  ncaabId?: string;
}

interface GamesMarqueeProps {
  games: GameSummary[];
}

export function GamesMarquee({ games }: GamesMarqueeProps) {
  // Sort games by sport (NFL, CFB, NBA, NCAAB)
  const sportOrder = { nfl: 0, cfb: 1, nba: 2, ncaab: 3 };
  const sortedGames = [...games].sort((a, b) => {
    return sportOrder[a.sport] - sportOrder[b.sport];
  });
  
  // Determine layout based on number of games
  const shouldUseMarquee = sortedGames.length >= 9;
  const shouldUseThreeRows = sortedGames.length >= 25;
  
  // If not using marquee, show simple grid
  if (!shouldUseMarquee) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedGames.map((game) => (
          <TodayGameSummaryCard key={game.gameId} {...game} />
        ))}
      </div>
    );
  }
  
  // Calculate games per row for marquee
  const gamesPerRow = shouldUseThreeRows ? Math.ceil(sortedGames.length / 3) : sortedGames.length;
  
  // Create rows for three-row layout
  const rows = shouldUseThreeRows ? [
    sortedGames.slice(0, gamesPerRow),
    sortedGames.slice(gamesPerRow, gamesPerRow * 2),
    sortedGames.slice(gamesPerRow * 2)
  ] : [sortedGames];
  
  // Use coordinated marquee layout
  return <CoordinatedMarquee rows={rows} />;
}

interface CoordinatedMarqueeProps {
  rows: GameSummary[][];
}

function CoordinatedMarquee({ rows }: CoordinatedMarqueeProps) {
  return (
    <div className="space-y-4">
      {rows.map((rowGames, rowIndex) => (
        <MarqueeRow
          key={rowIndex}
          games={rowGames}
          rowIndex={rowIndex}
        />
      ))}
    </div>
  );
}

interface MarqueeRowProps {
  games: GameSummary[];
  rowIndex: number;
}

function MarqueeRow({ games }: MarqueeRowProps) {
  const [emblaRef] = useEmblaCarousel({
    loop: false,
    dragFree: true,
    containScroll: 'trimSnaps',
    align: 'start',
  });
  
  return (
    <div className="overflow-hidden" ref={emblaRef}>
      <div className="flex gap-4">
        {games.map((game) => (
          <div
            key={game.gameId}
            className="flex-[0_0_90%] min-w-0 sm:flex-[0_0_45%] md:flex-[0_0_30%] lg:flex-[0_0_23%]"
          >
            <TodayGameSummaryCard {...game} />
          </div>
        ))}
      </div>
    </div>
  );
}

