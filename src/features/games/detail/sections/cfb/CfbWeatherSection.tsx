import { CloudRain } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { IconWind, WeatherIcon as WeatherIconComponent } from '@/utils/weatherIcons';
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

/**
 * CFB weather details — port of GameDetailsModal's CFB-only weather block
 * (~2030-2106). Prefers the weather_* columns, falls back to the legacy
 * temperature/wind_speed columns.
 */
export function CfbWeatherSection({ game }: { game: GameFeedItem<CFBPrediction> }) {
  const prediction = game.raw;

  const iconCode = mapCFBWeatherIconToCode(prediction.weather_icon_text, prediction.icon_code);
  // Normalize undefined → null so the legacy `!== null` display gates hold off-season.
  const temperature = (prediction.weather_temp_f ?? prediction.temperature) ?? null;
  const windSpeed = (prediction.weather_windspeed_mph ?? prediction.wind_speed) ?? null;
  const precipitation = prediction.precipitation ?? null;

  const hasWeather = iconCode || temperature !== null || windSpeed !== null;

  return (
    <WidgetCard icon={<CloudRain />} title="Full Weather Details">
      {hasWeather ? (
        <div className="flex justify-center">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-4 mb-2">
              {iconCode && (
                <div className="w-16 h-16 flex items-center justify-center">
                  <WeatherIconComponent
                    code={iconCode}
                    size={64}
                    className="stroke-current text-gray-800 dark:text-white"
                  />
                </div>
              )}

              {temperature !== null && (
                <div className="text-lg font-bold text-gray-900 dark:text-white min-w-[60px] text-center">
                  {Math.round(temperature)}°F
                </div>
              )}

              {windSpeed !== null && windSpeed > 0 && (
                <div className="flex items-center space-x-2 min-w-[70px]">
                  <IconWind size={24} className="stroke-current text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-white/80">
                    {Math.round(windSpeed)} mph
                  </span>
                </div>
              )}
            </div>

            {iconCode && (
              <div className="text-xs font-medium text-gray-600 dark:text-white/70 capitalize">
                {iconCode.replace(/-/g, ' ')}
              </div>
            )}

            {precipitation !== null && precipitation > 0 && (
              <div className="text-xs font-medium text-gray-600 dark:text-white/70 mt-1">
                {/* Legacy quirk kept: values >1 are already %, fractions get scaled. */}
                Precipitation: {precipitation > 1 ? Math.round(precipitation) : Math.round(precipitation * 100)}%
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <CloudRain className="h-12 w-12 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
          <p className="text-sm text-gray-600 dark:text-white/70">Weather data not yet available</p>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1">Check back closer to game time</p>
        </div>
      )}
    </WidgetCard>
  );
}
