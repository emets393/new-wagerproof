import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Aurora from '@/components/magicui/aurora';
import ShineBorder from '@/components/magicui/shine-border';
import { Card } from '@/components/ui/card';

interface NFLGameCardProps {
  children: ReactNode;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  className?: string;
  awayTeamColors: { primary: string; secondary: string };
  homeTeamColors: { primary: string; secondary: string };
  homeSpread: number | null;
  awaySpread: number | null;
}

export default function NFLGameCard({
  children,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  className = '',
  awayTeamColors,
  homeTeamColors,
  homeSpread,
  awaySpread
}: NFLGameCardProps) {
  
  // Determine the favored team (negative spread) and create aurora color stops
  const getAuroraColors = (): string[] => {
    if (homeSpread !== null && homeSpread < 0) {
      // Home team favored - use home team colors
      return [homeTeamColors.primary, homeTeamColors.secondary, homeTeamColors.primary];
    } else if (awaySpread !== null && awaySpread < 0) {
      // Away team favored - use away team colors
      return [awayTeamColors.primary, awayTeamColors.secondary, awayTeamColors.primary];
    }
    // Fallback to neutral colors if no clear favorite
    return ['#6db8e0', '#93c5fd', '#6db8e0'];
  };

  const auroraColors = getAuroraColors();
  
  // Debug logging
  if (isHovered) {
    console.log('Aurora should be visible!', {
      auroraColors,
      homeSpread,
      awaySpread,
      homeTeamColors,
      awayTeamColors
    });
  }
  
  return (
    <div 
      className="relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Card with Shine Border */}
      <ShineBorder
        borderRadius={12}
        borderWidth={1}
        duration={18}
        color={["#93c5fd", "#c4b5fd", "#93c5fd"]}
        className="relative z-10 bg-transparent p-0 min-h-0 w-full"
      >
        {/* Aurora Effect - Only visible when this card is hovered */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute top-0 left-0 right-0 h-40 z-[1] pointer-events-none overflow-hidden rounded-t-lg"
              style={{ 
                mixBlendMode: 'screen',
                filter: 'brightness(1.2) contrast(1.1)'
              }}
            >
              <Aurora
                colorStops={auroraColors}
                amplitude={1.2}
                blend={0.6}
                speed={0.8}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          whileHover={{ 
            scale: 1.015,
            transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
          }}
          whileTap={{ scale: 0.995 }}
        >
          <Card className={`relative overflow-hidden ${isHovered ? 'bg-gradient-to-br from-gray-200/80 via-gray-300/80 to-gray-200/80 dark:from-gray-900/70 dark:via-gray-800/70 dark:to-gray-900/70 backdrop-blur-sm' : 'bg-gradient-to-br from-gray-100/90 via-gray-200/90 to-gray-100/90 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 backdrop-blur-sm'} border-0 shadow-lg transition-all duration-300 z-[2] ${isHovered ? 'shadow-2xl shadow-blue-200/50 dark:shadow-blue-900/30' : ''} ${className}`}>
            {/* Dynamic team colors gradient top border */}
            <div 
              className="absolute top-0 left-0 right-0 h-1"
              style={{
                background: `linear-gradient(to right, ${awayTeamColors.primary}, ${awayTeamColors.secondary}, ${homeTeamColors.primary}, ${homeTeamColors.secondary})`,
                opacity: 0.9
              }}
            />
            {children}
          </Card>
        </motion.div>
      </ShineBorder>
    </div>
  );
}

