import { motion } from "motion/react";
import { LiveGame } from "@/types/liveScores";
import { cn } from "@/lib/utils";

interface LiveScoreCardProps {
  game: LiveGame;
}

export function LiveScoreCard({ game }: LiveScoreCardProps) {
  // Create gradient from team colors if available
  const getGradient = () => {
    if (game.away_color && game.home_color) {
      return `linear-gradient(135deg, ${game.away_color}10 0%, ${game.home_color}10 100%)`;
    }
    return undefined;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "relative flex items-center gap-2 min-w-[160px] h-[36px]",
        "rounded-md border border-border/40",
        "bg-card/80 backdrop-blur-sm",
        "px-2.5 py-1.5",
        "hover:bg-card transition-all"
      )}
      style={{
        background: getGradient() || undefined,
        backdropFilter: "blur(4px)"
      }}
    >
      {/* Live Indicator */}
      {game.is_live && (
        <div className="flex items-center">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-honeydew-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-honeydew-500"></span>
          </span>
        </div>
      )}

      {/* Teams and Scores */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Away Team */}
        <span className="text-[11px] font-bold text-foreground whitespace-nowrap">
          {game.away_abbr}
        </span>
        <span className="text-sm font-bold text-foreground tabular-nums">
          {game.away_score}
        </span>

        {/* Separator */}
        <span className="text-[10px] text-muted-foreground">-</span>

        {/* Home Team */}
        <span className="text-sm font-bold text-foreground tabular-nums">
          {game.home_score}
        </span>
        <span className="text-[11px] font-bold text-foreground whitespace-nowrap">
          {game.home_abbr}
        </span>
      </div>

      {/* Game Status */}
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
    </motion.div>
  );
}

