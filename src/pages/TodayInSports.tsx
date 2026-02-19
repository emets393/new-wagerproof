import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TodayInSportsCompletionHeader } from '@/components/TodayInSportsCompletionHeader';
import { TodayGameSummaryCard } from '@/components/TodayGameSummaryCard';
import { GamesMarquee } from '@/components/GamesMarquee';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Target, Flame, Lock, ChevronDown, ChevronUp, Shield, Trophy, ArrowRightLeft, BarChart, DollarSign, Percent, Users, Dribbble, RefreshCw, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';
import { FreemiumUpgradeBanner } from '@/components/FreemiumUpgradeBanner';
import { TailingAvatarList } from '@/components/TailingAvatarList';
import Dither from '@/components/Dither';
import { useTheme } from '@/contexts/ThemeContext';
import debug from '@/utils/debug';
import { getNFLTeamColors, getCFBTeamColors, getNBATeamColors, getNCAABTeamColors, getNFLTeamInitials, getCFBTeamInitials, getNBATeamInitials, getNCAABTeamInitials } from '@/utils/teamColors';
import { useTodayInSportsCache } from '@/hooks/useTodayInSportsCache';
import { SHOW_WEBSITE_TAILING_FEATURES } from '@/lib/featureFlags';

interface GameSummary {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  awayTeam: string;
  homeTeam: string;
  awayLogo?: string;
  homeLogo?: string;
  gameTime?: string;
  awaySpread?: number;
  homeSpread?: number;
  totalLine?: number;
  awayMl?: number;
  homeMl?: number;
  tailCount?: number;
  cfbId?: number; // CFB id for querying cfb_api_predictions
  nbaId?: string; // NBA game_id for querying nba_predictions
  ncaabId?: string; // NCAAB game_id for querying ncaab_predictions
}

interface ValueAlert {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  awayTeam: string;
  homeTeam: string;
  marketType: string;
  side: string;
  percentage: number;
  // Game info for enhanced display
  gameTime?: string;
  homeSpread?: number;
  totalLine?: number;
  homeMl?: number;
  awayMl?: number;
}

interface FadeAlert {
  gameId: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  awayTeam: string;
  homeTeam: string;
  pickType: string;
  predictedTeam: string;
  confidence: number;
  // Game info for enhanced display
  gameTime?: string;
  homeSpread?: number;
  totalLine?: number;
  homeMl?: number;
  awayMl?: number;
}

interface TopTailedGame extends GameSummary {
  tails: Array<{
    pickType: string;
    teamSelection: string;
    count: number;
    users: Array<{ user_id: string; display_name?: string; email?: string }>;
  }>;
}

interface TrendsTeamRow {
  game_id: number;
  game_date: string;
  team_abbr: string;
  team_name: string;
  team_side: 'home' | 'away';
  last_game_situation: string;
  fav_dog_situation: string;
  side_spread_situation: string;
  rest_bucket: string;
  rest_comp: string;
  ats_last_game_record: string;
  ats_last_game_cover_pct: number | null;
  ats_fav_dog_record: string;
  ats_fav_dog_cover_pct: number | null;
  ats_side_fav_dog_record: string;
  ats_side_fav_dog_cover_pct: number | null;
  ats_rest_bucket_record: string;
  ats_rest_bucket_cover_pct: number | null;
  ats_rest_comp_record: string;
  ats_rest_comp_cover_pct: number | null;
  ou_last_game_record: string;
  ou_last_game_over_pct: number | null;
  ou_last_game_under_pct: number | null;
  ou_fav_dog_record: string;
  ou_fav_dog_over_pct: number | null;
  ou_fav_dog_under_pct: number | null;
  ou_side_fav_dog_record: string;
  ou_side_fav_dog_over_pct: number | null;
  ou_side_fav_dog_under_pct: number | null;
  ou_rest_bucket_record: string;
  ou_rest_bucket_over_pct: number | null;
  ou_rest_bucket_under_pct: number | null;
  ou_rest_comp_record: string;
  ou_rest_comp_over_pct: number | null;
  ou_rest_comp_under_pct: number | null;
}

interface TrendsGame {
  game_id: number;
  game_date: string;
  tipoff_time_et: string | null;
  away_team: TrendsTeamRow;
  home_team: TrendsTeamRow;
}

type TrendMarketType = 'ATS' | 'Over' | 'Under';

interface TrendCandidate {
  teamName: string;
  marketType: TrendMarketType;
  percentage: number;
  record: string;
  situationLabel: string;
  sampleSize: number;
}

interface TrendOutlier {
  sport: 'nba' | 'ncaab';
  gameId: number;
  awayTeam: string;
  homeTeam: string;
  gameTime?: string | null;
  candidate: TrendCandidate;
}

type SportFilter = 'all' | 'nfl' | 'cfb' | 'nba' | 'ncaab';

const BETTING_TRENDS_THRESHOLD = 65;
const BETTING_TRENDS_MIN_GAMES = 5;

// Helper to format game time for display
const formatGameTime = (gameTime: string | undefined): string | null => {
  if (!gameTime) return null;
  try {
    const date = new Date(gameTime);
    if (isNaN(date.getTime())) return null;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = dayNames[date.getDay()];
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minuteStr = minutes < 10 ? `0${minutes}` : minutes;
    return `${day} ${hours}:${minuteStr} ${ampm}`;
  } catch {
    return null;
  }
};

// Helper to format spread for display
const formatSpread = (spread: number | null | undefined): string | null => {
  if (spread === null || spread === undefined) return null;
  return spread > 0 ? `+${spread}` : `${spread}`;
};

// Helper to format moneyline for display
const formatMoneyline = (ml: number | null | undefined): string => {
  if (ml === null || ml === undefined) return '-';
  return ml > 0 ? `+${ml}` : `${ml}`;
};

const parseTrendRecord = (record: string | null | undefined): { total: number } => {
  if (!record) return { total: 0 };
  const [wins = 0, losses = 0, pushes = 0] = record.split('-').map(Number);
  return { total: wins + losses + pushes };
};

