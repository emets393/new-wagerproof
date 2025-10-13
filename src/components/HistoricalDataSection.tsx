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
      <div className="bg-gradient-to-br from-gray-50 to-slate-50/30 dark:from-gray-800/50 dark:to-slate-800/20 p-3 sm:p-4 pb-4 sm:pb-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
        {/* Header */}
        <h4 className="text-lg sm:text-xl pb-6 font-bold text-gray-400 dark:text-gray-500">Historical Data</h4>
        
        {/* Glass Icons */}
        <div className="flex gap-6 justify-center">
          <div className="flex flex-col items-center gap-2">
            <div 
              onClick={() => onH2HClick(prediction.home_team, prediction.away_team)}
              onMouseEnter={() => setHoveredH2H(true)}
              onMouseLeave={() => setHoveredH2H(false)}
              className="cursor-pointer"
            >
              <GlassIcon
                icon={<History />}
                color={`linear-gradient(135deg, ${awayTeamColors.primary}, ${homeTeamColors.primary})`}
                label="Head to Head"
                size="sm"
                isHovered={hoveredH2H}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Head to Head</span>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div 
              onClick={() => onLinesClick(prediction.training_key, prediction.home_team, prediction.away_team)}
              onMouseEnter={() => setHoveredLines(true)}
              onMouseLeave={() => setHoveredLines(false)}
              className="cursor-pointer"
            >
              <GlassIcon
                icon={<TrendingUp />}
                color="green"
                label="Line Movement"
                size="sm"
                isHovered={hoveredLines}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Line Movement</span>
          </div>
        </div>
      </div>
    </div>
  );
}
