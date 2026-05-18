import React from 'react';
import type { MatchupGame } from '@/types/mlb-matchups';
import { windBannerTone } from '@/utils/mlbPitcherMatchups';
import { cn } from '@/lib/utils';

interface WeatherBannerProps {
  game: MatchupGame;
}

export function WeatherBanner({ game }: WeatherBannerProps) {
  if ((game.wind_speed_mph ?? 0) < 10) return null;

  const tone = windBannerTone(game.wind_direction);
  const toneClass =
    tone === 'warn'
      ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200'
      : tone === 'info'
        ? 'bg-blue-500/10 border-blue-500/40 text-blue-900 dark:text-blue-200'
        : 'bg-muted border-border text-foreground';

  const temp =
    game.temperature_f != null ? ` · ${Math.round(game.temperature_f)}°F` : '';

  return (
    <div className={cn('rounded-lg border px-3 py-2 text-sm', toneClass)}>
      <span className="font-medium">
        🌬️ Wind: {Math.round(game.wind_speed_mph!)} mph
        {game.wind_direction ? ` ${game.wind_direction}` : ''}
        {temp}
      </span>
    </div>
  );
}
