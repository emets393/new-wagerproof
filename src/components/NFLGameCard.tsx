import debug from '@/utils/debug';
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
  alwaysShowAurora?: boolean;
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
  awaySpread,
  alwaysShowAurora = false
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
    debug.log('Aurora should be visible!', {
      auroraColors,
      homeSpread,
      awaySpread,
      homeTeamColors,
      awayTeamColors
    });
  }
  
  return (
    <div 
      className="relative w-full"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Card with Shine Border */}
      <ShineBorder
        borderRadius={12}
        borderWidth={1}
        duration={18}
        color={["#93c5fd", "#c4b5fd", "#93c5fd"]}
        className="relative z-10 !bg-transparent p-0 min-h-0 w-full max-w-full min-w-0"
      >
        {/* Aurora Effect - Visible when hovered or always shown */}
        {alwaysShowAurora ? (
          <div
            className="absolute top-0 left-0 right-0 h-40 z-[1] pointer-events-none overflow-hidden rounded-t-lg"
            style={{ 
              mixBlendMode: 'screen',
              filter: 'brightness(1.2) contrast(1.1)',
              opacity: isHovered ? 0.8 : 0.6,
              transition: 'opacity 0.5s ease-in-out'
            }}
          >
            <Aurora
              colorStops={auroraColors}
              amplitude={1.2}
              blend={0.6}
              speed={0.8}
            />
          </div>
        ) : (
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
        )}
        <motion.div
          whileHover={{ 
            scale: 1.015,
            transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
          }}
          whileTap={{ scale: 0.995 }}
          className="touch-action-none w-full"
          style={{ pointerEvents: 'auto' }}
        >
          <Card className={`relative overflow-hidden w-full ${isHovered ? 'bg-sidebar/85 backdrop-blur-sm' : 'bg-sidebar/95 backdrop-blur-sm'} border-0 shadow-lg transition-all duration-300 z-[2] ${isHovered ? 'shadow-2xl shadow-blue-400/30 dark:shadow-blue-900/30' : ''} ${className}`}>
            {/* Dynamic team colors gradient top border */}
            <div 
              className="absolute top-0 left-0 right-0 h-1 rounded-t-lg pointer-events-none"
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

