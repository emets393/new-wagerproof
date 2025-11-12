import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  return (
    <Card 
      className="p-4 hover:shadow-lg transition-all cursor-pointer border-white/20"
      style={{
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      }}
      onClick={handleClick}
    >
      {/* Sport Badge */}
      <div className="flex items-center justify-between mb-3">
        <Badge variant="outline" className="text-xs">
          {sport.toUpperCase()}
        </Badge>
        {tailCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
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
            <span className="text-sm font-semibold text-white">
              {awayTeam}
            </span>
          </div>
          {awaySpread !== undefined && (
            <span className="text-xs text-gray-400">
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
            <span className="text-sm font-semibold text-white">
              {homeTeam}
            </span>
          </div>
          {homeSpread !== undefined && (
            <span className="text-xs text-gray-400">
              {formatSpread(homeSpread)}
            </span>
          )}
        </div>
      </div>

      {/* Game Info */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-700">
        {gameTime && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{gameTime}</span>
          </div>
        )}
        {totalLine !== undefined && (
          <span>O/U {totalLine}</span>
        )}
      </div>
    </Card>
  );
}

