import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, Shield, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

interface TodayGameSummaryCardProps {
  gameId: string;
  sport: 'nfl' | 'cfb';
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
}

export function TodayGameSummaryCard({
  gameId,
  sport,
  awayTeam,
  homeTeam,
  awayLogo,
  homeLogo,
  gameTime,
  awaySpread,
  homeSpread,
  totalLine,
  tailCount = 0,
}: TodayGameSummaryCardProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Helper function to get sport icon
  const getSportIcon = (sport: 'nfl' | 'cfb') => {
    return sport === 'nfl' ? Shield : Trophy;
  };

  // Helper function to get sport color classes (matching TodayInSports.tsx)
  const getSportColorClasses = (sport: 'nfl' | 'cfb') => {
    if (sport === 'nfl') {
      return 'bg-blue-500/20 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40 dark:border-blue-500/30';
    }
    return 'bg-orange-500/20 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/40 dark:border-orange-500/30';
  };

  const handleClick = () => {
    // Navigate to appropriate sport page with game in view
    if (sport === 'nfl') {
      navigate('/nfl');
    } else {
      navigate('/college-football');
    }
  };

  const formatSpread = (spread?: number) => {
    if (spread === undefined || spread === null) return '-';
    return spread > 0 ? `+${spread}` : spread.toString();
  };

  const formatDate = (dateTimeString?: string): string => {
    if (!dateTimeString) return '';
    
    try {
      const date = new Date(dateTimeString);
      
      // Get weekday name (Monday, Tuesday, etc.)
      const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Get abbreviated month (Nov, Dec, etc.)
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      
      // Get day with ordinal suffix (12th, 3rd, etc.)
      const day = date.getDate();
      const getOrdinalSuffix = (n: number): string => {
        const j = n % 10;
        const k = n % 100;
        if (j === 1 && k !== 11) return 'st';
        if (j === 2 && k !== 12) return 'nd';
        if (j === 3 && k !== 13) return 'rd';
        return 'th';
      };
      
      return `${weekday}, ${month} ${day}${getOrdinalSuffix(day)}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateTimeString;
    }
  };

  return (
    <Card 
      className="p-4 hover:shadow-lg transition-all cursor-pointer border-gray-300 dark:border-white/20"
      style={{
        background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      }}
      onClick={handleClick}
    >
      {/* Sport Badge */}
      <div className="flex items-center justify-between mb-3">
        <Badge className={`${getSportColorClasses(sport)} flex items-center gap-1.5 text-xs`}>
          {(() => {
            const SportIcon = getSportIcon(sport);
            return <SportIcon className="h-3 w-3" />;
          })()}
          <span className="font-medium">{sport.toUpperCase()}</span>
        </Badge>
        {tailCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Users className="h-3 w-3" />
            <span>{tailCount} tailing</span>
          </div>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2 mb-3">
        {/* Away Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {awayLogo && (
              <img 
                src={awayLogo} 
                alt={awayTeam} 
                className="h-6 w-6 object-contain"
              />
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {awayTeam}
            </span>
          </div>
          {awaySpread !== undefined && (
            <span className="text-xs text-gray-700 dark:text-gray-400">
              {formatSpread(awaySpread)}
            </span>
          )}
        </div>

        {/* Home Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {homeLogo && (
              <img 
                src={homeLogo} 
                alt={homeTeam} 
                className="h-6 w-6 object-contain"
              />
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {homeTeam}
            </span>
          </div>
          {homeSpread !== undefined && (
            <span className="text-xs text-gray-700 dark:text-gray-400">
              {formatSpread(homeSpread)}
            </span>
          )}
        </div>
      </div>

      {/* Game Info */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-300 dark:border-gray-700">
        {gameTime && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDate(gameTime)}</span>
          </div>
        )}
        {totalLine !== undefined && (
          <span>O/U {totalLine}</span>
        )}
      </div>
    </Card>
  );
}

