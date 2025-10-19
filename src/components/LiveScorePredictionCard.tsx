import { LiveGame } from "@/types/liveScores";
import { cn } from "@/lib/utils";
import { Check, X, TrendingUp, TrendingDown } from "lucide-react";

interface LiveScorePredictionCardProps {
  game: LiveGame;
}

export function LiveScorePredictionCard({ game }: LiveScorePredictionCardProps) {
  const { predictions } = game;

  // Don't show if no predictions
  if (!predictions || (!predictions.moneyline && !predictions.spread && !predictions.overUnder)) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No predictions available for this game
      </div>
    );
  }

  // Format line with sign
  const formatLine = (line?: number) => {
    if (line === undefined || line === null) return '';
    return line > 0 ? `+${line}` : `${line}`;
  };

  return (
    <div className="w-[280px] md:w-[320px] bg-card border border-border/60 rounded-lg shadow-lg overflow-hidden">
      {/* Header with team info */}
      <div className="p-3 md:p-4 border-b border-border/40 bg-gradient-to-br from-background to-muted/20">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          {/* Away Team Circle */}
          <div className="flex flex-col items-center gap-1">
            <div 
              className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xs md:text-sm font-bold border-2 border-border/40"
              style={{ 
                backgroundColor: game.away_color ? `${game.away_color}30` : 'hsl(var(--muted))',
                borderColor: game.away_color || 'hsl(var(--border))'
              }}
            >
              {game.away_abbr}
            </div>
            <span className="text-xs text-muted-foreground">{game.away_team}</span>
          </div>

          {/* Score Display */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-xl md:text-2xl font-bold tabular-nums">{game.away_score}</span>
              <span className="text-muted-foreground text-xs md:text-sm">-</span>
              <span className="text-xl md:text-2xl font-bold tabular-nums">{game.home_score}</span>
            </div>
            {game.period && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="font-semibold">{game.period}</span>
                {game.time_remaining && (
                  <span className="tabular-nums">{game.time_remaining}</span>
                )}
              </div>
            )}
          </div>

          {/* Home Team Circle */}
          <div className="flex flex-col items-center gap-1">
            <div 
              className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xs md:text-sm font-bold border-2 border-border/40"
              style={{ 
                backgroundColor: game.home_color ? `${game.home_color}30` : 'hsl(var(--muted))',
                borderColor: game.home_color || 'hsl(var(--border))'
              }}
            >
              {game.home_abbr}
            </div>
            <span className="text-xs text-muted-foreground">{game.home_team}</span>
          </div>
        </div>
      </div>

      {/* Predictions Section */}
      <div className="p-3 md:p-4 space-y-2 md:space-y-3">
        <div className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">
          AI Model Predictions
        </div>

        {/* Moneyline */}
        {predictions.moneyline && (
          <div 
            className={cn(
              "flex items-center justify-between p-2.5 rounded-md border transition-colors",
              predictions.moneyline.isHitting
                ? "bg-honeydew-500/10 border-honeydew-500/40"
                : "bg-muted/30 border-border/40"
            )}
          >
            <div className="flex items-center gap-2">
              {predictions.moneyline.isHitting ? (
                <Check className="w-4 h-4 text-honeydew-500" />
              ) : (
                <X className="w-4 h-4 text-destructive/70" />
              )}
              <div>
                <div className="text-sm font-medium">Moneyline</div>
                <div className="text-xs text-muted-foreground">
                  {predictions.moneyline.predicted} to win
                </div>
              </div>
            </div>
            <div className="text-right">
              {predictions.moneyline.isHitting ? (
                <div className="flex items-center gap-0.5 text-xs text-honeydew-500">
                  <TrendingUp className="w-3 h-3" />
                  <span>Hitting</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Not hitting</div>
              )}
            </div>
          </div>
        )}

        {/* Spread */}
        {predictions.spread && (
          <div 
            className={cn(
              "flex items-center justify-between p-2.5 rounded-md border transition-colors",
              predictions.spread.isHitting
                ? "bg-honeydew-500/10 border-honeydew-500/40"
                : "bg-muted/30 border-border/40"
            )}
          >
            <div className="flex items-center gap-2">
              {predictions.spread.isHitting ? (
                <Check className="w-4 h-4 text-honeydew-500" />
              ) : (
                <X className="w-4 h-4 text-destructive/70" />
              )}
              <div>
                <div className="text-sm font-medium">Spread</div>
                <div className="text-xs text-muted-foreground">
                  {predictions.spread.predicted} {formatLine(predictions.spread.line)}
                </div>
              </div>
            </div>
            <div className="text-right">
              {predictions.spread.isHitting ? (
                <div className="flex items-center gap-0.5 text-xs text-honeydew-500">
                  <TrendingUp className="w-3 h-3" />
                  <span>Hitting</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Not hitting</div>
              )}
            </div>
          </div>
        )}

        {/* Over/Under */}
        {predictions.overUnder && (
          <div 
            className={cn(
              "flex items-center justify-between p-2.5 rounded-md border transition-colors",
              predictions.overUnder.isHitting
                ? "bg-honeydew-500/10 border-honeydew-500/40"
                : "bg-muted/30 border-border/40"
            )}
          >
            <div className="flex items-center gap-2">
              {predictions.overUnder.isHitting ? (
                <Check className="w-4 h-4 text-honeydew-500" />
              ) : (
                <X className="w-4 h-4 text-destructive/70" />
              )}
              <div>
                <div className="text-sm font-medium">Over/Under</div>
                <div className="text-xs text-muted-foreground">
                  {predictions.overUnder.predicted} {predictions.overUnder.line}
                </div>
              </div>
            </div>
            <div className="text-right">
              {predictions.overUnder.isHitting ? (
                <div className="flex items-center gap-0.5 text-xs text-honeydew-500">
                  <TrendingUp className="w-3 h-3" />
                  <span>Hitting</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <TrendingDown className="w-3 h-3" />
                  <span>Not hitting</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

