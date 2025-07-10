import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import GameCard from "@/components/GameCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BarChart3, TrendingUp, Settings } from "lucide-react";

interface TodaysGame {
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

export default function Index() {
  // Use Eastern Time consistently to prevent date issues around 8 PM
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const today = easternTime.toISOString().split('T')[0];

  const { data: games, isLoading, error } = useQuery({
    queryKey: ['todays_games', today],
    queryFn: async () => {
      console.log('=== FRONTEND DATE DEBUG INFO ===');
      console.log('Fetching games for ET date:', today);
      console.log('Current UTC time:', now.toISOString());
      console.log('Current ET time:', easternTime.toISOString());
      console.log('===============================');
      
      const { data, error } = await supabase
        .from('input_values_view')
        .select(`
          unique_id,
          home_team,
          away_team,
          home_pitcher,
          away_pitcher,
          home_era,
          away_era,
          home_whip,
          away_whip,
          date,
          start_time_minutes,
          home_ml,
          away_ml,
          home_rl,
          away_rl,
          o_u_line
        `)
        .eq('date', today)
        .order('start_time_minutes', { ascending: true });

      if (error) {
        console.error('Error fetching games:', error);
        throw new Error(error.message);
      }

      console.log('Found games:', data?.length || 0);
      return (data || []) as TodaysGame[];
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading today's games...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600">Error loading games: {error.message}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Today's MLB Games
            </h1>
            <p className="text-green-500 font-semibold text-lg">
              🚀 Live Updates Working! - {new Date().toLocaleTimeString()}
            </p>
            <p className="text-muted-foreground mt-2">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Link to="/analytics">
              <Button variant="outline" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Button>
            </Link>
            <Link to="/win-rates">
              <Button variant="outline" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Win Rates
              </Button>
            </Link>
            <Link to="/custom-models">
              <Button variant="outline" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Custom Models
              </Button>
            </Link>
          </div>
        </div>

        {/* Games Grid */}
        {games && games.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => (
              <GameCard key={game.unique_id} game={game} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-muted-foreground text-lg">
              No games scheduled for today
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Check back later or view our analytics page
            </p>
            <div className="flex gap-2 mt-4 justify-center">
              <Link to="/analytics">
                <Button>View Analytics</Button>
              </Link>
              <Link to="/win-rates">
                <Button variant="outline">View Win Rates</Button>
              </Link>
              <Link to="/custom-models">
                <Button variant="outline">View Custom Models</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
