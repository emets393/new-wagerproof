import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getNBATeamColors, getNBATeamInitials } from '@/utils/teamColors';
import debug from '@/utils/debug';

interface SituationalTrendRow {
  game_id: number;
  game_date: string;
  team_id: number;
  team_abbr: string;
  team_name: string;
  team_side: 'home' | 'away';
  last_game_situation: string;
  fav_dog_situation: string;
  side_spread_situation: string;
  home_away_situation: string | null;
  rest_bucket: string;
  rest_comp: string;
  ats_last_game_record: string;
  ats_last_game_cover_pct: number;
  ats_fav_dog_record: string;
  ats_fav_dog_cover_pct: number;
  ats_side_fav_dog_record: string;
  ats_side_fav_dog_cover_pct: number;
  ats_home_away_record: string | null;
  ats_home_away_cover_pct: number | null;
  ats_rest_bucket_record: string;
  ats_rest_bucket_cover_pct: number;
  ats_rest_comp_record: string;
  ats_rest_comp_cover_pct: number;
  ou_last_game_record: string;
  ou_last_game_over_pct: number;
  ou_last_game_under_pct: number;
  ou_fav_dog_record: string;
  ou_fav_dog_over_pct: number;
  ou_fav_dog_under_pct: number;
  ou_side_fav_dog_record: string;
  ou_side_fav_dog_over_pct: number;
  ou_side_fav_dog_under_pct: number;
  ou_home_away_record: string | null;
  ou_home_away_over_pct: number | null;
  ou_home_away_under_pct: number | null;
  ou_rest_bucket_record: string;
  ou_rest_bucket_over_pct: number;
  ou_rest_bucket_under_pct: number;
  ou_rest_comp_record: string;
  ou_rest_comp_over_pct: number;
  ou_rest_comp_under_pct: number;
}

interface GameTrends {
  game_id: number;
  game_date: string;
  tipoff_time_et: string | null;
  away_team: SituationalTrendRow;
  home_team: SituationalTrendRow;
}

