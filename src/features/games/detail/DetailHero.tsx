import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeamLogoDiscs } from '@/components/ios';
import { StarButton } from '@/components/StarButton';
import { WeatherIcon as WeatherIconComponent, IconWind } from '@/utils/weatherIcons';
import { formatMoneyline, formatSpread, formatDateGroupLabel } from '../api/shared';
import type { GameFeedItem } from '../types';

function HeroStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-black/5 bg-white/50 px-4 py-2 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.07]">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn('font-mono text-[15px] font-bold text-foreground', className)}>
        {value}
      </span>
    </div>
  );
}

/**
 * Detail-pane hero over the team aura: merged logo discs, matchup title,
 * ML/Spread/Total stat tiles, weather chips (outdoor sports), admin star.
 */
export function DetailHero({ game, isAdmin }: { game: GameFeedItem; isAdmin: boolean }) {
  const { awayTeam, homeTeam, lines } = game;
  const raw = game.raw as any;

  const showWeather =
    (game.sport === 'nfl' || game.sport === 'cfb') &&
    (raw?.temperature != null || raw?.wind_speed != null || raw?.icon);

  return (
    <div className="relative flex flex-col items-center gap-3 px-6 pb-5 pt-8 text-center">
      {isAdmin && game.sport !== 'mlb' && (
        <div className="absolute right-4 top-4">
          <StarButton gameId={game.id} gameType={game.sport} />
        </div>
      )}

      <TeamLogoDiscs
        away={{ logoUrl: awayTeam.logoUrl, abbrev: awayTeam.abbrev, color: awayTeam.colors.primary }}
        home={{ logoUrl: homeTeam.logoUrl, abbrev: homeTeam.abbrev, color: homeTeam.colors.primary }}
        size={72}
        overlap={18}
      />

      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {awayTeam.name} <span className="font-semibold text-muted-foreground">@</span>{' '}
          {homeTeam.name}
        </h2>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDateGroupLabel(game.gameDate)} ·{' '}
          {game.status === 'postponed' ? 'Postponed' : game.gameTimeLabel}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <HeroStat
          label="Moneyline"
          value={`${formatMoneyline(lines.awayML)} / ${formatMoneyline(lines.homeML)}`}
        />
        <HeroStat
          label="Spread"
          value={lines.homeSpread !== null ? `${homeTeam.abbrev} ${formatSpread(lines.homeSpread)}` : '-'}
        />
        <HeroStat label="Total" value={lines.total !== null ? String(lines.total) : '-'} />
      </div>

      {showWeather && (
        <div className="flex items-center gap-3 rounded-full border border-black/5 bg-white/50 px-4 py-1.5 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.07]">
          {raw?.icon && (
            <WeatherIconComponent code={raw.icon} size={22} className="stroke-current text-foreground" />
          )}
          {raw?.temperature != null && (
            <span className="text-sm font-bold text-foreground">{Math.round(raw.temperature)}°F</span>
          )}
          {raw?.wind_speed != null && raw.wind_speed > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <IconWind size={16} className="stroke-current text-blue-500" />
              {Math.round(raw.wind_speed)} mph
            </span>
          )}
        </div>
      )}
    </div>
  );
}
