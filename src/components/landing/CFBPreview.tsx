import debug from '@/utils/debug';
import { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Shield, Trophy, BarChart, ScatterChart, School, Star, Bot, Home, Newspaper, Activity, Users, MessageSquare, Smartphone, FileImage, Share2, GraduationCap, User } from 'lucide-react';
import { Basketball, DiscordLogo } from 'phosphor-react';
import CFBMiniCard from './CFBMiniCard';
import { LiveScoreTicker } from '@/components/LiveScoreTicker';
import { getNBATeamColors } from '@/utils/teamColors';

type SportType = 'cfb' | 'nba' | 'dummy';

interface GamePrediction {
  id: string;
  away_team: string;
  home_team: string;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  total_line: number | null;
  start_time?: string;
  start_date?: string;
  game_datetime?: string;
  datetime?: string;
  game_date?: string;
  game_time?: string;
  away_moneyline?: number | null;
  home_moneyline?: number | null;
  api_spread?: number | null;
  api_over_line?: number | null;
  // Model predictions
  pred_ml_proba?: number | null;
  pred_spread_proba?: number | null;
  pred_total_proba?: number | null;
  home_spread_diff?: number | null;
  over_line_diff?: number | null;
  home_away_ml_prob?: number | null;
  home_away_spread_cover_prob?: number | null;
  ou_result_prob?: number | null;
}

interface TeamMapping {
  api: string;
  logo_light: string;
}

// Dummy data for when no real games are available
const DUMMY_GAMES: GamePrediction[] = [
  {
    id: 'dummy-1',
    away_team: 'Los Angeles Lakers',
    home_team: 'Boston Celtics',
    home_ml: -150,
    away_ml: 130,
    home_spread: -3.5,
    away_spread: 3.5,
    total_line: 224.5,
    game_time: '7:30 PM EST',
    pred_ml_proba: 0.62,
    pred_spread_proba: 0.58,
    pred_total_proba: 0.55,
    home_spread_diff: 1.2,
    over_line_diff: -2.5,
  },
  {
    id: 'dummy-2',
    away_team: 'Golden State Warriors',
    home_team: 'Phoenix Suns',
    home_ml: -120,
    away_ml: 100,
    home_spread: -2.0,
    away_spread: 2.0,
    total_line: 231.0,
    game_time: '9:00 PM EST',
    pred_ml_proba: 0.54,
    pred_spread_proba: 0.52,
    pred_total_proba: 0.48,
    home_spread_diff: -0.5,
    over_line_diff: 3.0,
  },
  {
    id: 'dummy-3',
    away_team: 'Miami Heat',
    home_team: 'Milwaukee Bucks',
    home_ml: -180,
    away_ml: 155,
    home_spread: -4.5,
    away_spread: 4.5,
    total_line: 218.5,
    game_time: '7:00 PM EST',
    pred_ml_proba: 0.68,
    pred_spread_proba: 0.61,
    pred_total_proba: 0.52,
    home_spread_diff: 2.0,
    over_line_diff: -1.5,
  },
  {
    id: 'dummy-4',
    away_team: 'Denver Nuggets',
    home_team: 'Dallas Mavericks',
    home_ml: 110,
    away_ml: -130,
    home_spread: 1.5,
    away_spread: -1.5,
    total_line: 226.0,
    game_time: '8:30 PM EST',
    pred_ml_proba: 0.45,
    pred_spread_proba: 0.47,
    pred_total_proba: 0.56,
    home_spread_diff: -1.0,
    over_line_diff: 4.5,
  },
];