// Helper function to format situation text
const formatSituation = (situation: string | null | undefined): string => {
  if (!situation) return '-';
  
  const situationMap: { [key: string]: string } = {
    'is_after_loss': 'After Loss',
    'is_after_win': 'After Win',
    'is_fav': 'Favorite',
    'is_dog': 'Underdog',
    'is_home_fav': 'Home Favorite',
    'is_away_fav': 'Away Favorite',
    'is_home_dog': 'Home Underdog',
    'is_away_dog': 'Away Underdog',
    'one_day_off': '1 Day Off',
    'two_three_days_off': '2-3 Days Off',
    'four_plus_days_off': '4+ Days Off',
    'rest_advantage': 'Rest Advantage',
    'rest_disadvantage': 'Rest Disadvantage',
    'rest_equal': 'Rest Equal',
  };
  return situationMap[situation] || situation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Helper function to parse record string (e.g., "15-3-0")
const parseRecord = (record: string | null | undefined): { wins: number; losses: number; pushes: number; total: number } => {
  if (!record) return { wins: 0, losses: 0, pushes: 0, total: 0 };
  
  const parts = record.split('-').map(Number);
  const wins = parts[0] || 0;
  const losses = parts[1] || 0;
  const pushes = parts[2] || 0;
  const total = wins + losses + pushes;
  
  return { wins, losses, pushes, total };
};

// Helper function to extract Over wins from OU record
// OU record format: "10-15-0" = 10 Overs, 15 Unders, 0 Pushes
const getOverWins = (ouRecord: string | null | undefined): number => {
  if (!ouRecord) return 0;
  const parsed = parseRecord(ouRecord);
  // For OU records, wins represent Over wins
  return parsed.wins;
};

// Helper function to extract Under wins from OU record
// OU record format: "10-15-0" = 10 Overs, 15 Unders, 0 Pushes
const getUnderWins = (ouRecord: string | null | undefined): number => {
  if (!ouRecord) return 0;
  const parsed = parseRecord(ouRecord);
  // For OU records, losses represent Under wins
  return parsed.losses;
};

// Helper function to get NBA team logo URL
const getNBATeamLogoUrl = (teamName: string): string => {
  if (!teamName) return '/placeholder.svg';
  
  const espnLogoMap: { [key: string]: string } = {
    'Atlanta': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
    'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
    'Boston': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    'Brooklyn': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
    'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
    'Charlotte': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
    'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
    'Chicago': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
    'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
    'Cleveland': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
    'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
    'Dallas': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    'Denver': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
    'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
    'Detroit': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
    'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
    'Golden State': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    'Houston': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
    'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
    'Indiana': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
    'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
    'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'Los Angeles Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'LA Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Memphis': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
    'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
    'Miami': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    'Milwaukee': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    'Minnesota': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
    'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
    'New Orleans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
    'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
    'New York': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
    'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
    'Oklahoma City': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Okla City': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Orlando': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
    'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
    'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
    'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
    'Phoenix': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
    'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
    'Portland': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    'Sacramento': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
    'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
    'San Antonio': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
    'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
    'Toronto': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
    'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
    'Utah': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
    'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
    'Washington': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
    'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
  };
  
  // Try exact match first
  if (espnLogoMap[teamName]) {
    return espnLogoMap[teamName];
  }
  
  // Try case-insensitive match
  const lowerTeamName = teamName.toLowerCase();
  const matchedKey = Object.keys(espnLogoMap).find(key => key.toLowerCase() === lowerTeamName);
  if (matchedKey) {
    return espnLogoMap[matchedKey];
  }
  
  // Try partial match
  for (const [key, url] of Object.entries(espnLogoMap)) {
    if (teamName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(teamName.toLowerCase())) {
      return url;
    }
  }
  
  return '/placeholder.svg';
};

// Helper function to get color for percentage
const getPercentageColor = (pct: number | null): string => {
  if (pct === null) return 'text-gray-500';
  if (pct > 55) return 'text-green-600 dark:text-green-400';
  if (pct < 45) return 'text-red-600 dark:text-red-400';
  return 'text-yellow-600 dark:text-yellow-400';
};

// Helper function to check if percentage is green (>55)
const isGreen = (pct: number | null): boolean => {
  return pct !== null && pct > 55;
};

// Helper function to check if percentage is yellow (45-55)
const isYellow = (pct: number | null): boolean => {
  return pct !== null && pct >= 45 && pct <= 55;
};

// Helper function to get consensus for ATS
const getATSConsensus = (
  awayPct: number | null,
  homePct: number | null,
  awayTeamName: string,
  homeTeamName: string,
  awayTeamAbbr: string,
  homeTeamAbbr: string
) => {
  if (awayPct === null || homePct === null) return null;
  
  if (awayPct > homePct) {
    return {
      type: 'team' as const,
      teamName: awayTeamName,
      teamAbbr: awayTeamAbbr,
      logo: getNBATeamLogoUrl(awayTeamName)
    };
  } else if (homePct > awayPct) {
    return {
      type: 'team' as const,
      teamName: homeTeamName,
      teamAbbr: homeTeamAbbr,
      logo: getNBATeamLogoUrl(homeTeamName)
    };
  }
  return null; // Tie
};

// Helper function to get consensus for Over/Under
const getOUConsensus = (
  awayOverPct: number | null,
  awayUnderPct: number | null,
  homeOverPct: number | null,
  homeUnderPct: number | null,
  awayTeamName: string,
  homeTeamName: string,
  awayTeamAbbr: string,
  homeTeamAbbr: string
) => {
  const awayOverGreen = isGreen(awayOverPct);
  const awayOverYellow = isYellow(awayOverPct);
  const awayUnderGreen = isGreen(awayUnderPct);
  const awayUnderYellow = isYellow(awayUnderPct);
  
  const homeOverGreen = isGreen(homeOverPct);
  const homeOverYellow = isYellow(homeOverPct);
  const homeUnderGreen = isGreen(homeUnderPct);
  const homeUnderYellow = isYellow(homeUnderPct);
  
  // Both teams green for Over
  if (awayOverGreen && homeOverGreen) {
    // Return team with higher Over percentage
    const isAway = (awayOverPct || 0) > (homeOverPct || 0);
    return { 
      type: 'over' as const,
      teamName: isAway ? awayTeamName : homeTeamName,
      teamAbbr: isAway ? awayTeamAbbr : homeTeamAbbr,
      logo: getNBATeamLogoUrl(isAway ? awayTeamName : homeTeamName)
    };
  }
  
  // Both teams green for Under
  if (awayUnderGreen && homeUnderGreen) {
    // Return team with higher Under percentage
    const isAway = (awayUnderPct || 0) > (homeUnderPct || 0);
    return { 
      type: 'under' as const,
      teamName: isAway ? awayTeamName : homeTeamName,
      teamAbbr: isAway ? awayTeamAbbr : homeTeamAbbr,
      logo: getNBATeamLogoUrl(isAway ? awayTeamName : homeTeamName)
    };
  }
  
  // One green Over, other green Under - No Consensus
  if ((awayOverGreen && homeUnderGreen) || (awayUnderGreen && homeOverGreen)) {
    return { type: 'no_consensus' as const };
  }
  
  // One green Over, other yellow Over - Consensus Over
  if (awayOverGreen && homeOverYellow) {
    return { 
      type: 'over' as const,
      teamName: awayTeamName,
      teamAbbr: awayTeamAbbr,
      logo: getNBATeamLogoUrl(awayTeamName)
    };
  }
  if (homeOverGreen && awayOverYellow) {
    return { 
      type: 'over' as const,
      teamName: homeTeamName,
      teamAbbr: homeTeamAbbr,
      logo: getNBATeamLogoUrl(homeTeamName)
    };
  }
  
  // One green Under, other yellow Under - Consensus Under
  if (awayUnderGreen && homeUnderYellow) {
    return { 
      type: 'under' as const,
      teamName: awayTeamName,
      teamAbbr: awayTeamAbbr,
      logo: getNBATeamLogoUrl(awayTeamName)
    };
  }
  if (homeUnderGreen && awayUnderYellow) {
    return { 
      type: 'under' as const,
      teamName: homeTeamName,
      teamAbbr: homeTeamAbbr,
      logo: getNBATeamLogoUrl(homeTeamName)
    };
  }
  
  // Both yellow for same side - No Consensus
  if ((awayOverYellow && homeOverYellow) || (awayUnderYellow && homeUnderYellow)) {
    return { type: 'no_consensus' as const };
  }
  
  return { type: 'no_consensus' as const };
};

// Helper function to convert UTC time to EST and format it
const formatTipoffTime = (tipoffTimeUtc: string | null): string => {
  if (!tipoffTimeUtc) return '';
  
  try {
    // Parse the UTC time string (format: "2026-01-19 18:10:00+00" or ISO format)
    const utcDate = new Date(tipoffTimeUtc);
    
    if (isNaN(utcDate.getTime())) {
      console.error('Invalid date:', tipoffTimeUtc);
      return '';
    }
    
    // Debug logging
    console.log('Formatting tipoff time:', {
      input: tipoffTimeUtc,
      parsedUTC: utcDate.toISOString(),
      utcTime: utcDate.toLocaleTimeString('en-US', { timeZone: 'UTC' }),
      estTime: utcDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })
    });
    
    // Format time in EST/EDT
    const timeStr = utcDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Format date in EST/EDT
    const dateStr = utcDate.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Determine if EST or EDT
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(utcDate);
    const tzName = parts.find(part => part.type === 'timeZoneName')?.value || 'EST';
    
    // Get day suffix (1st, 2nd, 3rd, 4th, etc.)
    const dayMatch = dateStr.match(/(\d+)/);
    const day = dayMatch ? parseInt(dayMatch[1]) : 0;
    const getDaySuffix = (day: number): string => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    // Replace the day number with day + suffix
    const formattedDate = dateStr.replace(/\d+/, `${day}${getDaySuffix(day)}`);
    
    return `${timeStr} ${tzName} ${formattedDate}`;
  } catch (error) {
    console.error('Error formatting tipoff time:', error);
    return '';
  }
};

