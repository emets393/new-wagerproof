import React from 'react';
import { View, StyleSheet } from 'react-native';
import AnimatedGlow, { type PresetConfig } from 'react-native-animated-glow';

interface GlowingCardWrapperProps {
  color: string;
  children: React.ReactNode;
  borderRadius?: number;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generatePalette(hex: string) {
  const [h, s, l] = hexToHsl(hex);
  return {
    darkest: hslToHex(h, Math.min(s + 10, 100), Math.max(l - 25, 10)),
    dark: hslToHex(h, s, Math.max(l - 10, 15)),
    base: hex,
    light: hslToHex(h, s, Math.min(l + 15, 85)),
    lightest: hslToHex(h, Math.max(s - 10, 20), Math.min(l + 30, 90)),
    shifted: hslToHex(h + 30, s, l),
  };
}

function buildGlowPreset(color: string, cornerRadius: number): PresetConfig {
  const p = generatePalette(color);

  return {
    metadata: {
      name: 'AgentGlow',
      textColor: '#FFFFFF',
      category: 'Custom',
      tags: ['agent'],
    },
    states: [
      {
        name: 'default',
        preset: {
          cornerRadius,
          outlineWidth: 0,
          animationSpeed: 1,
          borderSpeedMultiplier: 1,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          glowLayers: [
            {
              glowPlacement: 'behind' as const,
              colors: [p.darkest, p.base, p.light, p.shifted, p.lightest],
              glowSize: 14,
              opacity: 0.3,
              speedMultiplier: 1,
              coverage: 1,
            },
            {
              glowPlacement: 'behind' as const,
              colors: [p.dark, p.base, p.light, p.shifted, p.lightest, p.light],
              glowSize: 5,
              opacity: 0.5,
              speedMultiplier: 1,
              coverage: 1,
            },
            {
              glowPlacement: 'behind' as const,
              colors: [p.dark, p.base, p.light, p.shifted, p.lightest],
              glowSize: 1,
              opacity: 1,
              speedMultiplier: 1,
              coverage: 1,
            },
            {
              glowPlacement: 'behind' as const,
              colors: [p.darkest, p.base, p.light],
              glowSize: [0, 4, 4, 0] as any,
              opacity: 0.2,
              speedMultiplier: 2,
              coverage: 0.4,
            },
            {
              glowPlacement: 'behind' as const,
              colors: ['#FFFFFF'],
              glowSize: [0, 2, 0] as any,
              opacity: 0.2,
              speedMultiplier: 2,
              coverage: 0.4,
            },
          ],
        },
      },
    ],
  };
}

export function GlowingCardWrapper({
  color,
  children,
  borderRadius = 20,
}: GlowingCardWrapperProps) {
  const preset = React.useMemo(
    () => buildGlowPreset(color, borderRadius),
    [color, borderRadius]
  );

  return (
    <View style={styles.wrapper}>
      <AnimatedGlow preset={preset}>
        {children}
      </AnimatedGlow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
});