const formatTrendSituation = (situation: string | null | undefined): string => {
  if (!situation) return '-';
  const situationMap: Record<string, string> = {
    'is_after_loss': 'After Loss',
    'is_after_win': 'After Win',
    'is_fav': 'Favorite',
    'is_dog': 'Underdog',
    'is_home_fav': 'Home Favorite',
    'is_away_fav': 'Away Favorite',
    'is_home_dog': 'Home Underdog',
    'is_away_dog': 'Away Underdog',
    'one_day_off': '1 Day Off',
    'two_three_days_off': '2-3 Days Off',
    'four_plus_days_off': '4+ Days Off',
    'rest_advantage': 'Rest Advantage',
    'rest_disadvantage': 'Rest Disadvantage',
    'rest_equal': 'Rest Equal',
  };
  return situationMap[situation] || situation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const buildTrendCandidates = (team: TrendsTeamRow): TrendCandidate[] => {
  const situations = [
    {
      situationLabel: formatTrendSituation(team.last_game_situation),
      atsRecord: team.ats_last_game_record,
      atsPct: team.ats_last_game_cover_pct,
      ouRecord: team.ou_last_game_record,
      overPct: team.ou_last_game_over_pct,
      underPct: team.ou_last_game_under_pct,
    },
    {
      situationLabel: formatTrendSituation(team.fav_dog_situation),
      atsRecord: team.ats_fav_dog_record,
      atsPct: team.ats_fav_dog_cover_pct,
      ouRecord: team.ou_fav_dog_record,
      overPct: team.ou_fav_dog_over_pct,
      underPct: team.ou_fav_dog_under_pct,
    },
    {
      situationLabel: formatTrendSituation(team.side_spread_situation),
      atsRecord: team.ats_side_fav_dog_record,
      atsPct: team.ats_side_fav_dog_cover_pct,
      ouRecord: team.ou_side_fav_dog_record,
      overPct: team.ou_side_fav_dog_over_pct,
      underPct: team.ou_side_fav_dog_under_pct,
    },
    {
      situationLabel: formatTrendSituation(team.rest_bucket),
      atsRecord: team.ats_rest_bucket_record,
      atsPct: team.ats_rest_bucket_cover_pct,
      ouRecord: team.ou_rest_bucket_record,
      overPct: team.ou_rest_bucket_over_pct,
      underPct: team.ou_rest_bucket_under_pct,
    },
    {
      situationLabel: formatTrendSituation(team.rest_comp),
      atsRecord: team.ats_rest_comp_record,
      atsPct: team.ats_rest_comp_cover_pct,
      ouRecord: team.ou_rest_comp_record,
      overPct: team.ou_rest_comp_over_pct,
      underPct: team.ou_rest_comp_under_pct,
    },
  ];

  const candidates: TrendCandidate[] = [];
  for (const row of situations) {
    const atsSample = parseTrendRecord(row.atsRecord).total;
    const ouSample = parseTrendRecord(row.ouRecord).total;

    if (typeof row.atsPct === 'number' && row.atsPct >= BETTING_TRENDS_THRESHOLD && atsSample >= BETTING_TRENDS_MIN_GAMES) {
      candidates.push({
        teamName: team.team_name,
        marketType: 'ATS',
        percentage: row.atsPct,
        record: row.atsRecord || '-',
        situationLabel: row.situationLabel,
        sampleSize: atsSample,
      });
    }

    if (typeof row.overPct === 'number' && row.overPct >= BETTING_TRENDS_THRESHOLD && ouSample >= BETTING_TRENDS_MIN_GAMES) {
      candidates.push({
        teamName: team.team_name,
        marketType: 'Over',
        percentage: row.overPct,
        record: row.ouRecord || '-',
        situationLabel: row.situationLabel,
        sampleSize: ouSample,
      });
    }

    if (typeof row.underPct === 'number' && row.underPct >= BETTING_TRENDS_THRESHOLD && ouSample >= BETTING_TRENDS_MIN_GAMES) {
      candidates.push({
        teamName: team.team_name,
        marketType: 'Under',
        percentage: row.underPct,
        record: row.ouRecord || '-',
        situationLabel: row.situationLabel,
        sampleSize: ouSample,
      });
    }
  }

  return candidates;
};

const sortTrendCandidates = (a: TrendCandidate, b: TrendCandidate) => {
  if (b.percentage !== a.percentage) return b.percentage - a.percentage;
  return b.sampleSize - a.sampleSize;
};

const buildTrendOutliers = (games: TrendsGame[], sport: 'nba' | 'ncaab'): TrendOutlier[] => {
  const outliers: TrendOutlier[] = [];

  for (const game of games) {
    const candidates = [
      ...buildTrendCandidates(game.away_team),
      ...buildTrendCandidates(game.home_team),
    ].sort(sortTrendCandidates);

    if (candidates.length === 0) continue;
    outliers.push({
      sport,
      gameId: game.game_id,
      awayTeam: game.away_team.team_name,
      homeTeam: game.home_team.team_name,
      gameTime: game.tipoff_time_et,
      candidate: candidates[0],
    });
  }

  return outliers.sort((a, b) => sortTrendCandidates(a.candidate, b.candidate));
};

export default function TodayInSports() {
  const { isFreemiumUser } = useFreemiumAccess();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const showWebsiteTailingFeatures = SHOW_WEBSITE_TAILING_FEATURES;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Helper to navigate to sport page
  const navigateToSport = (sport: 'nfl' | 'cfb' | 'nba' | 'ncaab') => {
    switch (sport) {
      case 'nfl': navigate('/nfl'); break;
      case 'cfb': navigate('/college-football'); break;
      case 'nba': navigate('/nba'); break;
      case 'ncaab': navigate('/ncaab'); break;
    }
  };

  // Initialize cache hook
  const { getCachedUIState, setCachedUIState, restoreScrollPosition } = useTodayInSportsCache();
  
  // Initialize state from cache or defaults
  const cachedState = getCachedUIState();
  const [showAllValueAlerts, setShowAllValueAlerts] = useState(cachedState?.showAllValueAlerts ?? false);
  const [showAllFadeAlerts, setShowAllFadeAlerts] = useState(cachedState?.showAllFadeAlerts ?? false);
  const [showAllTailedGames, setShowAllTailedGames] = useState(cachedState?.showAllTailedGames ?? false);
  const [showAllNbaTrendOutliers, setShowAllNbaTrendOutliers] = useState(false);
  const [showAllNcaabTrendOutliers, setShowAllNcaabTrendOutliers] = useState(false);
  const [isRefreshingValueSummary, setIsRefreshingValueSummary] = useState(false);
  
  // Sport filters for each section
  const [todayGamesFilter, setTodayGamesFilter] = useState<SportFilter>(cachedState?.todayGamesFilter ?? 'all');
  const [valueAlertsFilter, setValueAlertsFilter] = useState<SportFilter>(cachedState?.valueAlertsFilter ?? 'all');
  const [fadeAlertsFilter, setFadeAlertsFilter] = useState<SportFilter>(cachedState?.fadeAlertsFilter ?? 'all');
  const [tailedGamesFilter, setTailedGamesFilter] = useState<SportFilter>(cachedState?.tailedGamesFilter ?? 'all');

  // Restore scroll position on mount
  useEffect(() => {
    if (cachedState && cachedState.scrollPosition > 0) {
      restoreScrollPosition(cachedState.scrollPosition);
    }
  }, []); // Only run once on mount

  // Save UI state when it changes (debounced to avoid excessive writes)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCachedUIState({
        showAllValueAlerts,
        showAllFadeAlerts,
        showAllTailedGames,
        todayGamesFilter,
        valueAlertsFilter,
        fadeAlertsFilter,
        tailedGamesFilter,
      });
    }, 500); // Wait 500ms after last change

    return () => clearTimeout(timeoutId);
  }, [
    showAllValueAlerts,
    showAllFadeAlerts,
    showAllTailedGames,
    todayGamesFilter,
    valueAlertsFilter,
    fadeAlertsFilter,
    tailedGamesFilter,
    setCachedUIState,
  ]);

  // Helper function to get sport icon
  const getSportIcon = (sport: 'nfl' | 'cfb' | 'nba' | 'ncaab') => {
    if (sport === 'nfl') return Shield;
    if (sport === 'cfb') return Trophy;
    if (sport === 'nba' || sport === 'ncaab') return Dribbble;
    return Trophy;
  };

  // Helper function to get sport color classes
  const getSportColorClasses = (sport: 'nfl' | 'cfb' | 'nba' | 'ncaab') => {
    if (sport === 'nfl') {
      return 'bg-blue-500/20 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40 dark:border-blue-500/30';
    }
    if (sport === 'cfb') {
      return 'bg-orange-500/20 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/40 dark:border-orange-500/30';
    }
    if (sport === 'nba') {
      return 'bg-red-500/20 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40 dark:border-red-500/30';
    }
    if (sport === 'ncaab') {
      return 'bg-purple-500/20 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40 dark:border-purple-500/30';
    }
    return 'bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white border-gray-300 dark:border-white/20';
  };

  // Helper function to get pick type icon
  const getPickTypeIcon = (pickType: string) => {
    if (pickType === 'Spread') return ArrowRightLeft;
    if (pickType === 'Total') return BarChart;
    if (pickType === 'Moneyline') return DollarSign;
    return TrendingUp;
  };

  // Helper function to get pick type color classes
  const getPickTypeColorClasses = (pickType: string) => {
    if (pickType === 'ATS') {
      return 'bg-teal-500/20 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/40 dark:border-teal-500/30';
    }
    if (pickType === 'Over' || pickType === 'Under') {
      return 'bg-emerald-500/20 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 dark:border-emerald-500/30';
    }
    if (pickType === 'Spread') {
      return 'bg-cyan-500/20 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 dark:border-cyan-500/30';
    }
    if (pickType === 'Total') {
      return 'bg-indigo-500/20 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 dark:border-indigo-500/30';
    }
    if (pickType === 'Moneyline') {
      return 'bg-yellow-500/20 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40 dark:border-yellow-500/30';
    }
    return 'bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white border-gray-300 dark:border-white/20';
  };

  // Helper function to get team colors based on sport
  const getTeamColors = (teamName: string, sport: 'nfl' | 'cfb' | 'nba' | 'ncaab') => {
    if (sport === 'nfl') return getNFLTeamColors(teamName);
    if (sport === 'cfb') return getCFBTeamColors(teamName);
    if (sport === 'nba') return getNBATeamColors(teamName);
    if (sport === 'ncaab') return getNCAABTeamColors(teamName);
    return { primary: '#6B7280', secondary: '#9CA3AF' };
  };

  // Helper function to get team initials based on sport
  const getTeamInitials = (teamName: string, sport: 'nfl' | 'cfb' | 'nba' | 'ncaab') => {
    if (sport === 'nfl') return getNFLTeamInitials(teamName);
    if (sport === 'cfb') return getCFBTeamInitials(teamName);
    if (sport === 'nba') return getNBATeamInitials(teamName);
    if (sport === 'ncaab') return getNCAABTeamInitials(teamName);
    return teamName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  };

  // Helper function to get contrasting text color for team circles
  // Note: There's already a getContrastingTextColor function below, but this one is simpler for team circles
  const getTeamCircleTextColor = (primaryColor: string, secondaryColor: string): string => {
    // Convert hex to RGB
    const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    const rgb = hexToRgb(primaryColor);
    if (!rgb) return '#FFFFFF';

    // Calculate luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };

  // Helper function to filter by sport
  const filterBySport = <T extends { sport: 'nfl' | 'cfb' | 'nba' | 'ncaab' }>(
    items: T[],
    filter: SportFilter
  ): T[] => {
    if (filter === 'all') return items;
    return items.filter(item => item.sport === filter);
  };

  // Helper component for sport filter buttons (styled like sport pills)
  const SportFilterButtons = ({ 
    currentFilter, 
    onFilterChange 
  }: { 
    currentFilter: SportFilter; 
    onFilterChange: (filter: SportFilter) => void;
  }) => {
    const filters: Array<{ value: SportFilter; label: string; icon: any; sport?: 'nfl' | 'cfb' | 'nba' | 'ncaab' }> = [
      { value: 'all', label: 'All', icon: null },
      { value: 'nfl', label: 'NFL', icon: Shield, sport: 'nfl' },
      { value: 'cfb', label: 'CFB', icon: Trophy, sport: 'cfb' },
      { value: 'nba', label: 'NBA', icon: Dribbble, sport: 'nba' },
      { value: 'ncaab', label: 'NCAAB', icon: Dribbble, sport: 'ncaab' },
    ];

    return (
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = currentFilter === filter.value;
          
          // For "All" button, use neutral gray styling
          if (filter.value === 'all') {
            return (
              <Badge
                key={filter.value}
                onClick={() => onFilterChange(filter.value)}
                className={`cursor-pointer text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                    : 'bg-gray-200/50 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-white/20 hover:bg-gray-300/50 dark:hover:bg-white/20'
                }`}
              >
                {filter.label}
              </Badge>
            );
          }
          
          // For sport buttons, use sport pill styling with opacity for inactive
          const sportColorClasses = filter.sport ? getSportColorClasses(filter.sport) : '';
          return (
            <Badge
              key={filter.value}
              onClick={() => onFilterChange(filter.value)}
              className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium transition-all ${
                isActive
                  ? sportColorClasses
                  : `${sportColorClasses} opacity-50 hover:opacity-75`
              }`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              <span>{filter.label}</span>
            </Badge>
          );
        })}
      </div>
    );
  };

  // Handler for refreshing Value Summary section
  const handleRefreshValueSummary = async () => {
    setIsRefreshingValueSummary(true);
    try {
      // Invalidate both value alerts and fade alerts queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['value-alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['fade-alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['nba-trend-outliers'] }),
        queryClient.invalidateQueries({ queryKey: ['ncaab-trend-outliers'] }),
      ]);
    } finally {
      // Keep spinner for at least 500ms for better UX
      setTimeout(() => setIsRefreshingValueSummary(false), 500);
    }
  };

  // Get today's date in Eastern Time - MATCH NFL/CFB format
  const getTodayET = () => {
    // Create a date in Eastern Time
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    
    return `${year}-${month}-${day}`;
  };

  const today = getTodayET();
  
  // Get date 7 days from now to show this week's games
  const getWeekFromNowET = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    // Add 7 days
    now.setDate(now.getDate() + 7);
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    
    return `${year}-${month}-${day}`;
  };

  const weekFromNow = getWeekFromNowET();

  // Fetch ALL games for the week (used for High Tailing It section)
  const { data: weekGames, isLoading: weekGamesLoading } = useQuery({
    queryKey: ['week-games-all'],
    queryFn: async () => {
      const gameSummaries: GameSummary[] = [];
      let nflGamesData: any[] = [];
      let cfbGamesData: any[] = [];

      console.log('========================================');
      console.log('🔥 THIS WEEK IN SPORTS - DEBUG START 🔥');
      console.log('========================================');
      console.log('📅 TODAY DATE (ET):', today);
      console.log('📅 WEEK FROM NOW (ET):', weekFromNow);
      console.log('📅 Showing games from', today, 'to', weekFromNow);
      console.log('========================================');

      // Fetch NFL games - use v_input_values_with_epa view (same as NFL page)
      try {
        debug.log('📊 Querying v_input_values_with_epa for NFL games...');
        const { data: nflGames, error: nflError } = await collegeFootballSupabase
          .from('v_input_values_with_epa')
          .select('*')
          .order('game_date', { ascending: true })
          .order('game_time', { ascending: true });

        debug.log('NFL games query result:', { count: nflGames?.length || 0, error: nflError });

        if (nflError) {
          debug.error('NFL games error details:', nflError);
        }

        // Fetch betting lines to get moneyline data (same as NFL page)
        let nflBettingLinesMap = new Map<string, { home_ml: number | null; away_ml: number | null }>();
        try {
          const { data: bettingLines, error: bettingError } = await collegeFootballSupabase
            .from('nfl_betting_lines')
            .select('training_key, home_ml, away_ml, as_of_ts')
            .order('as_of_ts', { ascending: false });

          if (!bettingError && bettingLines) {
            // Keep only the latest entry per training_key
            for (const line of bettingLines) {
              if (!nflBettingLinesMap.has(line.training_key)) {
                nflBettingLinesMap.set(line.training_key, {
                  home_ml: line.home_ml,
                  away_ml: line.away_ml,
                });
              }
            }
            debug.log('✅ NFL betting lines fetched:', nflBettingLinesMap.size);
          }
        } catch (err) {
          debug.error('Error fetching NFL betting lines:', err);
        }

        if (!nflError && nflGames) {
          nflGamesData = nflGames;
          console.log('========================================');
          console.log('🏈 NFL GAMES DATA');
          console.log('========================================');
          console.log('Total NFL games fetched:', nflGames.length);
          console.log('First NFL game sample:', nflGames[0]);

          // Log all unique dates we have
          const uniqueDates = [...new Set(nflGames.map(g => g.game_date).filter(Boolean))];
          console.log('NFL UNIQUE DATES IN DATABASE:', uniqueDates);
          console.log('DATE RANGE:', today, 'to', weekFromNow);
          console.log('========================================');

          let nflMatchCount = 0;
          for (const game of nflGames) {
            // game_date is in format "YYYY-MM-DD" - check if it's within this week
            const gameDate = game.game_date;
            const isThisWeek = gameDate >= today && gameDate <= weekFromNow;

            console.log(`${isThisWeek ? '✅ THIS WEEK' : '❌ NOT THIS WEEK'} - ${game.away_team} @ ${game.home_team}`);
            console.log(`   game_date: "${gameDate}" | range: "${today}" to "${weekFromNow}"`);

            // Only add games within the next 7 days
            if (isThisWeek) {
              nflMatchCount++;
              // Combine game_date and game_time to create a full datetime string
              // game_date is "YYYY-MM-DD", game_time is "HH:MM:SS"
              const gameTimeValue = (game.game_date && game.game_time)
                ? `${game.game_date}T${game.game_time}`
                : undefined;

              // Get moneylines from betting lines
              const bettingLine = nflBettingLinesMap.get(game.home_away_unique);

              gameSummaries.push({
                gameId: game.home_away_unique, // Must match training_key used in GameTailSection
                sport: 'nfl',
                awayTeam: game.away_team,
                homeTeam: game.home_team,
                gameTime: gameTimeValue,
                awaySpread: game.away_spread,
                homeSpread: game.home_spread,
                totalLine: game.ou_vegas_line,
                awayMl: bettingLine?.away_ml || null,
                homeMl: bettingLine?.home_ml || null,
              });
            }
          }

          console.log('========================================');
          console.log(`🏈 NFL GAMES MATCHED FOR THIS WEEK: ${nflMatchCount} / ${nflGames.length}`);
          console.log('========================================');
        } else if (nflError) {
          debug.error('Error fetching NFL games:', nflError);
        }
      } catch (error) {
        debug.error('Exception fetching NFL games:', error);
      }

      // Fetch CFB games - use cfb_live_weekly_inputs (same as CFB page)
      try {
        debug.log('📊 Querying cfb_live_weekly_inputs for CFB games...');
        const { data: cfbGames, error: cfbError } = await collegeFootballSupabase
          .from('cfb_live_weekly_inputs')
          .select('*');

        debug.log('CFB games query result:', { count: cfbGames?.length || 0, error: cfbError });
        
        if (cfbError) {
          debug.error('CFB games error details:', cfbError);
        }

        if (!cfbError && cfbGames) {
          cfbGamesData = cfbGames;
          console.log('========================================');
          console.log('🏈 CFB GAMES DATA');
          console.log('========================================');
          console.log('Total CFB games fetched:', cfbGames.length);
          console.log('First CFB game sample:', cfbGames[0]);
          
          // Log specific games mentioned by user
          const kentGame = cfbGames.find((g: any) => 
            (g.away_team?.includes('Kent') && g.home_team?.includes('Akron')) ||
            (g.home_team?.includes('Kent') && g.away_team?.includes('Akron'))
          );
          const ohioGame = cfbGames.find((g: any) => 
            (g.away_team?.includes('Ohio') && g.home_team?.includes('Western Michigan')) ||
            (g.home_team?.includes('Ohio') && g.away_team?.includes('Western Michigan'))
          );
          
          if (kentGame) {
            console.log('🔥 FOUND KENT STATE GAME:', JSON.stringify(kentGame, null, 2));
          } else {
            console.log('❌ KENT STATE GAME NOT FOUND');
          }
          
          if (ohioGame) {
            console.log('🔥 FOUND OHIO GAME:', JSON.stringify(ohioGame, null, 2));
          } else {
            console.log('❌ OHIO GAME NOT FOUND');
          }
          
          console.log('========================================');
          
          let cfbMatchCount = 0;
          for (const game of cfbGames) {
            // CFB uses start_date or start_time which is a datetime - convert to date for comparison
            const startTimeString = game.start_date || game.start_time || game.game_datetime || game.datetime || game.date;
            let gameDate: string | null = null;
            
            if (startTimeString) {
              try {
                // Parse the datetime and get the date in ET
                const utcDate = new Date(startTimeString);
                const formatter = new Intl.DateTimeFormat('en-US', {
                  timeZone: 'America/New_York',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                });
                
                const parts = formatter.formatToParts(utcDate);
                const year = parts.find(p => p.type === 'year')?.value;
                const month = parts.find(p => p.type === 'month')?.value;
                const day = parts.find(p => p.type === 'day')?.value;
                
                gameDate = `${year}-${month}-${day}`;
              } catch (e) {
                console.error('Error parsing CFB date:', e);
              }
            }
            
            const isThisWeek = gameDate && gameDate >= today && gameDate <= weekFromNow;
            
            console.log(`${isThisWeek ? '✅ THIS WEEK' : '❌ NOT THIS WEEK'} - ${game.away_team} @ ${game.home_team}`);
            console.log(`   start_time: "${startTimeString}" | gameDate: "${gameDate}" | range: "${today}" to "${weekFromNow}"`);
            
            // Only add games within the next 7 days
            if (isThisWeek) {
              cfbMatchCount++;
              const gameTimeValue = game.start_date || game.start_time || game.game_datetime || game.datetime;
              const gameId = game.training_key || game.id;
              
              console.log(`   🎯 ADDING CFB GAME: ${game.away_team} @ ${game.home_team}`);
              console.log(`      Raw data:`, {
                training_key: game.training_key,
                id: game.id,
                has_training_key: !!game.training_key,
                has_id: !!game.id
              });
              console.log(`      Final gameId: "${gameId}"`);
              console.log(`      gameTime value: "${gameTimeValue}"`);
              
              if (!gameId) {
                console.error(`      ❌ WARNING: No gameId for CFB game ${game.away_team} @ ${game.home_team}`);
              }
              
              gameSummaries.push({
                gameId: gameId, // Must match training_key || id used in GameTailSection
                sport: 'cfb',
                awayTeam: game.away_team,
                homeTeam: game.home_team,
                gameTime: gameTimeValue,
                awaySpread: game.away_spread || (game.api_spread ? -game.api_spread : null),
                homeSpread: game.home_spread || game.api_spread,
                totalLine: game.total_line || game.api_over_line,
                cfbId: game.id, // Store CFB id for querying cfb_api_predictions
              });
            }
          }
          
          console.log('========================================');
          console.log(`🏈 CFB GAMES MATCHED FOR THIS WEEK: ${cfbMatchCount} / ${cfbGames.length}`);
          console.log('========================================');
        } else if (cfbError) {
          debug.error('Error fetching CFB games:', cfbError);
        }
      } catch (error) {
        debug.error('Exception fetching CFB games:', error);
      }

      // Fetch NBA games - use nba_input_values_view (same as NBA page)
      try {
        debug.log('📊 Querying nba_input_values_view for NBA games...');
        const { data: nbaGames, error: nbaError } = await collegeFootballSupabase
          .from('nba_input_values_view')
          .select('*')
          .order('game_date', { ascending: true })
          .order('tipoff_time_et', { ascending: true });

        debug.log('NBA games query result:', { count: nbaGames?.length || 0, error: nbaError });
        
        if (nbaError) {
          debug.error('NBA games error details:', nbaError);
        }

        if (!nbaError && nbaGames) {
          console.log('========================================');
          console.log('🏀 NBA GAMES DATA');
          console.log('========================================');
          console.log('Total NBA games fetched:', nbaGames.length);
          
          let nbaMatchCount = 0;
          for (const game of nbaGames) {
            // Extract date from tipoff_time_et (which is in ET) or fallback to game_date
            let gameDate: string | null = null;
            
            if (game.tipoff_time_et) {
              try {
                // Parse tipoff_time_et and get the date in ET
                const utcDate = new Date(game.tipoff_time_et);
                const formatter = new Intl.DateTimeFormat('en-US', {
                  timeZone: 'America/New_York',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                });
                
                const parts = formatter.formatToParts(utcDate);
                const year = parts.find(p => p.type === 'year')?.value;
                const month = parts.find(p => p.type === 'month')?.value;
                const day = parts.find(p => p.type === 'day')?.value;
                
                gameDate = `${year}-${month}-${day}`;
              } catch (e) {
                console.error('Error parsing NBA tipoff_time_et:', e);
                // Fallback to game_date if parsing fails
                gameDate = game.game_date;
              }
            } else {
              // Fallback to game_date if tipoff_time_et is not available
              gameDate = game.game_date;
            }
            
            const isThisWeek = gameDate && gameDate >= today && gameDate <= weekFromNow;
            
            console.log(`${isThisWeek ? '✅ THIS WEEK' : '❌ NOT THIS WEEK'} - ${game.away_team} @ ${game.home_team}`);
            console.log(`   tipoff_time_et: "${game.tipoff_time_et}" | game_date: "${game.game_date}" | extracted date: "${gameDate}" | range: "${today}" to "${weekFromNow}"`);
            
            // Only add games within the next 7 days
            if (isThisWeek) {
              nbaMatchCount++;
              // Use training_key || unique_id to match what GameTailSection receives on NBA page
              const gameIdStr = game.training_key || game.unique_id || String(game.game_id);
              // Combine game_date and tipoff_time_et to create a full datetime string
              // tipoff_time_et might be a full ISO datetime or just a time string
              let gameTimeValue: string | undefined = undefined;
              if (game.tipoff_time_et) {
                // Check if tipoff_time_et is already a full ISO datetime (contains 'T' and timezone info)
                if (game.tipoff_time_et.includes('T') && (game.tipoff_time_et.includes('+') || game.tipoff_time_et.includes('Z'))) {
                  // Already a full datetime, use it directly
                  gameTimeValue = game.tipoff_time_et;
                } else if (game.game_date) {
                  // It's just a time string, combine with game_date
                  const timeStr = game.tipoff_time_et.includes(':') && game.tipoff_time_et.split(':').length === 2
                    ? `${game.tipoff_time_et}:00`
                    : game.tipoff_time_et;
                  gameTimeValue = `${game.game_date}T${timeStr}`;
                }
              }
              
              // Calculate away moneyline from home moneyline
              const homeML = game.home_moneyline;
              let awayML = null;
              if (homeML) {
                awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
              }
              
              gameSummaries.push({
                gameId: gameIdStr, // Must match training_key || unique_id used in GameTailSection
                sport: 'nba',
                awayTeam: game.away_team,
                homeTeam: game.home_team,
                gameTime: gameTimeValue,
                awaySpread: game.home_spread ? -game.home_spread : null,
                homeSpread: game.home_spread,
                totalLine: game.total_line,
                awayMl: awayML,
                homeMl: homeML,
                nbaId: String(game.game_id), // Store NBA game_id for querying nba_predictions
              });
            }
          }
          
          console.log(`🏀 NBA GAMES MATCHED FOR THIS WEEK: ${nbaMatchCount} / ${nbaGames.length}`);
          console.log('========================================');
        } else if (nbaError) {
          debug.error('Error fetching NBA games:', nbaError);
        }
      } catch (error) {
        debug.error('Exception fetching NBA games:', error);
      }

      // Fetch NCAAB games - use v_cbb_input_values (same as NCAAB page)
      try {
        debug.log('📊 Querying v_cbb_input_values for NCAAB games...');
        const { data: ncaabGames, error: ncaabError } = await collegeFootballSupabase
          .from('v_cbb_input_values')
          .select('*')
          .order('game_date_et', { ascending: true })
          .order('tipoff_time_et', { ascending: true });

        debug.log('NCAAB games query result:', { count: ncaabGames?.length || 0, error: ncaabError });
        
        if (ncaabError) {
          debug.error('NCAAB games error details:', ncaabError);
        }

        if (!ncaabError && ncaabGames) {
          console.log('========================================');
          console.log('🏀 NCAAB GAMES DATA');
          console.log('========================================');
          console.log('Total NCAAB games fetched:', ncaabGames.length);
          
          let ncaabMatchCount = 0;
          for (const game of ncaabGames) {
            // Extract date from start_utc or tipoff_time_et (which is in ET) or fallback to game_date_et
            let gameDate: string | null = null;
            
            // Prefer start_utc, then tipoff_time_et, then game_date_et
            const dateTimeSource = game.start_utc || game.tipoff_time_et;
            
            if (dateTimeSource) {
              try {
                // Parse the datetime and get the date in ET
                const utcDate = new Date(dateTimeSource);
                const formatter = new Intl.DateTimeFormat('en-US', {
                  timeZone: 'America/New_York',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                });
                
                const parts = formatter.formatToParts(utcDate);
                const year = parts.find(p => p.type === 'year')?.value;
                const month = parts.find(p => p.type === 'month')?.value;
                const day = parts.find(p => p.type === 'day')?.value;
                
                gameDate = `${year}-${month}-${day}`;
              } catch (e) {
                console.error('Error parsing NCAAB datetime:', e);
                // Fallback to game_date_et if parsing fails
                gameDate = game.game_date_et;
              }
            } else {
              // Fallback to game_date_et if no datetime source
              gameDate = game.game_date_et;
            }
            
            const isThisWeek = gameDate && gameDate >= today && gameDate <= weekFromNow;
            
            console.log(`${isThisWeek ? '✅ THIS WEEK' : '❌ NOT THIS WEEK'} - ${game.away_team} @ ${game.home_team}`);
            console.log(`   start_utc: "${game.start_utc}" | tipoff_time_et: "${game.tipoff_time_et}" | game_date_et: "${game.game_date_et}" | extracted date: "${gameDate}" | range: "${today}" to "${weekFromNow}"`);
            
            // Only add games within the next 7 days
            if (isThisWeek) {
              ncaabMatchCount++;
              // Use training_key || unique_id to match what GameTailSection receives on NCAAB page
              const gameIdStr = game.training_key || game.unique_id || String(game.game_id);
              // Combine game_date_et and tipoff_time_et or start_utc to create a full datetime string
              // tipoff_time_et might be a full ISO datetime or just a time string
              let gameTimeValue: string | undefined = undefined;
              if (game.start_utc) {
                gameTimeValue = game.start_utc;
              } else if (game.tipoff_time_et) {
                // Check if tipoff_time_et is already a full ISO datetime
                if (game.tipoff_time_et.includes('T') && (game.tipoff_time_et.includes('+') || game.tipoff_time_et.includes('Z'))) {
                  gameTimeValue = game.tipoff_time_et;
                } else if (game.game_date_et) {
                  // It's just a time string, combine with game_date_et
                  gameTimeValue = `${game.game_date_et}T${game.tipoff_time_et}`;
                }
              }
              
              // Get spreads and totals from game data
              const vegasHomeSpread = game.spread || null;
              const vegasTotal = game.over_under || null;
              
              gameSummaries.push({
                gameId: gameIdStr, // Must match training_key || unique_id used in GameTailSection
                sport: 'ncaab',
                awayTeam: game.away_team,
                homeTeam: game.home_team,
                gameTime: gameTimeValue,
                awaySpread: vegasHomeSpread !== null ? -vegasHomeSpread : null,
                homeSpread: vegasHomeSpread,
                totalLine: vegasTotal,
                awayMl: game.awayMoneyline || null,
                homeMl: game.homeMoneyline || null,
                ncaabId: String(game.game_id), // Store NCAAB game_id for querying ncaab_predictions
              });
            }
          }
          
          console.log(`🏀 NCAAB GAMES MATCHED FOR THIS WEEK: ${ncaabMatchCount} / ${ncaabGames.length}`);
          console.log('========================================');
        } else if (ncaabError) {
          debug.error('Error fetching NCAAB games:', ncaabError);
        }
      } catch (error) {
        debug.error('Exception fetching NCAAB games:', error);
      }

      console.log('========================================');
      console.log('🎯 FINAL RESULTS');
      console.log('========================================');
      console.log('✅ Total games this week:', gameSummaries.length);
      console.log('🏈 NFL games:', gameSummaries.filter(g => g.sport === 'nfl').length);
      console.log('🏈 CFB games:', gameSummaries.filter(g => g.sport === 'cfb').length);
      console.log('🏀 NBA games:', gameSummaries.filter(g => g.sport === 'nba').length);
      console.log('🏀 NCAAB games:', gameSummaries.filter(g => g.sport === 'ncaab').length);
      
      console.log('========================================');
      
      // Note: Removed fallback logic - if no games found, we show empty state

      // Fetch tail counts for all week games
      if (gameSummaries.length > 0) {
        const gameIds = gameSummaries.map(g => g.gameId).filter(Boolean);
        console.log('========================================');
        console.log('🎯 FETCHING TAIL COUNTS');
        console.log('========================================');
        console.log('Game IDs we\'re looking for:', gameIds);
        console.log('Total game IDs:', gameIds.length);
        console.log('NFL game IDs:', gameSummaries.filter(g => g.sport === 'nfl').map(g => g.gameId));
        console.log('CFB game IDs:', gameSummaries.filter(g => g.sport === 'cfb').map(g => g.gameId));
        
        // Check what CFB gameIds we generated
        const cfbGamesInList = gameSummaries.filter(g => g.sport === 'cfb');
        console.log('CFB games and their gameIds:', cfbGamesInList.map(g => ({
          away: g.awayTeam,
          home: g.homeTeam,
          gameId: g.gameId
        })));
        
        // Query for ANY game_tails that might be CFB (not matching NFL format)
        const { data: allTails } = await supabase
          .from('game_tails')
          .select('game_unique_id')
          .limit(100);
        
        // Filter for potential CFB games (numeric IDs or containing "State", "Ohio", etc)
        const potentialCfbTails = allTails?.filter(t => 
          /^\d+$/.test(t.game_unique_id) || // All numeric
          t.game_unique_id.includes('State') ||
          t.game_unique_id.includes('Akron') ||
          t.game_unique_id.includes('Ohio') ||
          t.game_unique_id.includes('Western') ||
          t.game_unique_id.includes('Michigan')
        );
        console.log('Potential CFB tails found (numeric or team names):', potentialCfbTails);
        
        const { data: tailsData } = await supabase
          .from('game_tails')
          .select('game_unique_id')
          .in('game_unique_id', gameIds);

        console.log('Tails data from database (matching our gameIds):', tailsData);
        
        if (tailsData) {
          const tailCounts = tailsData.reduce((acc, tail) => {
            acc[tail.game_unique_id] = (acc[tail.game_unique_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          console.log('Tail counts by game:', tailCounts);
          
          gameSummaries.forEach(game => {
            game.tailCount = tailCounts[game.gameId] || 0;
            if (game.sport === 'cfb') {
              console.log(`CFB Game: ${game.awayTeam} @ ${game.homeTeam}`);
              console.log(`  gameId: "${game.gameId}"`);
              console.log(`  tailCount: ${game.tailCount}`);
            }
          });
        }
        console.log('========================================');
      }

      // Sort by tail count, then by time
      return gameSummaries.sort((a, b) => {
        if (a.tailCount !== b.tailCount) {
          return (b.tailCount || 0) - (a.tailCount || 0);
        }
        return (a.gameTime || '').localeCompare(b.gameTime || '');
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filter to get ONLY today's games
  const todayGames = weekGames?.filter(game => {
    const isBball = game.sport === 'nba' || game.sport === 'ncaab';
    if (isBball) {
      console.log(`🏀 FILTERING ${game.sport.toUpperCase()} GAME:`, {
        sport: game.sport,
        away: game.awayTeam,
        home: game.homeTeam,
        gameTime: game.gameTime,
        gameId: game.gameId
      });
    }
    
    // For games with gameTime, extract the date
    if (game.gameTime) {
      try {
        // Parse the gameTime string (format: "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DDTHH:MM")
        const utcDate = new Date(game.gameTime);
        
        // Check if date is valid
        if (isNaN(utcDate.getTime())) {
          console.error(`   ❌ Invalid date for ${game.sport}: "${game.gameTime}"`);
          return false;
        }
        
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        
        const parts = formatter.formatToParts(utcDate);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        
        const gameDate = `${year}-${month}-${day}`;
        const isToday = gameDate === today;
        
        if (isBball) {
          console.log(`   🏀 ${game.sport.toUpperCase()} gameTime: "${game.gameTime}" -> gameDate: "${gameDate}" | today: "${today}" | match: ${isToday}`);
        }
        
        return isToday;
      } catch (e) {
        console.error(`Error parsing game time for ${game.sport}:`, e, game);
        return false;
      }
    }
    
    if (isBball) {
      console.log(`   ❌ ${game.sport.toUpperCase()} game missing gameTime field`);
    }
    return false;
  });
  
  console.log('========================================');
  console.log('📊 TODAY\'S GAMES FILTER RESULTS');
  console.log('========================================');
  console.log('Total week games:', weekGames?.length || 0);
  console.log('  NFL:', weekGames?.filter(g => g.sport === 'nfl').length || 0);
  console.log('  CFB:', weekGames?.filter(g => g.sport === 'cfb').length || 0);
  console.log('  NBA:', weekGames?.filter(g => g.sport === 'nba').length || 0);
  console.log('  NCAAB:', weekGames?.filter(g => g.sport === 'ncaab').length || 0);
  console.log('Today\'s games:', todayGames?.length || 0);
  console.log('  NFL:', todayGames?.filter(g => g.sport === 'nfl').length || 0);
  console.log('  CFB:', todayGames?.filter(g => g.sport === 'cfb').length || 0);
  console.log('  NBA:', todayGames?.filter(g => g.sport === 'nba').length || 0);
  console.log('  NCAAB:', todayGames?.filter(g => g.sport === 'ncaab').length || 0);
  console.log('Today\'s date:', today);
  console.log('========================================');

  // Fetch value alerts (Polymarket >57%) - for ALL games this WEEK
  const { data: valueAlerts, isLoading: valueAlertsLoading } = useQuery({
    queryKey: ['value-alerts', today, weekGames?.length],
    queryFn: async () => {
      const alerts: ValueAlert[] = [];

      if (!weekGames || weekGames.length === 0) {
        debug.log('No games available for value alerts');
        return alerts;
      }

      const basketballGames = weekGames.filter(g => g.sport === 'nba' || g.sport === 'ncaab');
      debug.log('Checking value alerts for', weekGames.length, 'games');
      debug.log(`  🏀 Basketball games: ${basketballGames.length} (${basketballGames.filter(g => g.sport === 'nba').length} NBA, ${basketballGames.filter(g => g.sport === 'ncaab').length} NCAAB)`);
      const gamesByLeague = new Map<'nfl' | 'cfb' | 'nba' | 'ncaab', GameSummary[]>();
      for (const game of weekGames) {
        const existing = gamesByLeague.get(game.sport) || [];
        existing.push(game);
        gamesByLeague.set(game.sport, existing);
      }

      type CachedMarket = {
        game_key: string;
        market_type: 'moneyline' | 'spread' | 'total';
        current_away_odds: number;
        current_home_odds: number;
      };

      const marketsByGameKey = new Map<string, CachedMarket[]>();
      for (const [league, games] of gamesByLeague.entries()) {
        const gameKeys = Array.from(
          new Set(games.map((game) => `${game.sport}_${game.awayTeam}_${game.homeTeam}`))
        );
        if (gameKeys.length === 0) continue;

        const { data: markets, error } = await supabase
          .from('polymarket_markets')
          .select('game_key, market_type, current_away_odds, current_home_odds')
          .eq('league', league)
          .in('game_key', gameKeys);

        if (error) {
          debug.error('Error fetching batched polymarket markets:', error);
          continue;
        }

        for (const market of (markets || []) as CachedMarket[]) {
          const existing = marketsByGameKey.get(market.game_key) || [];
          existing.push(market);
          marketsByGameKey.set(market.game_key, existing);
        }
      }

      for (const game of weekGames) {
        const gameKey = `${game.sport}_${game.awayTeam}_${game.homeTeam}`;
        const markets = marketsByGameKey.get(gameKey);
        if (!markets) continue;

        for (const market of markets) {
          const gameInfo = {
            gameTime: game.gameTime,
            homeSpread: game.homeSpread,
            totalLine: game.totalLine,
            homeMl: game.homeMl,
            awayMl: game.awayMl,
          };

          if (market.market_type === 'spread') {
            if (market.current_away_odds > 57) {
              alerts.push({
                gameId: game.gameId,
                sport: game.sport,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                marketType: 'Spread',
                side: game.awayTeam,
                percentage: market.current_away_odds,
                ...gameInfo,
              });
            }
            if (market.current_home_odds > 57) {
              alerts.push({
                gameId: game.gameId,
                sport: game.sport,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                marketType: 'Spread',
                side: game.homeTeam,
                percentage: market.current_home_odds,
                ...gameInfo,
              });
            }
          }

          if (market.market_type === 'total') {
            if (market.current_away_odds > 57) {
              alerts.push({
                gameId: game.gameId,
                sport: game.sport,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                marketType: 'Total',
                side: 'Over',
                percentage: market.current_away_odds,
                ...gameInfo,
              });
            }
            if (market.current_home_odds > 57) {
              alerts.push({
                gameId: game.gameId,
                sport: game.sport,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                marketType: 'Total',
                side: 'Under',
                percentage: market.current_home_odds,
                ...gameInfo,
              });
            }
          }

          if (market.market_type === 'moneyline') {
            const awayOddsHaveValue = !game.awayMl || game.awayMl > -200;
            if (market.current_away_odds >= 85 && awayOddsHaveValue) {
              alerts.push({
                gameId: game.gameId,
                sport: game.sport,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                marketType: 'Moneyline',
                side: game.awayTeam,
                percentage: market.current_away_odds,
                ...gameInfo,
              });
            }
            const homeOddsHaveValue = !game.homeMl || game.homeMl > -200;
            if (market.current_home_odds >= 85 && homeOddsHaveValue) {
              alerts.push({
                gameId: game.gameId,
                sport: game.sport,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                marketType: 'Moneyline',
                side: game.homeTeam,
                percentage: market.current_home_odds,
                ...gameInfo,
              });
            }
          }
        }
      }

      return alerts;
    },
    enabled: !isFreemiumUser && !!weekGames,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch fade alerts (80%+ model confidence) - for ALL games this WEEK
  const { data: fadeAlerts, isLoading: fadeAlertsLoading } = useQuery({
    queryKey: ['fade-alerts', today, weekGames?.length],
    queryFn: async () => {
      const alerts: FadeAlert[] = [];

      if (!weekGames || weekGames.length === 0) {
        debug.log('No games available for fade alerts');
        return alerts;
      }

      debug.log('Checking fade alerts for', weekGames.length, 'games');

      // Separate games by sport
      const nflGames = weekGames.filter(g => g.sport === 'nfl');
      const cfbGames = weekGames.filter(g => g.sport === 'cfb');
      const nbaGames = weekGames.filter(g => g.sport === 'nba');
      const ncaabGames = weekGames.filter(g => g.sport === 'ncaab');

      // Fetch NFL predictions
      if (nflGames.length > 0) {
        try {
          const { data: latestRun } = await collegeFootballSupabase
            .from('nfl_predictions_epa')
            .select('run_id')
            .order('run_id', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestRun) {
            const gameIds = nflGames.map(g => g.gameId);
            const { data: nflPredictions } = await collegeFootballSupabase
              .from('nfl_predictions_epa')
              .select('home_away_spread_cover_prob, ou_result_prob, training_key')
              .eq('run_id', latestRun.run_id)
              .in('training_key', gameIds);

            const predictionMap = new Map((nflPredictions || []).map(p => [p.training_key, p]));

            for (const game of nflGames) {
              const prediction = predictionMap.get(game.gameId);
              if (prediction) {
                // Common game info to include in alerts
                const gameInfo = {
                  gameTime: game.gameTime,
                  homeSpread: game.homeSpread,
                  totalLine: game.totalLine,
                  homeMl: game.homeMl,
                  awayMl: game.awayMl,
                };

                // Check spread
                if (prediction.home_away_spread_cover_prob !== null) {
                  const isHome = prediction.home_away_spread_cover_prob > 0.5;
                  const confidence = Math.round((isHome ? prediction.home_away_spread_cover_prob : 1 - prediction.home_away_spread_cover_prob) * 100);

                  if (confidence >= 80) {
                    alerts.push({
                      gameId: game.gameId,
                      sport: 'nfl',
                      awayTeam: game.awayTeam,
                      homeTeam: game.homeTeam,
                      pickType: 'Spread',
                      predictedTeam: isHome ? game.homeTeam : game.awayTeam,
                      confidence,
                      ...gameInfo,
                    });
                  }
                }

                // Check total
                if (prediction.ou_result_prob !== null) {
                  const isOver = prediction.ou_result_prob > 0.5;
                  const confidence = Math.round((isOver ? prediction.ou_result_prob : 1 - prediction.ou_result_prob) * 100);

                  if (confidence >= 80) {
                    alerts.push({
                      gameId: game.gameId,
                      sport: 'nfl',
                      awayTeam: game.awayTeam,
                      homeTeam: game.homeTeam,
                      pickType: 'Total',
                      predictedTeam: isOver ? 'Over' : 'Under',
                      confidence,
                      ...gameInfo,
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          debug.error('Error fetching NFL prediction data:', error);
        }
      }

      // Fetch CFB predictions - batch fetch all at once (same pattern as CollegeFootball page)
      // CFB uses edges instead of probabilities - show alerts when edge > 10
      if (cfbGames.length > 0) {
        try {
          // Fetch all CFB API predictions at once - get edge fields
          const { data: allCfbPredictions, error: cfbPredictionsError } = await collegeFootballSupabase
            .from('cfb_api_predictions')
            .select('home_spread_diff, over_line_diff, id');

          if (cfbPredictionsError) {
            debug.error('Error fetching CFB predictions:', cfbPredictionsError);
          } else {
            debug.log(`Fetched ${allCfbPredictions?.length || 0} CFB predictions for fade alerts`);
            
            // Create a map of predictions by id
            const cfbPredictionMap = new Map((allCfbPredictions || []).map(p => [p.id, p]));

            for (const game of cfbGames) {
              if (!game.cfbId) {
                debug.log(`Skipping CFB game - no cfbId for game ${game.gameId}`);
                continue;
              }

              const prediction = cfbPredictionMap.get(game.cfbId);
              if (!prediction) {
                debug.log(`No prediction found for CFB game ${game.gameId} (cfbId: ${game.cfbId})`);
                continue;
              }

              // Common game info to include in alerts
              const gameInfo = {
                gameTime: game.gameTime,
                homeSpread: game.homeSpread,
                totalLine: game.totalLine,
                homeMl: game.homeMl,
                awayMl: game.awayMl,
              };

              // Check spread edge - use home_spread_diff (primary field)
              const spreadEdge = prediction.home_spread_diff;

              if (spreadEdge !== null && spreadEdge !== undefined && Math.abs(spreadEdge) > 10) {
                // Positive edge = home team, negative edge = away team
                const isHome = spreadEdge > 0;
                const edgeValue = Math.abs(spreadEdge);

                debug.log(`CFB Spread Alert: ${game.awayTeam} @ ${game.homeTeam} - Edge: ${edgeValue} to ${isHome ? game.homeTeam : game.awayTeam}`);

                alerts.push({
                  gameId: game.gameId,
                  sport: 'cfb',
                  awayTeam: game.awayTeam,
                  homeTeam: game.homeTeam,
                  pickType: 'Spread',
                  predictedTeam: isHome ? game.homeTeam : game.awayTeam,
                  confidence: Math.round(edgeValue), // Store edge value as "confidence" for display
                  ...gameInfo,
                });
              }

              // Check total edge - use over_line_diff (primary field)
              const totalEdge = prediction.over_line_diff;

              if (totalEdge !== null && totalEdge !== undefined && Math.abs(totalEdge) > 10) {
                // Positive edge = over, negative edge = under
                const isOver = totalEdge > 0;
                const edgeValue = Math.abs(totalEdge);

                debug.log(`CFB Total Alert: ${game.awayTeam} @ ${game.homeTeam} - Edge: ${edgeValue} to ${isOver ? 'Over' : 'Under'}`);

                alerts.push({
                  gameId: game.gameId,
                  sport: 'cfb',
                  awayTeam: game.awayTeam,
                  homeTeam: game.homeTeam,
                  pickType: 'Total',
                  predictedTeam: isOver ? 'Over' : 'Under',
                  confidence: Math.round(edgeValue), // Store edge value as "confidence" for display
                  ...gameInfo,
                });
              }
            }
            
            debug.log(`Total CFB fade alerts created: ${alerts.filter(a => a.sport === 'cfb').length}`);
          }
        } catch (error) {
          debug.error('Error fetching CFB prediction data:', error);
        }
      }

      // Fetch NBA predictions - use edge values (similar to CFB)
      if (nbaGames.length > 0) {
        try {
          // Get latest run_id
          const { data: latestRun } = await collegeFootballSupabase
            .from('nba_predictions')
            .select('run_id, as_of_ts_utc')
            .order('as_of_ts_utc', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestRun) {
            const gameIds = nbaGames.map(g => g.nbaId || g.gameId).filter(Boolean);
            const { data: nbaPredictions } = await collegeFootballSupabase
              .from('nba_predictions')
              .select('game_id, model_fair_home_spread, model_fair_total')
              .eq('run_id', latestRun.run_id)
              .in('game_id', gameIds);

            const predictionMap = new Map((nbaPredictions || []).map(p => [String(p.game_id), p]));

            for (const game of nbaGames) {
              const gameId = String(game.nbaId || game.gameId);
              const prediction = predictionMap.get(gameId);
              if (prediction) {
                // Common game info to include in alerts
                const gameInfo = {
                  gameTime: game.gameTime,
                  homeSpread: game.homeSpread,
                  totalLine: game.totalLine,
                  homeMl: game.homeMl,
                  awayMl: game.awayMl,
                };

                // Calculate spread edge - use game data for vegas spread
                const vegasSpread = game.homeSpread;
                const modelFairSpread = prediction.model_fair_home_spread;
                const spreadEdge = (vegasSpread !== null && modelFairSpread !== null)
                  ? modelFairSpread - vegasSpread
                  : null;

                if (spreadEdge !== null && Math.abs(spreadEdge) > 3) {
                  // NBA uses 3+ point edge threshold (smaller than CFB's 10)
                  const isHome = spreadEdge > 0;
                  const edgeValue = Math.abs(spreadEdge);

                  alerts.push({
                    gameId: game.gameId,
                    sport: 'nba',
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    pickType: 'Spread',
                    predictedTeam: isHome ? game.homeTeam : game.awayTeam,
                    confidence: Math.round(edgeValue * 10) / 10, // Store edge value as "confidence"
                    ...gameInfo,
                  });
                }

                // Calculate total edge - use game data for vegas total
                const vegasTotal = game.totalLine;
                const modelFairTotal = prediction.model_fair_total;
                const totalEdge = (vegasTotal !== null && modelFairTotal !== null)
                  ? modelFairTotal - vegasTotal
                  : null;

                if (totalEdge !== null && Math.abs(totalEdge) > 3) {
                  const isOver = totalEdge > 0;
                  const edgeValue = Math.abs(totalEdge);

                  alerts.push({
                    gameId: game.gameId,
                    sport: 'nba',
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    pickType: 'Total',
                    predictedTeam: isOver ? 'Over' : 'Under',
                    confidence: Math.round(edgeValue * 10) / 10,
                    ...gameInfo,
                  });
                }
              }
            }
          }
        } catch (error) {
          debug.error('Error fetching NBA prediction data:', error);
        }
      }

      // Fetch NCAAB predictions - use edge values (similar to CFB)
      if (ncaabGames.length > 0) {
        try {
          // Get latest run_id
          const { data: latestRun } = await collegeFootballSupabase
            .from('ncaab_predictions')
            .select('run_id, as_of_ts_utc')
            .order('as_of_ts_utc', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestRun) {
            const gameIds = ncaabGames.map(g => g.ncaabId || g.gameId).filter(Boolean);
            const { data: ncaabPredictions } = await collegeFootballSupabase
              .from('ncaab_predictions')
              .select('game_id, pred_home_margin, pred_total_points, vegas_home_spread, vegas_total')
              .eq('run_id', latestRun.run_id)
              .in('game_id', gameIds);

            const predictionMap = new Map((ncaabPredictions || []).map(p => [String(p.game_id), p]));

            for (const game of ncaabGames) {
              const gameId = String(game.ncaabId || game.gameId);
              const prediction = predictionMap.get(gameId);
              if (prediction) {
                // Common game info to include in alerts
                const gameInfo = {
                  gameTime: game.gameTime,
                  homeSpread: game.homeSpread,
                  totalLine: game.totalLine,
                  homeMl: game.homeMl,
                  awayMl: game.awayMl,
                };

                // Calculate spread edge
                const vegasSpread = prediction.vegas_home_spread || game.homeSpread;
                const predMargin = prediction.pred_home_margin;
                const spreadEdge = (vegasSpread !== null && predMargin !== null)
                  ? predMargin - vegasSpread
                  : null;

                if (spreadEdge !== null && Math.abs(spreadEdge) > 5) {
                  // NCAAB uses 5+ point edge threshold
                  const isHome = spreadEdge > 0;
                  const edgeValue = Math.abs(spreadEdge);

                  alerts.push({
                    gameId: game.gameId,
                    sport: 'ncaab',
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    pickType: 'Spread',
                    predictedTeam: isHome ? game.homeTeam : game.awayTeam,
                    confidence: Math.round(edgeValue * 10) / 10,
                    ...gameInfo,
                  });
                }

                // Calculate total edge
                const vegasTotal = prediction.vegas_total || game.totalLine;
                const predTotal = prediction.pred_total_points;
                const totalEdge = (vegasTotal !== null && predTotal !== null)
                  ? predTotal - vegasTotal
                  : null;

                if (totalEdge !== null && Math.abs(totalEdge) > 5) {
                  const isOver = totalEdge > 0;
                  const edgeValue = Math.abs(totalEdge);

                  alerts.push({
                    gameId: game.gameId,
                    sport: 'ncaab',
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    pickType: 'Total',
                    predictedTeam: isOver ? 'Over' : 'Under',
                    confidence: Math.round(edgeValue * 10) / 10,
                    ...gameInfo,
                  });
                }
              }
            }
          }
        } catch (error) {
          debug.error('Error fetching NCAAB prediction data:', error);
        }
      }

      return alerts;
    },
    enabled: !isFreemiumUser && !!weekGames,
    staleTime: 5 * 60 * 1000,
  });

  const { data: nbaTrendOutliers = [], isLoading: nbaTrendOutliersLoading } = useQuery({
    queryKey: ['nba-trend-outliers', today],
    queryFn: async () => {
      let trendsData: TrendsTeamRow[] | null = null;
      const { data: todayRows, error: todayError } = await collegeFootballSupabase
        .from('nba_game_situational_trends_today')
        .select('*')
        .order('game_date', { ascending: true })
        .order('game_id', { ascending: true });

      if (!todayError && todayRows && todayRows.length > 0) {
        trendsData = todayRows as TrendsTeamRow[];
      } else {
        const { data: fallbackRows, error: fallbackError } = await collegeFootballSupabase
          .from('nba_game_situational_trends')
          .select('*')
          .order('game_date', { ascending: true })
          .order('game_id', { ascending: true });

        if (fallbackError) {
          debug.error('Error fetching NBA trend rows:', fallbackError);
          return [];
        }
        trendsData = (fallbackRows || []) as TrendsTeamRow[];
      }

      if (!trendsData || trendsData.length === 0) return [];

      const gamesMap = new Map<number, TrendsGame>();
      trendsData.forEach((row) => {
        if (!gamesMap.has(row.game_id)) {
          gamesMap.set(row.game_id, {
            game_id: row.game_id,
            game_date: row.game_date,
            tipoff_time_et: null,
            away_team: row.team_side === 'away' ? row : ({} as TrendsTeamRow),
            home_team: row.team_side === 'home' ? row : ({} as TrendsTeamRow),
          });
        } else {
          const game = gamesMap.get(row.game_id)!;
          if (row.team_side === 'away') game.away_team = row;
          if (row.team_side === 'home') game.home_team = row;
        }
      });

      const games = Array.from(gamesMap.values()).filter(
        (game) => game.away_team?.team_name && game.home_team?.team_name
      );
      if (games.length === 0) return [];

      const gameIds = games.map((game) => game.game_id);
      const { data: timesRows, error: timesError } = await collegeFootballSupabase
        .from('nba_input_values_view')
        .select('game_id, tipoff_time_et')
        .in('game_id', gameIds);

      if (timesError) {
        debug.error('Error fetching NBA trend tipoff times:', timesError);
      } else if (timesRows) {
        const timeMap = new Map<number, string | null>();
        timesRows.forEach((row: any) => timeMap.set(row.game_id, row.tipoff_time_et));
        games.forEach((game) => {
          game.tipoff_time_et = timeMap.get(game.game_id) || null;
        });
      }

      return buildTrendOutliers(games, 'nba');
    },
    enabled: !isFreemiumUser && !!weekGames,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ncaabTrendOutliers = [], isLoading: ncaabTrendOutliersLoading } = useQuery({
    queryKey: ['ncaab-trend-outliers', today],
    queryFn: async () => {
      let trendsData: TrendsTeamRow[] | null = null;
      const { data: todayRows, error: todayError } = await collegeFootballSupabase
        .from('ncaab_game_situational_trends_today')
        .select('*')
        .order('game_date', { ascending: true })
        .order('game_id', { ascending: true });

      if (!todayError && todayRows && todayRows.length > 0) {
        trendsData = todayRows as TrendsTeamRow[];
      } else {
        const { data: fallbackRows, error: fallbackError } = await collegeFootballSupabase
          .from('ncaab_game_situational_trends')
          .select('*')
          .order('game_date', { ascending: true })
          .order('game_id', { ascending: true });

        if (fallbackError) {
          debug.error('Error fetching NCAAB trend rows:', fallbackError);
          return [];
        }
        trendsData = (fallbackRows || []) as TrendsTeamRow[];
      }

      if (!trendsData || trendsData.length === 0) return [];

      const gamesMap = new Map<number, TrendsGame>();
      trendsData.forEach((row) => {
        if (!gamesMap.has(row.game_id)) {
          gamesMap.set(row.game_id, {
            game_id: row.game_id,
            game_date: row.game_date,
            tipoff_time_et: null,
            away_team: row.team_side === 'away' ? row : ({} as TrendsTeamRow),
            home_team: row.team_side === 'home' ? row : ({} as TrendsTeamRow),
          });
        } else {
          const game = gamesMap.get(row.game_id)!;
          if (row.team_side === 'away') game.away_team = row;
          if (row.team_side === 'home') game.home_team = row;
        }
      });

      const games = Array.from(gamesMap.values()).filter(
        (game) => game.away_team?.team_name && game.home_team?.team_name
      );
      if (games.length === 0) return [];

      const gameIds = games.map((game) => game.game_id);
      const { data: timesRows, error: timesError } = await collegeFootballSupabase
        .from('v_cbb_input_values')
        .select('game_id, start_utc, tipoff_time_et')
        .in('game_id', gameIds);

      if (timesError) {
        debug.error('Error fetching NCAAB trend tipoff times:', timesError);
      } else if (timesRows) {
        const timeMap = new Map<number, string | null>();
        timesRows.forEach((row: any) => timeMap.set(row.game_id, row.start_utc || row.tipoff_time_et));
        games.forEach((game) => {
          game.tipoff_time_et = timeMap.get(game.game_id) || null;
        });
      }

      return buildTrendOutliers(games, 'ncaab');
    },
    enabled: !isFreemiumUser && !!weekGames,
    staleTime: 5 * 60 * 1000,
  });

  const topNbaTrendOutliers = useMemo(
    () => nbaTrendOutliers.slice(0, showAllNbaTrendOutliers ? nbaTrendOutliers.length : 6),
    [nbaTrendOutliers, showAllNbaTrendOutliers]
  );

  const topNcaabTrendOutliers = useMemo(
    () => ncaabTrendOutliers.slice(0, showAllNcaabTrendOutliers ? ncaabTrendOutliers.length : 6),
    [ncaabTrendOutliers, showAllNcaabTrendOutliers]
  );

  // Fetch all games with tails - for ALL games this WEEK
  const { data: allTailedGames, isLoading: allTailedLoading } = useQuery({
    queryKey: ['all-tailed-games', today, weekGames?.length],
    queryFn: async () => {
      if (!weekGames || weekGames.length === 0) {
        debug.log('No games available for tailed games');
        return [];
      }

      debug.log('Fetching all games with tails for', weekGames.length, 'games');

      // Convert all gameIds to strings to ensure type consistency with database (game_unique_id is text)
      const gameIds = weekGames.map(g => String(g.gameId)).filter(Boolean); // Remove any undefined/null
      
      console.log('========================================');
      console.log('🎯 FETCHING ALL GAMES WITH TAILS');
      console.log('========================================');
      console.log('Total weekGames:', weekGames.length);
      console.log('  NFL:', weekGames.filter(g => g.sport === 'nfl').length);
      console.log('  CFB:', weekGames.filter(g => g.sport === 'cfb').length);
      console.log('  NBA:', weekGames.filter(g => g.sport === 'nba').length);
      console.log('  NCAAB:', weekGames.filter(g => g.sport === 'ncaab').length);
      console.log('Total gameIds:', gameIds.length);
      
      // Split by sport for debugging (convert to strings for consistency)
      const nflGameIds = weekGames.filter(g => g.sport === 'nfl').map(g => String(g.gameId)).filter(Boolean);
      const cfbGameIds = weekGames.filter(g => g.sport === 'cfb').map(g => String(g.gameId)).filter(Boolean);
      const nbaGameIds = weekGames.filter(g => g.sport === 'nba').map(g => String(g.gameId)).filter(Boolean);
      const ncaabGameIds = weekGames.filter(g => g.sport === 'ncaab').map(g => String(g.gameId)).filter(Boolean);
      
      console.log('NFL game IDs:', nflGameIds);
      console.log('CFB game IDs:', cfbGameIds);
      console.log('🏀 NBA game IDs:', nbaGameIds);
      console.log('🏀 NCAAB game IDs:', ncaabGameIds);
      console.log('');
      
      // First, query ALL tails to see what exists in the database
      const { data: allTails, error: allTailsError } = await supabase
        .from('game_tails')
        .select('game_unique_id, sport');
      
      console.log('ALL TAILS in database:', {
        total: allTails?.length || 0,
        error: allTailsError,
        nflCount: allTails?.filter(t => t.sport === 'nfl').length || 0,
        cfbCount: allTails?.filter(t => t.sport === 'cfb').length || 0,
        nbaCount: allTails?.filter(t => t.sport === 'nba').length || 0,
        ncaabCount: allTails?.filter(t => t.sport === 'ncaab').length || 0,
      });
      
      // Show unique game IDs in database by sport
      const cfbTailsInDb = allTails?.filter(t => t.sport === 'cfb') || [];
      const nbaTailsInDb = allTails?.filter(t => t.sport === 'nba') || [];
      const ncaabTailsInDb = allTails?.filter(t => t.sport === 'ncaab') || [];
      const uniqueCfbGameIds = [...new Set(cfbTailsInDb.map(t => t.game_unique_id))];
      const uniqueNbaGameIds = [...new Set(nbaTailsInDb.map(t => t.game_unique_id))];
      const uniqueNcaabGameIds = [...new Set(ncaabTailsInDb.map(t => t.game_unique_id))];
      console.log('Unique CFB game IDs in database:', uniqueCfbGameIds);
      console.log('🏀 Unique NBA game IDs in database:', uniqueNbaGameIds);
      console.log('🏀 Unique NCAAB game IDs in database:', uniqueNcaabGameIds);
      console.log('CFB game IDs we\'re looking for:', cfbGameIds);
      console.log('🏀 NBA game IDs we\'re looking for:', nbaGameIds);
      console.log('🏀 NCAAB game IDs we\'re looking for:', ncaabGameIds);
      
      // Check for NBA/NCAAB gameId mismatches (both sides are already strings)
      if (nbaGameIds.length > 0 && uniqueNbaGameIds.length > 0) {
        const matchingNbaIds = nbaGameIds.filter(id => uniqueNbaGameIds.includes(id));
        const missingNbaIds = nbaGameIds.filter(id => !uniqueNbaGameIds.includes(id));
        console.log('🏀 NBA gameId matches:', matchingNbaIds.length, 'out of', nbaGameIds.length);
        if (missingNbaIds.length > 0) {
          console.log('⚠️ NBA gameIds with tails not in weekGames:', missingNbaIds);
          console.log('   Unique NBA IDs in DB:', uniqueNbaGameIds);
          console.log('   NBA IDs we have:', nbaGameIds);
        }
      }
      
      if (ncaabGameIds.length > 0 && uniqueNcaabGameIds.length > 0) {
        const matchingNcaabIds = ncaabGameIds.filter(id => uniqueNcaabGameIds.includes(id));
        const missingNcaabIds = ncaabGameIds.filter(id => !uniqueNcaabGameIds.includes(id));
        console.log('🏀 NCAAB gameId matches:', matchingNcaabIds.length, 'out of', ncaabGameIds.length);
        if (missingNcaabIds.length > 0) {
          console.log('⚠️ NCAAB gameIds with tails not in weekGames:', missingNcaabIds);
          console.log('   Unique NCAAB IDs in DB:', uniqueNcaabGameIds);
          console.log('   NCAAB IDs we have:', ncaabGameIds);
        }
      }
      console.log('');
      
      // Get tails for this week's games
      let tailsData: any[] = [];
      let tailsError: any = null;
      
      // First, get tails for games in our weekGames list
      if (gameIds.length > 0) {
        const { data: weekTailsData, error: weekTailsError } = await supabase
          .from('game_tails')
          .select(`
            game_unique_id,
            pick_type,
            team_selection,
            user_id,
            sport
          `)
          .in('game_unique_id', gameIds)
          .or(`sport.eq.nfl,sport.eq.cfb,sport.eq.nba,sport.eq.ncaab`);
        
        tailsData = weekTailsData || [];
        tailsError = weekTailsError;
      }
      
      // For NBA/NCAAB: Also fetch tails for games NOT in weekGames (they might be outside the week range)
      // This ensures we show all tailed basketball games
      const nbaTailGameIds = uniqueNbaGameIds.filter(id => !nbaGameIds.includes(id));
      const ncaabTailGameIds = uniqueNcaabGameIds.filter(id => !ncaabGameIds.includes(id));
      
      if (nbaTailGameIds.length > 0 || ncaabTailGameIds.length > 0) {
        console.log('🏀 Fetching additional NBA/NCAAB tails for games outside week range');
        console.log('   NBA gameIds to fetch:', nbaTailGameIds);
        console.log('   NCAAB gameIds to fetch:', ncaabTailGameIds);
        
        const additionalGameIds = [...nbaTailGameIds, ...ncaabTailGameIds];
        const { data: additionalTailsData, error: additionalTailsError } = await supabase
          .from('game_tails')
          .select(`
            game_unique_id,
            pick_type,
            team_selection,
            user_id,
            sport
          `)
          .in('game_unique_id', additionalGameIds)
          .or(`sport.eq.nba,sport.eq.ncaab`);
        
        if (additionalTailsData && additionalTailsData.length > 0) {
          console.log(`🏀 Found ${additionalTailsData.length} additional NBA/NCAAB tails`);
          tailsData = [...tailsData, ...additionalTailsData];
        }
        
        if (additionalTailsError) {
          console.error('Error fetching additional NBA/NCAAB tails:', additionalTailsError);
        }
      }

      console.log('Tails query result:', { 
        count: tailsData?.length || 0, 
        error: tailsError,
        nflTails: tailsData?.filter(t => t.sport === 'nfl').length || 0,
        cfbTails: tailsData?.filter(t => t.sport === 'cfb').length || 0,
        nbaTails: tailsData?.filter(t => t.sport === 'nba').length || 0,
        ncaabTails: tailsData?.filter(t => t.sport === 'ncaab').length || 0,
        sample: tailsData?.[0],
        allGameIds: gameIds,
        nflGameIds: nflGameIds,
        cfbGameIds: cfbGameIds,
        nbaGameIds: nbaGameIds,
        ncaabGameIds: ncaabGameIds
      });
      
      // Debug: Show which NBA/NCAAB gameIds from tailsData match our weekGames
      if (tailsData && tailsData.length > 0) {
        const nbaTailsFromQuery = tailsData.filter(t => t.sport === 'nba');
        const ncaabTailsFromQuery = tailsData.filter(t => t.sport === 'ncaab');
        if (nbaTailsFromQuery.length > 0) {
          const nbaTailGameIds = [...new Set(nbaTailsFromQuery.map(t => t.game_unique_id))];
          console.log('🏀 NBA tail gameIds from query:', nbaTailGameIds);
          console.log('🏀 Do they match our weekGames?', nbaTailGameIds.map(id => ({
            id,
            inWeekGames: nbaGameIds.includes(id),
            weekGame: weekGames.find(g => String(g.gameId) === id)
          })));
        }
        if (ncaabTailsFromQuery.length > 0) {
          const ncaabTailGameIds = [...new Set(ncaabTailsFromQuery.map(t => t.game_unique_id))];
          console.log('🏀 NCAAB tail gameIds from query:', ncaabTailGameIds);
          console.log('🏀 Do they match our weekGames?', ncaabTailGameIds.map(id => ({
            id,
            inWeekGames: ncaabGameIds.includes(id),
            weekGame: weekGames.find(g => String(g.gameId) === id)
          })));
        }
      }
      
      // Debug: Show which gameIds have tails
      if (tailsData && tailsData.length > 0) {
        const tailedGameIds = [...new Set(tailsData.map(t => t.game_unique_id))];
        const tailedNflIds = [...new Set(tailsData.filter(t => t.sport === 'nfl').map(t => t.game_unique_id))];
        const tailedCfbIds = [...new Set(tailsData.filter(t => t.sport === 'cfb').map(t => t.game_unique_id))];
        const tailedNbaIds = [...new Set(tailsData.filter(t => t.sport === 'nba').map(t => t.game_unique_id))];
        const tailedNcaabIds = [...new Set(tailsData.filter(t => t.sport === 'ncaab').map(t => t.game_unique_id))];
        
        console.log('Game IDs with tails:', {
          total: tailedGameIds.length,
          nfl: tailedNflIds,
          cfb: tailedCfbIds,
          nba: tailedNbaIds,
          ncaab: tailedNcaabIds
        });
        
        // Check for CFB gameIds that have tails but aren't in our weekGames
        const missingCfbIds = tailedCfbIds.filter(id => !cfbGameIds.includes(id));
        if (missingCfbIds.length > 0) {
          console.log('⚠️ CFB gameIds with tails not in weekGames:', missingCfbIds);
        }
      }

      // If we found some tails but not all CFB tails, try a broader query
      let finalTailsData = tailsData || [];
      
      if (tailsData && tailsData.length > 0) {
        console.log('✅ Found', tailsData.length, 'tails for week games');
        
        // Debug: Show CFB game IDs from weekGames vs tails
        const cfbGamesFromWeek = weekGames.filter(g => g.sport === 'cfb');
        const cfbTailGameIds = [...new Set(tailsData.filter(t => t.sport === 'cfb').map(t => t.game_unique_id))];
        
        console.log('🏈 CFB GAMEIDS COMPARISON:');
        console.log('CFB games in weekGames:', cfbGamesFromWeek.map(g => ({ 
          away: g.awayTeam, 
          home: g.homeTeam, 
          gameId: g.gameId,
          gameIdType: typeof g.gameId
        })));
        console.log('CFB game IDs with tails in database:', cfbTailGameIds);
        
        // Check which CFB tail gameIds are NOT in weekGames
        const weekGameIds = weekGames.map(g => String(g.gameId)); // Convert to strings for comparison
        const missingCfbGames = cfbTailGameIds.filter(id => !weekGameIds.includes(String(id)));
        if (missingCfbGames.length > 0) {
          console.log('⚠️ CFB games with tails NOT found in weekGames:', missingCfbGames);
          
          // Try to find these games by querying all CFB tails and matching them
          const { data: allCfbTails } = await supabase
            .from('game_tails')
            .select(`
              game_unique_id,
              pick_type,
              team_selection,
              user_id,
              sport
            `)
            .eq('sport', 'cfb')
            .in('game_unique_id', missingCfbGames);
          
          if (allCfbTails && allCfbTails.length > 0) {
            console.log(`✅ Found ${allCfbTails.length} additional CFB tails for missing gameIds`);
            // Merge with existing tails
            finalTailsData = [...(tailsData || []), ...allCfbTails];
          }
        }
        
        // Check if we're missing CFB tails
        const foundCfbTails = tailsData.filter(t => t.sport === 'cfb').length;
        const allCfbTailsCount = cfbTailsInDb.length;
        
        if (foundCfbTails < allCfbTailsCount) {
          console.log(`⚠️ Missing some CFB tails: found ${foundCfbTails}, expected up to ${allCfbTailsCount}`);
          console.log('This suggests gameId mismatch between CFB page and Today in Sports');
        }
      } else {
        console.log('❌ No tails found for week games');
        
        // If no matches found but tails exist, there's definitely a gameId mismatch
        if (allTails && allTails.length > 0) {
          console.log('⚠️ WARNING: Tails exist in database but none match our gameIds');
          console.log('This is a gameId format mismatch issue');
          
          // Try querying all CFB tails as fallback
          const { data: allCfbTails } = await supabase
            .from('game_tails')
            .select(`
              game_unique_id,
              pick_type,
              team_selection,
              user_id,
              sport
            `)
            .eq('sport', 'cfb');
          
          if (allCfbTails && allCfbTails.length > 0) {
            console.log(`✅ Found ${allCfbTails.length} CFB tails as fallback`);
            finalTailsData = allCfbTails;
          } else {
            return [];
          }
        } else {
          return [];
        }
      }

      // For NBA/NCAAB games with tails but not in weekGames, fetch their game details
      const missingNbaGameIds = nbaTailGameIds.filter(id => !weekGames.some(g => String(g.gameId) === id));
      const missingNcaabGameIds = ncaabTailGameIds.filter(id => !weekGames.some(g => String(g.gameId) === id));
      
      let additionalGames: GameSummary[] = [];
      
      // Fetch NBA game details for missing games
      if (missingNbaGameIds.length > 0) {
        console.log('🏀 Fetching NBA game details for', missingNbaGameIds.length, 'games with tails');
        try {
          // Query by training_key or unique_id (matching what's stored in game_tails)
          // Try training_key first, then unique_id
          const { data: nbaGamesByTrainingKey, error: nbaError1 } = await collegeFootballSupabase
            .from('nba_input_values_view')
            .select('*')
            .in('training_key', missingNbaGameIds);
          
          const { data: nbaGamesByUniqueId, error: nbaError2 } = await collegeFootballSupabase
            .from('nba_input_values_view')
            .select('*')
            .in('unique_id', missingNbaGameIds);
          
          // Combine results, deduplicate by game_id
          const nbaGamesMap = new Map();
          [...(nbaGamesByTrainingKey || []), ...(nbaGamesByUniqueId || [])].forEach(game => {
            if (!nbaGamesMap.has(game.game_id)) {
              nbaGamesMap.set(game.game_id, game);
            }
          });
          const nbaGamesData = Array.from(nbaGamesMap.values());
          const nbaGamesError = nbaError1 || nbaError2;
          
          if (!nbaGamesError && nbaGamesData) {
            for (const game of nbaGamesData) {
              // Use training_key || unique_id to match what GameTailSection receives
              const gameIdStr = game.training_key || game.unique_id || String(game.game_id);
              let gameTimeValue: string | undefined = undefined;
              if (game.tipoff_time_et) {
                if (game.tipoff_time_et.includes('T') && (game.tipoff_time_et.includes('+') || game.tipoff_time_et.includes('Z'))) {
                  gameTimeValue = game.tipoff_time_et;
                } else if (game.game_date) {
                  const timeStr = game.tipoff_time_et.includes(':') && game.tipoff_time_et.split(':').length === 2
                    ? `${game.tipoff_time_et}:00`
                    : game.tipoff_time_et;
                  gameTimeValue = `${game.game_date}T${timeStr}`;
                }
              }
              
              const homeML = game.home_moneyline;
              let awayML = null;
              if (homeML) {
                awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
              }
              
              additionalGames.push({
                gameId: gameIdStr, // Must match training_key || unique_id used in GameTailSection
                sport: 'nba',
                awayTeam: game.away_team,
                homeTeam: game.home_team,
                gameTime: gameTimeValue,
                awaySpread: game.home_spread ? -game.home_spread : null,
                homeSpread: game.home_spread,
                totalLine: game.total_line,
                awayMl: awayML,
                homeMl: homeML,
                nbaId: String(game.game_id), // Store NBA game_id for querying nba_predictions
              });
            }
            console.log(`🏀 Added ${additionalGames.length} NBA games with tails`);
          }
        } catch (error) {
          console.error('Error fetching NBA game details:', error);
        }
      }
      
      // Fetch NCAAB game details for missing games
      if (missingNcaabGameIds.length > 0) {
        console.log('🏀 Fetching NCAAB game details for', missingNcaabGameIds.length, 'games with tails');
        try {
          // Query by training_key or unique_id (matching what's stored in game_tails)
          // Try training_key first, then unique_id
          const { data: ncaabGamesByTrainingKey, error: ncaabError1 } = await collegeFootballSupabase
            .from('v_cbb_input_values')
            .select('*')
            .in('training_key', missingNcaabGameIds);
          
          const { data: ncaabGamesByUniqueId, error: ncaabError2 } = await collegeFootballSupabase
            .from('v_cbb_input_values')
            .select('*')
            .in('unique_id', missingNcaabGameIds);
          
          // Combine results, deduplicate by game_id
          const ncaabGamesMap = new Map();
          [...(ncaabGamesByTrainingKey || []), ...(ncaabGamesByUniqueId || [])].forEach(game => {
            if (!ncaabGamesMap.has(game.game_id)) {
              ncaabGamesMap.set(game.game_id, game);
            }
          });
          const ncaabGamesData = Array.from(ncaabGamesMap.values());
          const ncaabGamesError = ncaabError1 || ncaabError2;
          
          if (!ncaabGamesError && ncaabGamesData) {
            for (const game of ncaabGamesData) {
              // Use training_key || unique_id to match what GameTailSection receives
              const gameIdStr = game.training_key || game.unique_id || String(game.game_id);
              let gameTimeValue: string | undefined = undefined;
              if (game.start_utc) {
                gameTimeValue = game.start_utc;
              } else if (game.tipoff_time_et) {
                if (game.tipoff_time_et.includes('T') && (game.tipoff_time_et.includes('+') || game.tipoff_time_et.includes('Z'))) {
                  gameTimeValue = game.tipoff_time_et;
                } else if (game.game_date_et) {
                  gameTimeValue = `${game.game_date_et}T${game.tipoff_time_et}`;
                }
              }
              
              const vegasHomeSpread = game.spread || null;
              const vegasTotal = game.over_under || null;
              
              additionalGames.push({
                gameId: gameIdStr, // Must match training_key || unique_id used in GameTailSection
                sport: 'ncaab',
                awayTeam: game.away_team,
                homeTeam: game.home_team,
                gameTime: gameTimeValue,
                awaySpread: vegasHomeSpread !== null ? -vegasHomeSpread : null,
                homeSpread: vegasHomeSpread,
                totalLine: vegasTotal,
                awayMl: game.awayMoneyline || null,
                homeMl: game.homeMoneyline || null,
                ncaabId: String(game.game_id), // Store NCAAB game_id for querying ncaab_predictions
              });
            }
            console.log(`🏀 Added ${ncaabGamesData.length} NCAAB games with tails`);
          }
        } catch (error) {
          console.error('Error fetching NCAAB game details:', error);
        }
      }
      
      // Merge additional games with weekGames for matching
      const allGamesForMatching = [...weekGames, ...additionalGames];
      
      // Group by game (use finalTailsData which includes any fallback queries)
      const gameGroups = finalTailsData.reduce((acc, tail) => {
        if (!acc[tail.game_unique_id]) {
          acc[tail.game_unique_id] = [];
        }
        acc[tail.game_unique_id].push(tail);
        return acc;
      }, {} as Record<string, any[]>);

      // Get user data (use finalTailsData)
      const userIds = [...new Set(finalTailsData.map(t => t.user_id))];
      
      let userMap = new Map<string, string | undefined>();
      
      if (userIds.length > 0) {
        // Fetch display names from profiles table
        const { data: usersData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        if (profilesError) {
          debug.error('Error fetching user profiles for tailed games:', profilesError);
          // Continue with empty map - avatars will use user_id fallback
        } else {
          userMap = new Map(usersData?.map(u => [u.user_id, u.display_name]) || []);
        }
      }

      // Process ALL games with tails (sorted by tail count, then by time)
      console.log('Game groups:', Object.keys(gameGroups));
      console.log('Game group counts:', Object.entries(gameGroups).map(([id, tails]) => ({ 
        id, 
        count: (tails as any[]).length,
        sport: (tails as any[])[0]?.sport 
      })));
      
      const gamesWithTails = Object.entries(gameGroups)
        .map(([gameId, tails]): [string, any[]] => [gameId, tails as any[]])
        .sort(([, a], [, b]) => {
          // First sort by tail count (descending)
          if (b.length !== a.length) {
            return b.length - a.length;
          }
          // Then sort by game time
          const gameA = allGamesForMatching.find(g => String(g.gameId) === String(a[0]?.game_unique_id));
          const gameB = allGamesForMatching.find(g => String(g.gameId) === String(b[0]?.game_unique_id));
          const timeA = gameA?.gameTime || '';
          const timeB = gameB?.gameTime || '';
          return timeA.localeCompare(timeB);
        })
        // Don't limit here - return all games, UI will handle showing 5 vs all
        .map(([gameId, tails]) => {
          // Try multiple matching strategies for gameId (ensure both sides are strings)
          const gameIdStr = String(gameId);
          let game = allGamesForMatching.find(g => String(g.gameId) === gameIdStr);
          
          // If not found, try direct comparison (in case gameId is already a string)
          if (!game) {
            game = allGamesForMatching.find(g => g.gameId === gameId);
          }
          
          // If still not found, try case-insensitive string comparison
          if (!game) {
            game = allGamesForMatching.find(g => String(g.gameId).toLowerCase() === gameIdStr.toLowerCase());
          }
          
          if (!game) {
            console.log(`⚠️ Could not find game for gameId: ${gameId} (sport: ${tails[0]?.sport})`);
            console.log(`   Available gameIds:`, allGamesForMatching.map(g => ({ 
              id: g.gameId, 
              type: typeof g.gameId, 
              sport: g.sport,
              teams: `${g.awayTeam} @ ${g.homeTeam}`
            })));
            
            // For CFB/NBA/NCAAB games, log the mismatch for debugging
            if ((tails[0]?.sport === 'cfb' || tails[0]?.sport === 'nba' || tails[0]?.sport === 'ncaab') && tails.length > 0) {
              console.log(`   ⚠️ ${tails[0]?.sport.toUpperCase()} gameId mismatch: ${gameId} (sport: ${tails[0]?.sport})`);
              console.log(`   This suggests the gameId format doesn't match what's stored in game_tails`);
            }
            return null;
          }

          console.log(`✅ Processing game: ${game.awayTeam} @ ${game.homeTeam} (${game.sport}) with ${tails.length} tails`);

          // Group tails by pick type and team selection (same as GameTailSection)
          const pickGroups = tails.reduce((acc, tail) => {
            const key = `${tail.team_selection}_${tail.pick_type}`;
            if (!acc[key]) {
              acc[key] = {
                pickType: tail.pick_type,
                teamSelection: tail.team_selection,
                count: 0,
                users: [],
              };
            }
            acc[key].count++;
            acc[key].users.push({
              user_id: tail.user_id,
              display_name: userMap.get(tail.user_id),
              email: undefined, // Email not available via REST API, but included for consistency
            });
            return acc;
          }, {} as Record<string, any>);

          console.log(`   Pick groups:`, Object.keys(pickGroups));

          return {
            ...game,
            tails: Object.values(pickGroups),
            tailCount: tails.length,
          } as TopTailedGame;
        })
        .filter(Boolean) as TopTailedGame[];
      
      // Log final results by sport
      const nflGames = gamesWithTails.filter(g => g.sport === 'nfl');
      const cfbGames = gamesWithTails.filter(g => g.sport === 'cfb');
      const nbaGames = gamesWithTails.filter(g => g.sport === 'nba');
      const ncaabGames = gamesWithTails.filter(g => g.sport === 'ncaab');
      console.log(`Final results: ${nflGames.length} NFL games, ${cfbGames.length} CFB games, ${nbaGames.length} NBA games, ${ncaabGames.length} NCAAB games`);
      
      // Log detailed breakdown for basketball games
      if (nbaGames.length > 0) {
        console.log('🏀 NBA games with tails:', nbaGames.map(g => ({
          gameId: g.gameId,
          teams: `${g.awayTeam} @ ${g.homeTeam}`,
          tailCount: g.tailCount
        })));
      }
      if (ncaabGames.length > 0) {
        console.log('🏀 NCAAB games with tails:', ncaabGames.map(g => ({
          gameId: g.gameId,
          teams: `${g.awayTeam} @ ${g.homeTeam}`,
          tailCount: g.tailCount
        })));
      }

      console.log(`🎉 Returning ${gamesWithTails.length} games with tails`);
      console.log('========================================');
      
      return gamesWithTails;
    },
    enabled: showWebsiteTailingFeatures && !isFreemiumUser && !!weekGames,
  });

  return (
    <div className="w-full">
      {/* Dither Background with Header Inside */}
      <div className="relative mb-6 rounded-lg overflow-hidden -mx-4 md:mx-0 md:rounded-lg">
        {/* Dither Background */}
        <div className="absolute inset-0">
          <Dither />
        </div>
        
        {/* Glassmorphic Header Overlay */}
        <div className="relative z-10 p-4 md:p-6">
          <div
            className="border border-gray-300 dark:border-white/20 rounded-xl shadow-2xl"
            style={{
              background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: isDark ? '0 8px 32px 0 rgba(31, 38, 135, 0.5)' : '0 8px 32px 0 rgba(0, 0, 0, 0.1)'
            }}
          >
            <TodayInSportsCompletionHeader />
          </div>
        </div>
      </div>

      {/* Freemium Paywall */}
      {isFreemiumUser ? (
        <Card className="mb-6 -mx-4 md:mx-0 p-8 text-center border-gray-300 dark:border-white/20" style={{
          background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        }}>
          <Lock className="h-12 w-12 mx-auto mb-4 text-gray-600 dark:text-gray-400" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Premium Feature</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upgrade to access today's games, value alerts, and model predictions.
          </p>
          <FreemiumUpgradeBanner totalGames={weekGames?.length || 0} visibleGames={0} />
        </Card>
      ) : (
        <>
          {/* Today's Games Section */}
          <Card className="mb-6 -mx-4 md:mx-0 border-gray-300 dark:border-white/20 rounded-lg" style={{
            background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}>
            <CardHeader className="px-4 md:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Target className="h-5 w-5" />
                    Today's Games
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-white/70">
                    Games happening today across NFL, College Football, NBA, and College Basketball
                  </CardDescription>
                </div>
                <SportFilterButtons 
                  currentFilter={todayGamesFilter} 
                  onFilterChange={setTodayGamesFilter} 
                />
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              {weekGamesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-40" />
                  ))}
                </div>
              ) : (() => {
                const filteredGames = filterBySport(todayGames || [], todayGamesFilter);
                return filteredGames.length > 0 ? (
                  <GamesMarquee games={filteredGames} />
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                    {todayGamesFilter === 'all' 
                      ? 'No games scheduled for today' 
                      : `No ${todayGamesFilter.toUpperCase()} games scheduled for today`}
                  </p>
                );
              })()}
            </CardContent>
          </Card>

          {/* Value Summary Section */}
          <Card className="mb-6 -mx-4 md:mx-0 border-gray-300 dark:border-white/20 rounded-lg" style={{
            background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}>
            <CardHeader className="px-4 md:px-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <TrendingUp className="h-5 w-5" />
                      Value Summary
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-white/70">
                      Polymarket alerts and high-confidence model predictions for remaining games this week
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshValueSummary}
                    disabled={isRefreshingValueSummary}
                    className="text-gray-900 dark:text-white border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshingValueSummary ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </Button>
                </div>
                <SportFilterButtons 
                  currentFilter={valueAlertsFilter} 
                  onFilterChange={setValueAlertsFilter} 
                />
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6 space-y-6">
              {/* Polymarket Value Alerts */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Polymarket Value Alerts</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Markets where Polymarket odds show &gt;57% on spread/total (line mismatch) or ≥85% on moneyline (strong consensus) for remaining games this week
                </p>
                {valueAlertsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : (() => {
                  const filteredAlerts = filterBySport(valueAlerts || [], valueAlertsFilter);
                  return filteredAlerts.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[...filteredAlerts]
                          .sort((a, b) => b.percentage - a.percentage)
                          .slice(0, showAllValueAlerts ? filteredAlerts.length : 6)
                          .map((alert, idx) => (
                        <div
                          key={`${alert.gameId}-${alert.marketType}-${alert.side}-${idx}`}
                          className="p-4 rounded-lg bg-green-500/10 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/20 hover:border-green-500/50 dark:hover:border-green-500/40 transition-all cursor-pointer"
                          onClick={() => navigateToSport(alert.sport)}
                        >
                          {/* Pills Row */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {/* Sport Pill */}
                            <Badge className={`${getSportColorClasses(alert.sport)} flex items-center gap-1.5`}>
                              {(() => {
                                const SportIcon = getSportIcon(alert.sport);
                                return <SportIcon className="h-3 w-3" />;
                              })()}
                              <span className="text-xs font-medium">{alert.sport.toUpperCase()}</span>
                            </Badge>

                            {/* Game Time Pill */}
                            {alert.gameTime && formatGameTime(alert.gameTime) && (
                              <Badge variant="secondary" className="bg-gray-200/50 dark:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span className="text-xs font-medium">{formatGameTime(alert.gameTime)}</span>
                              </Badge>
                            )}

                            {/* Pick Type Pill */}
                            {(() => {
                              const PickTypeIcon = getPickTypeIcon(alert.marketType);
                              return (
                                <Badge className={`${getPickTypeColorClasses(alert.marketType)} flex items-center gap-1.5`}>
                                  <PickTypeIcon className="h-3 w-3" />
                                  <span className="text-xs font-medium">{alert.marketType}</span>
                                </Badge>
                              );
                            })()}

                            {/* Value Pill */}
                            <Badge className="bg-green-500 text-white flex items-center gap-1.5">
                              <Percent className="h-3 w-3" />
                              <span className="text-xs font-semibold">{alert.percentage.toFixed(0)}%</span>
                            </Badge>
                          </div>

                          {/* Lines Row */}
                          {(alert.homeSpread !== undefined || alert.totalLine !== undefined || alert.homeMl !== undefined) && (
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {alert.homeSpread !== undefined && (
                                <Badge variant="secondary" className="bg-gray-200/30 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs">
                                  Spread: {formatSpread(alert.homeSpread)}
                                </Badge>
                              )}
                              {alert.totalLine !== undefined && (
                                <Badge variant="secondary" className="bg-gray-200/30 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs">
                                  O/U: {alert.totalLine}
                                </Badge>
                              )}
                              {(alert.awayMl !== undefined || alert.homeMl !== undefined) && (
                                <Badge variant="secondary" className="bg-gray-200/30 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs">
                                  ML: {formatMoneyline(alert.awayMl)}/{formatMoneyline(alert.homeMl)}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Game Info */}
                          <div className="mb-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1 break-words">
                              {alert.awayTeam} @ {alert.homeTeam}
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                              <span className="font-medium">{alert.side}</span>
                              {alert.marketType === 'Moneyline'
                                ? ` - Strong ${alert.percentage.toFixed(0)}% consensus`
                                : ` - ${alert.percentage.toFixed(0)}% suggests line hasn't adjusted to market`
                              }
                            </p>
                          </div>
                        </div>
                      ))}
                      </div>
                      {filteredAlerts.length > 6 && (
                        <div className="flex justify-center mt-4">
                          <Button
                            variant="outline"
                            onClick={() => setShowAllValueAlerts(!showAllValueAlerts)}
                            className="text-gray-900 dark:text-white border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                          >
                            {showAllValueAlerts ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Show More ({filteredAlerts.length - 6} more)
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 text-sm text-center py-4">
                      {valueAlertsFilter === 'all' 
                        ? 'No value alerts detected for remaining games this week'
                        : `No ${valueAlertsFilter.toUpperCase()} value alerts detected for remaining games this week`}
                    </p>
                  );
                })()}
              </div>

              {/* Model Prediction Fade Alerts */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Model Prediction Fade Alerts</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      High-confidence model predictions (≥80% NFL, &gt;10 point edge CFB, &gt;3 point edge NBA, &gt;5 point edge NCAAB) suggesting strong edges against the spread or total for remaining games this week
                    </p>
                  </div>
                  <SportFilterButtons 
                    currentFilter={fadeAlertsFilter} 
                    onFilterChange={setFadeAlertsFilter} 
                  />
                </div>
                {fadeAlertsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : (() => {
                  const filteredFadeAlerts = filterBySport(fadeAlerts || [], fadeAlertsFilter);
                  return filteredFadeAlerts.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[...filteredFadeAlerts]
                          .sort((a, b) => b.confidence - a.confidence)
                          .slice(0, showAllFadeAlerts ? filteredFadeAlerts.length : 6)
                          .map((alert, idx) => (
                        <div
                          key={`${alert.gameId}-${alert.pickType}-${alert.predictedTeam}-${idx}`}
                          className="p-4 rounded-lg bg-purple-500/10 dark:bg-purple-500/10 border border-purple-500/30 dark:border-purple-500/20 hover:border-purple-500/50 dark:hover:border-purple-500/40 transition-all cursor-pointer"
                          onClick={() => navigateToSport(alert.sport)}
                        >
                          {/* Pills Row */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {/* Sport Pill */}
                            <Badge className={`${getSportColorClasses(alert.sport)} flex items-center gap-1.5`}>
                              {(() => {
                                const SportIcon = getSportIcon(alert.sport);
                                return <SportIcon className="h-3 w-3" />;
                              })()}
                              <span className="text-xs font-medium">{alert.sport.toUpperCase()}</span>
                            </Badge>

                            {/* Game Time Pill */}
                            {alert.gameTime && formatGameTime(alert.gameTime) && (
                              <Badge variant="secondary" className="bg-gray-200/50 dark:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span className="text-xs font-medium">{formatGameTime(alert.gameTime)}</span>
                              </Badge>
                            )}

                            {/* Pick Type Pill */}
                            {(() => {
                              const PickTypeIcon = getPickTypeIcon(alert.pickType);
                              return (
                                <Badge className={`${getPickTypeColorClasses(alert.pickType)} flex items-center gap-1.5`}>
                                  <PickTypeIcon className="h-3 w-3" />
                                  <span className="text-xs font-medium">{alert.pickType}</span>
                                </Badge>
                              );
                            })()}

                            {/* Confidence/Edge Pill */}
                            <Badge className="bg-purple-500 text-white flex items-center gap-1.5">
                              <Percent className="h-3 w-3" />
                              <span className="text-xs font-semibold">
                                {alert.sport === 'nfl' ? `${alert.confidence}%` : `${alert.confidence}pt`}
                              </span>
                            </Badge>
                          </div>

                          {/* Lines Row */}
                          {(alert.homeSpread !== undefined || alert.totalLine !== undefined || alert.homeMl !== undefined) && (
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {alert.homeSpread !== undefined && (
                                <Badge variant="secondary" className="bg-gray-200/30 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs">
                                  Spread: {formatSpread(alert.homeSpread)}
                                </Badge>
                              )}
                              {alert.totalLine !== undefined && (
                                <Badge variant="secondary" className="bg-gray-200/30 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs">
                                  O/U: {alert.totalLine}
                                </Badge>
                              )}
                              {(alert.awayMl !== undefined || alert.homeMl !== undefined) && (
                                <Badge variant="secondary" className="bg-gray-200/30 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs">
                                  ML: {formatMoneyline(alert.awayMl)}/{formatMoneyline(alert.homeMl)}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Game Info */}
                          <div className="mb-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1 break-words">
                              {alert.awayTeam} @ {alert.homeTeam}
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                              <span className="font-medium">{alert.predictedTeam}</span>
                              {alert.sport === 'nfl'
                                ? ` - Model has ${alert.confidence}% confidence (strong edge indicator)`
                                : ` - Model shows ${alert.confidence} point edge (strong edge indicator)`
                              }
                            </p>
                          </div>
                        </div>
                      ))}
                      </div>
                      {filteredFadeAlerts.length > 6 && (
                        <div className="flex justify-center mt-4">
                          <Button
                            variant="outline"
                            onClick={() => setShowAllFadeAlerts(!showAllFadeAlerts)}
                            className="text-gray-900 dark:text-white border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                          >
                            {showAllFadeAlerts ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Show More ({filteredFadeAlerts.length - 6} more)
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 text-sm text-center py-4">
                      {fadeAlertsFilter === 'all' 
                        ? 'No high-confidence predictions for remaining games this week'
                        : `No ${fadeAlertsFilter.toUpperCase()} high-confidence predictions for remaining games this week`}
                    </p>
                  );
                })()}
              </div>

              {/* NBA Betting Trends Outliers */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">NBA Betting Trends Outliers</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Highest ATS and O/U trend widgets at {BETTING_TRENDS_THRESHOLD}%+ win rates.
                    </p>
                  </div>
                </div>
                {nbaTrendOutliersLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={`nba-outlier-skeleton-${i}`} className="h-28" />
                    ))}
                  </div>
                ) : nbaTrendOutliers.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {topNbaTrendOutliers.map((outlier, idx) => (
                        <div
                          key={`nba-trend-outlier-${outlier.gameId}-${idx}`}
                          className="p-4 rounded-lg bg-sky-500/10 dark:bg-sky-500/10 border border-sky-500/30 dark:border-sky-500/20 hover:border-sky-500/50 dark:hover:border-sky-500/40 transition-all cursor-pointer"
                          onClick={() => navigate(`/nba/todays-betting-trends?focusGameId=${outlier.gameId}`)}
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={`${getSportColorClasses('nba')} flex items-center gap-1.5`}>
                              <Dribbble className="h-3 w-3" />
                              <span className="text-xs font-medium">NBA</span>
                            </Badge>

                            {outlier.gameTime && formatGameTime(outlier.gameTime) && (
                              <Badge variant="secondary" className="bg-gray-200/50 dark:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span className="text-xs font-medium">{formatGameTime(outlier.gameTime)}</span>
                              </Badge>
                            )}

                            <Badge className={`${getPickTypeColorClasses(outlier.candidate.marketType)} flex items-center gap-1.5`}>
                              <span className="text-xs font-medium">{outlier.candidate.marketType}</span>
                            </Badge>

                            <Badge className="bg-sky-600 text-white flex items-center gap-1.5">
                              <Percent className="h-3 w-3" />
                              <span className="text-xs font-semibold">{outlier.candidate.percentage.toFixed(0)}%</span>
                            </Badge>
                          </div>

                          <div className="mb-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1 break-words">
                              {outlier.awayTeam} @ {outlier.homeTeam}
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                              <span className="font-medium">{outlier.candidate.teamName}</span>{' '}
                              {outlier.candidate.marketType} {outlier.candidate.percentage.toFixed(0)}% ({outlier.candidate.record})
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              Situation: {outlier.candidate.situationLabel}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {nbaTrendOutliers.length > 6 && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="outline"
                          onClick={() => setShowAllNbaTrendOutliers(!showAllNbaTrendOutliers)}
                          className="text-gray-900 dark:text-white border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                          {showAllNbaTrendOutliers ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-2" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-2" />
                              Show More ({nbaTrendOutliers.length - 6} more)
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-sm text-center py-4">
                    No NBA ATS/O-U trend outliers at {BETTING_TRENDS_THRESHOLD}%+ right now.
                  </p>
                )}
              </div>

              {/* NCAAB Betting Trends Outliers */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">NCAAB Betting Trends Outliers</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Highest ATS and O/U trend widgets at {BETTING_TRENDS_THRESHOLD}%+ win rates.
                    </p>
                  </div>
                </div>
                {ncaabTrendOutliersLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={`ncaab-outlier-skeleton-${i}`} className="h-28" />
                    ))}
                  </div>
                ) : ncaabTrendOutliers.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {topNcaabTrendOutliers.map((outlier, idx) => (
                        <div
                          key={`ncaab-trend-outlier-${outlier.gameId}-${idx}`}
                          className="p-4 rounded-lg bg-sky-500/10 dark:bg-sky-500/10 border border-sky-500/30 dark:border-sky-500/20 hover:border-sky-500/50 dark:hover:border-sky-500/40 transition-all cursor-pointer"
                          onClick={() => navigate(`/ncaab/todays-betting-trends?focusGameId=${outlier.gameId}`)}
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={`${getSportColorClasses('ncaab')} flex items-center gap-1.5`}>
                              <Dribbble className="h-3 w-3" />
                              <span className="text-xs font-medium">NCAAB</span>
                            </Badge>

                            {outlier.gameTime && formatGameTime(outlier.gameTime) && (
                              <Badge variant="secondary" className="bg-gray-200/50 dark:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span className="text-xs font-medium">{formatGameTime(outlier.gameTime)}</span>
                              </Badge>
                            )}

                            <Badge className={`${getPickTypeColorClasses(outlier.candidate.marketType)} flex items-center gap-1.5`}>
                              <span className="text-xs font-medium">{outlier.candidate.marketType}</span>
                            </Badge>

                            <Badge className="bg-sky-600 text-white flex items-center gap-1.5">
                              <Percent className="h-3 w-3" />
                              <span className="text-xs font-semibold">{outlier.candidate.percentage.toFixed(0)}%</span>
                            </Badge>
                          </div>

                          <div className="mb-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1 break-words">
                              {outlier.awayTeam} @ {outlier.homeTeam}
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                              <span className="font-medium">{outlier.candidate.teamName}</span>{' '}
                              {outlier.candidate.marketType} {outlier.candidate.percentage.toFixed(0)}% ({outlier.candidate.record})
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              Situation: {outlier.candidate.situationLabel}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {ncaabTrendOutliers.length > 6 && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="outline"
                          onClick={() => setShowAllNcaabTrendOutliers(!showAllNcaabTrendOutliers)}
                          className="text-gray-900 dark:text-white border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                          {showAllNcaabTrendOutliers ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-2" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-2" />
                              Show More ({ncaabTrendOutliers.length - 6} more)
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-sm text-center py-4">
                    No NCAAB ATS/O-U trend outliers at {BETTING_TRENDS_THRESHOLD}%+ right now.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {showWebsiteTailingFeatures && (
            <Card className="mb-6 -mx-4 md:mx-0 border-gray-300 dark:border-white/20 rounded-lg" style={{
              background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
            }}>
              <CardHeader className="px-4 md:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <Flame className="h-5 w-5 text-orange-500" />
                      High Tailing It
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-white/70">
                      Most tailed games this week
                    </CardDescription>
                  </div>
                  <SportFilterButtons
                    currentFilter={tailedGamesFilter}
                    onFilterChange={setTailedGamesFilter}
                  />
                </div>
              </CardHeader>
              <CardContent className="px-4 md:px-6">
                {allTailedLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : (() => {
                  const filteredTailedGames = filterBySport(allTailedGames || [], tailedGamesFilter);
                  return filteredTailedGames.length > 0 ? (
                    <>
                      <div className="space-y-4">
                        {filteredTailedGames
                          .slice(0, showAllTailedGames ? filteredTailedGames.length : 5)
                          .map((game, idx) => {
                      // Helper to normalize pick type for color function
                      const normalizePickType = (pickType: string) => {
                        if (pickType === 'moneyline') return 'Moneyline';
                        if (pickType === 'spread') return 'Spread';
                        if (pickType === 'over_under') return 'Total';
                        return pickType;
                      };

                      return (
                        <div
                          key={game.gameId}
                          className="p-4 rounded-lg bg-orange-500/10 dark:bg-orange-500/10 border border-orange-500/30 dark:border-orange-500/20"
                        >
                          {/* Pills Row */}
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            {/* Sport Pill */}
                            <Badge className={`${getSportColorClasses(game.sport)} flex items-center gap-1.5`}>
                              {(() => {
                                const SportIcon = getSportIcon(game.sport);
                                return <SportIcon className="h-3 w-3" />;
                              })()}
                              <span className="text-xs font-medium">{game.sport.toUpperCase()}</span>
                            </Badge>

                            {/* Tail Count Pill */}
                            <Badge className="bg-orange-500 text-white flex items-center gap-1.5">
                              <Users className="h-3 w-3" />
                              <span className="text-xs font-semibold">{game.tailCount || 0} tails</span>
                            </Badge>
                          </div>

                          {/* Game Info with Team Circles and Tails in Row */}
                          <div className="mb-3">
                            <div className="flex items-center gap-4">
                              {/* Team Matchup - Subcontainer with Neutral Background - Fixed Width */}
                              <div className="flex flex-col gap-2 flex-shrink-0 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 w-[120px] sm:w-[140px]">
                                {/* Away Team Circle */}
                                {(() => {
                                  const awayColors = getTeamColors(game.awayTeam, game.sport);
                                  const awayInitials = getTeamInitials(game.awayTeam, game.sport);
                                  const awayTextColor = getTeamCircleTextColor(awayColors.primary, awayColors.secondary);

                                  return (
                                    <div className="flex flex-col items-center">
                                      <div
                                        className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-105 mb-1"
                                        style={{
                                          background: `linear-gradient(135deg, ${awayColors.primary} 0%, ${awayColors.secondary} 100%)`,
                                          color: awayTextColor,
                                          border: `2px solid ${awayColors.primary}`,
                                        }}
                                      >
                                        <span className="text-xs sm:text-sm font-bold">
                                          {awayInitials}
                                        </span>
                                      </div>
                                      <span className="text-xs font-semibold text-gray-900 dark:text-white break-words text-center w-full line-clamp-2">
                                        {game.awayTeam}
                                      </span>
                                    </div>
                                  );
                                })()}

                                {/* @ Symbol */}
                                <div className="flex flex-col items-center">
                                  <div className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center flex-shrink-0 mb-1">
                                    <span className="text-lg sm:text-xl font-bold text-gray-400 dark:text-gray-500">@</span>
                                  </div>
                                </div>

                                {/* Home Team Circle */}
                                {(() => {
                                  const homeColors = getTeamColors(game.homeTeam, game.sport);
                                  const homeInitials = getTeamInitials(game.homeTeam, game.sport);
                                  const homeTextColor = getTeamCircleTextColor(homeColors.primary, homeColors.secondary);

                                  return (
                                    <div className="flex flex-col items-center">
                                      <div
                                        className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-105 mb-1"
                                        style={{
                                          background: `linear-gradient(135deg, ${homeColors.primary} 0%, ${homeColors.secondary} 100%)`,
                                          color: homeTextColor,
                                          border: `2px solid ${homeColors.primary}`,
                                        }}
                                      >
                                        <span className="text-xs sm:text-sm font-bold">
                                          {homeInitials}
                                        </span>
                                      </div>
                                      <span className="text-xs font-semibold text-gray-900 dark:text-white break-words text-center w-full line-clamp-2">
                                        {game.homeTeam}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Tailed Picks Breakdown - To the right */}
                              <div className="flex-1 space-y-2 min-w-0">
                            {game.tails.map((tail, tidx) => {
                              // Format pick type label (same as GameTailSection)
                              const pickTypeLabels = {
                                moneyline: 'ML',
                                spread: 'Spread',
                                over_under: 'O/U',
                              };
                              const pickTypeLabel = pickTypeLabels[tail.pickType as keyof typeof pickTypeLabels] || tail.pickType;

                              // Format team/side label (same as GameTailSection)
                              const getDisplayLabel = (teamSelection: 'home' | 'away', pickType: string) => {
                                if (pickType === 'over_under') {
                                  return teamSelection === 'home' ? 'Over' : 'Under';
                                }
                                return teamSelection === 'home' ? game.homeTeam : game.awayTeam;
                              };
                              const sideLabel = getDisplayLabel(tail.teamSelection as 'home' | 'away', tail.pickType);

                              // Get normalized pick type for color
                              const normalizedPickType = normalizePickType(tail.pickType);
                              const PickTypeIcon = getPickTypeIcon(normalizedPickType);

                              return (
                                <div key={tidx} className="flex items-center gap-2 text-xs flex-wrap">
                                  <Badge className={`${getPickTypeColorClasses(normalizedPickType)} flex items-center gap-1.5 shrink-0`}>
                                    <PickTypeIcon className="h-3 w-3" />
                                    <span className="text-xs font-medium">
                                      {sideLabel} {tail.pickType !== 'over_under' && pickTypeLabel}
                                    </span>
                                  </Badge>
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <TailingAvatarList users={tail.users} size="sm" maxVisible={5} />
                                  </div>
                                </div>
                              );
                            })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                      </div>
                      {filteredTailedGames.length > 5 && (
                        <div className="flex justify-center mt-4">
                          <Button
                            variant="outline"
                            onClick={() => setShowAllTailedGames(!showAllTailedGames)}
                            className="text-gray-900 dark:text-white border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                          >
                            {showAllTailedGames ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                View All ({filteredTailedGames.length - 5} more)
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                      {tailedGamesFilter === 'all'
                        ? 'No tailed games yet this week'
                        : `No ${tailedGamesFilter.toUpperCase()} tailed games yet this week`}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