// Calculate Over/Under Consensus Strength score for a game
const calculateOUConsensusStrength = (game: GameTrends): number => {
  let totalScore = 0;
  const minGamesThreshold = 5;
  const minPercentage = 55;
  
  // Define all situations to check
  const situations = [
    {
      awayOverPct: game.away_team.ou_last_game_over_pct,
      awayUnderPct: game.away_team.ou_last_game_under_pct,
      awayRecord: game.away_team.ou_last_game_record,
      homeOverPct: game.home_team.ou_last_game_over_pct,
      homeUnderPct: game.home_team.ou_last_game_under_pct,
      homeRecord: game.home_team.ou_last_game_record,
    },
    {
      awayOverPct: game.away_team.ou_fav_dog_over_pct,
      awayUnderPct: game.away_team.ou_fav_dog_under_pct,
      awayRecord: game.away_team.ou_fav_dog_record,
      homeOverPct: game.home_team.ou_fav_dog_over_pct,
      homeUnderPct: game.home_team.ou_fav_dog_under_pct,
      homeRecord: game.home_team.ou_fav_dog_record,
    },
    {
      awayOverPct: game.away_team.ou_side_fav_dog_over_pct,
      awayUnderPct: game.away_team.ou_side_fav_dog_under_pct,
      awayRecord: game.away_team.ou_side_fav_dog_record,
      homeOverPct: game.home_team.ou_side_fav_dog_over_pct,
      homeUnderPct: game.home_team.ou_side_fav_dog_under_pct,
      homeRecord: game.home_team.ou_side_fav_dog_record,
    },
    {
      awayOverPct: game.away_team.ou_rest_bucket_over_pct,
      awayUnderPct: game.away_team.ou_rest_bucket_under_pct,
      awayRecord: game.away_team.ou_rest_bucket_record,
      homeOverPct: game.home_team.ou_rest_bucket_over_pct,
      homeUnderPct: game.home_team.ou_rest_bucket_under_pct,
      homeRecord: game.home_team.ou_rest_bucket_record,
    },
    {
      awayOverPct: game.away_team.ou_rest_comp_over_pct,
      awayUnderPct: game.away_team.ou_rest_comp_under_pct,
      awayRecord: game.away_team.ou_rest_comp_record,
      homeOverPct: game.home_team.ou_rest_comp_over_pct,
      homeUnderPct: game.home_team.ou_rest_comp_under_pct,
      homeRecord: game.home_team.ou_rest_comp_record,
    },
  ];
  
  situations.forEach(situation => {
    // Check if both teams favor Over
    const bothFavorOver = 
      situation.awayOverPct !== null && situation.awayOverPct > minPercentage &&
      situation.homeOverPct !== null && situation.homeOverPct > minPercentage;
    
    // Check if both teams favor Under
    const bothFavorUnder = 
      situation.awayUnderPct !== null && situation.awayUnderPct > minPercentage &&
      situation.homeUnderPct !== null && situation.homeUnderPct > minPercentage;
    
    if (bothFavorOver) {
      const awayGames = parseRecord(situation.awayRecord).total;
      const homeGames = parseRecord(situation.homeRecord).total;
      
      if (awayGames >= minGamesThreshold && homeGames >= minGamesThreshold) {
        // Weighted score: average percentage * minimum games (reliability factor)
        const totalGames = awayGames + homeGames;
        const avgPct = ((situation.awayOverPct || 0) * awayGames + (situation.homeOverPct || 0) * homeGames) / totalGames;
        const score = avgPct * Math.min(awayGames, homeGames);
        totalScore += score;
      }
    }
    
    if (bothFavorUnder) {
      const awayGames = parseRecord(situation.awayRecord).total;
      const homeGames = parseRecord(situation.homeRecord).total;
      
      if (awayGames >= minGamesThreshold && homeGames >= minGamesThreshold) {
        // Weighted score: average percentage * minimum games (reliability factor)
        const totalGames = awayGames + homeGames;
        const avgPct = ((situation.awayUnderPct || 0) * awayGames + (situation.homeUnderPct || 0) * homeGames) / totalGames;
        const score = avgPct * Math.min(awayGames, homeGames);
        totalScore += score;
      }
    }
  });
  
  return totalScore;
};

