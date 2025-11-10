import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeamDisplay from "./TeamDisplay";
import PitcherDisplay from "./PitcherDisplay";
import PredictionsModal from "./PredictionsModal";
import PublicBettingDistribution from "./PublicBettingDistribution";
import { GameTailSection } from "./GameTailSection";
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
  home_ml?: number;
  away_ml?: number;
  home_rl?: number;
  away_rl?: number;
  o_u_line?: number;
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

const formatMoneyline = (ml: number | undefined): string => {
  if (!ml) return 'N/A';
  return ml > 0 ? `+${ml}` : ml.toString();
};

const formatRunline = (rl: number | undefined): string => {
  if (!rl) return 'N/A';
  return rl > 0 ? `+${rl}` : rl.toString();
};

const GameCard = ({ game }: GameCardProps) => {
  const [showPredictions, setShowPredictions] = useState(false);
  const startTime = formatStartTime(game.start_time_minutes);

  return (
    <>
      <Card className="w-full hover:shadow-lg transition-shadow overflow-hidden">
        <CardHeader className="pb-4 bg-gradient-to-r from-info/20 via-info/15 to-info/10 border-b border-info/30">
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
          {/* Betting Lines Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
              Betting Lines
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              {/* Away Team Lines */}
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Away</div>
                <div className="space-y-1">
                  <div className="text-xs">
                    <span className="text-muted-foreground">ML:</span>
                    <span className="font-medium ml-1">{formatMoneyline(game.away_ml)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">RL:</span>
                    <span className="font-medium ml-1">{formatRunline(game.away_rl)}</span>
                  </div>
                </div>
              </div>
              
              {/* O/U Line */}
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Total</div>
                <div className="text-lg font-bold text-foreground">
                  {game.o_u_line || 'N/A'}
                </div>
              </div>
              
              {/* Home Team Lines */}
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Home</div>
                <div className="space-y-1">
                  <div className="text-xs">
                    <span className="text-muted-foreground">ML:</span>
                    <span className="font-medium ml-1">{formatMoneyline(game.home_ml)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">RL:</span>
                    <span className="font-medium ml-1">{formatRunline(game.home_rl)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Starting Pitchers Section */}
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

        <CardFooter className="pt-0 flex-col gap-3">
          <Button 
            onClick={() => setShowPredictions(true)}
            className="w-full font-semibold text-base bg-primary text-white hover:bg-primary/90 transition-colors"
            variant="default"
          >
            Matchup Overview
          </Button>
          
          <GameTailSection
            gameUniqueId={game.unique_id}
            sport="mlb"
            homeTeam={game.home_team}
            awayTeam={game.away_team}
            lines={{
              home_ml: game.home_ml,
              away_ml: game.away_ml,
              home_spread: game.home_rl,
              away_spread: game.away_rl,
              total: game.o_u_line,
            }}
            compact
          />
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
