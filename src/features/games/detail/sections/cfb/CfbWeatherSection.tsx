import type { ReactNode } from 'react';
import { CloudSun, Droplets } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { IconWind, WeatherIcon as WeatherIconComponent } from '@/utils/weatherIcons';
import { EmptyNote } from './shared';
import type { CFBPrediction } from '../../../api/cfbGames';
import type { GameFeedItem } from '../../../types';

/**
 * Verbatim from GameDetailsModal — maps cfb_live_weekly_inputs'
 * weather_icon_text phrasing onto the shared weather icon codes; a direct
 * icon_code from the row always wins.
 */
const mapCFBWeatherIconToCode = (
  iconText: string | null | undefined,
  fallbackIcon: string | null | undefined
): string | null => {
  // If we have a direct icon_code, use it
  if (fallbackIcon) return fallbackIcon;

  // If we have weather_icon_text, map it
  if (!iconText) return null;

  const t = iconText.toLowerCase().trim();
  const isNight = /(night|pm\s*\(night\)|overnight)/.test(t);

  // Rain spectrum
  if (/(drizzle|light rain|rain showers|shower|sprinkle|rainy|rain)/.test(t)) {
    return isNight ? 'showers-night' : /showers|shower|drizzle/.test(t) ? 'showers-day' : 'rain';
  }

  // Thunderstorms
  if (/(t-?storm|thunder|storm)/.test(t)) {
    return t.includes('rain') ? 'thunder-rain' : 'thunder';
  }

  // Snow variants
  if (/(snow|flurries|blowing snow)/.test(t)) {
    return /showers|flurries/.test(t)
      ? (isNight ? 'snow-showers-night' : 'snow-showers-day')
      : 'snow';
  }

  // Mixed precip
  if (/(wintry mix|rain and snow|rain\s*\/\s*snow|sleet)/.test(t)) return 'rain-snow';
  if (/sleet/.test(t)) return 'sleet';
  if (/hail/.test(t)) return 'hail';

  // Fog/Mist/Haze
  if (/(fog|mist|haze|smoke)/.test(t)) return 'fog';

  // Cloud cover
  if (/(overcast)/.test(t)) return 'cloudy';
  if (/(mostly cloudy|broken clouds|considerable cloud)/.test(t)) return 'cloudy';
  if (/(partly sunny|partly cloudy|intermittent cloud|scattered cloud)/.test(t)) {
    return isNight ? 'partly-cloudy-night' : 'partly-cloudy-day';
  }
  if (/cloud/.test(t)) return 'cloudy';

  // Clear/mostly clear
  if (/(clear|sunny|mostly clear)/.test(t)) return isNight ? 'clear-night' : 'clear-day';

  // Windy
  if (/wind/.test(t)) return 'wind';

  // Fallback
  return isNight ? 'clear-night' : 'clear-day';
};

/** Secondary weather figure — icon, value, caption. No surface of its own. */
function WeatherStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-foreground">
        {icon}
        {value}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
    </div>
  );
}

/**
 * CFB conditions at kickoff, as one line: what it looks like, how warm, and the
 * two numbers that actually move a total (wind and precipitation).
 *
 * Deliberately not a dashboard — see WIDGET_DESIGN.md rule 1. Everything else
 * the row carries (dew point, cloud cover…) is noise next to those.
 */
export function CfbWeatherSection({ game }: { game: GameFeedItem<CFBPrediction> }) {
  const prediction = game.raw;

  const iconCode = mapCFBWeatherIconToCode(prediction.weather_icon_text, prediction.icon_code);
  // Normalize undefined → null so the legacy `!== null` display gates hold off-season.
  const temperature = (prediction.weather_temp_f ?? prediction.temperature) ?? null;
  const windSpeed = (prediction.weather_windspeed_mph ?? prediction.wind_speed) ?? null;
  const precipitation = prediction.precipitation ?? null;

  const hasWeather = iconCode !== null || temperature !== null || windSpeed !== null;
  // Legacy quirk kept: values >1 are already a percentage, fractions get scaled.
  const precipPct =
    precipitation !== null && precipitation > 0
      ? Math.round(precipitation > 1 ? precipitation : precipitation * 100)
      : null;

  return (
    <WidgetCard
      icon={<CloudSun />}
      title="Weather"
      subtitle="Conditions at kickoff. Wind and rain pull totals down far more than temperature does."
    >
      {hasWeather ? (
        <div className="flex items-center gap-3">
          {iconCode && (
            <WeatherIconComponent
              code={iconCode}
              size={44}
              className="shrink-0 stroke-current text-foreground"
            />
          )}

          <div className="flex min-w-0 flex-col">
            {temperature !== null && (
              <span className="text-2xl font-bold leading-none tabular-nums text-foreground">
                {Math.round(temperature)}&deg;F
              </span>
            )}
            {iconCode && (
              <span className="mt-1 truncate text-[11px] capitalize text-muted-foreground">
                {iconCode.replace(/-/g, ' ')}
              </span>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-4">
            {windSpeed !== null && windSpeed > 0 && (
              <WeatherStat
                icon={<IconWind size={14} className="stroke-current text-muted-foreground" />}
                value={`${Math.round(windSpeed)} mph`}
                label="Wind"
              />
            )}
            {precipPct !== null && (
              <WeatherStat
                icon={<Droplets className="h-3.5 w-3.5 text-muted-foreground" />}
                value={`${precipPct}%`}
                label="Precip"
              />
            )}
          </div>
        </div>
      ) : (
        <EmptyNote>
          No forecast for this game yet — conditions usually land a few days out from kickoff.
        </EmptyNote>
      )}
    </WidgetCard>
  );
}