// Calculate ATS Dominance score for a game
const calculateATSDominance = (game: GameTrends): number => {
  let totalScore = 0;
  const minGamesThreshold = 5;
  const minDifference = 10; // Minimum 10 percentage point difference
  
  // Define all situations to check
  const situations = [
    {
      awayPct: game.away_team.ats_last_game_cover_pct,
      awayRecord: game.away_team.ats_last_game_record,
      homePct: game.home_team.ats_last_game_cover_pct,
      homeRecord: game.home_team.ats_last_game_record,
    },
    {
      awayPct: game.away_team.ats_fav_dog_cover_pct,
      awayRecord: game.away_team.ats_fav_dog_record,
      homePct: game.home_team.ats_fav_dog_cover_pct,
      homeRecord: game.home_team.ats_fav_dog_record,
    },
    {
      awayPct: game.away_team.ats_side_fav_dog_cover_pct,
      awayRecord: game.away_team.ats_side_fav_dog_record,
      homePct: game.home_team.ats_side_fav_dog_cover_pct,
      homeRecord: game.home_team.ats_side_fav_dog_record,
    },
    {
      awayPct: game.away_team.ats_rest_bucket_cover_pct,
      awayRecord: game.away_team.ats_rest_bucket_record,
      homePct: game.home_team.ats_rest_bucket_cover_pct,
      homeRecord: game.home_team.ats_rest_bucket_record,
    },
    {
      awayPct: game.away_team.ats_rest_comp_cover_pct,
      awayRecord: game.away_team.ats_rest_comp_record,
      homePct: game.home_team.ats_rest_comp_cover_pct,
      homeRecord: game.home_team.ats_rest_comp_record,
    },
  ];
  
  situations.forEach(situation => {
    if (situation.awayPct !== null && situation.homePct !== null) {
      const awayGames = parseRecord(situation.awayRecord).total;
      const homeGames = parseRecord(situation.homeRecord).total;
      const minGames = Math.min(awayGames, homeGames);
      
      if (minGames >= minGamesThreshold) {
        const difference = Math.abs(situation.awayPct - situation.homePct);
        
        if (difference > minDifference) {
          // Score = difference * minimum games (weighted by reliability)
          const score = difference * minGames;
          totalScore += score;
        }
      }
    }
  });
  
  return totalScore;
};

