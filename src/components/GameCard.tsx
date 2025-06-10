import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeamDisplay from "./TeamDisplay";
import PitcherDisplay from "./PitcherDisplay";
import PredictionsModal from "./PredictionsModal";
import { useState } from "react";

interface Game {
  unique_id: string;
  home_team: string;
  away_team: string;
  home_pitcher: string;
  away_pitcher: string;
  home_era: number;
  away_era: number;
  home_whip: number;
  away_whip: number;
  date: string;
  start_time_minutes?: number;
}

interface GameCardProps {
  game: Game;
}

const formatStartTime = (startTimeMinutes: number | undefined): string => {
  if (!startTimeMinutes) return '';
  
  const hours = Math.floor(startTimeMinutes / 60);
  const minutes = startTimeMinutes % 60;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return `${displayHours}:${displayMinutes} ${period}`;
};

const GameCard = ({ game }: GameCardProps) => {
  const [showPredictions, setShowPredictions] = useState(false);
  const startTime = formatStartTime(game.start_time_minutes);

  return (
    <>
      <Card className="w-full hover:shadow-lg transition-shadow">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <TeamDisplay team={game.away_team} isHome={false} />
            <div className="flex flex-col items-center">
              {startTime && (
                <div className="text-sm font-semibold text-muted-foreground mb-1">
                  {startTime} EST
                </div>
              )}
              <div className="text-2xl font-bold text-muted-foreground">@</div>
            </div>
            <TeamDisplay team={game.home_team} isHome={true} />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
              Starting Pitchers
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <PitcherDisplay
                pitcher={game.away_pitcher}
                era={game.away_era}
                whip={game.away_whip}
                label="Away"
              />
              
              <PitcherDisplay
                pitcher={game.home_pitcher}
                era={game.home_era}
                whip={game.home_whip}
                label="Home"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          <Button 
            onClick={() => setShowPredictions(true)}
            className="w-full"
            variant="outline"
          >
            View Predictions
          </Button>
        </CardFooter>
      </Card>

      <PredictionsModal
        isOpen={showPredictions}
        onClose={() => setShowPredictions(false)}
        uniqueId={game.unique_id}
        homeTeam={game.home_team}
        awayTeam={game.away_team}
      />
    </>
  );
};

export default GameCard;
