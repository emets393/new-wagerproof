import { collegeFootballSupabase } from '@/services/collegeFootballClient';

// Parse betting split label to extract team, percentage, and type
export interface BettingSplitData {
  team: string;
  percentage: number;
  isSharp: boolean;
  isPublic: boolean;
  direction?: string; // For totals: "over" or "under"
}

export const parseBettingSplit = (label: string | null): BettingSplitData | null => {
  if (!label) return null;

  const lowerLabel = label.toLowerCase();

  // Extract percentage
  const percentMatch = label.match(/(\d+)%/);
  const percentage = percentMatch ? parseInt(percentMatch[1]) : 50;

  // Determine if sharp or public
  const isSharp = lowerLabel.includes('sharp');
  const isPublic = lowerLabel.includes('public');

  // Extract team name or direction
  let team = '';
  let direction = undefined;

  // Check for Over/Under (for totals)
  if (lowerLabel.includes('over')) {
    direction = 'over';
    team = 'Over';
  } else if (lowerLabel.includes('under')) {
    direction = 'under';
    team = 'Under';
  } else {
    // Extract team name (usually after "on" keyword)
    const teamMatch = label.match(/on\s+([A-Za-z\s]+?)(?:\s*\(|$)/);
    if (teamMatch) {
      team = teamMatch[1].trim();
    }
  }

  return { team, percentage, isSharp, isPublic, direction };
};

// Determine which row should display the label based on team mention
export interface LabelRowInfo {
  isHomeOrOver: boolean;  // true = home team or Over side gets label
  labelText: string;      // The original label text
  isSharp: boolean;       // Whether it's a "sharp" indicator
}

export const parseLabelForRow = (
  label: string | null,
  homeTeam: string,
  awayTeam: string
): LabelRowInfo | null => {
  if (!label) return null;

  const lowerLabel = label.toLowerCase();
  const isSharp = lowerLabel.includes('sharp');

  // For totals - check for Over/Under
  if (lowerLabel.includes('over')) {
    return { isHomeOrOver: true, labelText: label, isSharp };
  }
  if (lowerLabel.includes('under')) {
    return { isHomeOrOver: false, labelText: label, isSharp };
  }

  // For team-based labels (ML and Spread)
  // Check if label mentions home team
  if (lowerLabel.includes(homeTeam.toLowerCase())) {
    return { isHomeOrOver: true, labelText: label, isSharp };
  }
  // Check if label mentions away team
  if (lowerLabel.includes(awayTeam.toLowerCase())) {
    return { isHomeOrOver: false, labelText: label, isSharp };
  }

  return null;
};

// H2H Game interface
export interface H2HGame {
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  home_spread: number | null;
  away_spread: number | null;
}

// Fetch head-to-head history
export const fetchH2HData = async (homeTeam: string, awayTeam: string): Promise<H2HGame[]> => {
  try {
    const { data, error } = await collegeFootballSupabase
      .from('nfl_training_data')
      .select('*')
      .or(`and(home_team.eq."${homeTeam}",away_team.eq."${awayTeam}"),and(home_team.eq."${awayTeam}",away_team.eq."${homeTeam}")`)
      .order('game_date', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching H2H data:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching H2H data:', err);
    return [];
  }
};

// Line Movement interface
export interface LineMovementData {
  as_of_ts: string;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
}

// Fetch line movement data
export const fetchLineMovement = async (trainingKey: string): Promise<LineMovementData[]> => {
  try {
    const { data, error } = await collegeFootballSupabase
      .from('nfl_betting_lines')
      .select('as_of_ts, home_spread, away_spread, over_line')
      .eq('training_key', trainingKey)
      .order('as_of_ts', { ascending: true });

    if (error) {
      console.error('Error fetching line movement data:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching line movement data:', err);
    return [];
  }
};

// Helper to get color theme based on percentage
export const getBettingColorTheme = (data: BettingSplitData | null) => {
  if (!data) return 'neutral';
  
  if (data.isSharp) return 'green';
  if (data.percentage >= 70) return 'purple';
  if (data.percentage >= 60) return 'blue';
  return 'neutral';
};

// Get colors for theme
export const getThemeColors = (theme: string) => {
  switch (theme) {
    case 'green':
      return {
        bg: 'rgba(34, 197, 94, 0.2)',
        border: 'rgba(34, 197, 94, 0.4)',
        text: '#22c55e'
      };
    case 'purple':
      return {
        bg: 'rgba(168, 85, 247, 0.2)',
        border: 'rgba(168, 85, 247, 0.4)',
        text: '#a855f7'
      };
    case 'blue':
      return {
        bg: 'rgba(59, 130, 246, 0.2)',
        border: 'rgba(59, 130, 246, 0.4)',
        text: '#3b82f6'
      };
    default:
      return {
        bg: 'rgba(100, 116, 139, 0.2)',
        border: 'rgba(100, 116, 139, 0.4)',
        text: '#64748b'
      };
  }
};