export default function NBATodayBettingTrends() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [games, setGames] = useState<GameTrends[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedGames, setExpandedGames] = useState<Set<number>>(new Set());
  const [highlightGameId, setHighlightGameId] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<'time' | 'ou-consensus' | 'ats-dominance'>('time');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      debug.log('Fetching NBA situational trends data...');
      
      // Try the table name as provided
      let query = collegeFootballSupabase
        .from('nba_game_situational_trends_today')
        .select('*')
        .order('game_date', { ascending: true })
        .order('game_id', { ascending: true });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        debug.error('Error fetching NBA trends:', fetchError);
        console.error('Full error details:', fetchError);
        console.error('Error code:', fetchError.code);
        console.error('Error hint:', fetchError.hint);
        console.error('Error message:', fetchError.message);
        
        // If table doesn't exist, try alternative names
        if (fetchError.code === '42P01' || fetchError.message.includes('does not exist')) {
          console.log('Table not found, trying alternative names...');
          // Try without _today suffix
          const { data: altData, error: altError } = await collegeFootballSupabase
            .from('nba_game_situational_trends')
            .select('*')
            .order('game_date', { ascending: true })
            .order('game_id', { ascending: true });
          
          if (!altError && altData) {
            console.log('Found data in nba_game_situational_trends:', altData.length);
            // Process altData here if found
            setError(`Table 'nba_game_situational_trends_today' not found. Found 'nba_game_situational_trends' with ${altData.length} rows. Please verify table name.`);
            setLoading(false);
            return;
          }
        }
        
        setError(`Failed to load data: ${fetchError.message}. Check console for details.`);
        setLoading(false);
        return;
      }

      debug.log('Fetched trends data:', data?.length || 0, 'rows');
      debug.log('Sample data:', data?.[0]);
      console.log('Query result:', { 
        rowCount: data?.length || 0, 
        hasData: !!data && data.length > 0,
        firstRow: data?.[0],
        allData: data
      });
      
      // Debug: Check for home_away fields in the data
      if (data && data.length > 0) {
        const sampleRow = data[0];
        const allKeys = Object.keys(sampleRow);
        console.log('All column names in table:', allKeys);
        console.log('Keys containing "home", "away", or "is_home":', 
          allKeys.filter(key => {
            const lower = key.toLowerCase();
            return lower.includes('home') || lower.includes('away') || lower.includes('is_home') || lower.includes('is_away');
          })
        );
      }

      if (!data || data.length === 0) {
        debug.log('No data returned from query - table exists but is empty');
        console.warn('Table "nba_game_situational_trends_today" exists but contains no rows.');
        console.warn('Please verify:');
        console.warn('1. The table name is correct: nba_game_situational_trends_today');
        console.warn('2. There is data in the table for today\'s games');
        console.warn('3. Check Supabase dashboard to confirm table has data');
        setGames([]);
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      // Group by game_id (2 rows per game)
      // Use team_side column to determine if team is 'away' or 'home'
      const gamesMap = new Map<number, GameTrends>();
      
      data.forEach((row: any) => {
        debug.log('Processing row:', { game_id: row.game_id, team_side: row.team_side, team_name: row.team_name });
        
        // Validate team_side is either 'away' or 'home'
        if (row.team_side !== 'away' && row.team_side !== 'home') {
          console.warn(`Invalid team_side value "${row.team_side}" for game_id ${row.game_id}, team_name ${row.team_name}. Skipping row.`);
          return;
        }
        
        if (!gamesMap.has(row.game_id)) {
          gamesMap.set(row.game_id, {
            game_id: row.game_id,
            game_date: row.game_date,
            tipoff_time_et: null,
            away_team: row.team_side === 'away' ? row : {} as SituationalTrendRow,
            home_team: row.team_side === 'home' ? row : {} as SituationalTrendRow,
          });
        } else {
          const game = gamesMap.get(row.game_id)!;
          // Use team_side to assign to correct team slot
          if (row.team_side === 'away') {
            game.away_team = row;
          } else if (row.team_side === 'home') {
            game.home_team = row;
          }
        }
      });
      
      // Debug: Log specific game data for Oklahoma City vs Cleveland
      gamesMap.forEach((game, gameId) => {
        if (game.away_team.team_name && (
          game.away_team.team_name.includes('Oklahoma') || 
          game.away_team.team_name.includes('Okla') ||
          game.home_team.team_name?.includes('Oklahoma') ||
          game.home_team.team_name?.includes('Okla') ||
          game.away_team.team_name.includes('Cleveland') ||
          game.home_team.team_name?.includes('Cleveland')
        )) {
          console.log('🔍 Oklahoma City/Cleveland Game Debug:', {
            game_id: gameId,
            away_team: game.away_team.team_name,
            home_team: game.home_team.team_name,
            away_team_side: game.away_team.team_side,
            home_team_side: game.home_team.team_side,
            away_fav_dog: {
              situation: game.away_team.fav_dog_situation,
              ats_record: game.away_team.ats_fav_dog_record,
              ats_pct: game.away_team.ats_fav_dog_cover_pct,
              ou_record: game.away_team.ou_fav_dog_record,
              ou_over_pct: game.away_team.ou_fav_dog_over_pct,
              ou_under_pct: game.away_team.ou_fav_dog_under_pct,
            },
            home_fav_dog: {
              situation: game.home_team.fav_dog_situation,
              ats_record: game.home_team.ats_fav_dog_record,
              ats_pct: game.home_team.ats_fav_dog_cover_pct,
              ou_record: game.home_team.ou_fav_dog_record,
              ou_over_pct: game.home_team.ou_fav_dog_over_pct,
              ou_under_pct: game.home_team.ou_fav_dog_under_pct,
            }
          });
        }
      });

      // Filter to only include games with both away and home teams
      // Validate that team_side was used correctly to assign teams
      const gamesArray = Array.from(gamesMap.values()).filter(game => {
        const hasAway = game.away_team.team_name && game.away_team.team_side === 'away';
        const hasHome = game.home_team.team_name && game.home_team.team_side === 'home';
        
        if (!hasAway || !hasHome) {
          console.warn(`Game ${game.game_id} missing complete team data:`, {
            away_team: game.away_team.team_name || 'missing',
            away_team_side: game.away_team.team_side,
            home_team: game.home_team.team_name || 'missing',
            home_team_side: game.home_team.team_side
          });
        }
        
        return hasAway && hasHome;
      });
      
      // Fetch tipoff times from nba_input_values_view
      const gameIds = gamesArray.map(game => game.game_id);
      if (gameIds.length > 0) {
        const { data: gameTimes, error: timesError } = await collegeFootballSupabase
          .from('nba_input_values_view')
          .select('game_id, tipoff_time_et')
          .in('game_id', gameIds);
        
        if (!timesError && gameTimes) {
          const timesMap = new Map<number, string | null>();
          gameTimes.forEach((gt: any) => {
            timesMap.set(gt.game_id, gt.tipoff_time_et);
          });
          
          // Add tipoff times to games
          gamesArray.forEach(game => {
            game.tipoff_time_et = timesMap.get(game.game_id) || null;
          });
        } else if (timesError) {
          console.warn('Error fetching tipoff times:', timesError);
        }
      }
      
      // Calculate scores for each game and store them
      const gamesWithScores = gamesArray.map(game => ({
        ...game,
        ouConsensusScore: calculateOUConsensusStrength(game),
        atsDominanceScore: calculateATSDominance(game),
      }));
      
      // Sort games based on sortMode
      gamesWithScores.sort((a, b) => {
        if (sortMode === 'ou-consensus') {
          // Sort by OU Consensus Strength (descending - highest first)
          return b.ouConsensusScore - a.ouConsensusScore;
        } else if (sortMode === 'ats-dominance') {
          // Sort by ATS Dominance (descending - highest first)
          return b.atsDominanceScore - a.atsDominanceScore;
        } else {
          // Default: Sort by tipoff time (earliest first)
          if (a.tipoff_time_et && b.tipoff_time_et) {
            const timeA = new Date(a.tipoff_time_et).getTime();
            const timeB = new Date(b.tipoff_time_et).getTime();
            return timeA - timeB;
          }
          // Games with tipoff times come before games without
          if (a.tipoff_time_et && !b.tipoff_time_et) return -1;
          if (!a.tipoff_time_et && b.tipoff_time_et) return 1;
          // If neither has tipoff time, sort by game_date
          return new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
        }
      });
      
      // Remove score properties before setting state (keep original structure)
      const sortedGames = gamesWithScores.map(({ ouConsensusScore, atsDominanceScore, ...game }) => game);
      
      debug.log('Processed', sortedGames.length, 'complete games');
      debug.log('Games array:', sortedGames);
      
      setGames(sortedGames);
      setLastUpdated(new Date());
    } catch (err) {
      debug.error('Exception fetching trends:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (games.length === 0) return;

    const focusGameIdParam = searchParams.get('focusGameId');
    if (!focusGameIdParam) return;

    const focusGameId = Number(focusGameIdParam);
    if (!Number.isFinite(focusGameId)) return;

    const exists = games.some((game) => game.game_id === focusGameId);
    if (!exists) return;

    setExpandedGames((prev) => {
      const next = new Set(prev);
      next.add(focusGameId);
      return next;
    });
    setHighlightGameId(focusGameId);

    requestAnimationFrame(() => {
      const target = document.querySelector(`[data-game-id="${focusGameId}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    const timeout = window.setTimeout(() => {
      setHighlightGameId((current) => (current === focusGameId ? null : current));
    }, 2000);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('focusGameId');
    setSearchParams(nextParams, { replace: true });

    return () => window.clearTimeout(timeout);
  }, [games, searchParams, setSearchParams]);

  // Re-sort games when sortMode changes
  useEffect(() => {
    setGames(prevGames => {
      if (prevGames.length === 0) return prevGames;
      
      const gamesWithScores = prevGames.map(game => ({
        ...game,
        ouConsensusScore: calculateOUConsensusStrength(game),
        atsDominanceScore: calculateATSDominance(game),
      }));
      
      const sorted = [...gamesWithScores].sort((a, b) => {
        if (sortMode === 'ou-consensus') {
          return b.ouConsensusScore - a.ouConsensusScore;
        } else if (sortMode === 'ats-dominance') {
          return b.atsDominanceScore - a.atsDominanceScore;
        } else {
          // Sort by time
          if (a.tipoff_time_et && b.tipoff_time_et) {
            const timeA = new Date(a.tipoff_time_et).getTime();
            const timeB = new Date(b.tipoff_time_et).getTime();
            return timeA - timeB;
          }
          if (a.tipoff_time_et && !b.tipoff_time_et) return -1;
          if (!a.tipoff_time_et && b.tipoff_time_et) return 1;
          return new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
        }
      });
      
      // Remove score properties
      return sorted.map(({ ouConsensusScore, atsDominanceScore, ...game }) => game);
    });
  }, [sortMode]);

  const toggleGame = (gameId: number) => {
    setExpandedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
  };

  const renderComparisonRow = (
    label: string,
    awayTeamName: string,
    homeTeamName: string,
    awayTeamAbbr: string,
    homeTeamAbbr: string,
    awaySituation: string,
    homeSituation: string,
    awayAtsRecord: string,
    awayAtsPct: number | null,
    homeAtsRecord: string,
    homeAtsPct: number | null,
    awayOuRecord: string,
    awayOuOverPct: number | null,
    awayOuUnderPct: number | null,
    homeOuRecord: string,
    homeOuOverPct: number | null,
    homeOuUnderPct: number | null
  ) => {
    return (
      <div className="space-y-2 py-3 border-b last:border-b-0">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">{label}</h4>
        
        {/* Situation Row */}
        <div className="grid grid-cols-[120px_200px_0_0_200px_0_0_auto] gap-1 text-sm items-center">
          <div className="font-medium text-xs text-gray-700 dark:text-gray-300">Situation</div>
          <div className="pl-16 text-sm text-left min-w-0">{formatSituation(awaySituation)}</div>
          <div></div>
          <div></div>
          <div className="pl-16 text-sm text-left min-w-0">{formatSituation(homeSituation)}</div>
          <div></div>
          <div></div>
          <div className="flex items-center justify-center">
            {(() => {
              const consensus = getATSConsensus(awayAtsPct, homeAtsPct, awayTeamName, homeTeamName, awayTeamAbbr, homeTeamAbbr);
              if (consensus) {
                return (
                  <img 
                    src={consensus.logo} 
                    alt={consensus.teamName}
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                );
              }
              return <span className="text-sm text-gray-500">-</span>;
            })()}
          </div>
        </div>

        {/* ATS Row */}
        <div className="grid grid-cols-[120px_200px_0_0_200px_0_0_auto] gap-1 text-sm mt-1 items-center">
          <div className="font-medium text-xs text-gray-700 dark:text-gray-300">ATS Record</div>
          <div className="pl-16 text-sm text-left whitespace-nowrap leading-tight min-w-0">
            {awayAtsRecord} (
            <span className={getPercentageColor(awayAtsPct)}>
              {awayAtsPct?.toFixed(1) ?? 'N/A'}%
            </span>
            )
          </div>
          <div></div>
          <div></div>
          <div className="pl-16 text-sm text-left whitespace-nowrap leading-tight min-w-0">
            {homeAtsRecord} (
            <span className={getPercentageColor(homeAtsPct)}>
              {homeAtsPct?.toFixed(1) ?? 'N/A'}%
            </span>
            )
          </div>
          <div></div>
          <div></div>
          <div className="flex items-center justify-center">
            {(() => {
              const consensus = getATSConsensus(awayAtsPct, homeAtsPct, awayTeamName, homeTeamName, awayTeamAbbr, homeTeamAbbr);
              if (consensus) {
                return (
                  <span className="text-sm font-semibold text-white">
                    {consensus.teamAbbr}
                  </span>
                );
              }
              return <span className="text-sm text-gray-500">-</span>;
            })()}
          </div>
        </div>

        {/* OU Row */}
        <div className="grid grid-cols-[120px_200px_0_0_200px_0_0_auto] gap-1 text-sm items-center">
          <div className="font-medium text-xs text-gray-700 dark:text-gray-300">Over/Under Record</div>
          <div className="pl-16 text-sm text-left whitespace-nowrap leading-tight min-w-0">
            {awayOuRecord} (
            <span className={getPercentageColor(awayOuOverPct)}>
              {awayOuOverPct?.toFixed(1) ?? 'N/A'}% O
            </span>
            {' / '}
            <span className={getPercentageColor(awayOuUnderPct)}>
              {awayOuUnderPct?.toFixed(1) ?? 'N/A'}% U
            </span>
            )
          </div>
          <div></div>
          <div></div>
          <div className="pl-16 text-sm text-left whitespace-nowrap leading-tight min-w-0">
            {homeOuRecord} (
            <span className={getPercentageColor(homeOuOverPct)}>
              {homeOuOverPct?.toFixed(1) ?? 'N/A'}% O
            </span>
            {' / '}
            <span className={getPercentageColor(homeOuUnderPct)}>
              {homeOuUnderPct?.toFixed(1) ?? 'N/A'}% U
            </span>
            )
          </div>
          <div></div>
          <div></div>
          <div className="flex items-center justify-center gap-1.5">
            {(() => {
              const consensus = getOUConsensus(awayOuOverPct, awayOuUnderPct, homeOuOverPct, homeOuUnderPct, awayTeamName, homeTeamName, awayTeamAbbr, homeTeamAbbr);
              if (consensus.type === 'over') {
                return (
                  <>
                    <ArrowUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                    <span className="text-lg font-semibold text-green-600 dark:text-green-400">Over</span>
                  </>
                );
              } else if (consensus.type === 'under') {
                return (
                  <>
                    <ArrowDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                    <span className="text-lg font-semibold text-red-600 dark:text-red-400">Under</span>
                  </>
                );
              } else {
                return <span className="text-base font-semibold text-gray-500">No Consensus</span>;
              }
            })()}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Today's Betting Trends</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Today's Betting Trends</h1>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Today's Betting Trends
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Situational betting trends for today's NBA games
            {lastUpdated && (
              <span className="ml-2">
                • Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              onClick={() => setSortMode('time')}
              variant={sortMode === 'time' ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
            >
              Game Time
            </Button>
            <Button
              onClick={() => setSortMode('ou-consensus')}
              variant={sortMode === 'ou-consensus' ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
            >
              OU Consensus
            </Button>
            <Button
              onClick={() => setSortMode('ats-dominance')}
              variant={sortMode === 'ats-dominance' ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
            >
              ATS Dominance
            </Button>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Games List */}
      {games.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No games with trends data available for today.
            <br />
            <span className="text-xs mt-2 block">
              Check the browser console (F12) for debugging information.
            </span>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map((game) => {
            const isExpanded = expandedGames.has(game.game_id);
            const awayColors = getNBATeamColors(game.away_team.team_name);
            const homeColors = getNBATeamColors(game.home_team.team_name);
            const awayInitials = getNBATeamInitials(game.away_team.team_name);
            const homeInitials = getNBATeamInitials(game.home_team.team_name);

            return (
              <Card
                key={game.game_id}
                data-game-id={game.game_id}
                className={`overflow-hidden transition-all ${
                  highlightGameId === game.game_id ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-background' : ''
                }`}
              >
                <Collapsible open={isExpanded} onOpenChange={() => toggleGame(game.game_id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 flex items-center justify-center">
                              <img 
                                src={getNBATeamLogoUrl(game.away_team.team_name)} 
                                alt={game.away_team.team_name}
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  // Fallback to colored circle with initials if logo fails
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs hidden"
                                style={{ backgroundColor: awayColors.primary }}
                              >
                                {awayInitials}
                              </div>
                            </div>
                            <span className="font-semibold">{game.away_team.team_abbr}</span>
                          </div>
                          <span className="text-gray-400">@</span>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 flex items-center justify-center">
                              <img 
                                src={getNBATeamLogoUrl(game.home_team.team_name)} 
                                alt={game.home_team.team_name}
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  // Fallback to colored circle with initials if logo fails
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs hidden"
                                style={{ backgroundColor: homeColors.primary }}
                              >
                                {homeInitials}
                              </div>
                            </div>
                            <span className="font-semibold">{game.home_team.team_abbr}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {game.tipoff_time_et ? (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {formatTipoffTime(game.tipoff_time_et)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(game.game_date).toLocaleDateString()}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-6">
                      {/* Team Header with Logos */}
                      <div className="grid grid-cols-[120px_200px_0_0_200px_0_0_auto] gap-1 mb-4 pb-3 border-b">
                        <div className="font-medium text-gray-700 dark:text-gray-300"></div>
                        <div className="pl-16 text-left">
                          <div className="flex items-center gap-2">
                            <img 
                              src={getNBATeamLogoUrl(game.away_team.team_name)} 
                              alt={game.away_team.team_name}
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            <div className="font-semibold text-lg truncate text-white">
                              {game.away_team.team_abbr}
                            </div>
                          </div>
                        </div>
                        <div></div>
                        <div></div>
                        <div className="pl-16 text-left">
                          <div className="flex items-center gap-2">
                            <img 
                              src={getNBATeamLogoUrl(game.home_team.team_name)} 
                              alt={game.home_team.team_name}
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            <div className="font-semibold text-lg truncate text-white">
                              {game.home_team.team_abbr}
                            </div>
                          </div>
                        </div>
                        <div></div>
                        <div></div>
                        <div className="text-center">
                          <div className="font-semibold text-sm text-gray-700 dark:text-gray-300">Consensus Trend</div>
                        </div>
                      </div>
                      
                      {/* Side-by-side comparison for each situation */}
                      {renderComparisonRow(
                        'Last Game Situation',
                        game.away_team.team_name,
                        game.home_team.team_name,
                        game.away_team.team_abbr,
                        game.home_team.team_abbr,
                        game.away_team.last_game_situation,
                        game.home_team.last_game_situation,
                        game.away_team.ats_last_game_record,
                        game.away_team.ats_last_game_cover_pct,
                        game.home_team.ats_last_game_record,
                        game.home_team.ats_last_game_cover_pct,
                        game.away_team.ou_last_game_record,
                        game.away_team.ou_last_game_over_pct,
                        game.away_team.ou_last_game_under_pct,
                        game.home_team.ou_last_game_record,
                        game.home_team.ou_last_game_over_pct,
                        game.home_team.ou_last_game_under_pct
                      )}
                      
                      {renderComparisonRow(
                        'Favorite/Dog Situation',
                        game.away_team.team_name,
                        game.home_team.team_name,
                        game.away_team.team_abbr,
                        game.home_team.team_abbr,
                        game.away_team.fav_dog_situation,
                        game.home_team.fav_dog_situation,
                        game.away_team.ats_fav_dog_record,
                        game.away_team.ats_fav_dog_cover_pct,
                        game.home_team.ats_fav_dog_record,
                        game.home_team.ats_fav_dog_cover_pct,
                        game.away_team.ou_fav_dog_record,
                        game.away_team.ou_fav_dog_over_pct,
                        game.away_team.ou_fav_dog_under_pct,
                        game.home_team.ou_fav_dog_record,
                        game.home_team.ou_fav_dog_over_pct,
                        game.home_team.ou_fav_dog_under_pct
                      )}
                      
                      {renderComparisonRow(
                        'Side Spread Situation',
                        game.away_team.team_name,
                        game.home_team.team_name,
                        game.away_team.team_abbr,
                        game.home_team.team_abbr,
                        game.away_team.side_spread_situation,
                        game.home_team.side_spread_situation,
                        game.away_team.ats_side_fav_dog_record,
                        game.away_team.ats_side_fav_dog_cover_pct,
                        game.home_team.ats_side_fav_dog_record,
                        game.home_team.ats_side_fav_dog_cover_pct,
                        game.away_team.ou_side_fav_dog_record,
                        game.away_team.ou_side_fav_dog_over_pct,
                        game.away_team.ou_side_fav_dog_under_pct,
                        game.home_team.ou_side_fav_dog_record,
                        game.home_team.ou_side_fav_dog_over_pct,
                        game.home_team.ou_side_fav_dog_under_pct
                      )}
                      
                      {renderComparisonRow(
                        'Rest Bucket',
                        game.away_team.team_name,
                        game.home_team.team_name,
                        game.away_team.team_abbr,
                        game.home_team.team_abbr,
                        game.away_team.rest_bucket,
                        game.home_team.rest_bucket,
                        game.away_team.ats_rest_bucket_record,
                        game.away_team.ats_rest_bucket_cover_pct,
                        game.home_team.ats_rest_bucket_record,
                        game.home_team.ats_rest_bucket_cover_pct,
                        game.away_team.ou_rest_bucket_record,
                        game.away_team.ou_rest_bucket_over_pct,
                        game.away_team.ou_rest_bucket_under_pct,
                        game.home_team.ou_rest_bucket_record,
                        game.home_team.ou_rest_bucket_over_pct,
                        game.home_team.ou_rest_bucket_under_pct
                      )}
                      
                      {renderComparisonRow(
                        'Rest Comparison',
                        game.away_team.team_name,
                        game.home_team.team_name,
                        game.away_team.team_abbr,
                        game.home_team.team_abbr,
                        game.away_team.rest_comp,
                        game.home_team.rest_comp,
                        game.away_team.ats_rest_comp_record,
                        game.away_team.ats_rest_comp_cover_pct,
                        game.home_team.ats_rest_comp_record,
                        game.home_team.ats_rest_comp_cover_pct,
                        game.away_team.ou_rest_comp_record,
                        game.away_team.ou_rest_comp_over_pct,
                        game.away_team.ou_rest_comp_under_pct,
                        game.home_team.ou_rest_comp_record,
                        game.home_team.ou_rest_comp_over_pct,
                        game.home_team.ou_rest_comp_under_pct
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
