import { 
  IconSun, 
  IconMoon, 
  IconCloud, 
  IconCloudRain,
  IconCloudSnow,
  IconCloudFog,
  IconCloudStorm,
  IconSnowflake,
  IconWind,
  IconCloudUp,
  IconBuildingStadium
} from '@tabler/icons-react';
import { ComponentType } from 'react';

export interface WeatherIconProps {
  size?: number;
  className?: string;
}

type WeatherIconComponent = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

/**
 * Maps weather condition codes to Tabler Icon components
 * Returns the appropriate icon component for each weather condition
 */
export const getWeatherIcon = (code: string): WeatherIconComponent => {
  const iconMap: { [key: string]: WeatherIconComponent } = {
    'clear-day': IconSun,
    'clear-night': IconMoon,
    'partly-cloudy-day': IconCloudUp,
    'partly-cloudy-night': IconCloudUp,
    'cloudy': IconCloud,
    'rain': IconCloudRain,
    'showers-day': IconCloudRain,
    'showers-night': IconCloudRain,
    'snow': IconSnowflake,
    'snow-showers-day': IconCloudSnow,
    'snow-showers-night': IconCloudSnow,
    'sleet': IconCloudSnow,
    'fog': IconCloudFog,
    'thunder': IconCloudStorm,
    'thunder-showers-day': IconCloudStorm,
    'thunder-showers-night': IconCloudStorm,
    'thunder-rain': IconCloudStorm,
    'rain-snow': IconCloudSnow,
    'rain-snow-showers-day': IconCloudSnow,
    'rain-snow-showers-night': IconCloudSnow,
    'hail': IconCloudRain,
    'wind': IconWind,
    'indoor': IconBuildingStadium
  };

  // Return mapped icon if exists
  if (iconMap[code]) {
    return iconMap[code];
  }

  // Fallback logic for unmapped codes
  if (code.includes('clear')) {
    return code.includes('night') ? IconMoon : IconSun;
  }
  if (code.includes('partly')) {
    return IconCloudUp;
  }
  if (code.includes('rain') && code.includes('snow')) {
    return IconCloudSnow;
  }
  if (code.includes('rain')) {
    return IconCloudRain;
  }
  if (code.includes('snow')) {
    return IconCloudSnow;
  }
  if (code.includes('thunder') || code.includes('storm')) {
    return IconCloudStorm;
  }
  if (code.includes('cloudy') || code.includes('cloud')) {
    return IconCloud;
  }
  if (code.includes('fog') || code.includes('mist') || code.includes('haze')) {
    return IconCloudFog;
  }
  if (code.includes('wind')) {
    return IconWind;
  }
  if (code.includes('indoor') || code.includes('dome')) {
    return IconBuildingStadium;
  }

  // Default fallback
  return IconSun;
};

/**
 * Export IconWind for standalone use
 */
export { IconWind };

/**
 * Renders a weather icon component based on the weather code
 */
export const WeatherIcon = ({ 
  code, 
  size = 24, 
  className = "stroke-current" 
}: { 
  code: string; 
  size?: number; 
  className?: string;
}) => {
  const IconComponent = getWeatherIcon(code);
  return <IconComponent size={size} className={className} strokeWidth={1.5} />;
};

