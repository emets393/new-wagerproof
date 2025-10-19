import { motion } from "motion/react";
import { LiveGame } from "@/types/liveScores";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LiveScorePredictionCard } from "./LiveScorePredictionCard";
import { useState } from "react";

interface LiveScoreCardProps {
  game: LiveGame;
}

export function LiveScoreCard({ game }: LiveScoreCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Create gradient from team colors if available
  const getGradient = () => {
    if (game.away_color && game.home_color) {
      return `linear-gradient(135deg, ${game.away_color}10 0%, ${game.home_color}10 100%)`;
    }
    return undefined;
  };

  // Check if any predictions are hitting
  const hasHittingPredictions = game.predictions?.hasAnyHitting || false;
  const hasPredictions = !!game.predictions && (
    !!game.predictions.moneyline || 
    !!game.predictions.spread || 
    !!game.predictions.overUnder
  );

  const cardContent = (
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "relative flex items-center gap-1.5 md:gap-2 h-[32px] md:h-[36px]",
        "rounded-md border",
        "bg-card/80 backdrop-blur-sm",
        "px-2 md:px-2.5 py-1 md:py-1.5",
        "hover:bg-card transition-all",
        "cursor-pointer", // Add cursor pointer to indicate interactivity
        // Adjust width based on whether we have predictions
        hasPredictions ? "min-w-[180px] md:min-w-[200px]" : "min-w-[140px] md:min-w-[160px]",
        // Border color based on prediction status
        hasPredictions && hasHittingPredictions
          ? "border-honeydew-500/60 shadow-[0_0_12px_rgba(191,239,119,0.3)] animate-pulse"
          : hasPredictions && !hasHittingPredictions
          ? "border-destructive/60 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
          : "border-border/40"
      )}
      style={{
        background: getGradient() || undefined,
        backdropFilter: "blur(4px)"
      }}
    >
      {/* Prediction Status Indicator */}
      <div className="flex items-center">
        {hasPredictions && (
          <span className="relative flex h-2 w-2">
            {hasHittingPredictions && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-honeydew-500 opacity-75"></span>
            )}
            <span 
              className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                hasHittingPredictions ? "bg-honeydew-500" : "bg-destructive"
              )}
            ></span>
          </span>
        )}
      </div>

      {/* Teams and Scores */}
      <div className="flex items-center gap-1.5 md:gap-2 flex-1 min-w-0">
        {/* Away Team */}
        <span className="text-[10px] md:text-[11px] font-bold text-foreground whitespace-nowrap">
          {game.away_abbr}
        </span>
        <span className="text-xs md:text-sm font-bold text-foreground tabular-nums">
          {game.away_score}
        </span>

        {/* Separator */}
        <span className="text-[9px] md:text-[10px] text-muted-foreground">-</span>

        {/* Home Team */}
        <span className="text-xs md:text-sm font-bold text-foreground tabular-nums">
          {game.home_score}
        </span>
        <span className="text-[10px] md:text-[11px] font-bold text-foreground whitespace-nowrap">
          {game.home_abbr}
        </span>
      </div>

      {/* Model Predictions */}
      {hasPredictions && (
        <div className="flex flex-col gap-0.5 text-[8px] md:text-[9px] whitespace-nowrap">
          {/* Spread Prediction */}
          {game.predictions?.spread && (
            <div className={cn(
              "font-semibold",
              game.predictions.spread.isHitting ? "text-honeydew-500" : "text-destructive/70"
            )}>
              {game.predictions.spread.predicted === 'Home' ? game.home_abbr : game.away_abbr}
              {' '}
              {game.predictions.spread.line !== null && game.predictions.spread.line !== undefined
                ? (game.predictions.spread.line > 0 ? `+${game.predictions.spread.line}` : game.predictions.spread.line)
                : ''}
            </div>
          )}
          {/* Over/Under Prediction */}
          {game.predictions?.overUnder && (
            <div className={cn(
              "font-semibold",
              game.predictions.overUnder.isHitting ? "text-honeydew-500" : "text-destructive/70"
            )}>
              {game.predictions.overUnder.predicted.charAt(0)} {game.predictions.overUnder.line}
            </div>
          )}
        </div>
      )}

      {/* Game Status */}
      {!hasPredictions && (
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground whitespace-nowrap">
          {game.is_live && game.period && (
            <>
              <span className="font-semibold">{game.period}</span>
              {game.time_remaining && (
                <span className="tabular-nums">{game.time_remaining}</span>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );

  // If game has predictions, wrap with both HoverCard (desktop) and Popover (mobile)
  if (hasPredictions) {
    return (
      <>
        {/* Desktop: Hover to expand */}
        <div className="hidden md:block">
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              {cardContent}
            </HoverCardTrigger>
            <HoverCardContent 
              side="bottom" 
              align="center" 
              className="w-auto p-0 border-border/60 z-[100]"
              sideOffset={8}
            >
              <LiveScorePredictionCard game={game} />
            </HoverCardContent>
          </HoverCard>
        </div>

        {/* Mobile: Tap to expand */}
        <div className="block md:hidden">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              {cardContent}
            </PopoverTrigger>
            <PopoverContent 
              side="bottom" 
              align="center" 
              className="w-auto p-0 border-border/60 z-[100]"
              sideOffset={8}
            >
              <LiveScorePredictionCard game={game} />
            </PopoverContent>
          </Popover>
        </div>
      </>
    );
  }

  // No predictions, just show the card
  return cardContent;
}

