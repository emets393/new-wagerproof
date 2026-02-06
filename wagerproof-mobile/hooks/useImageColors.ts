/**
 * Team color hooks for NCAAB game cards and bottom sheets.
 *
 * Previously used react-native-image-colors (native module) to extract colors
 * from ESPN logo images, but that requires a native rebuild which breaks the
 * current Xcode setup. Instead, this now simply passes through the fallback
 * colors provided by the caller (typically from getCFBTeamColors).
 *
 * The public API is unchanged so all consuming components work as-is.
 */

export interface TeamColors {
  primary: string;
  secondary: string;
}

const DEFAULT_COLORS: TeamColors = { primary: '#6B7280', secondary: '#9CA3AF' };

/**
 * Returns team colors for a given logo URL.
 * Currently returns the provided fallback (or default gray).
 */
export function useImageColors(
  _imageUrl: string | null | undefined,
  fallback?: TeamColors
): TeamColors {
  return fallback ?? DEFAULT_COLORS;
}

/**
 * Returns team colors for both away and home logos.
 * Currently returns the provided fallbacks (or default gray).
 */
export function useGameTeamColors(
  _awayLogoUrl: string | null | undefined,
  _homeLogoUrl: string | null | undefined,
  awayFallback?: TeamColors,
  homeFallback?: TeamColors
): { awayColors: TeamColors; homeColors: TeamColors } {
  return {
    awayColors: awayFallback ?? DEFAULT_COLORS,
    homeColors: homeFallback ?? DEFAULT_COLORS,
  };
}
