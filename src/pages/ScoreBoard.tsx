import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveScores } from "@/hooks/useLiveScores";
import { LiveScoreCard } from "@/components/LiveScoreCard";
import { LiveScorePredictionCard } from "@/components/LiveScorePredictionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Shield, AlertCircle, Maximize2, Minimize2, Bug } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export default function ScoreBoard() {
  const navigate = useNavigate();
  const { games, hasLiveGames, isLoading, error } = useLiveScores();
  const [isExpanded, setIsExpanded] = useState(false);

  // Separate games by league
  const nflGames = games.filter(g => g.league === 'NFL');
  const cfbGames = games.filter(g => g.league === 'NCAAF');

  // Count games with hitting predictions in each league
  const nflHitting = nflGames.filter(g => g.predictions?.hasAnyHitting).length;
  const cfbHitting = cfbGames.filter(g => g.predictions?.hasAnyHitting).length;

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
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Live Score Board</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading live scores: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasLiveGames) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Live Score Board</h1>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Trophy className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Live Games</h2>
          <p className="text-muted-foreground max-w-md">
            There are currently no live NFL or College Football games. Check back during game time!
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

      {/* NFL Section */}
      {nflGames.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">NFL Games</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {nflGames.length} {nflGames.length === 1 ? 'Game' : 'Games'}
              </Badge>
              {nflHitting > 0 && (
                <Badge className="text-xs bg-honeydew-500/20 text-honeydew-500 border-honeydew-500/50">
                  {nflHitting} Hitting
                </Badge>
              )}
            </div>
          </div>
          {isExpanded ? (
            // Expanded mode - show full prediction cards
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nflGames.map((game) => (
                <div key={game.id} className="flex justify-center">
                  <LiveScorePredictionCard game={game} />
                </div>
              ))}
            </div>
          ) : (
            // Compact mode - show small cards
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {nflGames.map((game) => (
                <div key={game.id}>
                  <LiveScoreCard game={game} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CFB Section */}
      {cfbGames.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">College Football Games</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {cfbGames.length} {cfbGames.length === 1 ? 'Game' : 'Games'}
              </Badge>
              {cfbHitting > 0 && (
                <Badge className="text-xs bg-honeydew-500/20 text-honeydew-500 border-honeydew-500/50">
                  {cfbHitting} Hitting
                </Badge>
              )}
            </div>
          </div>
          {isExpanded ? (
            // Expanded mode - show full prediction cards
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cfbGames.map((game) => (
                <div key={game.id} className="flex justify-center">
                  <LiveScorePredictionCard game={game} />
                </div>
              ))}
            </div>
          ) : (
            // Compact mode - show small cards
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {cfbGames.map((game) => (
                <div key={game.id}>
                  <LiveScoreCard game={game} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

