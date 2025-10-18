import { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Shield, Trophy, BarChart, ScatterChart, School, Star, Bot } from 'lucide-react';
import { Basketball } from 'phosphor-react';
import CFBMiniCard from './CFBMiniCard';
import { LiveScoreTicker } from '@/components/LiveScoreTicker';

interface CFBPrediction {
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
}

interface TeamMapping {
  api: string;
  logo_light: string;
}

export default function CFBPreview() {
  const [predictions, setPredictions] = useState<CFBPrediction[]>([]);
  const [teamMappings, setTeamMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const mapping = teamMappings.find(m => m.api === teamName);
    return mapping?.logo_light || '';
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch team mappings first
      const { data: mappings, error: mappingsError } = await collegeFootballSupabase
        .from('cfb_team_mapping')
        .select('api, logo_light');
      
      if (mappingsError) {
        console.error('Error fetching team mappings:', mappingsError);
        setError('Failed to load team data');
        return;
      }
      
      setTeamMappings(mappings || []);

      // Fetch predictions - limit to 4 games for preview
      const { data: preds, error: predsError } = await collegeFootballSupabase
        .from('cfb_live_weekly_inputs')
        .select('*')
        .limit(4);

      if (predsError) {
        console.error('Error fetching predictions:', predsError);
        setError('Failed to load game data');
        return;
      }

      setPredictions(preds || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
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
            <div className="w-64 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 p-4 hidden lg:block">
              <Skeleton className="h-4 w-20 mb-3" />
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            </div>
            {/* Content Skeleton */}
            <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="w-64 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 p-4 hidden lg:block">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Navigation
                </div>
                {[
                  { icon: Shield, label: 'NFL', active: false },
                  { icon: Trophy, label: 'College Football', active: true },
                  { icon: BarChart, label: 'NFL Analytics', active: false },
                  { icon: ScatterChart, label: 'NFL Teaser Sharpness', active: false },
                  { icon: Basketball, label: 'NBA', active: false },
                  { icon: School, label: 'NCAAB', active: false },
                  { icon: Star, label: "Editor's Picks", active: false },
                  { icon: Bot, label: 'WagerBot Chat', active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      item.active
                        ? 'bg-honeydew-100 dark:bg-honeydew-900/30 text-honeydew-700 dark:text-honeydew-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.active && (
                      <div className="ml-auto w-2 h-2 bg-honeydew-500 rounded-full"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 p-6">
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

  const sidebarItems = [
    { icon: Shield, label: 'NFL', active: false },
    { icon: Trophy, label: 'College Football', active: true },
    { icon: BarChart, label: 'NFL Analytics', active: false },
    { icon: ScatterChart, label: 'NFL Teaser Sharpness', active: false },
    { icon: Basketball, label: 'NBA', active: false },
    { icon: School, label: 'NCAAB', active: false },
    { icon: Star, label: "Editor's Picks", active: false },
    { icon: Bot, label: 'WagerBot Chat', active: false },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto mt-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
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
            <span className="text-sm text-gray-500 dark:text-gray-400">Today's Games</span>
          </div>
        </div>
        
        {/* Live Score Ticker - Demo in Hero */}
        <div className="overflow-hidden">
          <LiveScoreTicker />
        </div>
        
        {/* Main Content Area with Sidebar */}
        <div className="flex">
          {/* Mini Sidebar */}
          <div className="w-64 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 p-4 hidden lg:block">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Navigation
              </div>
              {sidebarItems.map((item, index) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    item.active
                      ? 'bg-honeydew-100 dark:bg-honeydew-900/30 text-honeydew-700 dark:text-honeydew-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.active && (
                    <div className="ml-auto w-2 h-2 bg-honeydew-500 rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Games Grid */}
          <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[400px]">
            {predictions.slice(0, 4).map((prediction) => {
              const awayTeamColors = getCFBTeamColors(prediction.away_team);
              const homeTeamColors = getCFBTeamColors(prediction.home_team);
              
              return (
                <CFBMiniCard
                  key={prediction.id}
                  prediction={prediction}
                  awayTeamColors={awayTeamColors}
                  homeTeamColors={homeTeamColors}
                  getTeamLogo={getTeamLogo}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
