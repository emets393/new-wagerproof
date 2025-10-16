import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Star, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { EditorPickCard } from '@/components/EditorPickCard';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useAuth } from '@/contexts/AuthContext';
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
  raw_game_date?: string; // Raw date for comparison (YYYY-MM-DD or ISO string)
  away_spread?: number | null;
  home_spread?: number | null;
  over_line?: number | null;
  away_ml?: number | null;
  home_ml?: number | null;
  opening_spread?: number | null; // For CFB games
  away_team_colors: { primary: string; secondary: string };
  home_team_colors: { primary: string; secondary: string };
}

// Helper function to get NFL team colors
const getNFLTeamColors = (teamName: string): { primary: string; secondary: string } => {
  const colorMap: { [key: string]: { primary: string; secondary: string } } = {
    'Arizona': { primary: '#97233F', secondary: '#000000' },
    'Atlanta': { primary: '#A71930', secondary: '#000000' },
    'Baltimore': { primary: '#241773', secondary: '#9E7C0C' },
    'Buffalo': { primary: '#00338D', secondary: '#C60C30' },
    'Carolina': { primary: '#0085CA', secondary: '#101820' },
    'Chicago': { primary: '#0B162A', secondary: '#C83803' },
    'Cincinnati': { primary: '#FB4F14', secondary: '#000000' },
    'Cleveland': { primary: '#311D00', secondary: '#FF3C00' },
    'Dallas': { primary: '#003594', secondary: '#869397' },
    'Denver': { primary: '#FB4F14', secondary: '#002244' },
    'Detroit': { primary: '#0076B6', secondary: '#B0B7BC' },
    'Green Bay': { primary: '#203731', secondary: '#FFB612' },
    'Houston': { primary: '#03202F', secondary: '#A71930' },
    'Indianapolis': { primary: '#002C5F', secondary: '#A2AAAD' },
    'Jacksonville': { primary: '#101820', secondary: '#D7A22A' },
    'Kansas City': { primary: '#E31837', secondary: '#FFB81C' },
    'Las Vegas': { primary: '#000000', secondary: '#A5ACAF' },
    'Los Angeles Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
    'Los Angeles Rams': { primary: '#003594', secondary: '#FFA300' },
    'LA Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
    'LA Rams': { primary: '#003594', secondary: '#FFA300' },
    'Miami': { primary: '#008E97', secondary: '#FC4C02' },
    'Minnesota': { primary: '#4F2683', secondary: '#FFC62F' },
    'New England': { primary: '#002244', secondary: '#C60C30' },
    'New Orleans': { primary: '#101820', secondary: '#D3BC8D' },
    'NY Giants': { primary: '#0B2265', secondary: '#A71930' },
    'NY Jets': { primary: '#125740', secondary: '#000000' },
    'Philadelphia': { primary: '#004C54', secondary: '#A5ACAF' },
    'Pittsburgh': { primary: '#FFB612', secondary: '#101820' },
    'San Francisco': { primary: '#AA0000', secondary: '#B3995D' },
    'Seattle': { primary: '#002244', secondary: '#69BE28' },
    'Tampa Bay': { primary: '#D50A0A', secondary: '#FF7900' },
    'Tennessee': { primary: '#0C2340', secondary: '#4B92DB' },
    'Washington': { primary: '#5A1414', secondary: '#FFB612' },
  };
  return colorMap[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
};

// Helper function to get CFB team colors
const getCFBTeamColors = (teamName: string): { primary: string; secondary: string } => {
  const colorMap: { [key: string]: { primary: string; secondary: string } } = {
    // SEC
    'Alabama': { primary: '#9E1B32', secondary: '#FFFFFF' },
    'Auburn': { primary: '#0C2340', secondary: '#E87722' },
    'Georgia': { primary: '#BA0C2F', secondary: '#000000' },
    'Florida': { primary: '#0021A5', secondary: '#FA4616' },
    'LSU': { primary: '#461D7C', secondary: '#FDD023' },
    'Texas A&M': { primary: '#500000', secondary: '#FFFFFF' },
    'Ole Miss': { primary: '#CE1126', secondary: '#14213D' },
    'Mississippi State': { primary: '#5D1725', secondary: '#FFFFFF' },
    'Arkansas': { primary: '#9D2235', secondary: '#FFFFFF' },
    'Kentucky': { primary: '#0033A0', secondary: '#FFFFFF' },
    'Tennessee': { primary: '#FF8200', secondary: '#FFFFFF' },
    'South Carolina': { primary: '#73000A', secondary: '#000000' },
    'Missouri': { primary: '#F1B82D', secondary: '#000000' },
    'Vanderbilt': { primary: '#866D4B', secondary: '#000000' },
    
    // Big Ten
    'Ohio State': { primary: '#BB0000', secondary: '#666666' },
    'Michigan': { primary: '#00274C', secondary: '#FFCB05' },
    'Penn State': { primary: '#041E42', secondary: '#FFFFFF' },
    'Michigan State': { primary: '#18453B', secondary: '#FFFFFF' },
    'Wisconsin': { primary: '#C5050C', secondary: '#FFFFFF' },
    'Iowa': { primary: '#FFCD00', secondary: '#000000' },
    'Minnesota': { primary: '#7A0019', secondary: '#FFCC33' },
    'Nebraska': { primary: '#E41C38', secondary: '#FFFFFF' },
    'Illinois': { primary: '#13294B', secondary: '#E84A27' },
    'Northwestern': { primary: '#4E2A84', secondary: '#FFFFFF' },
    'Purdue': { primary: '#000000', secondary: '#CFB991' },
    'Indiana': { primary: '#990000', secondary: '#FFFFFF' },
    'Rutgers': { primary: '#CC0033', secondary: '#FFFFFF' },
    'Maryland': { primary: '#E03A3E', secondary: '#FFD520' },
    
    // Big 12
    'Oklahoma': { primary: '#841617', secondary: '#FDF9D8' },
    'Texas': { primary: '#BF5700', secondary: '#FFFFFF' },
    'Oklahoma State': { primary: '#FF6600', secondary: '#000000' },
    'Baylor': { primary: '#003015', secondary: '#FFB81C' },
    'TCU': { primary: '#4D1979', secondary: '#A3A9AC' },
    'Texas Tech': { primary: '#CC0000', secondary: '#000000' },
    'Kansas State': { primary: '#512888', secondary: '#FFFFFF' },
    'Iowa State': { primary: '#C8102E', secondary: '#F1BE48' },
    'Kansas': { primary: '#0051BA', secondary: '#E8000D' },
    'West Virginia': { primary: '#002855', secondary: '#EAAA00' },
    'BYU': { primary: '#002E5D', secondary: '#FFFFFF' },
    'Cincinnati': { primary: '#E00122', secondary: '#000000' },
    'UCF': { primary: '#BA9B37', secondary: '#000000' },
    'Houston': { primary: '#C8102E', secondary: '#FFFFFF' },
    
    // ACC
    'Clemson': { primary: '#F56600', secondary: '#522D80' },
    'Florida State': { primary: '#782F40', secondary: '#CEB888' },
    'Miami': { primary: '#F47321', secondary: '#005030' },
    'North Carolina': { primary: '#7BAFD4', secondary: '#13294B' },
    'NC State': { primary: '#CC0000', secondary: '#FFFFFF' },
    'Virginia Tech': { primary: '#630031', secondary: '#CF4420' },
    'Virginia': { primary: '#232D4B', secondary: '#E57200' },
    'Duke': { primary: '#003087', secondary: '#FFFFFF' },
    'Wake Forest': { primary: '#9E7E38', secondary: '#000000' },
    'Georgia Tech': { primary: '#B3A369', secondary: '#003057' },
    'Boston College': { primary: '#98002E', secondary: '#FFB81C' },
    'Pitt': { primary: '#003594', secondary: '#FFB81C' },
    'Syracuse': { primary: '#F76900', secondary: '#000E54' },
    'Louisville': { primary: '#AD0000', secondary: '#000000' },
    
    // Pac-12
    'USC': { primary: '#990000', secondary: '#FFCC00' },
    'UCLA': { primary: '#2D68C4', secondary: '#FFD100' },
    'Oregon': { primary: '#007030', secondary: '#FEE123' },
    'Washington': { primary: '#4B2E83', secondary: '#B7A57A' },
    'Utah': { primary: '#CC0000', secondary: '#FFFFFF' },
    'Arizona State': { primary: '#8C1D40', secondary: '#FFC627' },
    'Arizona': { primary: '#003366', secondary: '#CC0033' },
    'Colorado': { primary: '#000000', secondary: '#CFB87C' },
    'Stanford': { primary: '#8C1515', secondary: '#FFFFFF' },
    'California': { primary: '#003262', secondary: '#FDB515' },
    'Oregon State': { primary: '#DC4405', secondary: '#000000' },
    'Washington State': { primary: '#981E32', secondary: '#5E6A71' },
    
    // Independents
    'Notre Dame': { primary: '#0C2340', secondary: '#C99700' },
    'Army': { primary: '#000000', secondary: '#D4AF37' },
    'Navy': { primary: '#000080', secondary: '#C5B783' },
    
    // Other notable programs
    'Boise State': { primary: '#0033A0', secondary: '#D64309' },
    'San Diego State': { primary: '#A6192E', secondary: '#000000' },
    'Fresno State': { primary: '#DB0032', secondary: '#003A70' },
    'Utah State': { primary: '#003057', secondary: '#FFFFFF' },
    'Wyoming': { primary: '#492F24', secondary: '#FFC425' },
    'Colorado State': { primary: '#1E4D2B', secondary: '#C8C372' },
    'Nevada': { primary: '#003366', secondary: '#A2AAAD' },
    'UNLV': { primary: '#CF0A2C', secondary: '#A7A8AA' },
    'New Mexico': { primary: '#BA0C2F', secondary: '#A7A8AA' },
    'Hawaii': { primary: '#024731', secondary: '#FFFFFF' },
    'San Jose State': { primary: '#0055A2', secondary: '#E5A823' },
    
    'Memphis': { primary: '#003087', secondary: '#808285' },
    'SMU': { primary: '#CC0033', secondary: '#0033A0' },
    'Tulane': { primary: '#006747', secondary: '#418FDE' },
    'Tulsa': { primary: '#002D72', secondary: '#C8102E' },
    'East Carolina': { primary: '#592A8A', secondary: '#FFC845' },
    'Temple': { primary: '#9D2235', secondary: '#FFFFFF' },
    'South Florida': { primary: '#006747', secondary: '#CFC493' },
    'Charlotte': { primary: '#046A38', secondary: '#FFFFFF' },
    'Florida Atlantic': { primary: '#003366', secondary: '#CC0000' },
    'Florida International': { primary: '#081E3F', secondary: '#B6862C' },
    'Marshall': { primary: '#00B140', secondary: '#FFFFFF' },
    'Old Dominion': { primary: '#003057', secondary: '#A2AAAD' },
    'Middle Tennessee': { primary: '#0066CC', secondary: '#FFFFFF' },
    'Western Kentucky': { primary: '#C8102E', secondary: '#FFFFFF' },
    'North Texas': { primary: '#00853E', secondary: '#FFFFFF' },
    'UTSA': { primary: '#0C2340', secondary: '#F15A22' },
    'Rice': { primary: '#00205B', secondary: '#8996A0' },
    'Louisiana Tech': { primary: '#00338D', secondary: '#EB1C2D' },
    'Southern Miss': { primary: '#FFAA3C', secondary: '#000000' },
    'UTEP': { primary: '#FF8200', secondary: '#041E42' },
    'New Mexico State': { primary: '#BA0C2F', secondary: '#FFFFFF' },
    'Liberty': { primary: '#002D72', secondary: '#C8102E' },
    'James Madison': { primary: '#450084', secondary: '#FFB612' },
    'Appalachian State': { primary: '#000000', secondary: '#FFCC00' },
    'Coastal Carolina': { primary: '#006F71', secondary: '#A27752' },
    'Georgia Southern': { primary: '#003A70', secondary: '#FFFFFF' },
    'Georgia State': { primary: '#0033A0', secondary: '#C8102E' },
    'Troy': { primary: '#8B0015', secondary: '#A7A8AA' },
    'South Alabama': { primary: '#004B8D', secondary: '#C8102E' },
    'Louisiana': { primary: '#CE181E', secondary: '#FFFFFF' },
    'Louisiana Monroe': { primary: '#8B0015', secondary: '#FFC82E' },
    'Arkansas State': { primary: '#CC092F', secondary: '#000000' },
    'Texas State': { primary: '#501214', secondary: '#B29369' },
    
    'Buffalo': { primary: '#005BBB', secondary: '#FFFFFF' },
    'Akron': { primary: '#041E42', secondary: '#A89968' },
    'Kent State': { primary: '#002664', secondary: '#EEB111' },
    'Ohio': { primary: '#00694E', secondary: '#FFFFFF' },
    'Miami (OH)': { primary: '#C8102E', secondary: '#FFFFFF' },
    'Bowling Green': { primary: '#FE5000', secondary: '#4F2C1D' },
    'Toledo': { primary: '#003E7E', secondary: '#F7B718' },
    'Central Michigan': { primary: '#6A0032', secondary: '#FFC82E' },
    'Eastern Michigan': { primary: '#006633', secondary: '#FFFFFF' },
    'Western Michigan': { primary: '#5B4638', secondary: '#FFCB05' },
    'Northern Illinois': { primary: '#BA0C2F', secondary: '#000000' },
    'Ball State': { primary: '#BA0C2F', secondary: '#FFFFFF' },
  };
  
  return colorMap[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
};

export default function EditorsPicks() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { adminModeEnabled } = useAdminMode();
  const [picks, setPicks] = useState<EditorPick[]>([]);
  const [gamesData, setGamesData] = useState<Map<string, GameData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect to welcome page if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

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
                raw_game_date: line.game_date, // Store raw date (YYYY-MM-DD)
                away_spread: line.away_spread,
                home_spread: line.home_spread,
                over_line: line.over_line,
                away_ml: line.away_ml,
                home_ml: line.home_ml,
                away_team_colors: getNFLTeamColors(line.away_team),
                home_team_colors: getNFLTeamColors(line.home_team),
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
                raw_game_date: startTimeString, // Store raw ISO date string
                away_spread: game.api_spread ? -game.api_spread : null,
                home_spread: game.api_spread,
                over_line: game.api_over_line,
                away_ml: game.away_moneyline || game.away_ml,
                home_ml: game.home_moneyline || game.home_ml,
                opening_spread: (game as any).spread ?? null, // Opening spread from 'spread' column
                away_team_colors: getCFBTeamColors(game.away_team),
                home_team_colors: getCFBTeamColors(game.home_team),
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
    if (user) {
      fetchPicks();
    }
  }, [adminModeEnabled, user]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-6 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

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

  // Helper function to check if a game date has passed (next day or later)
  const isGameExpired = (gameData: GameData | undefined): boolean => {
    if (!gameData || !gameData.raw_game_date) {
      return false; // If no date, don't filter it out
    }

    try {
      // Parse the game date
      const gameDate = new Date(gameData.raw_game_date);
      
      // Get today at midnight (local time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get game date at midnight (local time)
      const gameDateOnly = new Date(gameDate);
      gameDateOnly.setHours(0, 0, 0, 0);
      
      // Game is expired if it's before today (next day after game = today or later)
      return gameDateOnly < today;
    } catch (error) {
      console.error('Error checking game expiration:', error);
      return false; // Don't filter out if we can't parse the date
    }
  };

  const draftPicks = picks.filter(p => !p.is_published);
  
  // Filter published picks to only show games that haven't expired
  // In admin mode, show all picks; otherwise filter out expired ones
  const publishedPicks = picks.filter(p => {
    if (!p.is_published) return false;
    
    // In admin mode, show all published picks including expired ones
    if (adminModeEnabled) return true;
    
    // For regular users, filter out expired games
    const gameData = gamesData.get(p.game_id);
    return !isGameExpired(gameData);
  });

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

      {/* Empty State - Show when there are no published picks for users or no picks at all for admins */}
      {((publishedPicks.length === 0 && !adminModeEnabled) || (picks.length === 0 && adminModeEnabled)) && !error && (
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="text-center py-12 px-4">
              {adminModeEnabled ? (
                <>
                  <Star className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Editor Picks Yet</h3>
                  <p className="text-muted-foreground">
                    Start by starring games on the NFL or College Football pages to create your first pick.
                  </p>
                </>
              ) : (
                <>
                  <div className="relative mb-6">
                    <Sparkles className="h-20 w-20 text-yellow-500 mx-auto animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Fresh Picks Coming Soon!</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    We're preparing our latest expert picks for you. In the meantime, get daily betting insights and analysis from our main channel!
                  </p>
                  <Button 
                    size="lg"
                    className="gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold shadow-lg"
                    onClick={() => window.open('https://www.tiktok.com/@wagerproof', '_blank')}
                  >
                    <svg 
                      className="h-5 w-5" 
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    Follow @wagerproof on TikTok
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4">
                    Daily picks • Analysis • Expert insights
                  </p>
                </>
              )}
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

