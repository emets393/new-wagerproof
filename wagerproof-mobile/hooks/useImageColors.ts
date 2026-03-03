import { useEffect, useMemo, useState } from 'react';
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';

export interface TeamColors {
  primary: string;
  secondary: string;
}

const DEFAULT_COLORS: TeamColors = { primary: '#6B7280', secondary: '#9CA3AF' };
const SAMPLE_SIZE = 24;
const MIN_ALPHA = 40;

const resolvedColorCache = new Map<string, TeamColors>();
const inFlightColorCache = new Map<string, Promise<TeamColors>>();

type QuantizedBucket = {
  count: number;
  weight: number;
  r: number;
  g: number;
  b: number;
};

function sanitizeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const normalized = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

function normalizeColors(colors?: TeamColors): TeamColors {
  return {
    primary: sanitizeHex(colors?.primary, DEFAULT_COLORS.primary),
    secondary: sanitizeHex(colors?.secondary, DEFAULT_COLORS.secondary),
  };
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map(channel => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function getLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function colorDistance(a: string, b: string): number {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);

  return Math.sqrt(
    (ar - br) ** 2 +
    (ag - bg) ** 2 +
    (ab - bb) ** 2
  );
}

function quantizeChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value / 24) * 24));
}

function buildColorBuckets(pixels: Uint8Array): QuantizedBucket[] {
  const buckets = new Map<string, QuantizedBucket>();

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < MIN_ALPHA) {
      continue;
    }

    const saturation = getSaturation(r, g, b);
    const luminance = getLuminance(r, g, b);

    if (luminance > 0.97 && saturation < 0.08) {
      continue;
    }

    const weight = (a / 255) * (0.45 + saturation * 1.4 + (1 - Math.abs(luminance - 0.5)) * 0.2);
    const key = `${quantizeChannel(r)}-${quantizeChannel(g)}-${quantizeChannel(b)}`;
    const existing = buckets.get(key);

    if (existing) {
      existing.count += 1;
      existing.weight += weight;
      existing.r += r * weight;
      existing.g += g * weight;
      existing.b += b * weight;
      continue;
    }

    buckets.set(key, {
      count: 1,
      weight,
      r: r * weight,
      g: g * weight,
      b: b * weight,
    });
  }

  return Array.from(buckets.values()).sort((a, b) => b.weight - a.weight);
}

function chooseColorsFromPixels(pixels: Uint8Array, fallback: TeamColors): TeamColors {
  const buckets = buildColorBuckets(pixels);

  if (buckets.length === 0) {
    return fallback;
  }

  const palette = buckets.map(bucket =>
    toHex(bucket.r / bucket.weight, bucket.g / bucket.weight, bucket.b / bucket.weight)
  );

  const primary = palette[0] ?? fallback.primary;
  const secondary =
    palette.find((color, index) => {
      if (index === 0) return false;

      const distance = colorDistance(primary, color);
      const saturation = getSaturation(
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16)
      );

      return distance >= 60 || saturation >= 0.18;
    }) ??
    palette[1] ??
    fallback.secondary;

  if (colorDistance(primary, secondary) < 18) {
    return {
      primary,
      secondary: fallback.secondary !== primary ? fallback.secondary : DEFAULT_COLORS.secondary,
    };
  }

  return { primary, secondary };
}

async function extractColorsFromLogo(imageUrl: string, fallback: TeamColors): Promise<TeamColors> {
  if (resolvedColorCache.has(imageUrl)) {
    return resolvedColorCache.get(imageUrl)!;
  }

  const existingRequest = inFlightColorCache.get(imageUrl);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      const data = await Skia.Data.fromURI(imageUrl);
      const image = Skia.Image.MakeImageFromEncoded(data);

      if (!image) {
        return fallback;
      }

      const rasterImage = image.makeNonTextureImage();
      const surface = Skia.Surface.Make(SAMPLE_SIZE, SAMPLE_SIZE) ?? Skia.Surface.MakeOffscreen(SAMPLE_SIZE, SAMPLE_SIZE);

      if (!surface) {
        return fallback;
      }

      const canvas = surface.getCanvas();
      const paint = Skia.Paint();
      canvas.clear(Skia.Color('transparent'));
      canvas.drawImageRect(
        rasterImage,
        Skia.XYWHRect(0, 0, rasterImage.width(), rasterImage.height()),
        Skia.XYWHRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE),
        paint,
        true
      );
      surface.flush();

      const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
        width: SAMPLE_SIZE,
        height: SAMPLE_SIZE,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });

      if (!(pixels instanceof Uint8Array)) {
        return fallback;
      }

      const extracted = chooseColorsFromPixels(pixels, fallback);
      resolvedColorCache.set(imageUrl, extracted);
      return extracted;
    } catch {
      return fallback;
    } finally {
      inFlightColorCache.delete(imageUrl);
    }
  })();

  inFlightColorCache.set(imageUrl, request);
  return request;
}

export function useImageColors(
  imageUrl: string | null | undefined,
  fallback?: TeamColors
): TeamColors {
  const normalizedFallback = useMemo(() => normalizeColors(fallback), [fallback?.primary, fallback?.secondary]);
  const [colors, setColors] = useState<TeamColors>(() => {
    if (!imageUrl) {
      return normalizedFallback;
    }

    return resolvedColorCache.get(imageUrl) ?? normalizedFallback;
  });

  useEffect(() => {
    let isCancelled = false;

    if (!imageUrl) {
      setColors(normalizedFallback);
      return;
    }

    setColors(resolvedColorCache.get(imageUrl) ?? normalizedFallback);

    extractColorsFromLogo(imageUrl, normalizedFallback).then(extractedColors => {
      if (!isCancelled) {
        setColors(extractedColors);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [imageUrl, normalizedFallback]);

  return colors;
}

export function useGameTeamColors(
  awayLogoUrl: string | null | undefined,
  homeLogoUrl: string | null | undefined,
  awayFallback?: TeamColors,
  homeFallback?: TeamColors
): { awayColors: TeamColors; homeColors: TeamColors } {
  const awayColors = useImageColors(awayLogoUrl, awayFallback);
  const homeColors = useImageColors(homeLogoUrl, homeFallback);

  return { awayColors, homeColors };
}
