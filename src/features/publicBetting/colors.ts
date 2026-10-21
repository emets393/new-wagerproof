import type { TeamRef } from '@/features/games/types';
import type { PublicMarket } from './types';

/** Same over/under fills as the splits widget on /games. */
export const OVER_COLOR = '#10b981';
export const UNDER_COLOR = '#3b82f6';

/** Below this, two bar colors read as the same team. */
const MIN_SEPARATION = 72;

function channel(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16);
}

function rgb(color: string): [number, number, number] | null {
  const hex = color.replace('#', '').trim();
  const full = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  if (full.length < 6 || Number.isNaN(channel(full, 0))) return null;
  return [channel(full, 0), channel(full, 2), channel(full, 4)];
}

export function colorDistance(a: string, b: string): number {
  const left = rgb(a);
  const right = rgb(b);
  if (!left || !right) return 0;
  const dr = left[0] - right[0];
  const dg = left[1] - right[1];
  const db = left[2] - right[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function hex(color: string): string {
  const parts = rgb(color);
  if (!parts) return '#94a3b8';
  return `#${parts.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The feed card in dark mode is a 6% white film over hsl(222.2 84% 4.9%).
 * Navy, black, and deep purple sit under 2:1 on that surface, so a bar in
 * those colors reads as empty. 4:1 is enough for a thick fill without
 * washing a green or a red out to pastel.
 */
const CARD_BG = '#111725';
const MIN_BAR_CONTRAST = 4;

function channelLinear(value: number): number {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(color: string, against = CARD_BG): number {
  const left = rgb(color);
  const right = rgb(against);
  if (!left || !right) return 1;
  const lum = (parts: [number, number, number]) =>
    0.2126 * channelLinear(parts[0]) + 0.7152 * channelLinear(parts[1]) + 0.0722 * channelLinear(parts[2]);
  const lighter = Math.max(lum(left), lum(right));
  const darker = Math.min(lum(left), lum(right));
  return (lighter + 0.05) / (darker + 0.05);
}

function mixTowardWhite(color: string, amount: number): string {
  const parts = rgb(color) ?? [148, 163, 184];
  const mixed = parts.map((part) => Math.round(part + (255 - part) * amount));
  return `#${mixed.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

/** Lighten only as far as the dark card requires. A color that already clears stays put. */
export function visibleBarColor(color: string): string {
  const start = hex(color);
  if (contrastRatio(start) >= MIN_BAR_CONTRAST) return start;
  let lo = 0;
  let hi = 0.92;
  for (let step = 0; step < 14; step++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(mixTowardWhite(start, mid)) >= MIN_BAR_CONTRAST) hi = mid;
    else lo = mid;
  }
  const lifted = mixTowardWhite(start, hi);
  return contrastRatio(lifted) >= MIN_BAR_CONTRAST ? lifted : mixTowardWhite(start, Math.min(0.92, hi + 0.05));
}

function lift(color: string): string {
  const parts = rgb(color) ?? [148, 163, 184];
  const mixed = parts.map((part) => Math.round(part + (255 - part) * 0.55));
  return visibleBarColor(`#${mixed.map((part) => part.toString(16).padStart(2, '0')).join('')}`);
}

/** Primary first, then secondary, each one already light enough to read. */
function choices(colors: { primary: string; secondary: string }): string[] {
  return [...new Set([colors.primary, colors.secondary].map(visibleBarColor))];
}

/**
 * Spread and moneyline use team colors. When the two primaries are the same
 * family (Oklahoma crimson against Mississippi State maroon), one side takes
 * its secondary so the split stays readable.
 */
export function sideColors(
  market: PublicMarket,
  away: TeamRef,
  home: TeamRef,
): { away: string; home: string } {
  if (market === 'total') return { away: OVER_COLOR, home: UNDER_COLOR };

  const awayChoices = choices(away.colors);
  const homeChoices = choices(home.colors);
  const primary = { away: awayChoices[0], home: homeChoices[0] };
  if (colorDistance(primary.away, primary.home) >= MIN_SEPARATION) return primary;

  let best = { ...primary, score: colorDistance(primary.away, primary.home), rank: 0 };
  awayChoices.forEach((awayColor, awayIndex) => {
    homeChoices.forEach((homeColor, homeIndex) => {
      const score = colorDistance(awayColor, homeColor);
      const rank = awayIndex + homeIndex;
      const better = score > best.score + 6 || (score >= best.score - 6 && rank < best.rank);
      if (better) best = { away: awayColor, home: homeColor, score, rank };
    });
  });

  if (best.score >= MIN_SEPARATION) return { away: best.away, home: best.home };
  return { away: best.away, home: lift(best.home) };
}

export function withAlpha(color: string, alpha: number): string {
  const parts = rgb(color);
  if (!parts) return color;
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}
