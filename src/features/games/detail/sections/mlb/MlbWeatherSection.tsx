import { CloudSun } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { type MLBPredictionRow } from '../../../api/mlbGames';
import { toNum } from './shared';

/**
 * MLB weather block: temperature_f / wind_speed_mph / wind_direction / sky
 * (fields live behind the row's index signature — same untyped access as the
 * legacy page), with a confirmed / estimated / unconfirmed chip in the header.
 */
export function MlbWeatherSection({ raw }: { raw: MLBPredictionRow }) {
  const rec = raw as Record<string, any>;
  const temp = toNum(rec.temperature_f);
  const wind = toNum(rec.wind_speed_mph);
  const hasWeather = temp !== null || wind !== null || rec.wind_direction || rec.sky;

  const statusChip = raw.weather_confirmed ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      Confirmed
    </span>
  ) : (
    <span
      title={raw.weather_imputed ? 'Using estimated weather inputs.' : 'Awaiting confirmed weather inputs.'}
      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    >
      {raw.weather_imputed ? 'Estimated' : 'Unconfirmed'}
    </span>
  );

  return (
    <WidgetCard icon={<CloudSun />} title="Weather" accessory={statusChip}>
      <div className="space-y-1 text-center text-xs text-muted-foreground">
        {hasWeather ? (
          <>
            <div>
              Temp: {temp !== null ? `${temp.toFixed(0)}F` : 'N/A'}
              {' | '}
              Wind: {wind !== null ? `${wind.toFixed(0)} mph` : 'N/A'}
              {' '}
              {rec.wind_direction ? `${rec.wind_direction}` : ''}
            </div>
            <div>
              Sky: {rec.sky || 'N/A'}
            </div>
          </>
        ) : (
          <div title="Weather details become available closer to first pitch.">
            Weather data not available yet.
          </div>
        )}
        {!raw.weather_confirmed && (
          <div className="text-[11px]">
            {raw.weather_imputed ? 'Using estimated weather inputs.' : 'Awaiting confirmed weather inputs.'}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
