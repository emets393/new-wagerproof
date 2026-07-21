import * as React from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import type { UpcomingGame } from './adapters/types';

/**
 * "This week's games that match" — logo + matchup + bet line + kickoff (+ MLB chips).
 * Rendered inside the insight section's Upcoming tab, so no card shell of its own. Empty-safe.
 */
export function UpcomingMatches({
  games,
  betType,
  title,
  note,
  lineForBet,
  timeLabel,
  logoForGame,
  chipsFor,
  onChipClick,
}: {
  games: UpcomingGame[];
  betType: string;
  title: string;
  note?: string | null;
  lineForBet: (betType: string, game: UpcomingGame) => string;
  timeLabel: (game: UpcomingGame) => string;
  logoForGame: (game: UpcomingGame) => string | null;
  chipsFor?: (game: UpcomingGame) => string[];
  onChipClick?: (game: UpcomingGame, chip: string) => void;
}) {
  if (!games.length) return null;
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {note && <p className="mb-2 text-[11px] text-amber-600 dark:text-amber-400">{note}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {games.map((g, i) => {
          const logo = logoForGame(g);
          const chips = chipsFor?.(g) ?? [];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="flex items-center gap-2.5 rounded-2xl border border-black/5 bg-white/50 px-3 py-2.5 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04]"
            >
              {logo && (
                <img
                  src={logo}
                  alt=""
                  className="h-7 w-7 shrink-0 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                  }}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{String(g.matchup ?? '')}</div>
                <div className="text-xs font-medium text-foreground/80">{lineForBet(betType, g)}</div>
                <div className="text-[11px] text-muted-foreground">{timeLabel(g)}</div>
                {chips.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {chips.map((chip, ci) => {
                      const clickable = !!onChipClick && chip === String(g.opp_sp_name ?? '');
                      return (
                        <Badge
                          key={ci}
                          variant="outline"
                          className={`text-[10px] font-normal ${clickable ? 'cursor-pointer transition-colors hover:bg-accent' : ''}`}
                          onClick={() => {
                            if (clickable) onChipClick?.(g, chip);
                          }}
                        >
                          {chip}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
