// ChatWeatherWidget — Compact game conditions display.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  data: Record<string, unknown>;
}

function getWeatherIcon(sky: string | null): string {
  if (!sky) return 'weather-partly-cloudy';
  const s = String(sky).toLowerCase();
  if (s.includes('clear') || s.includes('sunny')) return 'weather-sunny';
  if (s.includes('cloud') || s.includes('overcast')) return 'weather-cloudy';
  if (s.includes('rain') || s.includes('drizzle')) return 'weather-rainy';
  if (s.includes('snow')) return 'weather-snowy';
  if (s.includes('dome') || s.includes('roof')) return 'dome-light';
  return 'weather-partly-cloudy';
}

export default function ChatWeatherWidget({ data }: Props) {
  const d = data as any;
  if (d.dome) {
    return (
      <View style={styles.container}>
        <MaterialCommunityIcons name="dome-light" size={14} color="rgba(255,255,255,0.5)" />
        <Text style={styles.text}>Dome / Retractable Roof</Text>
      </View>
    );
  }

  const parts: string[] = [];
  if (d.temperature != null) parts.push(`${Math.round(Number(d.temperature))}°F`);
  if (d.wind_speed != null) {
    let wind = `Wind: ${Math.round(Number(d.wind_speed))}mph`;
    if (d.wind_direction) wind += ` ${d.wind_direction}`;
    parts.push(wind);
  }
  if (d.sky) parts.push(String(d.sky));
  if (d.precipitation) parts.push(String(d.precipitation));

  if (parts.length === 0) return null;

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name={getWeatherIcon(d.sky) as any}
        size={14}
        color="rgba(255,255,255,0.5)"
      />
      <Text style={styles.text}>{parts.join('  ·  ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  text: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
});
