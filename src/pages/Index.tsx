import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import GameCard from "@/components/GameCard";
import { Button } from "@/components/ui/button";

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
  // Use local timezone instead of UTC to prevent date issues around 8 PM
  const today = new Date().toLocaleDateString('en-CA'); // Returns YYYY-MM-DD format in local timezone

  const { data: games, isLoading, error } = useQuery({
    queryKey: ['todays_games', today],
    queryFn: async () => {
      console.log('Fetching games for date:', today);
      console.log('Current local time:', new Date().toLocaleString());
      console.log('Current UTC time:', new Date().toISOString());
      
      // First, let's check what dates are available in the database
      const { data: allDates, error: dateError } = await supabase
        .from('input_values_view')
        .select('date')
        .order('date', { ascending: false })
        .limit(10);
      
      if (dateError) {
        console.error('Error fetching dates:', dateError);
      } else {
        console.log('Available dates in database:', allDates?.map(d => d.date));
      }
      
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

      console.log('Found games for today:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('Sample game:', data[0]);
      }
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
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-accent drop-shadow-lg">
              Today's MLB Games
            </h1>
            <p className="text-white/80 mt-2">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
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

          </div>
        )}
      </div>
    </div>
  );
}
