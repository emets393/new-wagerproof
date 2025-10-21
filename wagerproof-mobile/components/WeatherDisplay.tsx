import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

interface WeatherDisplayProps {
  icon: string | null;
  temperature: number | null;
  windSpeed: number | null;
  precipitation: number | null;
}

export const WeatherDisplay: React.FC<WeatherDisplayProps> = ({
  icon,
  temperature,
  windSpeed,
  precipitation
}) => {
  const theme = useTheme();

  const getWeatherIcon = (iconCode: string | null): string => {
    if (!iconCode) return 'weather-cloudy';
    
    const iconMap: { [key: string]: string } = {
      'clear-day': 'weather-sunny',
      'clear-night': 'weather-night',
      'rain': 'weather-rainy',
      'snow': 'weather-snowy',
      'sleet': 'weather-snowy-rainy',
      'wind': 'weather-windy',
      'fog': 'weather-fog',
      'cloudy': 'weather-cloudy',
      'partly-cloudy-day': 'weather-partly-cloudy',
      'partly-cloudy-night': 'weather-night-partly-cloudy',
      'hail': 'weather-hail',
      'thunderstorm': 'weather-lightning',
      'tornado': 'weather-tornado',
      'indoor': 'home-roof',
    };
    
    return iconMap[iconCode] || 'weather-cloudy';
  };

  const isIndoor = icon === 'indoor';

  if (isIndoor) {
    return (
      <View style={styles.container}>
        <MaterialCommunityIcons 
          name="home-roof" 
          size={24} 
          color={theme.colors.primary} 
        />
        <Text style={[styles.indoorText, { color: theme.colors.onSurfaceVariant }]}>
          Indoor Game
        </Text>
      </View>
    );
  }

  if (!temperature && !windSpeed && !precipitation) {
    return (
      <View style={styles.container}>
        <MaterialCommunityIcons 
          name="help-circle-outline" 
          size={20} 
          color={theme.colors.onSurfaceVariant} 
        />
        <Text style={[styles.noDataText, { color: theme.colors.onSurfaceVariant }]}>
          Weather N/A
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons 
        name={getWeatherIcon(icon) as any} 
        size={24} 
        color={theme.colors.primary} 
      />
      <View style={styles.weatherDetails}>
        {temperature !== null && (
          <Text style={[styles.weatherText, { color: theme.colors.onSurface }]}>
            {Math.round(temperature)}°F
          </Text>
        )}
        {windSpeed !== null && windSpeed > 0 && (
          <Text style={[styles.weatherText, { color: theme.colors.onSurfaceVariant }]}>
            💨 {Math.round(windSpeed)} mph
          </Text>
        )}
        {precipitation !== null && precipitation > 0 && (
          <Text style={[styles.weatherText, { color: theme.colors.onSurfaceVariant }]}>
            🌧️ {Math.round(precipitation * 100)}%
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  indoorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  noDataText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  weatherDetails: {
    flexDirection: 'row',
    gap: 10,
  },
  weatherText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

