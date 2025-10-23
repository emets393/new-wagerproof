import { collegeFootballSupabase } from '@/services/collegeFootballClient';

export interface LineMovementData {
  as_of_ts: string;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
}

export interface PublicBettingData {
  ml: { team: string; percentage: number } | null;
  spread: { team: string; percentage: number } | null;
  total: { team: string; percentage: number } | null;
}

export async function fetchLineMovement(trainingKey: string): Promise<LineMovementData[]> {
  try {
    const { data, error } = await collegeFootballSupabase
      .from('cfb_betting_lines')
      .select('as_of_ts, home_spread, away_spread, over_line')
      .eq('training_key', trainingKey)
      .order('as_of_ts', { ascending: true });

    if (error) {
      console.error('Error fetching CFB line movement:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching CFB line movement:', err);
    return [];
  }
}

export async function fetchPublicBettingDistribution(trainingKey: string): Promise<PublicBettingData | null> {
  try {
    // Note: circa_lines may not have CFB data, but we'll try
    const { data, error } = await collegeFootballSupabase
      .from('circa_lines')
      .select('*')
      .eq('training_key', trainingKey)
      .single();

    if (error || !data) {
      return null;
    }

    // Parse the data similar to NFL
    return {
      ml: data.ml_splits_label ? parseBettingSplit(data.ml_splits_label) : null,
      spread: data.spread_splits_label ? parseBettingSplit(data.spread_splits_label) : null,
      total: data.total_splits_label ? parseBettingSplit(data.total_splits_label) : null,
    };
  } catch (err) {
    console.error('Error fetching CFB public betting:', err);
    return null;
  }
}

export function parseBettingSplit(label: string): { team: string; percentage: number } | null {
  if (!label) return null;
  
  // Format: "TeamName 65%" or "Over 52%"
  const match = label.match(/(.+?)\s+(\d+)%/);
  if (match) {
    return {
      team: match[1].trim(),
      percentage: parseInt(match[2], 10),
    };
  }
  
  return null;
}

export function getBettingColorTheme(isDark: boolean) {
  return {
    success: isDark ? '#22c55e' : '#16a34a',
    successLight: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
    danger: isDark ? '#ef4444' : '#dc2626',
    dangerLight: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
    warning: isDark ? '#f59e0b' : '#d97706',
    warningLight: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
    info: isDark ? '#3b82f6' : '#2563eb',
    infoLight: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
  };
}

export function getThemeColors(theme: any) {
  return {
    surface: theme.colors.surface,
    onSurface: theme.colors.onSurface,
    surfaceVariant: theme.colors.surfaceVariant,
    onSurfaceVariant: theme.colors.onSurfaceVariant,
    outline: theme.colors.outline,
  };
}

