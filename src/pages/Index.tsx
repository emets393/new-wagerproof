import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GameCard from "@/components/GameCard";

const Index = () => {
  const { data: todaysGames, isLoading, error } = useQuery({
    queryKey: ['todaysGames'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      console.log('Fetching games for date:', today);
      
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
        .order('start_time_minutes');

      if (error) {
        console.error('Error fetching games:', error);
        throw error;
      }
      
      console.log('Fetched games:', data);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Loading Today's Games...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('Query error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-destructive">Error Loading Games</h1>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Today's MLB Games</h1>
          <p className="text-xl text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {todaysGames && todaysGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {todaysGames.map((game) => (
              <GameCard key={game.unique_id} game={game} />
            ))}
          </div>
        ) : (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-center">No Games Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                There are no games scheduled for today.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
