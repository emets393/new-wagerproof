import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveScores } from "@/hooks/useLiveScores";
import { useSportsFilter } from "@/hooks/useSportsFilter";
import { LiveScoreCard } from "@/components/LiveScoreCard";
import { LiveScorePredictionCard } from "@/components/LiveScorePredictionCard";
import { SportsFilterButton } from "@/components/SportsFilterButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Shield, AlertCircle, Maximize2, Minimize2, Bug, Dribbble, IceCream } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { LiveGame } from "@/types/liveScores";

// League configuration with icons and display names
const LEAGUE_CONFIG: Record<string, { name: string; icon: any; order: number }> = {
  'NFL': { name: 'NFL Games', icon: Shield, order: 1 },
  'NCAAF': { name: 'College Football Games', icon: Trophy, order: 2 },
  'NBA': { name: 'NBA Games', icon: Dribbble, order: 3 },
  'NCAAB': { name: 'College Basketball Games', icon: Dribbble, order: 4 },
  'NHL': { name: 'NHL Games', icon: IceCream, order: 5 },
  'MLB': { name: 'MLB Games', icon: Trophy, order: 6 },
  'MLS': { name: 'MLS Games', icon: Trophy, order: 7 },
  'EPL': { name: 'EPL Games', icon: Trophy, order: 8 },
};

export default function ScoreBoard() {
  const navigate = useNavigate();
  const { games, hasLiveGames, isLoading, error } = useLiveScores();
  const { isSportEnabled, enabledCount, totalCount } = useSportsFilter();
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter games based on user preferences
  const filteredGames = games.filter(game => isSportEnabled(game.league));

  // Group games by league
  const gamesByLeague = filteredGames.reduce((acc, game) => {
    if (!acc[game.league]) {
      acc[game.league] = [];
    }
    acc[game.league].push(game);
    return acc;
  }, {} as Record<string, LiveGame[]>);

  // Sort leagues by configured order
  const sortedLeagues = Object.keys(gamesByLeague).sort((a, b) => {
    const orderA = LEAGUE_CONFIG[a]?.order ?? 999;
    const orderB = LEAGUE_CONFIG[b]?.order ?? 999;
    return orderA - orderB;
  });
  
  // Check if filtering has hidden all games
  const hasActiveFilters = enabledCount < totalCount;
  const hasFilteredGames = filteredGames.length > 0;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Live Score Board</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-[36px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-black -mx-4 md:-mx-8 px-4 md:px-8 py-6 md:py-8 min-h-screen">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-6">Live Score Board</h1>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error loading live scores: {error}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!hasLiveGames) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Live Score Board</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Real-time scores and model predictions for all live games
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SportsFilterButton />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Trophy className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Live Games</h2>
          <p className="text-muted-foreground max-w-md">
            There are currently no live games. Check back during game time!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Live Score Board</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Real-time scores and model predictions for all live games
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SportsFilterButton />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/scoreboard/diagnostics')}
              className="flex items-center gap-2"
            >
              <Bug className="h-4 w-4" />
              <span className="hidden sm:inline">Diagnostics</span>
            </Button>
            <Button
              variant={isExpanded ? "default" : "outline"}
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 self-start"
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Compact</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Expand All</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filter Indicator */}
      {hasActiveFilters && (
        <Alert className="mb-6 border-primary/50 bg-primary/5">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            Showing {enabledCount} of {totalCount} sports. 
            {!hasFilteredGames && " All filtered sports have no live games."}
          </AlertDescription>
        </Alert>
      )}

      {/* No Filtered Games Message */}
      {!hasFilteredGames && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Trophy className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Games Match Your Filter</h2>
          <p className="text-muted-foreground max-w-md mb-4">
            The selected sports don't have any live games right now. Try adjusting your filter or check back later.
          </p>
        </div>
      )}

      {/* Dynamic League Sections */}
      {sortedLeagues.map(league => {
        const leagueGames = gamesByLeague[league];
        const leagueConfig = LEAGUE_CONFIG[league] || { name: `${league} Games`, icon: Trophy, order: 999 };
        const LeagueIcon = leagueConfig.icon;
        const hittingCount = leagueGames.filter(g => g.predictions?.hasAnyHitting).length;

        return (
          <div key={league} className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
              <div className="flex items-center gap-2">
                <LeagueIcon className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">{leagueConfig.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {leagueGames.length} {leagueGames.length === 1 ? 'Game' : 'Games'}
                </Badge>
                {hittingCount > 0 && (
                  <Badge className="text-xs bg-honeydew-500/20 text-honeydew-500 border-honeydew-500/50">
                    {hittingCount} Hitting
                  </Badge>
                )}
              </div>
            </div>
            {isExpanded ? (
              // Expanded mode - show full prediction cards
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {leagueGames.map((game) => (
                  <div key={game.id} className="flex justify-center">
                    <LiveScorePredictionCard game={game} />
                  </div>
                ))}
              </div>
            ) : (
              // Compact mode - show small cards
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {leagueGames.map((game) => (
                  <div key={game.id}>
                    <LiveScoreCard game={game} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary Footer */}
      <div className="mt-8 pt-6 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-honeydew-500 animate-pulse"></div>
            <span>Prediction Hitting</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-destructive"></div>
            <span>Prediction Not Hitting</span>
          </div>
          <div className="sm:ml-auto text-xs">
            Updates every 30 seconds
          </div>
        </div>
      </div>
    </div>
  );
}

