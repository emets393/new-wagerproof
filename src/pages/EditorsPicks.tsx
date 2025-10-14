import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Star } from 'lucide-react';
import { EditorPickCard } from '@/components/EditorPickCard';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { Badge } from '@/components/ui/badge';

interface EditorPick {
  id: string;
  game_id: string;
  game_type: 'nfl' | 'cfb';
  editor_id: string;
  selected_bet_type: 'spread' | 'over_under' | 'moneyline';
  editors_notes: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface GameData {
  away_team: string;
  home_team: string;
  away_logo?: string;
  home_logo?: string;
  game_date?: string;
  game_time?: string;
  away_spread?: number | null;
  home_spread?: number | null;
  over_line?: number | null;
  away_ml?: number | null;
  home_ml?: number | null;
  opening_spread?: number | null; // For CFB games
}

export default function EditorsPicks() {
  const { isAdmin } = useIsAdmin();
  const { adminModeEnabled } = useAdminMode();
  const [picks, setPicks] = useState<EditorPick[]>([]);
  const [gamesData, setGamesData] = useState<Map<string, GameData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPicks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch editor picks
      let query = supabase.from('editors_picks').select('*');
      
      // Only show draft picks if admin mode is enabled, otherwise only show published
      if (!adminModeEnabled) {
        query = query.eq('is_published', true);
      }

      const { data: picksData, error: picksError } = await query.order('created_at', { ascending: false });

      if (picksError) {
        throw picksError;
      }

      setPicks((picksData || []) as EditorPick[]);

      // Fetch game data for all picks
      if (picksData && picksData.length > 0) {
        console.log('📊 Editor Picks found:', picksData);
        const nflGameIds = picksData.filter(p => p.game_type === 'nfl').map(p => p.game_id);
        const cfbGameIds = picksData.filter(p => p.game_type === 'cfb').map(p => p.game_id);

        console.log('🏈 NFL Game IDs to fetch:', nflGameIds);
        console.log('🏈 CFB Game IDs to fetch:', cfbGameIds);

        const gameDataMap = new Map<string, GameData>();

        // Helper function to get NFL team logo
        const getNFLTeamLogo = (teamName: string): string => {
          const logoMap: { [key: string]: string } = {
            'Arizona': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
            'Atlanta': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
            'Baltimore': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
            'Buffalo': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
            'Carolina': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
            'Chicago': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
            'Cincinnati': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
            'Cleveland': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
            'Dallas': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
            'Denver': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
            'Detroit': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
            'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
            'Houston': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
            'Indianapolis': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
            'Jacksonville': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
            'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
            'Las Vegas': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
            'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
            'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
            'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
            'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
            'Miami': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
            'Minnesota': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
            'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
            'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
            'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
            'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
            'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
            'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
            'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
            'Seattle': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
            'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
            'Tennessee': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
            'Washington': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
          };
          return logoMap[teamName] || '/placeholder.svg';
        };

        // Fetch CFB team mappings for logos
        const { data: cfbTeamMappings, error: cfbMappingError } = await collegeFootballSupabase
          .from('cfb_team_mapping')
          .select('api, logo_light');

        console.log('🏈 CFB Team Mappings fetched:', cfbTeamMappings?.length || 0);
        if (cfbMappingError) {
          console.error('CFB team mapping error:', cfbMappingError);
        }

        // Helper function to get CFB team logo
        const getCFBTeamLogo = (teamName: string): string => {
          const mapping = cfbTeamMappings?.find(m => m.api === teamName);
          return mapping?.logo_light || '';
        };

        // Fetch NFL games - using the same approach as NFL.tsx
        if (nflGameIds.length > 0) {
          // First get the betting lines for these games using collegeFootballSupabase
          const { data: bettingLines, error: linesError } = await collegeFootballSupabase
            .from('nfl_betting_lines')
            .select('*')
            .in('training_key', nflGameIds);

          console.log('🏈 NFL Betting Lines fetched:', bettingLines);
          console.log('🏈 NFL Betting Lines error:', linesError);

          // Then get predictions
          const { data: nflPredictions, error: predsError } = await collegeFootballSupabase
            .from('nfl_predictions_epa')
            .select('*')
            .in('training_key', nflGameIds);

          console.log('🏈 NFL Predictions fetched:', nflPredictions);
          console.log('🏈 NFL Predictions error:', predsError);

          if (!linesError && bettingLines) {
            bettingLines.forEach((line: any) => {
              // Find matching prediction if it exists
              const prediction = nflPredictions?.find((p: any) => p.training_key === line.training_key);
              
              console.log('Adding NFL game to map:', line.training_key, line.away_team, '@', line.home_team);
              
              // Format NFL date
              let formattedDate = line.game_date;
              if (line.game_date) {
                try {
                  const [year, month, day] = line.game_date.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  formattedDate = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                } catch (error) {
                  console.error('Error formatting NFL date:', error);
                }
              }
              
              // Format NFL time
              let formattedTime = line.game_time;
              if (line.game_time) {
                try {
                  const [hours, minutes] = line.game_time.split(':').map(Number);
                  // Add 4 hours to convert UTC to EST
                  const estHours = hours + 4;
                  const finalHours = estHours >= 24 ? estHours - 24 : estHours;
                  const today = new Date();
                  const estDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), finalHours, minutes, 0);
                  formattedTime = estDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) + ' EST';
                } catch (error) {
                  console.error('Error formatting NFL time:', error);
                }
              }
              
              gameDataMap.set(line.training_key, {
                away_team: line.away_team,
                home_team: line.home_team,
                away_logo: getNFLTeamLogo(line.away_team),
                home_logo: getNFLTeamLogo(line.home_team),
                game_date: formattedDate,
                game_time: formattedTime,
                away_spread: line.away_spread,
                home_spread: line.home_spread,
                over_line: line.over_line,
                away_ml: line.away_ml,
                home_ml: line.home_ml,
              });
            });
          }
        }

        // Fetch CFB games
        if (cfbGameIds.length > 0) {
          console.log('🏈 Querying CFB games with IDs:', cfbGameIds);
          console.log('🏈 ID types:', cfbGameIds.map(id => `${id} (${typeof id})`));
          
          // Try converting IDs to numbers in case the database uses numeric type
          const numericIds = cfbGameIds.map(id => {
            const parsed = parseInt(id);
            return isNaN(parsed) ? id : parsed;
          });
          
          console.log('🏈 Numeric IDs:', numericIds);
          
          const { data: cfbGames, error: cfbError } = await collegeFootballSupabase
            .from('cfb_live_weekly_inputs')
            .select('*')
            .in('id', numericIds);

          console.log('🏈 CFB Games fetched:', cfbGames);
          console.log('🏈 CFB Games count:', cfbGames?.length || 0);
          console.log('🏈 CFB Fetch error:', cfbError);
          
          // Debug: Let's also try fetching all CFB games to see what IDs are available
          if (!cfbGames || cfbGames.length === 0) {
            const { data: allCfbGames, error: allError } = await collegeFootballSupabase
              .from('cfb_live_weekly_inputs')
              .select('id, away_team, home_team')
              .limit(10);
            console.log('🏈 Sample CFB games in DB (first 10):', allCfbGames);
            console.log('🏈 Sample ID types:', allCfbGames?.map(g => `${g.id} (${typeof g.id})`));
          }

          if (!cfbError && cfbGames) {
            cfbGames.forEach(game => {
              console.log('Adding CFB game to map:', game.id, game.away_team, '@', game.home_team);
              
              // Get the start time from any available field
              const startTimeString = game.start_time || game.start_date || game.game_datetime || game.datetime;
              
              // Format date and time
              let formattedDate = 'TBD';
              let formattedTime = 'TBD';
              
              if (startTimeString) {
                try {
                  const utcDate = new Date(startTimeString);
                  
                  // Format date as "OCT 2, 2025"
                  const estMonth = utcDate.toLocaleString('en-US', {
                    timeZone: 'America/New_York',
                    month: 'short'
                  }).toUpperCase();
                  const estDay = utcDate.toLocaleString('en-US', {
                    timeZone: 'America/New_York',
                    day: 'numeric'
                  });
                  const estYear = utcDate.toLocaleString('en-US', {
                    timeZone: 'America/New_York',
                    year: 'numeric'
                  });
                  formattedDate = `${estMonth} ${estDay}, ${estYear}`;
                  
                  // Format time as "7:00 PM EST"
                  formattedTime = utcDate.toLocaleTimeString('en-US', {
                    timeZone: 'America/New_York',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) + ' EST';
                } catch (error) {
                  console.error('Error formatting CFB date/time:', error);
                }
              }
              
              // Convert game.id to string to match how it's stored in editors_picks
              gameDataMap.set(String(game.id), {
                away_team: game.away_team,
                home_team: game.home_team,
                away_logo: getCFBTeamLogo(game.away_team),
                home_logo: getCFBTeamLogo(game.home_team),
                game_date: formattedDate,
                game_time: formattedTime,
                away_spread: game.api_spread ? -game.api_spread : null,
                home_spread: game.api_spread,
                over_line: game.api_over_line,
                away_ml: game.away_moneyline || game.away_ml,
                home_ml: game.home_moneyline || game.home_ml,
                opening_spread: (game as any).spread ?? null, // Opening spread from 'spread' column
              });
            });
          }
        }

        console.log('🗺️ Final game data map size:', gameDataMap.size);
        console.log('🗺️ Game data map keys:', Array.from(gameDataMap.keys()));
        console.log('🗺️ Game data map keys types:', Array.from(gameDataMap.keys()).map(k => `${k} (${typeof k})`));
        console.log('🗺️ Pick game_ids to match:', picksData.map(p => `${p.game_id} (${typeof p.game_id}) - ${p.game_type}`));
        setGamesData(gameDataMap);
      }
    } catch (err) {
      console.error('Error fetching editor picks:', err);
      setError(`Failed to load editor picks: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
  }, [adminModeEnabled]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
            <h1 className="text-3xl font-bold">Editor's Picks</h1>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const draftPicks = picks.filter(p => !p.is_published);
  const publishedPicks = picks.filter(p => p.is_published);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          <h1 className="text-3xl font-bold">Editor's Picks</h1>
        </div>
      </div>

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {picks.length === 0 && !error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Star className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Editor Picks Yet</h3>
              <p className="text-muted-foreground">
                {adminModeEnabled 
                  ? 'Start by starring games on the NFL or College Football pages to create your first pick.'
                  : 'Check back soon for expert picks from our editors!'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Draft Picks (Admin Mode Only) */}
      {adminModeEnabled && draftPicks.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold">Drafts</h2>
            <Badge variant="secondary" className="bg-yellow-500 text-white">
              {draftPicks.length}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {draftPicks.map(pick => {
              const gameData = gamesData.get(pick.game_id);
              
              console.log(`🎯 Draft: Looking for game ${pick.game_id} (type: ${typeof pick.game_id}) [${pick.game_type}]:`, gameData ? 'FOUND ✅' : 'NOT FOUND ❌');
              if (!gameData) {
                console.log(`   Available keys:`, Array.from(gamesData.keys()).join(', '));
              }
              
              if (!gameData) {
                // Show placeholder card for missing game data
                return (
                  <Card key={pick.id} className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700">
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
                        <h3 className="text-sm font-semibold mb-2">Game Data Not Found</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          Game ID: {pick.game_id}<br />
                          Type: {pick.game_type}
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          The game may have been removed or the ID doesn't match any current games.
                        </p>
                        {adminModeEnabled && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              try {
                                const { error } = await supabase
                                  .from('editors_picks')
                                  .delete()
                                  .eq('id', pick.id);
                                
                                if (error) throw error;
                                fetchPicks();
                              } catch (err) {
                                console.error('Error deleting pick:', err);
                              }
                            }}
                          >
                            Delete This Pick
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <EditorPickCard
                  key={pick.id}
                  pick={pick}
                  gameData={gameData}
                  onUpdate={fetchPicks}
                  onDelete={fetchPicks}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Published Picks */}
      {publishedPicks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold">Published Picks</h2>
            <Badge variant="secondary" className="bg-green-500 text-white">
              {publishedPicks.length}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publishedPicks.map(pick => {
              const gameData = gamesData.get(pick.game_id);
              
              console.log(`🎯 Published: Looking for game ${pick.game_id} (type: ${typeof pick.game_id}) [${pick.game_type}]:`, gameData ? 'FOUND ✅' : 'NOT FOUND ❌');
              if (!gameData) {
                console.log(`   Available keys:`, Array.from(gamesData.keys()).join(', '));
              }
              
              if (!gameData) {
                // Show placeholder card for missing game data
                return (
                  <Card key={pick.id} className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700">
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
                        <h3 className="text-sm font-semibold mb-2">Game Data Not Found</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          Game ID: {pick.game_id}<br />
                          Type: {pick.game_type}
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          The game may have been removed or the ID doesn't match any current games.
                        </p>
                        {adminModeEnabled && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              try {
                                const { error } = await supabase
                                  .from('editors_picks')
                                  .delete()
                                  .eq('id', pick.id);
                                
                                if (error) throw error;
                                fetchPicks();
                              } catch (err) {
                                console.error('Error deleting pick:', err);
                              }
                            }}
                          >
                            Delete This Pick
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <EditorPickCard
                  key={pick.id}
                  pick={pick}
                  gameData={gameData}
                  onUpdate={fetchPicks}
                  onDelete={fetchPicks}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

