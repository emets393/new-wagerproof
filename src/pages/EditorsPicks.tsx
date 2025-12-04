import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { supabase } from '@/integrations/supabase/client';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertCircle, Star, Loader2, Sparkles, ExternalLink, Plus, LayoutGrid, List } from 'lucide-react';
import debug from '@/utils/debug';
import { EditorPickCard } from '@/components/EditorPickCard';
import { EditorPickListItem } from '@/components/EditorPickListItem';
import { EditorPickCreatorModal } from '@/components/EditorPickCreatorModal';
import { EditorPicksStats } from '@/components/EditorPicksStats';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { ValueFindsSection } from '@/components/ValueFindsSection';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useTheme } from '@/contexts/ThemeContext';
import { getNBATeamColors, getNCAABTeamColors } from '@/utils/teamColors';
import { getNBATeamLogo, getNCAABTeamLogo } from '@/utils/teamLogos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface EditorPick {
  id: string;
  game_id: string;
  game_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  editor_id: string;
  selected_bet_type: 'spread' | 'over_under' | 'moneyline';
  editors_notes: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  betslip_links?: Record<string, string> | null;
  pick_value?: string | null;
  best_price?: string | null;
  sportsbook?: string | null;
  units?: number | null;
  is_free_pick?: boolean;
  archived_game_data?: any;
  bet_type?: string | null;
  result?: 'won' | 'lost' | 'push' | 'pending' | null;
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
  const { showExtraValueSuggestions } = useDisplaySettings();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [picks, setPicks] = useState<EditorPick[]>([]);
  const [gamesData, setGamesData] = useState<Map<string, GameData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('editorsPicks_activeTab');
    return saved || 'active';
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('editorsPicks_viewMode') as 'grid' | 'list') || 'list';
  });
  const [selectedSportFilter, setSelectedSportFilter] = useState<string | null>(() => {
    const saved = localStorage.getItem('editorsPicks_sportFilter');
    return saved || null;
  });
  
  // Date range filter for historical picks (default: show all - no filter)
  const getDefaultDateRange = (): DateRange | undefined => {
    // Return undefined to show all picks by default
    return undefined;
  };
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const saved = localStorage.getItem('editorsPicks_dateRange');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // If saved as null/undefined string, return undefined
        if (parsed === null || parsed === 'null' || parsed === 'undefined') {
          return undefined;
        }
        
        const from = parsed.from ? new Date(parsed.from) : undefined;
        const to = parsed.to ? new Date(parsed.to) : undefined;
        
        // Validate dates
        if (from && !isNaN(from.getTime()) && to && !isNaN(to.getTime())) {
          return { from, to };
        }
      } catch (e) {
        debug.error('Error parsing saved date range:', e);
      }
    }
    return getDefaultDateRange();
  });
  
  // Modal state for creating/editing picks
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPick, setEditingPick] = useState<EditorPick | null>(null);

  const handleOpenCreateModal = () => {
    setEditingPick(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (pick: EditorPick) => {
    setEditingPick(pick);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPick(null);
  };

  const handleModalSuccess = () => {
    fetchPicks();
  };

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
        debug.log('📊 Editor Picks found:', picksData);
        const nflGameIds = picksData.filter(p => p.game_type === 'nfl').map(p => p.game_id);
        const cfbGameIds = picksData.filter(p => p.game_type === 'cfb').map(p => p.game_id);
        const nbaGameIds = picksData.filter(p => p.game_type === 'nba').map(p => p.game_id);
        const ncaabGameIds = picksData.filter(p => p.game_type === 'ncaab').map(p => p.game_id);

        debug.log('🏈 NFL Game IDs to fetch:', nflGameIds);
        debug.log('🏈 CFB Game IDs to fetch:', cfbGameIds);
        debug.log('🏀 NBA Game IDs to fetch:', nbaGameIds);
        debug.log('🏀 NCAAB Game IDs to fetch:', ncaabGameIds);

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

        debug.log('🏈 CFB Team Mappings fetched:', cfbTeamMappings?.length || 0);
        if (cfbMappingError) {
          debug.error('CFB team mapping error:', cfbMappingError);
        }

        // Helper function to get CFB team logo with flexible matching
        const getCFBTeamLogo = (teamName: string): string => {
          if (!cfbTeamMappings || cfbTeamMappings.length === 0) {
            return '';
          }
          
          // Try exact match first
          let mapping = cfbTeamMappings.find(m => m.api === teamName);
          
          // Try case-insensitive match
          if (!mapping) {
            const lowerTeamName = teamName.toLowerCase();
            mapping = cfbTeamMappings.find(m => m.api && m.api.toLowerCase() === lowerTeamName);
          }
          
          // Try partial match (teamName contains api or api contains teamName)
          if (!mapping) {
            const lowerTeamName = teamName.toLowerCase();
            mapping = cfbTeamMappings.find(m => {
              if (!m.api) return false;
              const lowerApi = m.api.toLowerCase();
              return lowerTeamName.includes(lowerApi) || lowerApi.includes(lowerTeamName);
            });
          }
          
          return mapping?.logo_light || '';
        };

        // Fetch NFL games - using the same approach as NFL.tsx
        // Map: editors_picks.game_id -> nfl_betting_lines.training_key
        if (nflGameIds.length > 0) {
          // Get the betting lines for these games (includes game_time_et)
          const { data: bettingLines, error: linesError } = await collegeFootballSupabase
            .from('nfl_betting_lines')
            .select('*')
            .in('training_key', nflGameIds);

          debug.log('🏈 NFL Betting Lines fetched:', bettingLines);
          debug.log('🏈 NFL Betting Lines error:', linesError);

          // Then get predictions
          const { data: nflPredictions, error: predsError } = await collegeFootballSupabase
            .from('nfl_predictions_epa')
            .select('*')
            .in('training_key', nflGameIds);

          debug.log('🏈 NFL Predictions fetched:', nflPredictions);
          debug.log('🏈 NFL Predictions error:', predsError);

          if (!linesError && bettingLines) {
            bettingLines.forEach((line: any) => {
              // Find matching prediction if it exists
              const prediction = nflPredictions?.find((p: any) => p.training_key === line.training_key);
              
              debug.log('Adding NFL game to map:', line.training_key, line.away_team, '@', line.home_team);
              
              // Format NFL date
              const gameDateRaw = line.game_date;
              let formattedDate = gameDateRaw;
              if (gameDateRaw) {
                try {
                  const [year, month, day] = gameDateRaw.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  formattedDate = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                } catch (error) {
                  debug.error('Error formatting NFL date:', error);
                }
              }
              
              // Format NFL time - get game_time_et from nfl_betting_lines
              // Add 5 hours to whatever time we get
              let formattedTime = '';
              if (line.game_time_et) {
                try {
                  const timeEt = line.game_time_et;
                  
                  // Parse the full datetime string as UTC (handles +00 offset correctly)
                  let date = new Date(timeEt);
                  
                  if (isNaN(date.getTime())) {
                    debug.error('Invalid datetime:', timeEt);
                    formattedTime = 'TBD';
                  } else {
                    // Add 5 hours to the date
                    date = new Date(date.getTime() + (5 * 60 * 60 * 1000));
                    
                    // Format as 12-hour time
                    formattedTime = date.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });
                    
                    // Get timezone abbreviation (EST/EDT)
                    const formatter = new Intl.DateTimeFormat('en-US', {
                      timeZone: 'America/New_York',
                      timeZoneName: 'short'
                    });
                    const parts = formatter.formatToParts(date);
                    const tzName = parts.find(part => part.type === 'timeZoneName')?.value || 'EST';
                    formattedTime = `${formattedTime} ${tzName}`;
                  }
                } catch (error) {
                  debug.error('Error converting game_time_et:', error, line.game_time_et);
                  formattedTime = 'TBD';
                }
              }
              
              // Fallback to other sources if game_time_et not available - add 5 hours (matching NFL.tsx logic)
              // game_time is in UTC format, so we need to add 5 hours to convert to EST
              if (!formattedTime && line.game_time) {
                try {
                  const fallbackTime = line.game_time;
                  debug.log(`   ⚠️ No game_time_et, falling back to game_time: ${fallbackTime}`);
                  // Parse the time string (format: "08:00:00" or "08:00" in UTC)
                  const parts = fallbackTime.split(':');
                  if (parts.length >= 2) {
                    const hours = parseInt(parts[0], 10);
                    const minutes = parseInt(parts[1] || '0', 10);
                    if (!isNaN(hours) && !isNaN(minutes) && gameDateRaw) {
                      // Create date object with the time
                      const [year, month, day] = gameDateRaw.split('-').map(Number);
                      let date = new Date(year, month - 1, day, hours, minutes, 0);
                      
                      // Add 5 hours to whatever time we have
                      date = new Date(date.getTime() + (5 * 60 * 60 * 1000));
                      
                      if (!isNaN(date.getTime())) {
                        // Format as 12-hour time
                        formattedTime = date.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        });
                        // Get timezone abbreviation (EST/EDT)
                        const formatter = new Intl.DateTimeFormat('en-US', {
                          timeZone: 'America/New_York',
                          timeZoneName: 'short'
                        });
                        const formatParts = formatter.formatToParts(date);
                        const tzName = formatParts.find(part => part.type === 'timeZoneName')?.value || 'EST';
                        formattedTime = `${formattedTime} ${tzName}`;
                        debug.log(`   ✅ Converted fallback time: ${fallbackTime} -> ${formattedTime}`);
                      }
                    } else {
                      formattedTime = fallbackTime; // Fallback to original if parsing fails
                    }
                  } else {
                    formattedTime = fallbackTime; // Fallback to original if format is unexpected
                  }
                } catch (error) {
                  debug.error('Error converting fallback game_time:', error, line.game_time);
                  formattedTime = line.game_time; // Fallback to original on error
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
          debug.log('🏈 Querying CFB games with IDs:', cfbGameIds);
          debug.log('🏈 ID types:', cfbGameIds.map(id => `${id} (${typeof id})`));
          
          // Try converting IDs to numbers in case the database uses numeric type
          const numericIds = cfbGameIds.map(id => {
            const parsed = parseInt(id);
            return isNaN(parsed) ? id : parsed;
          });
          
          debug.log('🏈 Numeric IDs:', numericIds);
          
          const { data: cfbGames, error: cfbError } = await collegeFootballSupabase
            .from('cfb_live_weekly_inputs')
            .select('*')
            .in('id', numericIds);

          debug.log('🏈 CFB Games fetched:', cfbGames);
          debug.log('🏈 CFB Games count:', cfbGames?.length || 0);
          debug.log('🏈 CFB Fetch error:', cfbError);
          
          // Debug: Let's also try fetching all CFB games to see what IDs are available
          if (!cfbGames || cfbGames.length === 0) {
            const { data: allCfbGames, error: allError } = await collegeFootballSupabase
              .from('cfb_live_weekly_inputs')
              .select('id, away_team, home_team')
              .limit(10);
            debug.log('🏈 Sample CFB games in DB (first 10):', allCfbGames);
            debug.log('🏈 Sample ID types:', allCfbGames?.map(g => `${g.id} (${typeof g.id})`));
          }

          if (!cfbError && cfbGames) {
            cfbGames.forEach(game => {
              debug.log('Adding CFB game to map:', game.id, game.away_team, '@', game.home_team);
              
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
                  debug.error('Error formatting CFB date/time:', error);
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

        // Fetch NBA games
        if (nbaGameIds.length > 0) {
          debug.log('🏀 Querying NBA games with IDs:', nbaGameIds);
          
          const { data: nbaGames, error: nbaError } = await collegeFootballSupabase
            .from('nba_input_values_view')
            .select('*')
            .in('game_id', nbaGameIds);

          debug.log('🏀 NBA Games fetched:', nbaGames?.length || 0);
          debug.log('🏀 NBA Fetch error:', nbaError);


          if (!nbaError && nbaGames) {
            // Process games in parallel
            await Promise.all(nbaGames.map(async (game) => {
              debug.log('Adding NBA game to map:', game.game_id, game.away_team, '@', game.home_team);
              
              // Format date and time
              let formattedDate = 'TBD';
              let formattedTime = 'TBD';
              
              if (game.game_date) {
                try {
                  const [year, month, day] = game.game_date.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  formattedDate = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                } catch (error) {
                  debug.error('Error formatting NBA date:', error);
                }
              }
              
              if (game.tipoff_time_et) {
                try {
                  // tipoff_time_et might be a full ISO datetime or just a time string
                  let date: Date;
                  if (game.tipoff_time_et.includes('T') || (game.tipoff_time_et.includes(' ') && game.tipoff_time_et.length > 10)) {
                    date = new Date(game.tipoff_time_et);
                  } else {
                    // Combine with game_date to create proper datetime
                    const [hours, minutes] = game.tipoff_time_et.split(':').map(Number);
                    if (game.game_date && !isNaN(hours) && !isNaN(minutes)) {
                      const [year, month, day] = game.game_date.split('-').map(Number);
                      // Create date in EST timezone
                      date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`);
                    } else {
                      date = new Date();
                    }
                  }
                  
                  formattedTime = date.toLocaleTimeString('en-US', {
                    timeZone: 'America/New_York',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/New_York',
                    timeZoneName: 'short'
                  });
                  const parts = formatter.formatToParts(date);
                  const tzName = parts.find(part => part.type === 'timeZoneName')?.value || 'EST';
                  formattedTime = `${formattedTime} ${tzName}`;
                } catch (error) {
                  debug.error('Error formatting NBA time:', error);
                }
              }
              
              // Calculate away moneyline from home moneyline (same as NBA.tsx)
              const homeML = game.home_moneyline;
              let awayML = null;
              if (homeML) {
                awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
              }
              
              // Get logos using the same utility functions as NBA page
              const [awayLogo, homeLogo] = await Promise.all([
                getNBATeamLogo(game.away_team),
                getNBATeamLogo(game.home_team)
              ]);
              
              gameDataMap.set(String(game.game_id), {
                away_team: game.away_team,
                home_team: game.home_team,
                away_logo: awayLogo,
                home_logo: homeLogo,
                game_date: formattedDate,
                game_time: formattedTime,
                raw_game_date: game.game_date,
                away_spread: game.home_spread ? -game.home_spread : null,
                home_spread: game.home_spread,
                over_line: game.total_line,
                away_ml: awayML,
                home_ml: homeML,
                away_team_colors: getNBATeamColors(game.away_team),
                home_team_colors: getNBATeamColors(game.home_team),
              });
            }));
          }
        }

        // Fetch NCAAB games
        if (ncaabGameIds.length > 0) {
          debug.log('🏀 Querying NCAAB games with IDs:', ncaabGameIds);
          
          const { data: ncaabGames, error: ncaabError } = await collegeFootballSupabase
            .from('v_cbb_input_values')
            .select('*')
            .in('game_id', ncaabGameIds);

          debug.log('🏀 NCAAB Games fetched:', ncaabGames?.length || 0);
          debug.log('🏀 NCAAB Fetch error:', ncaabError);

          // Fetch NCAAB predictions for betting lines
          const { data: latestRun, error: runError } = await collegeFootballSupabase
            .from('ncaab_predictions')
            .select('run_id, as_of_ts_utc')
            .order('as_of_ts_utc', { ascending: false })
            .limit(1)
            .maybeSingle();

          let predictionsMap = new Map();
          if (!runError && latestRun && ncaabGames) {
            const gameIds = ncaabGames.map(g => g.game_id);
            const { data: predictions } = await collegeFootballSupabase
              .from('ncaab_predictions')
              .select('game_id, vegas_home_spread, vegas_total, vegas_home_moneyline, vegas_away_moneyline')
              .eq('run_id', latestRun.run_id)
              .in('game_id', gameIds);
            
            predictions?.forEach(pred => {
              predictionsMap.set(pred.game_id, pred);
            });
          }


          if (!ncaabError && ncaabGames) {
            // Process games in parallel
            await Promise.all(ncaabGames.map(async (game) => {
              debug.log('Adding NCAAB game to map:', game.game_id, game.away_team, '@', game.home_team);
              
              const prediction = predictionsMap.get(game.game_id);
              
              // Get betting lines - prioritize from predictions, fallback to game data
              const vegasHomeSpread = prediction?.vegas_home_spread ?? game.spread ?? null;
              const vegasTotal = prediction?.vegas_total ?? game.over_under ?? null;
              const homeML = game.homeMoneyline ?? prediction?.vegas_home_moneyline ?? null;
              const awayML = game.awayMoneyline ?? prediction?.vegas_away_moneyline ?? null;
              
              // Format date and time
              let formattedDate = 'TBD';
              let formattedTime = 'TBD';
              
              if (game.game_date_et) {
                try {
                  const [year, month, day] = game.game_date_et.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  formattedDate = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                } catch (error) {
                  debug.error('Error formatting NCAAB date:', error);
                }
              }
              
              const timeSource = game.start_utc || game.tipoff_time_et;
              if (timeSource) {
                try {
                  let date: Date;
                  if (timeSource.includes('T') || (timeSource.includes(' ') && timeSource.length > 10)) {
                    date = new Date(timeSource);
                  } else {
                    // Combine with game_date_et to create proper datetime
                    const [hours, minutes] = timeSource.split(':').map(Number);
                    if (game.game_date_et && !isNaN(hours) && !isNaN(minutes)) {
                      const [year, month, day] = game.game_date_et.split('-').map(Number);
                      // Create date in EST timezone
                      date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`);
                    } else {
                      date = new Date();
                    }
                  }
                  
                  formattedTime = date.toLocaleTimeString('en-US', {
                    timeZone: 'America/New_York',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/New_York',
                    timeZoneName: 'short'
                  });
                  const parts = formatter.formatToParts(date);
                  const tzName = parts.find(part => part.type === 'timeZoneName')?.value || 'EST';
                  formattedTime = `${formattedTime} ${tzName}`;
                } catch (error) {
                  debug.error('Error formatting NCAAB time:', error);
                }
              }
              
              // Get logos using the same utility functions as NCAAB page
              const [awayLogo, homeLogo] = await Promise.all([
                getNCAABTeamLogo(game.away_team_id),
                getNCAABTeamLogo(game.home_team_id)
              ]);
              
              gameDataMap.set(String(game.game_id), {
                away_team: game.away_team,
                home_team: game.home_team,
                away_logo: awayLogo,
                home_logo: homeLogo,
                game_date: formattedDate,
                game_time: formattedTime,
                raw_game_date: game.game_date_et || game.start_utc,
                away_spread: vegasHomeSpread !== null ? -vegasHomeSpread : null,
                home_spread: vegasHomeSpread,
                over_line: vegasTotal,
                away_ml: awayML,
                home_ml: homeML,
                away_team_colors: getNCAABTeamColors(game.away_team),
                home_team_colors: getNCAABTeamColors(game.home_team),
              });
            }));
          }
        }

        debug.log('🗺️ Game data map size before archived fallback:', gameDataMap.size);
        
        // Fallback: For picks without game data in live tables, use archived_game_data
        for (const pick of picksData as EditorPick[]) {
          const pickGameId = String(pick.game_id);
          if (!gameDataMap.has(pickGameId) && pick.archived_game_data) {
            const archived = pick.archived_game_data;
            debug.log(`📦 Using archived_game_data for pick ${pickGameId} (${pick.game_type}):`, archived);
            
            const awayTeam = archived.awayTeam || archived.away_team || 'Unknown';
            const homeTeam = archived.homeTeam || archived.home_team || 'Unknown';
            
            // Fetch logos if missing or invalid - ensure they're strings
            let awayLogo: string = '';
            let homeLogo: string = '';
            
            // Safely extract logo values, ensuring they're strings
            const awayLogoRaw = archived.awayLogo || archived.away_logo;
            const homeLogoRaw = archived.homeLogo || archived.home_logo;
            
            if (typeof awayLogoRaw === 'string' && awayLogoRaw.trim() !== '') {
              awayLogo = awayLogoRaw;
            }
            if (typeof homeLogoRaw === 'string' && homeLogoRaw.trim() !== '') {
              homeLogo = homeLogoRaw;
            }
            
            // If logos are missing or invalid, try to fetch them based on game type
            if ((!awayLogo || awayLogo === '/placeholder.svg') && awayTeam !== 'Unknown') {
              try {
                if (pick.game_type === 'nba') {
                  awayLogo = await getNBATeamLogo(awayTeam);
                } else if (pick.game_type === 'ncaab') {
                  // For NCAAB, we'd need team ID, but archived data might not have it
                  // Try to get logo from team name if possible
                  awayLogo = '/placeholder.svg'; // Will fallback to initials
                } else if (pick.game_type === 'nfl') {
                  // Use the helper function from NFL.tsx logic
                  const nflLogoMap: { [key: string]: string } = {
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
                  awayLogo = nflLogoMap[awayTeam] || '/placeholder.svg';
                } else if (pick.game_type === 'cfb') {
                  // Try to get CFB logo from team mapping
                  const cfbMapping = cfbTeamMappings?.find(m => m.api === awayTeam);
                  awayLogo = cfbMapping?.logo_light || '/placeholder.svg';
                }
              } catch (e) {
                debug.error('Error fetching away logo:', e);
                awayLogo = '/placeholder.svg';
              }
            }
            
            if ((!homeLogo || homeLogo === '/placeholder.svg') && homeTeam !== 'Unknown') {
              try {
                if (pick.game_type === 'nba') {
                  homeLogo = await getNBATeamLogo(homeTeam);
                } else if (pick.game_type === 'ncaab') {
                  homeLogo = '/placeholder.svg'; // Will fallback to initials
                } else if (pick.game_type === 'nfl') {
                  const nflLogoMap: { [key: string]: string } = {
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
                  homeLogo = nflLogoMap[homeTeam] || '/placeholder.svg';
                } else if (pick.game_type === 'cfb') {
                  const cfbMapping = cfbTeamMappings?.find(m => m.api === homeTeam);
                  homeLogo = cfbMapping?.logo_light || '/placeholder.svg';
                }
              } catch (e) {
                debug.error('Error fetching home logo:', e);
                homeLogo = '/placeholder.svg';
              }
            }
            
            // Clean up date strings - remove "INVALID DATE" text if present
            let gameDate = archived.gameDate || archived.game_date || 'TBD';
            let rawGameDate = archived.rawGameDate || archived.raw_game_date || archived.game_date_et || archived.start_utc || archived.gameDate || archived.game_date;
            
            // Remove "INVALID DATE" from date strings
            if (typeof gameDate === 'string') {
              gameDate = gameDate.replace(/INVALID DATE/gi, '').replace(/NaN/gi, '').trim() || 'TBD';
            }
            if (typeof rawGameDate === 'string') {
              rawGameDate = rawGameDate.replace(/INVALID DATE/gi, '').replace(/NaN/gi, '').trim() || '';
              
              // If rawGameDate is still formatted like "Mon, Dec 1" (no year, no YYYY-MM-DD pattern),
              // we need to handle it in the filter logic with year inference
              // But log it so we know it's happening
              if (rawGameDate && !rawGameDate.match(/^\d{4}-\d{2}-\d{2}/) && !rawGameDate.includes('T')) {
                debug.log(`⚠️ Pick ${pickGameId} has formatted date in raw_game_date: "${rawGameDate}" - will need year inference`);
              }
            }
            
            // Transform camelCase archived data to snake_case GameData format
            gameDataMap.set(pickGameId, {
              away_team: awayTeam,
              home_team: homeTeam,
              away_logo: awayLogo,
              home_logo: homeLogo,
              game_date: gameDate,
              game_time: archived.gameTime || archived.game_time || '',
              raw_game_date: rawGameDate,
              away_spread: archived.awaySpread ?? archived.away_spread ?? null,
              home_spread: archived.homeSpread ?? archived.home_spread ?? null,
              over_line: archived.overLine ?? archived.over_line ?? null,
              away_ml: archived.awayMl ?? archived.away_ml ?? null,
              home_ml: archived.homeMl ?? archived.home_ml ?? null,
              away_team_colors: archived.awayTeamColors || archived.away_team_colors || { primary: '#6B7280', secondary: '#9CA3AF' },
              home_team_colors: archived.homeTeamColors || archived.home_team_colors || { primary: '#6B7280', secondary: '#9CA3AF' },
            });
          }
        }
        
        debug.log('🗺️ Final game data map size:', gameDataMap.size);
        debug.log('🗺️ Game data map keys:', Array.from(gameDataMap.keys()));
        debug.log('🗺️ Game data map keys types:', Array.from(gameDataMap.keys()).map(k => `${k} (${typeof k})`));
        debug.log('🗺️ Pick game_ids to match:', picksData.map(p => `${p.game_id} (${typeof p.game_id}) - ${p.game_type}`));
        setGamesData(gameDataMap);
      }
    } catch (err) {
      debug.error('Error fetching editor picks:', err);
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

  const draftPicks = picks.filter(p => !p.is_published);
  
  // Helper function to check if a pick is for a historical game (older than a week)
  const isHistoricalGame = (pick: EditorPick): boolean => {
    const gameData = gamesData.get(pick.game_id);
    
    // If no game data or no date, consider it as active
    if (!gameData || !gameData.raw_game_date) {
      return false;
    }
    
    try {
      const gameDate = new Date(gameData.raw_game_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Create date for 7 days ago
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(today.getDate() - 7);
      
      const gameDateOnly = new Date(gameDate);
      gameDateOnly.setHours(0, 0, 0, 0);
      
      // Game is historical if it's older than a week
      return gameDateOnly < oneWeekAgo;
    } catch (error) {
      debug.error('Error checking if game is historical:', error);
      return false;
    }
  };
  
  // Get all published picks (no filtering yet - we'll split into active/historical)
  const allPublishedPicks = picks.filter(p => p.is_published);
  
  // Split published picks into active and historical for ALL users
  // Active: picks without a result (won/lost/push) AND games within last 7 days or future games
  // Historical: picks with a result (won/lost/push) OR games older than 7 days
  const activePicks = allPublishedPicks.filter(p => {
    // If pick has a result (won/lost/push), it should be in historical, not active
    if (p.result && p.result !== 'pending' && p.result !== null) {
      return false;
    }
    
    const gameData = gamesData.get(p.game_id);
    
    // If no game data or no date, consider it as active
    if (!gameData || !gameData.raw_game_date) {
      return true;
    }
    
    try {
      const gameDate = new Date(gameData.raw_game_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const gameDateOnly = new Date(gameDate);
      gameDateOnly.setHours(0, 0, 0, 0);
      
      // Calculate days difference (negative = future, positive = past)
      const daysDiff = Math.floor((today.getTime() - gameDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      
      // Active: future games (daysDiff < 0) and games from the last 7 days (daysDiff <= 7)
      return daysDiff <= 7;
    } catch (error) {
      debug.error('Error filtering pick:', error);
      return true; // Show the pick if there's an error parsing the date
    }
  });
  
  const historicalPicks = allPublishedPicks.filter(p => {
    // If pick has a result (won/lost/push), it should be in historical
    if (p.result && p.result !== 'pending' && p.result !== null) {
      return true;
    }
    
    const gameData = gamesData.get(p.game_id);
    
    // If no game data or no date, don't consider it historical (unless it has a result)
    if (!gameData || !gameData.raw_game_date) {
      return false;
    }
    
    try {
      const gameDate = new Date(gameData.raw_game_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const gameDateOnly = new Date(gameDate);
      gameDateOnly.setHours(0, 0, 0, 0);
      
      // Calculate days difference (negative = future, positive = past)
      const daysDiff = Math.floor((today.getTime() - gameDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      
      // Historical: games older than 7 days (daysDiff > 7)
      return daysDiff > 7;
    } catch (error) {
      debug.error('Error filtering pick:', error);
      return false; // Don't show as historical if there's an error
    }
  });
  
  // Filter historical picks by date range
  const filteredHistoricalPicks = historicalPicks.filter(p => {
    // If date range is not set, show all picks
    if (!dateRange || !dateRange.from || !dateRange.to) {
      debug.log('No date range set, showing all historical picks');
      return true;
    }
    
    const gameData = gamesData.get(p.game_id);
    if (!gameData || !gameData.raw_game_date) {
      debug.log(`Pick ${p.id} has no game data or raw_game_date`);
      return false;
    }
    
    try {
      // Parse game date - CRITICAL: raw_game_date should be YYYY-MM-DD format
      const rawDate = gameData.raw_game_date;
      
      debug.log(`Pick ${p.id} raw data:`, {
        raw_game_date: rawDate,
        game_date: gameData.game_date,
        game_type: p.game_type
      });
      
      if (typeof rawDate !== 'string') {
        debug.log(`Pick ${p.id} raw_game_date is not a string:`, typeof rawDate, rawDate);
        return false;
      }
      
      const cleanDate = rawDate.replace(/INVALID DATE/gi, '').replace(/NaN/gi, '').trim();
      
      if (!cleanDate || cleanDate === 'TBD' || cleanDate === '') {
        debug.log(`Pick ${p.id} has invalid/empty raw_game_date: "${rawDate}"`);
        return false;
      }
      
      let gameDate: Date;
      
      // Try to parse the date
      if (cleanDate.includes('T')) {
        // ISO format: 2024-12-01T12:00:00Z
        gameDate = new Date(cleanDate);
      } else if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD format
        const [year, month, day] = cleanDate.split('-').map(Number);
        gameDate = new Date(year, month - 1, day);
      } else {
        // Try generic parse as last resort
        debug.log(`Pick ${p.id} using generic Date parse for: "${cleanDate}"`);
        gameDate = new Date(cleanDate);
      }
      
      // Check if date is valid
      if (isNaN(gameDate.getTime())) {
        debug.log(`Pick ${p.id} has invalid gameDate after parsing: "${cleanDate}"`);
        return false;
      }
      
      // Check if year seems reasonable (between 2020 and 2030)
      // If year is unreasonable, try to infer the correct year
      let year = gameDate.getFullYear();
      if (year < 2020 || year > 2030) {
        debug.log(`Pick ${p.id} has unreasonable year ${year}, attempting to infer correct year`);
        
        // Date format is likely "Mon, Dec 1" without year
        // Infer the year based on current date and month
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const gameMonth = gameDate.getMonth();
        const gameDay = gameDate.getDate();
        
        // Try current year first, then last year
        const possibleYears = [currentYear, currentYear - 1];
        
        for (const testYear of possibleYears) {
          const testDate = new Date(testYear, gameMonth, gameDay);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          testDate.setHours(0, 0, 0, 0);
          const daysDiff = Math.floor((today.getTime() - testDate.getTime()) / (1000 * 60 * 60 * 24));
          
          debug.log(`Pick ${p.id} testing year ${testYear}: ${testDate.toISOString().split('T')[0]}, daysDiff: ${daysDiff}`);
          
          // Accept dates that are in the past and within 1 year
          // This allows both recent games (for default 30 day filter) and older historical games
          if (daysDiff >= 0 && daysDiff < 365) {
            gameDate = testDate;
            year = testYear;
            debug.log(`Pick ${p.id} ✅ inferred year ${testYear} for "${cleanDate}" -> ${testDate.toISOString().split('T')[0]} (${daysDiff} days ago)`);
            break;
          } else {
            debug.log(`Pick ${p.id} ❌ year ${testYear} rejected: daysDiff=${daysDiff} (need 0-365)`);
          }
        }
        
        // If still unreasonable, reject it
        if (year < 2020 || year > 2030) {
          debug.log(`Pick ${p.id} still has unreasonable year ${year} after inference`);
          return false;
        }
      }
      
      // Normalize to date only (no time)
      const gameDateOnly = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
      
      const fromDate = new Date(dateRange.from);
      const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      
      const toDate = new Date(dateRange.to);
      const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
      
      const isInRange = gameDateOnly >= fromDateOnly && gameDateOnly <= toDateOnly;
      
      debug.log(`Pick ${p.id} date filter result:`, {
        cleanDate,
        parsedYear: year,
        gameDateOnly: gameDateOnly.toISOString().split('T')[0],
        fromDateOnly: fromDateOnly.toISOString().split('T')[0],
        toDateOnly: toDateOnly.toISOString().split('T')[0],
        isInRange
      });
      
      return isInRange;
    } catch (error) {
      debug.error('Error filtering by date range:', error, p.id, gameData.raw_game_date);
      return false;
    }
  });
  
  debug.log('Historical picks filtering:', {
    totalHistoricalPicks: historicalPicks.length,
    filteredCount: filteredHistoricalPicks.length,
    dateRange: dateRange ? {
      from: dateRange.from?.toISOString(),
      to: dateRange.to?.toISOString()
    } : 'none'
  });
  
  // For backward compatibility, publishedPicks represents active picks for regular users
  const publishedPicks = activePicks;
  
  // Helper function to group picks by date
  interface DateGroup {
    title: string;
    dateObj: Date;
    picks: EditorPick[];
  }

  const groupPicksByDate = (picksToGroup: EditorPick[], sortDesc: boolean = false): DateGroup[] => {
    const groups = new Map<string, { dateObj: Date, picks: EditorPick[] }>();
    const noDatePicks: EditorPick[] = [];

    picksToGroup.forEach(pick => {
      const gameData = gamesData.get(pick.game_id);
      
      if (!gameData || !gameData.raw_game_date) {
        noDatePicks.push(pick);
        return;
      }

      try {
        // Create date object from raw date string
        // Handle ISO strings and simple YYYY-MM-DD
        let dateStr = gameData.raw_game_date;
        
        // Clean up invalid date strings
        if (typeof dateStr === 'string') {
          dateStr = dateStr.replace(/INVALID DATE/gi, '').replace(/NaN/gi, '').trim();
        }
        
        if (!dateStr || dateStr === 'TBD' || dateStr === '') {
          noDatePicks.push(pick);
          return;
        }
        
        let dateObj: Date;
        
        if (dateStr.includes('T')) {
          dateObj = new Date(dateStr);
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // YYYY-MM-DD format
          const [year, month, day] = dateStr.split('-').map(Number);
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            noDatePicks.push(pick);
            return;
          }
          dateObj = new Date(year, month - 1, day);
        } else {
          dateObj = new Date(dateStr);
        }
        
        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
          noDatePicks.push(pick);
          return;
        }
        
        // Create a standardized key for grouping (YYYY-MM-DD)
        const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        
        if (!groups.has(key)) {
          groups.set(key, { dateObj, picks: [] });
        }
        
        groups.get(key)?.picks.push(pick);
      } catch (e) {
        console.error('Error parsing date for grouping:', e);
        noDatePicks.push(pick);
      }
    });

    // Convert map to array and sort
    const sortedGroups: DateGroup[] = Array.from(groups.entries()).map(([_, value]) => {
      // Check if date is valid before formatting
      if (isNaN(value.dateObj.getTime())) {
        return {
          title: 'Date Not Found',
          dateObj: new Date(0),
          picks: value.picks
        };
      }
      
      // Format date nicely for display
      const dayName = value.dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      const monthName = value.dateObj.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = value.dateObj.getDate();
      const title = `${dayName}, ${monthName} ${dayNum}`;
      
      return {
        title,
        dateObj: value.dateObj,
        picks: value.picks
      };
    });

    // Sort groups by date
    sortedGroups.sort((a, b) => {
      return sortDesc 
        ? b.dateObj.getTime() - a.dateObj.getTime() 
        : a.dateObj.getTime() - b.dateObj.getTime();
    });

    // Add "No Date" group at the end if needed
    if (noDatePicks.length > 0 && adminModeEnabled) {
      sortedGroups.push({
        title: 'Date Not Found',
        dateObj: new Date(0), // very old date to put at bottom
        picks: noDatePicks
      });
    }

    return sortedGroups;
  };
  
  // Sort groups: Active/Draft/Published -> DESC (Newest/Future at top), Historical -> DESC (Newest at top)
  // User requested: "timeline with the oldest picks at the bottom"
  // "Older" games (earlier dates) should be at the bottom.
  
  const groupedDraftPicks = groupPicksByDate(draftPicks, true);
  const groupedActivePicks = groupPicksByDate(activePicks, true);
  const groupedHistoricalPicks = groupPicksByDate(filteredHistoricalPicks, true);
  const groupedPublishedPicks = groupPicksByDate(publishedPicks, true);
  
  // Date range preset handlers
  const applyDatePreset = (preset: string) => {
    if (preset === 'all') {
      setDateRange(undefined);
      localStorage.setItem('editorsPicks_dateRange', 'null');
      return;
    }
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let from: Date;
    
    switch (preset) {
      case 'lastWeek':
        from = subDays(today, 7);
        break;
      case 'lastMonth':
        from = subMonths(today, 1);
        break;
      case 'last30Days':
        from = subDays(today, 30);
        break;
      case 'last90Days':
        from = subDays(today, 90);
        break;
      case 'thisMonth':
        from = startOfMonth(today);
        break;
      case 'thisYear':
        from = startOfYear(today);
        break;
      default:
        from = subDays(today, 30);
    }
    
    from.setHours(0, 0, 0, 0);
    const newRange = { from, to: today };
    setDateRange(newRange);
    localStorage.setItem('editorsPicks_dateRange', JSON.stringify({
      from: from.toISOString(),
      to: today.toISOString(),
    }));
  };
  
  debug.log(`📊 Picks Summary:`, {
    totalPicks: picks.length,
    allPublishedPicks: allPublishedPicks.length,
    activePicks: activePicks.length,
    historicalPicks: historicalPicks.length,
    draftPicks: draftPicks.length,
    adminModeEnabled
  });

  // Helper to render grouped picks
  const renderGroupedPicks = (groups: DateGroup[]) => {
    if (groups.length === 0) return null;

    return (
      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.title} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-2 bg-background">
                {group.title}
              </span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
            </div>
            
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
              {group.picks.map(pick => {
                const gameData = gamesData.get(pick.game_id);
                
                if (!gameData) {
                  // Only show placeholder card for admins
                  if (!adminModeEnabled) return null;
                  
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
                                debug.error('Error deleting pick:', err);
                              }
                            }}
                          >
                            Delete This Pick
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                return viewMode === 'list' ? (
                  <EditorPickListItem
                    key={pick.id}
                    pick={pick}
                    gameData={gameData}
                    onUpdate={fetchPicks}
                    onDelete={fetchPicks}
                    onEdit={() => handleOpenEditModal(pick)}
                  />
                ) : (
                  <EditorPickCard
                    key={pick.id}
                    pick={pick}
                    gameData={gameData}
                    onUpdate={fetchPicks}
                    onDelete={fetchPicks}
                    onEdit={() => handleOpenEditModal(pick)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-0 md:px-0">
        <div className="flex items-center gap-2">
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          <h1 className="text-2xl sm:text-3xl font-bold">Editor's Picks</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 rounded-md ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-muted-foreground hover:text-primary'}`}
              onClick={() => {
                setViewMode('grid');
                localStorage.setItem('editorsPicks_viewMode', 'grid');
              }}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-muted-foreground hover:text-primary'}`}
              onClick={() => {
                setViewMode('list');
                localStorage.setItem('editorsPicks_viewMode', 'list');
              }}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          {adminModeEnabled && (
            <Button onClick={handleOpenCreateModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Pick
            </Button>
          )}
        </div>
      </div>

      {/* Stats Component */}
      {picks.length > 0 && (
        <EditorPicksStats 
          picks={picks} 
          selectedSport={selectedSportFilter}
          onSportChange={(sport) => {
            setSelectedSportFilter(sport);
            if (sport) {
              localStorage.setItem('editorsPicks_sportFilter', sport);
            } else {
              localStorage.removeItem('editorsPicks_sportFilter');
            }
          }}
        />
      )}

      {/* Editor Pick Creator Modal */}
      <EditorPickCreatorModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
        editingPick={editingPick}
      />

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}


      {/* Empty State - Show when there are no published picks */}
      {allPublishedPicks.length === 0 && !error && (
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

      {/* Tabs for Active and Historical Picks - Available to All Users */}
      {allPublishedPicks.length > 0 && (
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          localStorage.setItem('editorsPicks_activeTab', value);
        }} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
            <TabsTrigger value="active" className="flex items-center gap-2">
              Active Picks
              {(adminModeEnabled ? draftPicks.length + activePicks.length : activePicks.length) > 0 && (
                <Badge variant="secondary" className="bg-green-500 text-white ml-1">
                  {adminModeEnabled ? draftPicks.length + activePicks.length : activePicks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historical" className="flex items-center gap-2">
              Historical Picks
              {historicalPicks.length > 0 && (
                <Badge variant="secondary" className="bg-gray-500 text-white ml-1">
                  {dateRange ? filteredHistoricalPicks.length : historicalPicks.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Active Picks Tab */}
          <TabsContent value="active" className="space-y-6">
            {/* Draft Picks - Admin Only */}
            {adminModeEnabled && draftPicks.length > 0 && (
              <Card className="-mx-4 md:mx-0 border-gray-300 dark:border-white/20 rounded-lg" style={{
                background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}>
                <CardHeader className="px-4 md:px-6">
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    <span>Drafts</span>
                    <Badge variant="secondary" className="bg-yellow-500 text-white">
                      {draftPicks.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6">
                  {renderGroupedPicks(groupedDraftPicks)}
                </CardContent>
              </Card>
            )}

            {/* Active Published Picks */}
            {activePicks.length > 0 && (
              <Card className="-mx-4 md:mx-0 border-gray-300 dark:border-white/20 rounded-lg" style={{
                background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}>
                <CardHeader className="px-4 md:px-6">
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Star className="h-5 w-5 text-green-500 fill-green-500" />
                    <span>Published</span>
                    <Badge variant="secondary" className="bg-green-500 text-white">
                      {activePicks.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6">
                  {renderGroupedPicks(groupedActivePicks)}
                </CardContent>
              </Card>
            )}

            {(adminModeEnabled ? draftPicks.length === 0 && activePicks.length === 0 : activePicks.length === 0) && (
              <Card className="-mx-4 md:mx-0">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Star className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Active Picks</h3>
                    <p className="text-muted-foreground">
                      {adminModeEnabled 
                        ? 'Star games to create new picks or check the Historical tab.'
                        : 'Check the Historical tab to see older picks.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Historical Picks Tab */}
          <TabsContent value="historical">
            {historicalPicks.length > 0 ? (
              <Card className="-mx-4 md:mx-0 border-gray-300 dark:border-white/20 rounded-lg" style={{
                background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}>
                <CardHeader className="px-4 md:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <Star className="h-5 w-5 text-gray-500 fill-gray-500" />
                      <span>Historical Picks</span>
                      <Badge variant="secondary" className="bg-gray-500 text-white">
                        {filteredHistoricalPicks.length}
                      </Badge>
                      {filteredHistoricalPicks.length !== historicalPicks.length && (
                        <Badge variant="outline" className="text-xs">
                          of {historicalPicks.length}
                        </Badge>
                      )}
                    </CardTitle>
                    
                    {/* Date Range Picker */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full sm:w-auto justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>All Time</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <div className="flex flex-col">
                          {/* Preset Buttons */}
                          <div className="flex flex-col gap-1 p-3 border-b">
                            <div className="text-sm font-semibold mb-2 text-muted-foreground">Quick Select</div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant={!dateRange ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => applyDatePreset('all')}
                                className="text-xs h-8"
                              >
                                All Time
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => applyDatePreset('last30Days')}
                                className="text-xs h-8"
                              >
                                Last 30 Days
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => applyDatePreset('last90Days')}
                                className="text-xs h-8"
                              >
                                Last 90 Days
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => applyDatePreset('thisMonth')}
                                className="text-xs h-8"
                              >
                                This Month
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => applyDatePreset('thisYear')}
                                className="text-xs h-8 col-span-2"
                              >
                                This Year
                              </Button>
                            </div>
                          </div>
                          
                          {/* Calendar */}
                          <div className="p-3">
                            <div className="text-sm font-semibold mb-2 text-muted-foreground">Custom Range</div>
                            <Calendar
                              initialFocus
                              mode="range"
                              defaultMonth={dateRange?.from}
                              selected={dateRange}
                              onSelect={(range) => {
                                setDateRange(range);
                                if (range?.from && range?.to) {
                                  localStorage.setItem('editorsPicks_dateRange', JSON.stringify({
                                    from: range.from.toISOString(),
                                    to: range.to.toISOString(),
                                  }));
                                }
                              }}
                              numberOfMonths={2}
                            />
                            
                            {/* Clear Button */}
                            {dateRange && (
                              <div className="mt-3 pt-3 border-t">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDateRange(undefined);
                                    localStorage.setItem('editorsPicks_dateRange', 'null');
                                  }}
                                  className="w-full"
                                >
                                  Clear Filter
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="px-4 md:px-6">
                  {filteredHistoricalPicks.length > 0 ? (
                    renderGroupedPicks(groupedHistoricalPicks)
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground mb-4">
                        No picks found in the selected date range.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDateRange(undefined);
                          localStorage.setItem('editorsPicks_dateRange', 'null');
                        }}
                      >
                        Show All Picks
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="-mx-4 md:mx-0">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Star className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Historical Picks</h3>
                    <p className="text-muted-foreground">
                      Historical picks from past games will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Value Finds Sections */}
      {showExtraValueSuggestions && (
        <>
          <ValueFindsSection sportType="nfl" gamesData={gamesData} />
          <ValueFindsSection sportType="cfb" gamesData={gamesData} />
        </>
      )}
    </div>
  );
}
