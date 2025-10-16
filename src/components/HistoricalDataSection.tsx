import React, { useState } from 'react';
import { History, TrendingUp } from 'lucide-react';
import GlassIcon from '@/components/magicui/glass-icon';

interface HistoricalDataSectionProps {
  prediction: {
    unique_id: string;
    training_key: string;
    home_team: string;
    away_team: string;
  };
  awayTeamColors: { primary: string; secondary: string };
  homeTeamColors: { primary: string; secondary: string };
  onH2HClick: (homeTeam: string, awayTeam: string) => void;
  onLinesClick: (trainingKey: string, homeTeam: string, awayTeam: string) => void;
}

export default function HistoricalDataSection({
  prediction,
  awayTeamColors,
  homeTeamColors,
  onH2HClick,
  onLinesClick
}: HistoricalDataSectionProps) {
  // Local hover states for this specific card
  const [hoveredH2H, setHoveredH2H] = useState(false);
  const [hoveredLines, setHoveredLines] = useState(false);

  return (
    <div className="text-center pt-2">
      <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-sm p-3 sm:p-4 pb-4 sm:pb-6 rounded-lg border border-gray-200 dark:border-white/20 space-y-3 overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 pb-6">
          <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h4 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Historical Data</h4>
        </div>
        
        {/* Glass Icons */}
        <div className="flex gap-8 justify-center items-start overflow-visible py-4">
          <div 
            className="flex flex-col items-center gap-2"
            onMouseEnter={() => setHoveredH2H(true)}
            onMouseLeave={() => setHoveredH2H(false)}
          >
            <GlassIcon
              icon={<History />}
              color={`linear-gradient(135deg, ${awayTeamColors.primary}, ${homeTeamColors.primary})`}
              label="Head to Head"
              size="sm"
              isHovered={hoveredH2H}
              onClick={() => onH2HClick(prediction.home_team, prediction.away_team)}
            />
            <span className="text-xs font-medium text-gray-700 dark:text-white/80">Head to Head</span>
          </div>
          
          <div 
            className="flex flex-col items-center gap-2"
            onMouseEnter={() => setHoveredLines(true)}
            onMouseLeave={() => setHoveredLines(false)}
          >
            <GlassIcon
              icon={<TrendingUp />}
              color="green"
              label="Line Movement"
              size="sm"
              isHovered={hoveredLines}
              onClick={() => onLinesClick(prediction.training_key, prediction.home_team, prediction.away_team)}
            />
            <span className="text-xs font-medium text-gray-700 dark:text-white/80">Line Movement</span>
          </div>
        </div>
      </div>
    </div>
  );
}