export default function CFBPreview() {
  const [predictions, setPredictions] = useState<GamePrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sportType, setSportType] = useState<SportType>('nba');

  // Function to get CFB team colors (copied from CollegeFootball.tsx)
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
      
      // Independents & Others
      'Notre Dame': { primary: '#0C2340', secondary: '#C99700' },
      'Army': { primary: '#000000', secondary: '#D4AF37' },
      'Navy': { primary: '#000080', secondary: '#C5B783' },
      'Boise State': { primary: '#0033A0', secondary: '#D64309' },
      'Memphis': { primary: '#003087', secondary: '#808285' },
      'SMU': { primary: '#CC0033', secondary: '#0033A0' },
      'Tulane': { primary: '#006747', secondary: '#418FDE' },
    };
    
    return colorMap[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
  };

  const getTeamLogo = (teamName: string): string => {
    // For CFB, use team mappings
    if (sportType === 'cfb') {
      const mapping = teamMappings.find(m => m.api === teamName);
      return mapping?.logo_light || '';
    }
    // For NBA/dummy, return ESPN logo URLs
    if (sportType === 'nba' || sportType === 'dummy') {
      const espnLogoMap: { [key: string]: string } = {
        'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
        'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
        'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
        'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
        'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
        'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
        'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
        'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
        'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
        'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
        'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
        'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
        'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
        'Los Angeles Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
        'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
        'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
        'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
        'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
        'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
        'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
        'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
        'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
        'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
        'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
        'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
        'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
        'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
        'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
        'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
        'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
        'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
      };
      return espnLogoMap[teamName] || '';
    }
    return '';
  };

  // Get team colors based on current sport type
  const getTeamColors = (teamName: string): { primary: string; secondary: string } => {
    if (sportType === 'cfb') {
      return getCFBTeamColors(teamName);
    }
    // For NBA and dummy data (which uses NBA teams)
    return getNBATeamColors(teamName);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Try NBA games first
      const today = new Date().toISOString().split('T')[0];

      const { data: nbaGames } = await collegeFootballSupabase
        .from('nba_input_values_view')
        .select('*')
        .gte('game_date', today)
        .order('game_date', { ascending: true })
        .order('tipoff_time_et', { ascending: true })
        .limit(4);

      if (nbaGames && nbaGames.length > 0) {
        debug.log('Using NBA games for landing page hero');
        // Transform NBA data to match our GamePrediction interface
        const transformedNbaGames: GamePrediction[] = nbaGames.map((game: any) => ({
          id: String(game.game_id),
          away_team: game.away_team,
          home_team: game.home_team,
          home_ml: game.home_moneyline,
          away_ml: game.home_moneyline ? (game.home_moneyline > 0 ? -(game.home_moneyline + 100) : 100 - game.home_moneyline) : null,
          home_spread: game.home_spread,
          away_spread: game.home_spread ? -game.home_spread : null,
          total_line: game.total_line,
          game_time: game.tipoff_time_et,
          game_date: game.game_date,
          // NBA doesn't have these prediction fields in input view, set reasonable defaults
          pred_ml_proba: 0.55,
          pred_spread_proba: 0.52,
          pred_total_proba: 0.50,
          home_spread_diff: null,
          over_line_diff: null,
        }));
        setPredictions(transformedNbaGames);
        setSportType('nba');
        return;
      }

      // Step 2: No NBA games, try CFB games
      debug.log('No NBA games found, trying CFB...');
      const { data: cfbMappings } = await collegeFootballSupabase
        .from('cfb_team_mapping')
        .select('api, logo_light');

      setTeamMappings(cfbMappings || []);

      const { data: cfbPreds } = await collegeFootballSupabase
        .from('cfb_live_weekly_inputs')
        .select('*')
        .limit(4);

      if (cfbPreds && cfbPreds.length > 0) {
        debug.log('Using CFB games for landing page hero');
        setPredictions(cfbPreds);
        setSportType('cfb');
        return;
      }

      // Step 3: No games at all, use dummy data
      debug.log('No live games found, using dummy data');
      setPredictions(DUMMY_GAMES);
      setSportType('dummy');

    } catch (err) {
      debug.error('Error fetching data:', err);
      // On error, fall back to dummy data instead of showing error
      setPredictions(DUMMY_GAMES);
      setSportType('dummy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto mt-8">
        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="flex">
            {/* Sidebar Skeleton */}
            <div className="w-16 md:w-64 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 p-2 md:p-4">
              <Skeleton className="h-4 w-20 mb-3 hidden md:block" />
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            </div>
            {/* Content Skeleton */}
            <div className="flex-1 p-3 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto mt-8">
        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/wagerproofGreenLight.png" alt="WagerProof" className="w-8 h-8 object-contain rounded-lg dark:hidden" />
              <img src="/wagerproofGreenDark.png" alt="WagerProof" className="w-8 h-8 object-contain rounded-lg hidden dark:block" />
              <span className="font-semibold text-gray-900 dark:text-gray-100">wagerproof.bet</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              Error
            </div>
          </div>
          <div className="flex">
            {/* Show sidebar even in error state */}
            <div className="w-16 md:w-64 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 p-2 md:p-4">
              <div className="space-y-1">
                {sidebarItems.map((item, index) => {
                  if (item.isHeader) {
                    return (
                      <div
                        key={`header-${index}`}
                        className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-2 px-1 md:px-3 first:mt-0 hidden md:block"
                      >
                        {item.label}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center justify-center md:justify-start gap-0 md:gap-3 px-1 md:px-3 py-2 rounded-lg text-sm transition-colors ${
                        item.active
                          ? 'bg-honeydew-100 dark:bg-honeydew-900/30 text-honeydew-700 dark:text-honeydew-400 font-medium'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                      title={item.label}
                    >
                      {item.icon && (
                        <item.icon className="w-4 h-4 flex-shrink-0" weight={item.icon === DiscordLogo ? "fill" : undefined} />
                      )}
                      <span className="hidden md:inline">{item.label}</span>
                      {item.active && (
                        <div className="hidden md:block ml-auto w-2 h-2 bg-honeydew-500 rounded-full"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 p-3 md:p-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Unable to load live game data. Please try again later.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sidebarItems: Array<{
    icon: React.ComponentType<{ className?: string }> | typeof DiscordLogo | null;
    label: string;
    active: boolean;
    isHeader: boolean;
  }> = [
    // Home
    { icon: Home, label: 'Home', active: false, isHeader: false },
    // ANALYSIS section
    { icon: null, label: 'ANALYSIS', active: false, isHeader: true },
    { icon: Newspaper, label: 'Today in Sports', active: false, isHeader: false },
    { icon: Star, label: "Editors Picks", active: false, isHeader: false },
    { icon: Bot, label: 'WagerBot Chat', active: false, isHeader: false },
    { icon: Activity, label: 'Score Board', active: false, isHeader: false },
    // SPORTS section
    { icon: null, label: 'SPORTS', active: false, isHeader: true },
    { icon: Trophy, label: 'College Football', active: sportType === 'cfb', isHeader: false },
    { icon: Shield, label: 'NFL', active: false, isHeader: false },
    { icon: Basketball, label: 'NBA', active: sportType === 'nba' || sportType === 'dummy', isHeader: false },
    { icon: School, label: 'College Basketball', active: false, isHeader: false },
    // COMMUNITY section
    { icon: null, label: 'COMMUNITY', active: false, isHeader: true },
    { icon: Users, label: 'Community Picks', active: false, isHeader: false },
    { icon: MessageSquare, label: 'Feature Requests', active: false, isHeader: false },
    { icon: DiscordLogo, label: 'Discord Channel', active: false, isHeader: false },
    { icon: Smartphone, label: 'iOS/Android App', active: false, isHeader: false },
    { icon: FileImage, label: 'Bet Slip Grader', active: false, isHeader: false },
    { icon: Share2, label: 'Share Win', active: false, isHeader: false },
    { icon: GraduationCap, label: 'Learn WagerProof', active: false, isHeader: false },
    // Account
    { icon: User, label: 'Account', active: false, isHeader: false },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto mt-4 md:mt-8 mb-4 md:mb-0 animate-fade-in" style={{ animationDelay: '0.2s' }}>
      <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        {/* Dashboard Header */}
        <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/wagerproof-logo-main.png" alt="WagerProof" className="w-8 h-8 rounded" />
            <span className="font-semibold text-gray-900 dark:text-gray-100">wagerproof.bet</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-honeydew-100 dark:bg-honeydew-900/30 text-honeydew-700 dark:text-honeydew-400 text-sm font-medium">
              <span className="w-2 h-2 bg-honeydew-500 rounded-full animate-pulse"></span>
              Live
            </div>
          </div>
        </div>
        
        {/* Live Score Ticker - Demo in Hero */}
        <div className="overflow-hidden">
          <LiveScoreTicker />
        </div>
        
        {/* Main Content Area with Sidebar */}
        <div className="flex">
          {/* Mini Sidebar - Icon only on mobile, full on desktop */}
          <div className="w-16 md:w-64 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 p-2 md:p-4">
            <div className="space-y-1">
              {sidebarItems.map((item, index) => {
                if (item.isHeader) {
                  return (
                    <div
                      key={`header-${index}`}
                      className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-2 px-1 md:px-3 first:mt-0 hidden md:block"
                    >
                      {item.label}
                    </div>
                  );
                }
                return (
                  <div
                    key={item.label}
                    className={`flex items-center justify-center md:justify-start gap-0 md:gap-3 px-1 md:px-3 py-2 rounded-lg text-sm transition-colors ${
                      item.active
                        ? 'bg-honeydew-100 dark:bg-honeydew-900/30 text-honeydew-700 dark:text-honeydew-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                    title={item.label}
                  >
                    {item.icon && (
                      <item.icon className="w-4 h-4 flex-shrink-0" weight={item.icon === DiscordLogo ? "fill" : undefined} />
                    )}
                    <span className="hidden md:inline">{item.label}</span>
                    {item.active && (
                      <div className="hidden md:block ml-auto w-2 h-2 bg-honeydew-500 rounded-full"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Games Grid */}
          <div className="flex-1 p-3 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {predictions.slice(0, 4).map((prediction, index) => {
              const awayTeamColors = getTeamColors(prediction.away_team);
              const homeTeamColors = getTeamColors(prediction.home_team);

              return (
                <CFBMiniCard
                  key={prediction.id}
                  prediction={prediction}
                  awayTeamColors={awayTeamColors}
                  homeTeamColors={homeTeamColors}
                  getTeamLogo={getTeamLogo}
                  cardIndex={index}
                  sportType={sportType}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
