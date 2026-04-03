import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Animated, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { useRouter } from 'expo-router';

import { fetchWeekGames, fetchValueAlerts, fetchFadeAlerts, ValueAlert, FadeAlert, GameSummary } from '@/services/outliersService';
import { syncWidgetData, getWidgetData } from '@/modules/widget-data-bridge';
import { Card } from '@/components/ui/Card';
import { AlertCardShimmer } from '@/components/AlertCardShimmer';
import { TeamAvatar, SportType } from '@/components/TeamAvatar';
import { OutlierMatchupCard } from '@/components/OutlierMatchupCard';
import { OutlierCardShimmer } from '@/components/OutlierCardShimmer';
import { OutliersHeroHeader } from '@/components/OutliersHeroHeader';
import { ToolExplainerBanner } from '@/components/ToolExplainerBanner';
import {
  getTeamInitials,
  getNBATeamInitials,
  getCFBTeamInitials,
} from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useScroll } from '@/contexts/ScrollContext';

// Game Sheets
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { useNBAGameSheet } from '@/contexts/NBAGameSheetContext';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useProAccess } from '@/hooks/useProAccess';
import { LockedOverlay } from '@/components/LockedOverlay';
import { TopAgentPicksFeed } from '@/components/agents/TopAgentPicksFeed';
import { AgentLeaderboard } from '@/components/agents/AgentLeaderboard';
import { useNBABettingTrendsSheet } from '@/contexts/NBABettingTrendsSheetContext';
import { useNCAABBettingTrendsSheet } from '@/contexts/NCAABBettingTrendsSheetContext';
import { useMLBBettingTrendsSheet } from '@/contexts/MLBBettingTrendsSheetContext';
import { useNBABettingTrends } from '@/hooks/useNBABettingTrends';
import { useNCAABBettingTrends } from '@/hooks/useNCAABBettingTrends';
import { useMLBBettingTrends } from '@/hooks/useMLBBettingTrends';
import { useNBAModelAccuracy } from '@/hooks/useNBAModelAccuracy';
import { useNCAABModelAccuracy } from '@/hooks/useNCAABModelAccuracy';
import { NBAGameTrendsData, SituationalTrendRow, parseRecord, formatSituation } from '@/types/nbaBettingTrends';
import { NCAABGameTrendsData, NCAABSituationalTrendRow, parseNCAABRecord, formatNCAABSituation } from '@/types/ncaabBettingTrends';
import { MLBGameTrendsData, MLBSituationalTrendRow, toTrendPct, formatMLBSituation } from '@/types/mlbBettingTrends';
import { getMLBTeamById, getMLBFallbackTeamInfo, getMLBTeamColors } from '@/constants/mlbTeams';
import { GameAccuracyData } from '@/types/modelAccuracy';
import { lookupNBAFullGame, lookupNCAABFullGame } from '@/hooks/useFullGameLookup';

// Helper to filter by sport
const filterBySport = <T extends { sport: 'nfl' | 'cfb' | 'nba' | 'ncaab' | 'mlb' }>(
  items: T[],
  filter: string | null
): T[] => {
  if (!filter) return items;
  return items.filter(item => item.sport === filter);
};

const getSportIconName = (sport: string) => {
  switch (sport) {
    case 'nfl': return 'football';
    case 'cfb': return 'school';
    case 'nba': return 'basketball';
    case 'ncaab': return 'basketball-hoop';
    case 'mlb': return 'baseball';
    default: return 'circle-outline';
  }
};

const getSportColor = (sport: string) => {
    switch (sport) {
        case 'nfl': return '#013369';
        case 'cfb': return '#C8102E';
        case 'nba': return '#1D428A';
        case 'ncaab': return '#F58426';
        case 'mlb': return '#002D72';
        default: return '#888';
    }
}

// Helper to format game time
const formatGameTime = (gameTime: string | undefined): string | null => {
    if (!gameTime) return null;
    try {
        const date = new Date(gameTime);
        if (isNaN(date.getTime())) return null;

        // Format: "Sun 1:00 PM"
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const day = dayNames[date.getDay()];
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const minuteStr = minutes < 10 ? `0${minutes}` : minutes;
        return `${day} ${hours}:${minuteStr} ${ampm}`;
    } catch {
        return null;
    }
};

// Helper to format spread
const formatSpread = (spread: number | null | undefined): string | null => {
    if (spread === null || spread === undefined) return null;
    return spread > 0 ? `+${spread}` : `${spread}`;
};

// Helper to format moneyline
const formatMoneyline = (ml: number | null | undefined): string | null => {
    if (ml === null || ml === undefined) return null;
    return ml > 0 ? `+${ml}` : `${ml}`;
};

const BETTING_TRENDS_THRESHOLD = 65;
const BETTING_TRENDS_MIN_GAMES = 5;

type TrendMarketType = 'ATS' | 'Over' | 'Under';

interface TrendCandidate {
  teamName: string;
  marketType: TrendMarketType;
  percentage: number;
  record: string;
  situationLabel: string;
  sampleSize: number;
}

interface TrendOutlier {
  gameId: number;
  sport: 'nba' | 'ncaab' | 'mlb';
  awayTeam: string;
  homeTeam: string;
  gameTime: string | null;
  awayTeamLogo?: string | null;
  homeTeamLogo?: string | null;
  candidate: TrendCandidate;
}

const sortTrendCandidates = (a: TrendCandidate, b: TrendCandidate) => {
  if (b.percentage !== a.percentage) return b.percentage - a.percentage;
  return b.sampleSize - a.sampleSize;
};

const buildNBATeamTrendCandidates = (team: SituationalTrendRow): TrendCandidate[] => {
  const situations = [
    {
      situationLabel: formatSituation(team.last_game_situation),
      atsRecord: team.ats_last_game_record,
      atsPct: team.ats_last_game_cover_pct,
      ouRecord: team.ou_last_game_record,
      ouOverPct: team.ou_last_game_over_pct,
      ouUnderPct: team.ou_last_game_under_pct,
    },
    {
      situationLabel: formatSituation(team.fav_dog_situation),
      atsRecord: team.ats_fav_dog_record,
      atsPct: team.ats_fav_dog_cover_pct,
      ouRecord: team.ou_fav_dog_record,
      ouOverPct: team.ou_fav_dog_over_pct,
      ouUnderPct: team.ou_fav_dog_under_pct,
    },
    {
      situationLabel: formatSituation(team.side_spread_situation),
      atsRecord: team.ats_side_fav_dog_record,
      atsPct: team.ats_side_fav_dog_cover_pct,
      ouRecord: team.ou_side_fav_dog_record,
      ouOverPct: team.ou_side_fav_dog_over_pct,
      ouUnderPct: team.ou_side_fav_dog_under_pct,
    },
    {
      situationLabel: formatSituation(team.rest_bucket),
      atsRecord: team.ats_rest_bucket_record,
      atsPct: team.ats_rest_bucket_cover_pct,
      ouRecord: team.ou_rest_bucket_record,
      ouOverPct: team.ou_rest_bucket_over_pct,
      ouUnderPct: team.ou_rest_bucket_under_pct,
    },
    {
      situationLabel: formatSituation(team.rest_comp),
      atsRecord: team.ats_rest_comp_record,
      atsPct: team.ats_rest_comp_cover_pct,
      ouRecord: team.ou_rest_comp_record,
      ouOverPct: team.ou_rest_comp_over_pct,
      ouUnderPct: team.ou_rest_comp_under_pct,
    },
  ];

  const candidates: TrendCandidate[] = [];

  for (const situation of situations) {
    const atsSample = parseRecord(situation.atsRecord).total;
    const ouSample = parseRecord(situation.ouRecord).total;

    if (
      typeof situation.atsPct === 'number' &&
      situation.atsPct >= BETTING_TRENDS_THRESHOLD &&
      atsSample >= BETTING_TRENDS_MIN_GAMES
    ) {
      candidates.push({
        teamName: team.team_name,
        marketType: 'ATS',
        percentage: situation.atsPct,
        record: situation.atsRecord || '-',
        situationLabel: situation.situationLabel,
        sampleSize: atsSample,
      });
    }

    if (
      typeof situation.ouOverPct === 'number' &&
      situation.ouOverPct >= BETTING_TRENDS_THRESHOLD &&
      ouSample >= BETTING_TRENDS_MIN_GAMES
    ) {
      candidates.push({
        teamName: team.team_name,
        marketType: 'Over',
        percentage: situation.ouOverPct,
        record: situation.ouRecord || '-',
        situationLabel: situation.situationLabel,
        sampleSize: ouSample,
      });
    }

    if (
      typeof situation.ouUnderPct === 'number' &&
      situation.ouUnderPct >= BETTING_TRENDS_THRESHOLD &&
      ouSample >= BETTING_TRENDS_MIN_GAMES
    ) {
      candidates.push({
        teamName: team.team_name,
        marketType: 'Under',
        percentage: situation.ouUnderPct,
        record: situation.ouRecord || '-',
        situationLabel: situation.situationLabel,
        sampleSize: ouSample,
      });
    }
  }

  return candidates;
};

const buildNCAABTeamTrendCandidates = (team: NCAABSituationalTrendRow): TrendCandidate[] => {
  const situations = [
    {
      situationLabel: formatNCAABSituation(team.last_game_situation),
      atsRecord: team.ats_last_game_record,
      atsPct: team.ats_last_game_cover_pct,
      ouRecord: team.ou_last_game_record,
      ouOverPct: team.ou_last_game_over_pct,
      ouUnderPct: team.ou_last_game_under_pct,
    },
    {
      situationLabel: formatNCAABSituation(team.fav_dog_situation),
      atsRecord: team.ats_fav_dog_record,
      atsPct: team.ats_fav_dog_cover_pct,
      ouRecord: team.ou_fav_dog_record,
      ouOverPct: team.ou_fav_dog_over_pct,
      ouUnderPct: team.ou_fav_dog_under_pct,
    },
    {
      situationLabel: formatNCAABSituation(team.side_spread_situation),
      atsRecord: team.ats_side_fav_dog_record,
      atsPct: team.ats_side_fav_dog_cover_pct,
      ouRecord: team.ou_side_fav_dog_record,
      ouOverPct: team.ou_side_fav_dog_over_pct,
      ouUnderPct: team.ou_side_fav_dog_under_pct,
    },
    {
      situationLabel: formatNCAABSituation(team.rest_bucket),
      atsRecord: team.ats_rest_bucket_record,
      atsPct: team.ats_rest_bucket_cover_pct,
      ouRecord: team.ou_rest_bucket_record,
      ouOverPct: team.ou_rest_bucket_over_pct,
      ouUnderPct: team.ou_rest_bucket_under_pct,
    },
    {
      situationLabel: formatNCAABSituation(team.rest_comp),
      atsRecord: team.ats_rest_comp_record,
      atsPct: team.ats_rest_comp_cover_pct,
      ouRecord: team.ou_rest_comp_record,
      ouOverPct: team.ou_rest_comp_over_pct,
      ouUnderPct: team.ou_rest_comp_under_pct,
    },
  ];

  const candidates: TrendCandidate[] = [];

  for (const situation of situations) {
    const atsSample = parseNCAABRecord(situation.atsRecord).total;
    const ouSample = parseNCAABRecord(situation.ouRecord).total;

    if (
      typeof situation.atsPct === 'number' &&
      situation.atsPct >= BETTING_TRENDS_THRESHOLD &&
      atsSample >= BETTING_TRENDS_MIN_GAMES
    ) {
      candidates.push({
        teamName: team.team_name,
        marketType: 'ATS',
        percentage: situation.atsPct,
        record: situation.atsRecord || '-',
        situationLabel: situation.situationLabel,
        sampleSize: atsSample,
      });
    }

    if (
      typeof situation.ouOverPct === 'number' &&
      situation.ouOverPct >= BETTING_TRENDS_THRESHOLD &&
      ouSample >= BETTING_TRENDS_MIN_GAMES
    ) {
      candidates.push({
        teamName: team.team_name,
        marketType: 'Over',
        percentage: situation.ouOverPct,
        record: situation.ouRecord || '-',
        situationLabel: situation.situationLabel,
        sampleSize: ouSample,
      });
    }

    if (
      typeof situation.ouUnderPct === 'number' &&
      situation.ouUnderPct >= BETTING_TRENDS_THRESHOLD &&
      ouSample >= BETTING_TRENDS_MIN_GAMES
    ) {
      candidates.push({
        teamName: team.team_name,
        marketType: 'Under',
        percentage: situation.ouUnderPct,
        record: situation.ouRecord || '-',
        situationLabel: situation.situationLabel,
        sampleSize: ouSample,
      });
    }
  }

  return candidates;
};

const buildNBATrendOutliers = (games: NBAGameTrendsData[]): TrendOutlier[] => {
  const outliers: TrendOutlier[] = [];

  for (const game of games) {
    const candidates = [
      ...buildNBATeamTrendCandidates(game.awayTeam),
      ...buildNBATeamTrendCandidates(game.homeTeam),
    ].sort(sortTrendCandidates);

    if (candidates.length === 0) continue;

    outliers.push({
      gameId: game.gameId,
      sport: 'nba',
      awayTeam: game.awayTeam.team_name,
      homeTeam: game.homeTeam.team_name,
      gameTime: game.tipoffTime,
      candidate: candidates[0],
    });
  }

  return outliers.sort((a, b) => sortTrendCandidates(a.candidate, b.candidate));
};

const buildNCAABTrendOutliers = (games: NCAABGameTrendsData[]): TrendOutlier[] => {
  const outliers: TrendOutlier[] = [];

  for (const game of games) {
    const candidates = [
      ...buildNCAABTeamTrendCandidates(game.awayTeam),
      ...buildNCAABTeamTrendCandidates(game.homeTeam),
    ].sort(sortTrendCandidates);

    if (candidates.length === 0) continue;

    outliers.push({
      gameId: game.gameId,
      sport: 'ncaab',
      awayTeam: game.awayTeam.team_name,
      homeTeam: game.homeTeam.team_name,
      gameTime: game.tipoffTime,
      awayTeamLogo: game.awayTeamLogo,
      homeTeamLogo: game.homeTeamLogo,
      candidate: candidates[0],
    });
  }

  return outliers.sort((a, b) => sortTrendCandidates(a.candidate, b.candidate));
};

// ── MLB Trend Outliers ────────────────────────────────────
const MLB_BETTING_TRENDS_THRESHOLD = 60; // MLB percentages are typically lower variance than NBA/NCAAB

const buildMLBTrendOutliers = (games: MLBGameTrendsData[]): TrendOutlier[] => {
  const outliers: TrendOutlier[] = [];

  for (const game of games) {
    const candidates: TrendCandidate[] = [];

    // Check both teams across all 7 MLB situations
    for (const team of [game.awayTeam, game.homeTeam]) {
      const situations: { label: string; winPct: number | string | null; overPct: number | string | null }[] = [
        { label: formatMLBSituation(team.last_game_situation), winPct: team.win_pct_last_game, overPct: team.over_pct_last_game },
        { label: formatMLBSituation(team.home_away_situation), winPct: team.win_pct_home_away, overPct: team.over_pct_home_away },
        { label: formatMLBSituation(team.fav_dog_situation), winPct: team.win_pct_fav_dog, overPct: team.over_pct_fav_dog },
        { label: formatMLBSituation(team.rest_bucket), winPct: team.win_pct_rest_bucket, overPct: team.over_pct_rest_bucket },
        { label: formatMLBSituation(team.rest_comp), winPct: team.win_pct_rest_comp, overPct: team.over_pct_rest_comp },
        { label: formatMLBSituation(team.league_situation), winPct: team.win_pct_league, overPct: team.over_pct_league },
        { label: formatMLBSituation(team.division_situation), winPct: team.win_pct_division, overPct: team.over_pct_division },
      ];

      for (const sit of situations) {
        const winPct = toTrendPct(sit.winPct);
        const overPct = toTrendPct(sit.overPct);

        // ML win percentage outlier
        if (winPct !== null && winPct >= MLB_BETTING_TRENDS_THRESHOLD) {
          candidates.push({
            teamName: team.team_name,
            marketType: 'ATS', // Using ATS label for moneyline win % in MLB context
            percentage: winPct,
            record: `${winPct.toFixed(0)}% win`,
            situationLabel: sit.label,
            sampleSize: 1, // MLB trends don't expose sample size
          });
        }

        // Over percentage outlier
        if (overPct !== null && overPct >= MLB_BETTING_TRENDS_THRESHOLD) {
          candidates.push({
            teamName: team.team_name,
            marketType: 'Over',
            percentage: overPct,
            record: `${overPct.toFixed(0)}% over`,
            situationLabel: sit.label,
            sampleSize: 1,
          });
        }

        // Under percentage outlier (inverse of over)
        if (overPct !== null && (100 - overPct) >= MLB_BETTING_TRENDS_THRESHOLD) {
          candidates.push({
            teamName: team.team_name,
            marketType: 'Under',
            percentage: 100 - overPct,
            record: `${(100 - overPct).toFixed(0)}% under`,
            situationLabel: sit.label,
            sampleSize: 1,
          });
        }
      }
    }

    candidates.sort(sortTrendCandidates);
    if (candidates.length === 0) continue;

    outliers.push({
      gameId: game.gamePk,
      sport: 'mlb',
      awayTeam: game.awayTeam.team_name,
      homeTeam: game.homeTeam.team_name,
      gameTime: game.gameTimeEt,
      candidate: candidates[0],
    });
  }

  return outliers.sort((a, b) => sortTrendCandidates(a.candidate, b.candidate));
};

// ── Model Accuracy Outliers ────────────────────────────────
// NBA: lower thresholds to capture more outliers
const NBA_ACCURACY_MIN_GAMES = 5;
const NBA_ACCURACY_HIGH_THRESHOLD = 65;
const NBA_ACCURACY_LOW_THRESHOLD = 35;
// NCAAB: stricter thresholds, no ML (heavily skewed toward favorites)
const NCAAB_ACCURACY_MIN_GAMES = 10;
const NCAAB_ACCURACY_HIGH_THRESHOLD = 70;
const NCAAB_ACCURACY_LOW_THRESHOLD = 30;

type AccuracyPickType = 'Spread' | 'ML' | 'O/U';

interface AccuracyOutlier {
  gameId: number;
  sport: 'nba' | 'ncaab';
  awayTeam: string;
  homeTeam: string;
  awayAbbr: string;
  homeAbbr: string;
  awayTeamLogo?: string | null;
  homeTeamLogo?: string | null;
  pickType: AccuracyPickType;
  pick: string;
  edge: string;
  accuracyPct: number;
  sampleSize: number;
  isHigh: boolean;
}

function buildAccuracyOutliers(games: GameAccuracyData[], sport: 'nba' | 'ncaab'): AccuracyOutlier[] {
  const outliers: AccuracyOutlier[] = [];
  const minGames = sport === 'nba' ? NBA_ACCURACY_MIN_GAMES : NCAAB_ACCURACY_MIN_GAMES;
  const highThreshold = sport === 'nba' ? NBA_ACCURACY_HIGH_THRESHOLD : NCAAB_ACCURACY_HIGH_THRESHOLD;
  const lowThreshold = sport === 'nba' ? NBA_ACCURACY_LOW_THRESHOLD : NCAAB_ACCURACY_LOW_THRESHOLD;

  for (const game of games) {
    // Spread
    if (
      game.spreadAccuracy &&
      game.spreadAccuracy.games >= minGames &&
      (game.spreadAccuracy.accuracy_pct >= highThreshold ||
        game.spreadAccuracy.accuracy_pct <= lowThreshold)
    ) {
      const pickTeam = game.homeSpreadDiff !== null
        ? (game.homeSpreadDiff > 0 ? game.homeAbbr : game.awayAbbr)
        : '-';
      outliers.push({
        gameId: game.gameId,
        sport,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        awayAbbr: game.awayAbbr,
        homeAbbr: game.homeAbbr,
        awayTeamLogo: game.awayTeamLogo,
        homeTeamLogo: game.homeTeamLogo,
        pickType: 'Spread',
        pick: pickTeam,
        edge: game.homeSpreadDiff !== null ? `${Math.abs(game.homeSpreadDiff).toFixed(1)} pts` : '-',
        accuracyPct: game.spreadAccuracy.accuracy_pct,
        sampleSize: game.spreadAccuracy.games,
        isHigh: game.spreadAccuracy.accuracy_pct >= highThreshold,
      });
    }

    // Moneyline — skip for NCAAB (heavily skewed toward favorites)
    if (
      sport !== 'ncaab' &&
      game.mlAccuracy &&
      game.mlAccuracy.games >= minGames &&
      (game.mlAccuracy.accuracy_pct >= highThreshold ||
        game.mlAccuracy.accuracy_pct <= lowThreshold)
    ) {
      const pickTeam = game.mlPickIsHome !== null
        ? (game.mlPickIsHome ? game.homeAbbr : game.awayAbbr)
        : '-';
      const prob = game.mlPickIsHome !== null
        ? ((game.mlPickIsHome ? (game.homeWinProb ?? 0) : (game.awayWinProb ?? 0)) * 100).toFixed(0) + '%'
        : '-';
      outliers.push({
        gameId: game.gameId,
        sport,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        awayAbbr: game.awayAbbr,
        homeAbbr: game.homeAbbr,
        awayTeamLogo: game.awayTeamLogo,
        homeTeamLogo: game.homeTeamLogo,
        pickType: 'ML',
        pick: pickTeam,
        edge: prob,
        accuracyPct: game.mlAccuracy.accuracy_pct,
        sampleSize: game.mlAccuracy.games,
        isHigh: game.mlAccuracy.accuracy_pct >= highThreshold,
      });
    }

    // Over/Under
    if (
      game.ouAccuracy &&
      game.ouAccuracy.games >= minGames &&
      (game.ouAccuracy.accuracy_pct >= highThreshold ||
        game.ouAccuracy.accuracy_pct <= lowThreshold)
    ) {
      const pick = game.overLineDiff !== null
        ? (game.overLineDiff > 0 ? 'Over' : 'Under')
        : '-';
      outliers.push({
        gameId: game.gameId,
        sport,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        awayAbbr: game.awayAbbr,
        homeAbbr: game.homeAbbr,
        awayTeamLogo: game.awayTeamLogo,
        homeTeamLogo: game.homeTeamLogo,
        pickType: 'O/U',
        pick,
        edge: game.overLineDiff !== null ? `${Math.abs(game.overLineDiff).toFixed(1)} pts` : '-',
        accuracyPct: game.ouAccuracy.accuracy_pct,
        sampleSize: game.ouAccuracy.games,
        isHigh: game.ouAccuracy.accuracy_pct >= highThreshold,
      });
    }
  }

  // Sort by accuracy descending for high, ascending for low, interleaved by extremity
  return outliers.sort((a, b) => {
    const aExtreme = a.isHigh ? a.accuracyPct : 100 - a.accuracyPct;
    const bExtreme = b.isHigh ? b.accuracyPct : 100 - b.accuracyPct;
    if (bExtreme !== aExtreme) return bExtreme - aExtreme;
    return b.sampleSize - a.sampleSize;
  });
}

export default function OutliersScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { scrollY, scrollYClamped } = useScroll();
  const { isPro, isLoading: isProLoading } = useProAccess();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'outliers' | 'agentPicks' | 'leaderboard'>('outliers');

  // Hub navigation
  type OutlierCategory = 'value' | 'fade' | 'nba-trends' | 'ncaab-trends' | 'mlb-trends' | 'nba-accuracy' | 'ncaab-accuracy';
  const [selectedCategory, setSelectedCategory] = useState<OutlierCategory | null>(null);

  // Modals for "Show More"
  const [showAllValueAlerts, setShowAllValueAlerts] = useState(false);
  const [showAllFadeAlerts, setShowAllFadeAlerts] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null);

  // Helper to get team abbreviation based on sport
  const getTeamAbbr = (teamName: string, sport: string): string => {
    switch (sport) {
      case 'nba': return getNBATeamInitials(teamName);
      case 'ncaab':
      case 'cfb': return getCFBTeamInitials(teamName);
      case 'nfl': return getTeamInitials(teamName);
      default: return teamName.substring(0, 3).toUpperCase();
    }
  };

  // Reusable matchup row with logos and abbreviations
  const renderMatchupRow = (
    awayTeam: string,
    homeTeam: string,
    sport: string,
    isLoading?: boolean,
    game?: GameSummary
  ) => (
    <View style={styles.matchupRow}>
      <View style={styles.teamInfo}>
        <TeamAvatar
          teamName={awayTeam}
          sport={sport as SportType}
          size={28}
          logoUrl={game?.awayTeamLogo}
          teamAbbr={game?.awayTeamAbbrev || undefined}
        />
        <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>
          {game?.awayTeamAbbrev || getTeamAbbr(awayTeam, sport)}
        </Text>
      </View>
      <Text style={[styles.atSymbol, { color: theme.colors.onSurfaceVariant }]}>@</Text>
      <View style={styles.teamInfo}>
        <TeamAvatar
          teamName={homeTeam}
          sport={sport as SportType}
          size={28}
          logoUrl={game?.homeTeamLogo}
          teamAbbr={game?.homeTeamAbbrev || undefined}
        />
        <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>
          {game?.homeTeamAbbrev || getTeamAbbr(homeTeam, sport)}
        </Text>
      </View>
      {isLoading && (
        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 'auto' }} />
      )}
    </View>
  );

  // Game Sheets
  const { openGameSheet: openNFLSheet } = useNFLGameSheet();
  const { openGameSheet: openCFBSheet } = useCFBGameSheet();
  const { openGameSheet: openNBASheet } = useNBAGameSheet();
  const { openGameSheet: openNCAABSheet } = useNCAABGameSheet();

  // Filter states
  const [valueAlertsFilter, setValueAlertsFilter] = useState<string | null>(null);
  const [fadeAlertsFilter, setFadeAlertsFilter] = useState<string | null>(null);

  // WagerBot floating assistant
  const { onPageChange, onOutliersPageWithData, isDetached, openManualMenu, setOutliersData } = useWagerBotSuggestion();
  const { games: nbaTrendsGames, isLoading: nbaTrendsLoading, refetch: refetchNbaTrends } = useNBABettingTrends();
  const { games: ncaabTrendsGames, isLoading: ncaabTrendsLoading, refetch: refetchNcaabTrends } = useNCAABBettingTrends();
  const { games: mlbTrendsGames, isLoading: mlbTrendsLoading, refetch: refetchMlbTrends } = useMLBBettingTrends();
  const { games: nbaAccuracyGames, isLoading: nbaAccuracyLoading, refetch: refetchNbaAccuracy } = useNBAModelAccuracy();
  const { games: ncaabAccuracyGames, isLoading: ncaabAccuracyLoading, refetch: refetchNcaabAccuracy } = useNCAABModelAccuracy();
  const { openTrendsSheet: openNBATrendsSheet } = useNBABettingTrendsSheet();
  const { openTrendsSheet: openNCAABTrendsSheet } = useNCAABBettingTrendsSheet();
  const { openTrendsSheet: openMLBTrendsSheet } = useMLBBettingTrendsSheet();

  // 1. Fetch Week Games
  const { data: weekGames, isLoading: gamesLoading } = useQuery({
    queryKey: ['week-games'],
    queryFn: fetchWeekGames,
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch Value Alerts
  const { data: valueAlerts, isLoading: valueAlertsLoading } = useQuery({
    queryKey: ['value-alerts', weekGames?.length],
    queryFn: () => fetchValueAlerts(weekGames || []),
    enabled: !!weekGames && weekGames.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // 3. Fetch Fade Alerts
  const { data: fadeAlerts, isLoading: fadeAlertsLoading } = useQuery({
    queryKey: ['fade-alerts', weekGames?.length],
    queryFn: () => fetchFadeAlerts(weekGames || []),
    enabled: !!weekGames && weekGames.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Always notify context which page we're on (needed for openManualMenu)
  useEffect(() => {
    onPageChange('outliers');
  }, [onPageChange]);

  // Update outliers data in WagerBot context for scanning
  useEffect(() => {
    if (valueAlerts || fadeAlerts) {
      setOutliersData(valueAlerts || [], fadeAlerts || []);
    }
  }, [valueAlerts, fadeAlerts, setOutliersData]);

  // Sync outliers data to iOS widget
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    console.log('📱 Outliers sync check - valueAlerts:', valueAlerts?.length ?? 'undefined', 'fadeAlerts:', fadeAlerts?.length ?? 'undefined');

    if (!valueAlerts && !fadeAlerts) {
      console.log('📱 Outliers sync skipped - no data');
      return;
    }

    const syncToWidget = async () => {
      try {
        // Get existing widget data to preserve editor picks
        const existingData = await getWidgetData();
        console.log('📱 Existing widget data for outliers:', existingData ? `picks: ${existingData.editorPicks?.length}` : 'none');

        // Transform fade alerts for widget
        const widgetFadeAlerts = (fadeAlerts || []).slice(0, 5).map(alert => {
          const result = {
            gameId: String(alert.gameId), // Ensure gameId is always a string
            sport: alert.sport,
            awayTeam: alert.awayTeam,
            homeTeam: alert.homeTeam,
            pickType: alert.pickType,
            predictedTeam: alert.predictedTeam,
            confidence: alert.confidence,
            gameTime: alert.game?.gameTime,
          };
          console.log('📱 Fade alert transformed:', result.awayTeam, '@', result.homeTeam, '-', result.pickType, result.confidence + '%');
          return result;
        });

        // Transform value alerts for widget
        const widgetValueAlerts = (valueAlerts || []).slice(0, 5).map(alert => ({
          gameId: String(alert.game.gameId), // Ensure gameId is always a string
          sport: alert.game.sport,
          awayTeam: alert.game.awayTeam,
          homeTeam: alert.game.homeTeam,
          marketType: alert.marketType,
          side: alert.side,
          percentage: alert.percentage,
        }));

        await syncWidgetData({
          editorPicks: existingData?.editorPicks || [], // Preserve existing picks
          fadeAlerts: widgetFadeAlerts,
          polymarketValues: widgetValueAlerts,
          topAgentPicks: existingData?.topAgentPicks || [],
          lastUpdated: new Date().toISOString(),
        });
        console.log('📱 Widget data synced from outliers:', widgetFadeAlerts.length, 'fades,', widgetValueAlerts.length, 'values');
      } catch (error) {
        console.error('Failed to sync widget data:', error);
      }
    };

    syncToWidget();
  }, [valueAlerts, fadeAlerts]);

  // When floating and data is available, provide enhanced suggestions
  useEffect(() => {
    if (isDetached && valueAlerts && valueAlerts.length > 0) {
      // Convert alerts to game data for the suggestion service
      const outlierGames = valueAlerts
        .filter(alert => alert.game?.originalData)
        .map(alert => alert.game.originalData);

      if (outlierGames.length > 0) {
        // Determine the primary sport from alerts
        const primarySport = valueAlerts[0]?.sport || 'nfl';
        onOutliersPageWithData(outlierGames, primarySport as any);
      }
    }
  }, [isDetached, valueAlerts, onOutliersPageWithData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['week-games'] }),
      queryClient.invalidateQueries({ queryKey: ['value-alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['fade-alerts'] }),
      refetchNbaTrends(),
      refetchNcaabTrends(),
      refetchMlbTrends(),
      refetchNbaAccuracy(),
      refetchNcaabAccuracy(),
    ]);
    setRefreshing(false);
  }, [queryClient, refetchNbaTrends, refetchNcaabTrends, refetchMlbTrends, refetchNbaAccuracy, refetchNcaabAccuracy]);

  const handleGamePress = useCallback((gameSummary: GameSummary) => {
      if (!gameSummary.originalData) return;

      setLoadingGameId(gameSummary.gameId);

      const data = gameSummary.originalData;

      // Map data based on sport to what the sheets expect
      if (gameSummary.sport === 'nfl') {
          const nflGame = {
              ...data,
              id: data.id || gameSummary.gameId,
              away_team: gameSummary.awayTeam,
              home_team: gameSummary.homeTeam,
              game_time: gameSummary.gameTime || data.game_time,
              home_away_ml_prob: data.home_away_ml_prob || null,
              home_away_spread_cover_prob: data.home_away_spread_cover_prob || null,
              ou_result_prob: data.ou_result_prob || null,
          };
          openNFLSheet(nflGame);
      } else if (gameSummary.sport === 'cfb') {
           const cfbGame = {
              ...data,
              id: data.id || gameSummary.cfbId,
              away_team: gameSummary.awayTeam,
              home_team: gameSummary.homeTeam,
              api_spread: gameSummary.homeSpread,
              api_over_line: gameSummary.totalLine,
           };
          openCFBSheet(cfbGame);
      } else if (gameSummary.sport === 'nba') {
          const nbaGame = {
              ...data,
              id: String(data.game_id),
              game_id: data.game_id,
              away_team: gameSummary.awayTeam,
              home_team: gameSummary.homeTeam,
          };
          openNBASheet(nbaGame);
      } else if (gameSummary.sport === 'ncaab') {
          const ncaabGame = {
              ...data,
              id: String(data.game_id),
              game_id: data.game_id,
              away_team: gameSummary.awayTeam,
              home_team: gameSummary.homeTeam,
          };
          openNCAABSheet(ncaabGame);
      }

      // Clear loading after a brief delay (sheet opens synchronously)
      setTimeout(() => setLoadingGameId(null), 500);
  }, [openNFLSheet, openCFBSheet, openNBASheet, openNCAABSheet]);


  const renderValueAlertCard = (alert: ValueAlert, index: number) => {
    const gameTime = formatGameTime(alert.game.gameTime);
    const spreadLine = formatSpread(alert.game.homeSpread);
    const totalLine = alert.game.totalLine;
    const homeMl = formatMoneyline(alert.game.homeMl);
    const awayMl = formatMoneyline(alert.game.awayMl);

    return (
      <Card
        key={`${alert.gameId}-${alert.marketType}-${alert.side}-${index}`}
        style={{
          ...styles.alertCard,
          backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.3)',
        }}
        onPress={() => handleGamePress(alert.game)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.pillsContainer}>
            {/* Sport Pill */}
            <View style={[styles.pill, { backgroundColor: getSportColor(alert.sport) + '20' }]}>
               <MaterialCommunityIcons name={getSportIconName(alert.sport) as any} size={12} color={getSportColor(alert.sport)} />
               <Text style={[styles.pillText, { color: getSportColor(alert.sport) }]}>{alert.sport.toUpperCase()}</Text>
            </View>

            {/* Game Time Pill */}
            {gameTime && (
              <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <MaterialCommunityIcons name="clock-outline" size={10} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>{gameTime}</Text>
              </View>
            )}

            {/* Market Type Pill */}
            <View style={[styles.pill, { backgroundColor: '#22c55e20' }]}>
               <Text style={[styles.pillText, { color: '#15803d' }]}>{alert.marketType}</Text>
            </View>

            {/* Percentage Pill */}
            <View style={[styles.pill, { backgroundColor: '#22c55e' }]}>
               <MaterialCommunityIcons name="percent" size={10} color="#fff" />
               <Text style={[styles.pillText, { color: '#fff' }]}>{alert.percentage.toFixed(0)}%</Text>
            </View>
          </View>

          {/* Lines Row */}
          {(spreadLine || totalLine || homeMl) && (
            <View style={[styles.pillsContainer, { marginTop: 6 }]}>
              {spreadLine && (
                <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>Spread: {spreadLine}</Text>
                </View>
              )}
              {totalLine && (
                <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>O/U: {totalLine}</Text>
                </View>
              )}
              {(homeMl || awayMl) && (
                <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>ML: {awayMl}/{homeMl}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          {renderMatchupRow(alert.awayTeam, alert.homeTeam, alert.sport, loadingGameId === alert.gameId, alert.game)}
          <Text style={[styles.descriptionText, { color: theme.colors.onSurfaceVariant }]}>
              <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{alert.side}</Text>
              {alert.marketType === 'Moneyline'
                ? ` - Strong ${alert.percentage.toFixed(0)}% consensus`
                : ` - ${alert.percentage.toFixed(0)}% suggests line hasn't adjusted`
              }
          </Text>
        </View>
      </Card>
    );
  };

  const renderFadeAlertCard = (alert: FadeAlert, index: number) => {
    const gameTime = formatGameTime(alert.game.gameTime);
    const spreadLine = formatSpread(alert.game.homeSpread);
    const totalLine = alert.game.totalLine;
    const homeMl = formatMoneyline(alert.game.homeMl);
    const awayMl = formatMoneyline(alert.game.awayMl);

    // Calculate the fade pick (opposite of what the model predicts)
    let fadePick = '';
    let fadeSpread = '';
    if (alert.pickType === 'Spread') {
      const isModelOnHome = alert.predictedTeam === alert.homeTeam;
      const fadeTeam = isModelOnHome ? alert.awayTeam : alert.homeTeam;
      const fadeSpreadValue = isModelOnHome ? alert.game.awaySpread : alert.game.homeSpread;
      fadePick = fadeTeam;
      fadeSpread = fadeSpreadValue ? formatSpread(fadeSpreadValue) || '' : '';
    } else if (alert.pickType === 'Total') {
      fadePick = alert.predictedTeam === 'Over' ? 'Under' : 'Over';
      fadeSpread = totalLine ? String(totalLine) : '';
    }

    return (
      <Card
        key={`${alert.gameId}-${alert.pickType}-${alert.predictedTeam}-${index}`}
        style={{
          ...styles.alertCard,
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.08)',
          borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.4)',
        }}
        onPress={() => handleGamePress(alert.game)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.pillsContainer}>
            {/* Sport Pill */}
            <View style={[styles.pill, { backgroundColor: getSportColor(alert.sport) + '20' }]}>
               <MaterialCommunityIcons name={getSportIconName(alert.sport) as any} size={12} color={getSportColor(alert.sport)} />
               <Text style={[styles.pillText, { color: getSportColor(alert.sport) }]}>{alert.sport.toUpperCase()}</Text>
            </View>

            {/* Game Time Pill */}
            {gameTime && (
              <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <MaterialCommunityIcons name="clock-outline" size={10} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>{gameTime}</Text>
              </View>
            )}

            {/* Pick Type Pill */}
            <View style={[styles.pill, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
               <Text style={[styles.pillText, { color: '#f59e0b' }]}>{alert.pickType}</Text>
            </View>

            {/* Fade Alert Pill */}
            <View style={[styles.pill, { backgroundColor: '#f59e0b' }]}>
               <MaterialCommunityIcons name="lightning-bolt" size={10} color="#fff" />
               <Text style={[styles.pillText, { color: '#fff' }]}>FADE</Text>
            </View>
          </View>

          {/* Lines Row */}
          {(spreadLine || totalLine || homeMl) && (
            <View style={[styles.pillsContainer, { marginTop: 6 }]}>
              {spreadLine && (
                <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>Spread: {spreadLine}</Text>
                </View>
              )}
              {totalLine && (
                <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>O/U: {totalLine}</Text>
                </View>
              )}
              {(homeMl || awayMl) && (
                <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>ML: {awayMl}/{homeMl}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          {renderMatchupRow(alert.awayTeam, alert.homeTeam, alert.sport, loadingGameId === alert.gameId, alert.game)}

          {/* Fade suggestion box */}
          <View style={[styles.fadeSuggestionBox, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
            <View style={styles.fadeSuggestionHeader}>
              <MaterialCommunityIcons name="swap-horizontal" size={14} color="#22c55e" />
              <Text style={[styles.fadeSuggestionLabel, { color: '#22c55e' }]}>Consider the Fade</Text>
            </View>
            <Text style={[styles.fadeSuggestionText, { color: theme.colors.onSurfaceVariant }]}>
              Bet <Text style={{ fontWeight: 'bold', color: '#22c55e' }}>{fadePick} {fadeSpread}</Text>
            </Text>
          </View>

          <Text style={[styles.fadeReasonText, { color: theme.colors.onSurfaceVariant }]}>
            Model shows {alert.sport === 'nfl' ? `${alert.confidence}%` : `${alert.confidence}pt edge`} on {alert.predictedTeam} — historically profitable to fade
          </Text>
        </View>
      </Card>
    );
  };

  // Custom Sport Filter with Counts
  const renderSportFilter = (
      alerts: any[], 
      currentFilter: string | null, 
      setFilter: (f: string | null) => void
  ) => {
      const sports = ['nfl', 'cfb', 'nba', 'ncaab'];
      
      const getCount = (sport: string) => alerts.filter(a => a.sport === sport).length;
      const allCount = alerts.length;

      return (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <TouchableOpacity
                  style={[
                      styles.filterPill,
                      currentFilter === null && styles.filterPillActive,
                      { backgroundColor: currentFilter === null ? theme.colors.primary : (isDark ? '#2a2a2a' : '#e0e0e0') }
                  ]}
                  onPress={() => setFilter(null)}
              >
                  <Text style={[styles.filterPillText, currentFilter === null && styles.filterPillTextActive]}>All ({allCount})</Text>
              </TouchableOpacity>

              {sports.map(sport => {
                  const count = getCount(sport);
                  if (count === 0) return null;
                  
                  const isActive = currentFilter === sport;
                  return (
                      <TouchableOpacity
                          key={sport}
                          style={[
                              styles.filterPill,
                              isActive && styles.filterPillActive,
                              { backgroundColor: isActive ? theme.colors.primary : (isDark ? '#2a2a2a' : '#e0e0e0') }
                          ]}
                          onPress={() => setFilter(isActive ? null : sport)}
                      >
                          <MaterialCommunityIcons 
                              name={getSportIconName(sport) as any} 
                              size={14} 
                              color={isActive ? '#fff' : theme.colors.onSurface} 
                              style={{ marginRight: 4 }}
                          />
                          <Text style={[
                              styles.filterPillText, 
                              isActive && styles.filterPillTextActive,
                              { color: isActive ? '#fff' : theme.colors.onSurface }
                          ]}>
                              {sport.toUpperCase()} ({count})
                          </Text>
                      </TouchableOpacity>
                  );
              })}
          </ScrollView>
      );
  };

  const now = Date.now();
  const isGameUpcoming = (gameTime?: string) => {
    if (!gameTime) return true; // Keep games with no time info
    const start = new Date(gameTime).getTime();
    return isNaN(start) || start > now;
  };
  const filteredValueAlerts = filterBySport(valueAlerts || [], valueAlertsFilter).filter(a => isGameUpcoming(a.game.gameTime));
  const filteredFadeAlerts = filterBySport(fadeAlerts || [], fadeAlertsFilter).filter(a => isGameUpcoming(a.game.gameTime));
  const nbaTrendOutliers = useMemo(() => buildNBATrendOutliers(nbaTrendsGames), [nbaTrendsGames]);
  const ncaabTrendOutliers = useMemo(() => buildNCAABTrendOutliers(ncaabTrendsGames), [ncaabTrendsGames]);
  const mlbTrendOutliers = useMemo(() => buildMLBTrendOutliers(mlbTrendsGames), [mlbTrendsGames]);
  const nbaAccuracyOutliers = useMemo(() => buildAccuracyOutliers(nbaAccuracyGames, 'nba'), [nbaAccuracyGames]);
  const ncaabAccuracyOutliers = useMemo(() => buildAccuracyOutliers(ncaabAccuracyGames, 'ncaab'), [ncaabAccuracyGames]);

  // For non-pro users (when loading is complete), only show 2 alerts; for pro users show 5
  const shouldShowLocks = !isProLoading && !isPro;
  const visibleAlertCount = shouldShowLocks ? 2 : 5;
  const topValueAlerts = filteredValueAlerts.slice(0, visibleAlertCount);
  const topFadeAlerts = filteredFadeAlerts.slice(0, visibleAlertCount);

  // Number of locked placeholder cards to show for non-pro users (only when loading is complete)
  const lockedValueAlertsCount = shouldShowLocks ? Math.min(3, Math.max(0, filteredValueAlerts.length - 2)) : 0;
  const lockedFadeAlertsCount = shouldShowLocks ? Math.min(3, Math.max(0, filteredFadeAlerts.length - 2)) : 0;

  // Modal Content for "Show More"
  const renderFullListModal = (
      isVisible: boolean, 
      onClose: () => void, 
      title: string, 
      alerts: any[], 
      renderCard: (a: any, i: number) => React.ReactNode
  ) => {
      const filteredBySearch = alerts.filter(a => 
        a.awayTeam.toLowerCase().includes(searchText.toLowerCase()) || 
        a.homeTeam.toLowerCase().includes(searchText.toLowerCase())
      );

      return (
          <Modal
            visible={isVisible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
          >
              <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
                  <View style={styles.modalHeader}>
                      <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>{title}</Text>
                      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                          <MaterialCommunityIcons name="close-circle" size={28} color={theme.colors.onSurfaceVariant} />
                      </TouchableOpacity>
                  </View>
                  
                  <View style={[styles.searchContainer, { 
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: theme.colors.outlineVariant,
                  }]}>
                    <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.onSurfaceVariant} />
                    <TextInput
                      style={[styles.searchInput, { color: theme.colors.onSurface }]}
                      placeholder="Search teams..."
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      value={searchText}
                      onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchText('')}>
                        <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView contentContainerStyle={styles.modalScrollContent}>
                      {filteredBySearch.map(renderCard)}
                      {filteredBySearch.length === 0 && (
                          <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}>No results found</Text>
                      )}
                  </ScrollView>
              </View>
          </Modal>
      );
  };

  const renderTrendOutlierCard = (trend: TrendOutlier, index: number) => {
    const gameTime = formatGameTime(trend.gameTime || undefined);
    const handleTrendPress = () => {
      setLoadingGameId(String(trend.gameId));
      if (trend.sport === 'nba') {
        const game = nbaTrendsGames.find((g) => g.gameId === trend.gameId);
        if (game) openNBATrendsSheet(game);
      } else if (trend.sport === 'mlb') {
        const game = mlbTrendsGames.find((g) => g.gamePk === trend.gameId);
        if (game) openMLBTrendsSheet(game);
      } else {
        const game = ncaabTrendsGames.find((g) => g.gameId === trend.gameId);
        if (game) openNCAABTrendsSheet(game);
      }
      setTimeout(() => setLoadingGameId(null), 500);
    };

    return (
      <Card
        key={`${trend.sport}-${trend.gameId}-${trend.candidate.teamName}-${trend.candidate.marketType}-${index}`}
        style={{
          ...styles.alertCard,
          backgroundColor: isDark ? 'rgba(14, 165, 233, 0.1)' : 'rgba(14, 165, 233, 0.08)',
          borderColor: isDark ? 'rgba(14, 165, 233, 0.35)' : 'rgba(14, 165, 233, 0.4)',
        }}
        onPress={handleTrendPress}
      >
        <View style={styles.cardHeader}>
          <View style={styles.pillsContainer}>
            <View style={[styles.pill, { backgroundColor: getSportColor(trend.sport) + '20' }]}>
              <MaterialCommunityIcons name={getSportIconName(trend.sport) as any} size={12} color={getSportColor(trend.sport)} />
              <Text style={[styles.pillText, { color: getSportColor(trend.sport) }]}>{trend.sport.toUpperCase()}</Text>
            </View>

            {gameTime && (
              <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <MaterialCommunityIcons name="clock-outline" size={10} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>{gameTime}</Text>
              </View>
            )}

            <View style={[styles.pill, { backgroundColor: 'rgba(14, 165, 233, 0.2)' }]}>
              <Text style={[styles.pillText, { color: '#0284c7' }]}>{trend.candidate.marketType}</Text>
            </View>

            <View style={[styles.pill, { backgroundColor: '#0284c7' }]}>
              <MaterialCommunityIcons name="percent" size={10} color="#fff" />
              <Text style={[styles.pillText, { color: '#fff' }]}>{trend.candidate.percentage.toFixed(0)}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardContent}>
          {renderMatchupRow(trend.awayTeam, trend.homeTeam, trend.sport, loadingGameId === String(trend.gameId), {
            gameId: String(trend.gameId),
            sport: trend.sport,
            awayTeam: trend.awayTeam,
            homeTeam: trend.homeTeam,
            awayTeamLogo: trend.awayTeamLogo,
            homeTeamLogo: trend.homeTeamLogo,
          })}
          <Text style={[styles.descriptionText, { color: theme.colors.onSurfaceVariant }]}>
            <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{trend.candidate.teamName}</Text>
            {` ${trend.candidate.marketType} ${trend.candidate.percentage.toFixed(0)}% (${trend.candidate.record})`}
          </Text>
          <Text style={[styles.descriptionText, { color: theme.colors.onSurfaceVariant }]}>
            Situation: {trend.candidate.situationLabel}
          </Text>
        </View>
      </Card>
    );
  };

  const renderAccuracyOutlierCard = (outlier: AccuracyOutlier, index: number) => {
    const accentColor = outlier.isHigh ? '#14b8a6' : '#ef4444';
    const bgColor = outlier.isHigh ? 'rgba(20, 184, 166, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    const borderColor = outlier.isHigh ? 'rgba(20, 184, 166, 0.35)' : 'rgba(239, 68, 68, 0.35)';

    const handleAccuracyPress = async () => {
      setLoadingGameId(String(outlier.gameId));
      try {
        if (outlier.sport === 'nba') {
          const fullGame = await lookupNBAFullGame(outlier.gameId);
          if (fullGame) {
            openNBASheet(fullGame);
          }
        } else {
          const fullGame = await lookupNCAABFullGame(outlier.gameId);
          if (fullGame) {
            openNCAABSheet(fullGame);
          }
        }
      } finally {
        setLoadingGameId(null);
      }
    };

    return (
      <Card
        key={`acc-${outlier.sport}-${outlier.gameId}-${outlier.pickType}-${index}`}
        style={{
          ...styles.alertCard,
          backgroundColor: isDark ? bgColor : bgColor,
          borderColor,
        }}
        onPress={handleAccuracyPress}
      >
        <View style={styles.cardHeader}>
          <View style={styles.pillsContainer}>
            <View style={[styles.pill, { backgroundColor: getSportColor(outlier.sport) + '20' }]}>
              <MaterialCommunityIcons name={getSportIconName(outlier.sport) as any} size={12} color={getSportColor(outlier.sport)} />
              <Text style={[styles.pillText, { color: getSportColor(outlier.sport) }]}>{outlier.sport.toUpperCase()}</Text>
            </View>

            <View style={[styles.pill, { backgroundColor: accentColor + '30' }]}>
              <Text style={[styles.pillText, { color: accentColor }]}>{outlier.pickType}</Text>
            </View>

            <View style={[styles.pill, { backgroundColor: accentColor }]}>
              <MaterialCommunityIcons name="bullseye-arrow" size={10} color="#fff" />
              <Text style={[styles.pillText, { color: '#fff' }]}>{outlier.accuracyPct.toFixed(0)}%</Text>
            </View>

            <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>{outlier.sampleSize}g sample</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardContent}>
          {renderMatchupRow(outlier.awayTeam, outlier.homeTeam, outlier.sport, loadingGameId === String(outlier.gameId), {
            gameId: String(outlier.gameId),
            sport: outlier.sport,
            awayTeam: outlier.awayTeam,
            homeTeam: outlier.homeTeam,
            awayTeamLogo: outlier.awayTeamLogo,
            homeTeamLogo: outlier.homeTeamLogo,
            awayTeamAbbrev: outlier.awayAbbr,
            homeTeamAbbrev: outlier.homeAbbr,
          })}
          <Text style={[styles.descriptionText, { color: theme.colors.onSurfaceVariant }]}>
            <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{outlier.pick}</Text>
            {` ${outlier.pickType} pick (${outlier.edge} edge) — `}
            <Text style={{ fontWeight: 'bold', color: accentColor }}>
              {outlier.isHigh ? `${outlier.accuracyPct.toFixed(0)}% historically accurate` : `only ${outlier.accuracyPct.toFixed(0)}% accurate (fade)`}
            </Text>
          </Text>
        </View>
      </Card>
    );
  };

  // Calculate header heights (must match tab bar calculation)
  const HEADER_TOP_HEIGHT = 56; // Header top section height
  const INNER_TABS_HEIGHT = 44; // Inner tab bar height
  const TOTAL_HEADER_HEIGHT = insets.top + HEADER_TOP_HEIGHT + INNER_TABS_HEIGHT;
  const TOTAL_COLLAPSIBLE_HEIGHT = TOTAL_HEADER_HEIGHT;

  // Calculate bottom padding (tab bar + safe area)
  const TAB_BAR_BASE_HEIGHT = 65;
  const TAB_BAR_HEIGHT = TAB_BAR_BASE_HEIGHT + insets.bottom;

  // Header stays fixed (no scroll-based hiding)
  const headerTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [0, 0],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [1, 1],
    extrapolate: 'clamp',
  });

  // Handle scroll event
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const INNER_TABS: { key: 'outliers' | 'agentPicks' | 'leaderboard'; label: string }[] = [
    { key: 'outliers', label: 'Outliers' },
    { key: 'agentPicks', label: 'Top Agent Picks' },
    { key: 'leaderboard', label: 'Leaderboard' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
       {/* Fixed Header with Inner Tabs - Animated (hidden in detail view) */}
       {!(activeTab === 'outliers' && selectedCategory !== null) && (
       <Animated.View
         style={[
           styles.fixedHeaderContainer,
           {
             height: TOTAL_HEADER_HEIGHT,
             transform: [{ translateY: headerTranslate }],
             opacity: headerOpacity,
           }
         ]}
       >
          <AndroidBlurView
             intensity={80}
             tint={isDark ? 'dark' : 'light'}
             style={[styles.fixedHeader, { paddingTop: insets.top }]}
           >
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => {
                router.push('/(drawer)/settings' as any);
              }}
              style={styles.menuButton}
            >
              <MaterialCommunityIcons name="cog" size={31} color={theme.colors.onSurface} />
            </TouchableOpacity>

            <View style={styles.titleContainer}>
              <Text style={[styles.titleMain, { color: theme.colors.onSurface }]}>Wager</Text>
              <Text style={[styles.titleProof, { color: '#00E676' }]}>Proof</Text>
            </View>

            {user && (
              <TouchableOpacity
                onPress={openManualMenu}
                style={styles.chatButton}
              >
                <MaterialCommunityIcons name="robot" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
            )}
          </View>

          {/* Inner Tab Bar */}
          <View style={styles.innerTabBar}>
            {INNER_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.innerTab]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.innerTabText,
                      {
                        color: isActive ? '#00E676' : theme.colors.onSurfaceVariant,
                        fontWeight: isActive ? '700' : '500',
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {isActive && <View style={styles.innerTabIndicator} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </AndroidBlurView>
       </Animated.View>
       )}

       {/* Agent Picks Tab */}
       {activeTab === 'agentPicks' && (
         <TopAgentPicksFeed
           onScroll={handleScroll}
           scrollEventThrottle={16}
           contentContainerStyle={{
             paddingTop: TOTAL_HEADER_HEIGHT + 8,
             paddingBottom: TAB_BAR_HEIGHT + 20,
           }}
           progressViewOffset={TOTAL_HEADER_HEIGHT}
         />
       )}

       {/* Leaderboard Tab */}
       {activeTab === 'leaderboard' && (
         <View style={{ flex: 1 }}>
           <AgentLeaderboard
             limit={50}
             showViewAll={false}
             embedded={true}
             contentContainerStyle={{
               paddingTop: TOTAL_HEADER_HEIGHT,
               paddingBottom: TAB_BAR_HEIGHT + 80,
             }}
             progressViewOffset={TOTAL_HEADER_HEIGHT}
           />
         </View>
       )}

       {/* Outliers Tab — Hub View */}
       {activeTab === 'outliers' && selectedCategory === null && (
       <Animated.ScrollView
         contentContainerStyle={[
           styles.scrollContent,
           {
             paddingTop: TOTAL_HEADER_HEIGHT + 16,
             paddingBottom: TAB_BAR_HEIGHT + 20
           }
         ]}
         onScroll={handleScroll}
         scrollEventThrottle={16}
         bounces={false}
         overScrollMode="never"
         showsVerticalScrollIndicator={true}
         refreshControl={
           <RefreshControl
             refreshing={refreshing}
             onRefresh={onRefresh}
             tintColor={theme.colors.primary}
             progressViewOffset={TOTAL_HEADER_HEIGHT}
           />
         }
       >
        {/* Spotify-style hub: each section = header + horizontal scroll of matchup cards */}

        <OutliersHeroHeader />

        {/* ── Prediction Market Alerts ── */}
        <View style={styles.hubSection}>
          <TouchableOpacity style={styles.hubSectionHeader} onPress={() => setSelectedCategory('value')} activeOpacity={0.7}>
            <View style={[styles.hubSectionIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
              <MaterialCommunityIcons name="trending-up" size={18} color="#22c55e" />
            </View>
            <Text style={[styles.hubSectionTitle, { color: theme.colors.onSurface }]}>Prediction Market Alerts</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
          {(valueAlertsLoading || gamesLoading) ? (
            <View style={[styles.hubShimmerRow, styles.hubScrollBreakout]}>
              {[0, 1, 2].map(i => (
                <OutlierCardShimmer key={i} delay={i * 150} />
              ))}
            </View>
          ) : filteredValueAlerts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubScrollBreakout} contentContainerStyle={styles.hubCardRow}>
              {filteredValueAlerts.slice(0, 4).map((a, i) => (
                <OutlierMatchupCard
                  key={`val-${a.gameId}-${a.marketType}-${a.side}-${i}`}
                  awayTeam={a.game.awayTeam}
                  homeTeam={a.game.homeTeam}
                  sport={a.sport as SportType}
                  awayTeamLogo={a.game.awayTeamLogo}
                  homeTeamLogo={a.game.homeTeamLogo}
                  pickIcon="trending-up"
                  pickLabel={`${a.side} ${a.marketType}`}
                  pickValue={`${a.percentage.toFixed(0)}% consensus`}
                  accentColor="#22c55e"
                  loading={loadingGameId === a.gameId}
                  onPress={() => handleGamePress(a.game)}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity style={[styles.hubCtaCard, { borderColor: 'rgba(34, 197, 94, 0.25)', backgroundColor: isDark ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.04)' }]} activeOpacity={0.7} onPress={() => setSelectedCategory('value')}>
              <MaterialCommunityIcons name="trending-up" size={28} color="#22c55e" style={{ marginBottom: 8 }} />
              <Text style={[styles.hubCtaTitle, { color: theme.colors.onSurface }]}>No alerts yet</Text>
              <Text style={[styles.hubCtaDesc, { color: theme.colors.onSurfaceVariant }]}>Explore the full tool</Text>
              <View style={[styles.hubCtaPill, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <Text style={[styles.hubCtaPillText, { color: '#22c55e' }]}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={12} color="#22c55e" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Model Fade Alerts ── */}
        <View style={styles.hubSection}>
          <TouchableOpacity style={styles.hubSectionHeader} onPress={() => setSelectedCategory('fade')} activeOpacity={0.7}>
            <View style={[styles.hubSectionIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <MaterialCommunityIcons name="lightning-bolt" size={18} color="#f59e0b" />
            </View>
            <Text style={[styles.hubSectionTitle, { color: theme.colors.onSurface }]}>Model Fade Alerts</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
          {(fadeAlertsLoading || gamesLoading) ? (
            <View style={[styles.hubShimmerRow, styles.hubScrollBreakout]}>
              {[0, 1, 2].map(i => (
                <OutlierCardShimmer key={i} delay={i * 150} />
              ))}
            </View>
          ) : filteredFadeAlerts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubScrollBreakout} contentContainerStyle={styles.hubCardRow}>
              {filteredFadeAlerts.slice(0, 4).map((a, i) => (
                <OutlierMatchupCard
                  key={`fade-${a.gameId}-${a.pickType}-${a.predictedTeam}-${i}`}
                  awayTeam={a.game.awayTeam}
                  homeTeam={a.game.homeTeam}
                  sport={a.sport as SportType}
                  awayTeamLogo={a.game.awayTeamLogo}
                  homeTeamLogo={a.game.homeTeamLogo}
                  pickIcon="lightning-bolt"
                  pickLabel={`Fade ${a.predictedTeam} ${a.pickType}`}
                  pickValue={`${a.confidence}${a.sport === 'nfl' ? '%' : 'pt'} confidence`}
                  accentColor="#f59e0b"
                  loading={loadingGameId === a.gameId}
                  onPress={() => handleGamePress(a.game)}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity style={[styles.hubCtaCard, { borderColor: 'rgba(245, 158, 11, 0.25)', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.04)' }]} activeOpacity={0.7} onPress={() => setSelectedCategory('fade')}>
              <MaterialCommunityIcons name="lightning-bolt" size={28} color="#f59e0b" style={{ marginBottom: 8 }} />
              <Text style={[styles.hubCtaTitle, { color: theme.colors.onSurface }]}>No fades yet</Text>
              <Text style={[styles.hubCtaDesc, { color: theme.colors.onSurfaceVariant }]}>Explore the full tool</Text>
              <View style={[styles.hubCtaPill, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Text style={[styles.hubCtaPillText, { color: '#f59e0b' }]}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={12} color="#f59e0b" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── NBA Betting Trends ── */}
        <View style={styles.hubSection}>
          <TouchableOpacity style={styles.hubSectionHeader} onPress={() => setSelectedCategory('nba-trends')} activeOpacity={0.7}>
            <View style={[styles.hubSectionIconCircle, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
              <MaterialCommunityIcons name="basketball" size={18} color="#0ea5e9" />
            </View>
            <Text style={[styles.hubSectionTitle, { color: theme.colors.onSurface }]}>NBA Betting Trends</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
          {nbaTrendsLoading ? (
            <View style={[styles.hubShimmerRow, styles.hubScrollBreakout]}>
              {[0, 1, 2].map(i => (
                <OutlierCardShimmer key={i} delay={i * 150} />
              ))}
            </View>
          ) : nbaTrendOutliers.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubScrollBreakout} contentContainerStyle={styles.hubCardRow}>
              {nbaTrendOutliers.slice(0, 4).map((t, i) => (
                <OutlierMatchupCard
                  key={`nba-trend-${t.gameId}-${t.candidate.teamName}-${i}`}
                  awayTeam={t.awayTeam}
                  homeTeam={t.homeTeam}
                  sport="nba"
                  pickIcon="percent"
                  pickLabel={`${t.candidate.teamName} ${t.candidate.marketType}`}
                  pickValue={`${t.candidate.percentage.toFixed(0)}% (${t.candidate.record})`}
                  accentColor="#0ea5e9"
                  loading={loadingGameId === String(t.gameId)}
                  onPress={() => {
                    setLoadingGameId(String(t.gameId));
                    const game = nbaTrendsGames.find((g) => g.gameId === t.gameId);
                    if (game) openNBATrendsSheet(game);
                    setTimeout(() => setLoadingGameId(null), 500);
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity style={[styles.hubCtaCard, { borderColor: 'rgba(14, 165, 233, 0.25)', backgroundColor: isDark ? 'rgba(14, 165, 233, 0.05)' : 'rgba(14, 165, 233, 0.04)' }]} activeOpacity={0.7} onPress={() => setSelectedCategory('nba-trends')}>
              <MaterialCommunityIcons name="basketball" size={28} color="#0ea5e9" style={{ marginBottom: 8 }} />
              <Text style={[styles.hubCtaTitle, { color: theme.colors.onSurface }]}>No trends yet</Text>
              <Text style={[styles.hubCtaDesc, { color: theme.colors.onSurfaceVariant }]}>Explore the full tool</Text>
              <View style={[styles.hubCtaPill, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
                <Text style={[styles.hubCtaPillText, { color: '#0ea5e9' }]}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={12} color="#0ea5e9" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── NCAAB Betting Trends ── */}
        <View style={styles.hubSection}>
          <TouchableOpacity style={styles.hubSectionHeader} onPress={() => setSelectedCategory('ncaab-trends')} activeOpacity={0.7}>
            <View style={[styles.hubSectionIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <MaterialCommunityIcons name="basketball" size={18} color="#6366f1" />
            </View>
            <Text style={[styles.hubSectionTitle, { color: theme.colors.onSurface }]}>NCAAB Betting Trends</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
          {ncaabTrendsLoading ? (
            <View style={[styles.hubShimmerRow, styles.hubScrollBreakout]}>
              {[0, 1, 2].map(i => (
                <OutlierCardShimmer key={i} delay={i * 150} />
              ))}
            </View>
          ) : ncaabTrendOutliers.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubScrollBreakout} contentContainerStyle={styles.hubCardRow}>
              {ncaabTrendOutliers.slice(0, 4).map((t, i) => (
                <OutlierMatchupCard
                  key={`ncaab-trend-${t.gameId}-${t.candidate.teamName}-${i}`}
                  awayTeam={t.awayTeam}
                  homeTeam={t.homeTeam}
                  sport="ncaab"
                  awayTeamLogo={t.awayTeamLogo}
                  homeTeamLogo={t.homeTeamLogo}
                  pickIcon="percent"
                  pickLabel={`${t.candidate.teamName} ${t.candidate.marketType}`}
                  pickValue={`${t.candidate.percentage.toFixed(0)}% (${t.candidate.record})`}
                  accentColor="#6366f1"
                  loading={loadingGameId === String(t.gameId)}
                  onPress={() => {
                    setLoadingGameId(String(t.gameId));
                    const game = ncaabTrendsGames.find((g) => g.gameId === t.gameId);
                    if (game) openNCAABTrendsSheet(game);
                    setTimeout(() => setLoadingGameId(null), 500);
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity style={[styles.hubCtaCard, { borderColor: 'rgba(99, 102, 241, 0.25)', backgroundColor: isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.04)' }]} activeOpacity={0.7} onPress={() => setSelectedCategory('ncaab-trends')}>
              <MaterialCommunityIcons name="basketball" size={28} color="#6366f1" style={{ marginBottom: 8 }} />
              <Text style={[styles.hubCtaTitle, { color: theme.colors.onSurface }]}>No trends yet</Text>
              <Text style={[styles.hubCtaDesc, { color: theme.colors.onSurfaceVariant }]}>Explore the full tool</Text>
              <View style={[styles.hubCtaPill, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Text style={[styles.hubCtaPillText, { color: '#6366f1' }]}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={12} color="#6366f1" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── MLB Betting Trends ── */}
        <View style={styles.hubSection}>
          <TouchableOpacity style={styles.hubSectionHeader} onPress={() => setSelectedCategory('mlb-trends')} activeOpacity={0.7}>
            <View style={[styles.hubSectionIconCircle, { backgroundColor: 'rgba(0, 45, 114, 0.15)' }]}>
              <MaterialCommunityIcons name="baseball" size={18} color="#002D72" />
            </View>
            <Text style={[styles.hubSectionTitle, { color: theme.colors.onSurface }]}>MLB Betting Trends</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
          {mlbTrendsLoading ? (
            <View style={[styles.hubShimmerRow, styles.hubScrollBreakout]}>
              {[0, 1, 2].map(i => (
                <OutlierCardShimmer key={i} delay={i * 150} />
              ))}
            </View>
          ) : mlbTrendOutliers.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubScrollBreakout} contentContainerStyle={styles.hubCardRow}>
              {mlbTrendOutliers.slice(0, 4).map((t, i) => {
                // Resolve MLB logos + colors via team_id, with name fallback
                const game = mlbTrendsGames.find((g) => g.gamePk === t.gameId);
                const awayById = game ? getMLBTeamById(game.awayTeam.team_id) : null;
                const homeById = game ? getMLBTeamById(game.homeTeam.team_id) : null;
                const awayFallback = getMLBFallbackTeamInfo(t.awayTeam);
                const homeFallback = getMLBFallbackTeamInfo(t.homeTeam);
                const awayLogo = awayById?.logoUrl ?? awayFallback?.logo_url ?? null;
                const homeLogo = homeById?.logoUrl ?? homeFallback?.logo_url ?? null;
                // Resolve colors by abbreviation for reliable matching
                const awayAbbrev = awayById?.abbrev ?? awayFallback?.team;
                const homeAbbrev = homeById?.abbrev ?? homeFallback?.team;
                const awayClr = awayAbbrev ? getMLBTeamColors(awayAbbrev).primary : undefined;
                const homeClr = homeAbbrev ? getMLBTeamColors(homeAbbrev).primary : undefined;
                return (
                  <OutlierMatchupCard
                    key={`mlb-trend-${t.gameId}-${t.candidate.teamName}-${i}`}
                    awayTeam={t.awayTeam}
                    homeTeam={t.homeTeam}
                    sport="mlb"
                    awayTeamLogo={awayLogo}
                    homeTeamLogo={homeLogo}
                    awayColor={awayClr}
                    homeColor={homeClr}
                    pickIcon="percent"
                    pickLabel={`${t.candidate.teamName} ${t.candidate.marketType}`}
                    pickValue={`${t.candidate.percentage.toFixed(0)}% (${t.candidate.record})`}
                    accentColor="#002D72"
                    loading={loadingGameId === String(t.gameId)}
                    onPress={() => {
                      setLoadingGameId(String(t.gameId));
                      if (game) openMLBTrendsSheet(game);
                      setTimeout(() => setLoadingGameId(null), 500);
                    }}
                  />
                );
              })}
            </ScrollView>
          ) : (
            <TouchableOpacity style={[styles.hubCtaCard, { borderColor: 'rgba(0, 45, 114, 0.25)', backgroundColor: isDark ? 'rgba(0, 45, 114, 0.05)' : 'rgba(0, 45, 114, 0.04)' }]} activeOpacity={0.7} onPress={() => setSelectedCategory('mlb-trends')}>
              <MaterialCommunityIcons name="baseball" size={28} color="#002D72" style={{ marginBottom: 8 }} />
              <Text style={[styles.hubCtaTitle, { color: theme.colors.onSurface }]}>No trends yet</Text>
              <Text style={[styles.hubCtaDesc, { color: theme.colors.onSurfaceVariant }]}>Explore the full tool</Text>
              <View style={[styles.hubCtaPill, { backgroundColor: 'rgba(0, 45, 114, 0.15)' }]}>
                <Text style={[styles.hubCtaPillText, { color: '#002D72' }]}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={12} color="#002D72" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── NBA Model Accuracy ── */}
        <View style={styles.hubSection}>
          <TouchableOpacity style={styles.hubSectionHeader} onPress={() => setSelectedCategory('nba-accuracy')} activeOpacity={0.7}>
            <View style={[styles.hubSectionIconCircle, { backgroundColor: 'rgba(20, 184, 166, 0.15)' }]}>
              <MaterialCommunityIcons name="bullseye-arrow" size={18} color="#14b8a6" />
            </View>
            <Text style={[styles.hubSectionTitle, { color: theme.colors.onSurface }]}>NBA Model Accuracy</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
          {nbaAccuracyLoading ? (
            <View style={[styles.hubShimmerRow, styles.hubScrollBreakout]}>
              {[0, 1, 2].map(i => (
                <OutlierCardShimmer key={i} delay={i * 150} />
              ))}
            </View>
          ) : nbaAccuracyOutliers.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubScrollBreakout} contentContainerStyle={styles.hubCardRow}>
              {nbaAccuracyOutliers.slice(0, 4).map((o, i) => (
                <OutlierMatchupCard
                  key={`nba-acc-${o.gameId}-${o.pickType}-${i}`}
                  awayTeam={o.awayTeam}
                  homeTeam={o.homeTeam}
                  sport="nba"
                  awayTeamLogo={o.awayTeamLogo}
                  homeTeamLogo={o.homeTeamLogo}
                  pickIcon="bullseye-arrow"
                  pickLabel={`${o.pick} ${o.pickType}`}
                  pickValue={o.isHigh ? `${o.accuracyPct.toFixed(0)}% accurate` : `Only ${o.accuracyPct.toFixed(0)}% — fade`}
                  accentColor={o.isHigh ? '#14b8a6' : '#ef4444'}
                  loading={loadingGameId === String(o.gameId)}
                  onPress={async () => {
                    setLoadingGameId(String(o.gameId));
                    try {
                      const fullGame = await lookupNBAFullGame(o.gameId);
                      if (fullGame) openNBASheet(fullGame);
                    } finally {
                      setTimeout(() => setLoadingGameId(null), 500);
                    }
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity style={[styles.hubCtaCard, { borderColor: 'rgba(20, 184, 166, 0.25)', backgroundColor: isDark ? 'rgba(20, 184, 166, 0.05)' : 'rgba(20, 184, 166, 0.04)' }]} activeOpacity={0.7} onPress={() => setSelectedCategory('nba-accuracy')}>
              <MaterialCommunityIcons name="bullseye-arrow" size={28} color="#14b8a6" style={{ marginBottom: 8 }} />
              <Text style={[styles.hubCtaTitle, { color: theme.colors.onSurface }]}>No outliers yet</Text>
              <Text style={[styles.hubCtaDesc, { color: theme.colors.onSurfaceVariant }]}>Explore the full tool</Text>
              <View style={[styles.hubCtaPill, { backgroundColor: 'rgba(20, 184, 166, 0.15)' }]}>
                <Text style={[styles.hubCtaPillText, { color: '#14b8a6' }]}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={12} color="#14b8a6" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── NCAAB Model Accuracy ── */}
        <View style={styles.hubSection}>
          <TouchableOpacity style={styles.hubSectionHeader} onPress={() => setSelectedCategory('ncaab-accuracy')} activeOpacity={0.7}>
            <View style={[styles.hubSectionIconCircle, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
              <MaterialCommunityIcons name="bullseye-arrow" size={18} color="#f97316" />
            </View>
            <Text style={[styles.hubSectionTitle, { color: theme.colors.onSurface }]}>NCAAB Model Accuracy</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
          {ncaabAccuracyLoading ? (
            <View style={[styles.hubShimmerRow, styles.hubScrollBreakout]}>
              {[0, 1, 2].map(i => (
                <OutlierCardShimmer key={i} delay={i * 150} />
              ))}
            </View>
          ) : ncaabAccuracyOutliers.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubScrollBreakout} contentContainerStyle={styles.hubCardRow}>
              {ncaabAccuracyOutliers.slice(0, 4).map((o, i) => (
                <OutlierMatchupCard
                  key={`ncaab-acc-${o.gameId}-${o.pickType}-${i}`}
                  awayTeam={o.awayTeam}
                  homeTeam={o.homeTeam}
                  sport="ncaab"
                  awayTeamLogo={o.awayTeamLogo}
                  homeTeamLogo={o.homeTeamLogo}
                  pickIcon="bullseye-arrow"
                  pickLabel={`${o.pick} ${o.pickType}`}
                  pickValue={o.isHigh ? `${o.accuracyPct.toFixed(0)}% accurate` : `Only ${o.accuracyPct.toFixed(0)}% — fade`}
                  accentColor={o.isHigh ? '#14b8a6' : '#ef4444'}
                  loading={loadingGameId === String(o.gameId)}
                  onPress={async () => {
                    setLoadingGameId(String(o.gameId));
                    try {
                      const fullGame = await lookupNCAABFullGame(o.gameId);
                      if (fullGame) openNCAABSheet(fullGame);
                    } finally {
                      setTimeout(() => setLoadingGameId(null), 500);
                    }
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity style={[styles.hubCtaCard, { borderColor: 'rgba(249, 115, 22, 0.25)', backgroundColor: isDark ? 'rgba(249, 115, 22, 0.05)' : 'rgba(249, 115, 22, 0.04)' }]} activeOpacity={0.7} onPress={() => setSelectedCategory('ncaab-accuracy')}>
              <MaterialCommunityIcons name="bullseye-arrow" size={28} color="#f97316" style={{ marginBottom: 8 }} />
              <Text style={[styles.hubCtaTitle, { color: theme.colors.onSurface }]}>No outliers yet</Text>
              <Text style={[styles.hubCtaDesc, { color: theme.colors.onSurfaceVariant }]}>Explore the full tool</Text>
              <View style={[styles.hubCtaPill, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
                <Text style={[styles.hubCtaPillText, { color: '#f97316' }]}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={12} color="#f97316" />
              </View>
            </TouchableOpacity>
          )}
        </View>

      </Animated.ScrollView>
       )}

       {/* Outliers Tab — Detail View */}
       {activeTab === 'outliers' && selectedCategory !== null && (
       <View style={{ flex: 1 }}>
         {/* Frosted Glass Header */}
         <View style={[styles.fixedHeaderContainer, { height: insets.top + 56 }]}>
           <AndroidBlurView
             intensity={80}
             tint={isDark ? 'dark' : 'light'}
             style={[styles.fixedHeader, { paddingTop: insets.top }]}
           >
             <View style={styles.headerTop}>
               <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.detailBackButton}>
                 <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
               </TouchableOpacity>

               <View style={{ flex: 1 }} />

               <TouchableOpacity onPress={onRefresh} style={styles.detailRefreshButton} disabled={refreshing}>
                 {refreshing ? (
                   <ActivityIndicator size="small" color="#00E676" />
                 ) : (
                   <MaterialCommunityIcons name="refresh" size={22} color={theme.colors.onSurface} />
                 )}
               </TouchableOpacity>
             </View>
           </AndroidBlurView>
         </View>

         <ScrollView
           contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 56 + 16, paddingBottom: TAB_BAR_HEIGHT + 20 }]}
           showsVerticalScrollIndicator={true}
           refreshControl={
             <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} progressViewOffset={insets.top + 56} />
           }
         >
           {/* Value Alerts Detail */}
           {selectedCategory === 'value' && (
             <>
               <ToolExplainerBanner
                 accentColor="#22c55e"
                 title="Prediction Market Alerts"
                 titleIcon="trending-up"
                 headline="Follow the smart money."
                 description="Prediction markets move faster than sportsbooks. When Polymarket consensus diverges from the line, the book may not have adjusted yet — that's your window."
                 examples={[
                   { icon: 'trending-up', label: 'Polymarket has Chiefs ML at 67%', value: 'Book: -150', valueColor: '#22c55e' },
                   { icon: 'swap-horizontal', label: 'Consensus says Over but line hasn\'t moved', value: '62% Over', valueColor: '#22c55e' },
                   { icon: 'alert-circle', label: 'Spread divergence: market vs book', value: '+3.5 gap', valueColor: '#f59e0b' },
                 ]}
               />
               {renderSportFilter(valueAlerts || [], valueAlertsFilter, setValueAlertsFilter)}
               {valueAlertsLoading || gamesLoading ? (
                 <View>{[1, 2, 3].map((i) => <AlertCardShimmer key={i} />)}</View>
               ) : filteredValueAlerts.length > 0 ? (
                 <View style={styles.cardsGrid}>
                   {filteredValueAlerts.slice(0, shouldShowLocks ? 2 : undefined).map(renderValueAlertCard)}
                   {lockedValueAlertsCount > 0 && Array.from({ length: lockedValueAlertsCount }).map((_, index) => (
                     <LockedOverlay key={`locked-value-${index}`} message="Unlock all alerts with Pro" style={styles.lockedAlertCard} />
                   ))}
                 </View>
               ) : (
                 <View style={styles.emptyState}>
                   <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                     No {valueAlertsFilter ? valueAlertsFilter.toUpperCase() : ''} value alerts found for this week.
                   </Text>
                 </View>
               )}
             </>
           )}

           {/* Fade Alerts Detail */}
           {selectedCategory === 'fade' && (
             <>
               <ToolExplainerBanner
                 accentColor="#f59e0b"
                 title="Model Fade Alerts"
                 titleIcon="lightning-bolt"
                 headline="When confidence backfires."
                 description="When our model is extremely confident, backtesting shows betting the opposite side has been more profitable. These are contrarian opportunities hiding in plain sight."
                 examples={[
                   { icon: 'lightning-bolt', label: 'Model says Bills -7 at 92% confidence', value: 'Fade', valueColor: '#ef4444' },
                   { icon: 'swap-vertical', label: 'Backtest: fading 90%+ picks hits 61%', value: '61% win', valueColor: '#22c55e' },
                   { icon: 'gauge-full', label: 'Extreme NBA spread confidence', value: 'Fade', valueColor: '#ef4444' },
                 ]}
               />
               {renderSportFilter(fadeAlerts || [], fadeAlertsFilter, setFadeAlertsFilter)}
               {fadeAlertsLoading || gamesLoading ? (
                 <View>{[1, 2, 3].map((i) => <AlertCardShimmer key={i} />)}</View>
               ) : filteredFadeAlerts.length > 0 ? (
                 <View style={styles.cardsGrid}>
                   {filteredFadeAlerts.slice(0, shouldShowLocks ? 2 : undefined).map(renderFadeAlertCard)}
                   {lockedFadeAlertsCount > 0 && Array.from({ length: lockedFadeAlertsCount }).map((_, index) => (
                     <LockedOverlay key={`locked-fade-${index}`} message="Unlock all alerts with Pro" style={styles.lockedAlertCard} />
                   ))}
                 </View>
               ) : (
                 <View style={styles.emptyState}>
                   <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                     No {fadeAlertsFilter ? fadeAlertsFilter.toUpperCase() : ''} model alerts found for today.
                   </Text>
                 </View>
               )}
             </>
           )}

           {/* NBA Trends Detail */}
           {selectedCategory === 'nba-trends' && (
             <>
               <ToolExplainerBanner
                 accentColor="#0ea5e9"
                 title="NBA Betting Trends"
                 titleIcon="basketball"
                 headline="Situations that keep paying off."
                 description={`Teams covering at ${BETTING_TRENDS_THRESHOLD}%+ in specific situations — after wins, as favorites, on rest — patterns the line doesn't always price in.`}
                 examples={[
                   { icon: 'shield-check', label: 'Celtics ATS after a loss', value: '72% (13-5)', valueColor: '#22c55e' },
                   { icon: 'trending-up', label: 'Lakers Over as home favorite', value: '68% (11-5)', valueColor: '#22c55e' },
                   { icon: 'sleep', label: 'Nuggets ATS on 2+ days rest', value: '70% (9-4)', valueColor: '#22c55e' },
                 ]}
               />
               {nbaTrendsLoading ? (
                 <View>{[1, 2, 3].map((i) => <AlertCardShimmer key={`nba-trends-${i}`} />)}</View>
               ) : nbaTrendOutliers.length > 0 ? (
                 <View style={styles.cardsGrid}>
                   {nbaTrendOutliers.slice(0, shouldShowLocks ? 2 : undefined).map(renderTrendOutlierCard)}
                   {shouldShowLocks && Math.min(3, Math.max(0, nbaTrendOutliers.length - 2)) > 0 && Array.from({ length: Math.min(3, Math.max(0, nbaTrendOutliers.length - 2)) }).map((_, index) => (
                     <LockedOverlay key={`locked-nba-trends-${index}`} message="Unlock all alerts with Pro" style={styles.lockedAlertCard} />
                   ))}
                 </View>
               ) : (
                 <View style={styles.emptyState}>
                   <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                     No NBA ATS/O-U trend outliers at {BETTING_TRENDS_THRESHOLD}%+ right now.
                   </Text>
                 </View>
               )}
             </>
           )}

           {/* NCAAB Trends Detail */}
           {selectedCategory === 'ncaab-trends' && (
             <>
               <ToolExplainerBanner
                 accentColor="#6366f1"
                 title="NCAAB Betting Trends"
                 titleIcon="basketball"
                 headline="College chaos has patterns."
                 description={`More variance means bigger edges. Situational trends at ${BETTING_TRENDS_THRESHOLD}%+ ATS or O/U win rates reveal what the market misses in college hoops.`}
                 examples={[
                   { icon: 'shield-check', label: 'Duke ATS as home favorite', value: '74% (14-5)', valueColor: '#22c55e' },
                   { icon: 'trending-up', label: 'Gonzaga Over after a win', value: '69% (9-4)', valueColor: '#22c55e' },
                   { icon: 'arrow-down', label: 'Kentucky Under as dog', value: '71% (10-4)', valueColor: '#22c55e' },
                 ]}
               />
               {ncaabTrendsLoading ? (
                 <View>{[1, 2, 3].map((i) => <AlertCardShimmer key={`ncaab-trends-${i}`} />)}</View>
               ) : ncaabTrendOutliers.length > 0 ? (
                 <View style={styles.cardsGrid}>
                   {ncaabTrendOutliers.slice(0, shouldShowLocks ? 2 : undefined).map(renderTrendOutlierCard)}
                   {shouldShowLocks && Math.min(3, Math.max(0, ncaabTrendOutliers.length - 2)) > 0 && Array.from({ length: Math.min(3, Math.max(0, ncaabTrendOutliers.length - 2)) }).map((_, index) => (
                     <LockedOverlay key={`locked-ncaab-trends-${index}`} message="Unlock all alerts with Pro" style={styles.lockedAlertCard} />
                   ))}
                 </View>
               ) : (
                 <View style={styles.emptyState}>
                   <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                     No NCAAB ATS/O-U trend outliers at {BETTING_TRENDS_THRESHOLD}%+ right now.
                   </Text>
                 </View>
               )}
             </>
           )}

           {/* MLB Trends Detail */}
           {selectedCategory === 'mlb-trends' && (
             <>
               <ToolExplainerBanner
                 accentColor="#002D72"
                 title="MLB Betting Trends"
                 titleIcon="baseball"
                 headline="162 games reveal the patterns."
                 description={`Situational win % and over/under trends at ${MLB_BETTING_TRENDS_THRESHOLD}%+ across rest, matchup type, and recent form — edges the daily line doesn't always catch.`}
                 examples={[
                   { icon: 'baseball-bat', label: 'Yankees ML after a loss', value: '64% (18-10)', valueColor: '#22c55e' },
                   { icon: 'trending-up', label: 'Dodgers Over vs LHP', value: '67% (12-6)', valueColor: '#22c55e' },
                   { icon: 'sleep', label: 'Braves ML on full rest', value: '62% (15-9)', valueColor: '#22c55e' },
                 ]}
               />
               {mlbTrendsLoading ? (
                 <View>{[1, 2, 3].map((i) => <AlertCardShimmer key={`mlb-trends-${i}`} />)}</View>
               ) : mlbTrendOutliers.length > 0 ? (
                 <View style={styles.cardsGrid}>
                   {mlbTrendOutliers.slice(0, shouldShowLocks ? 2 : undefined).map(renderTrendOutlierCard)}
                   {shouldShowLocks && Math.min(3, Math.max(0, mlbTrendOutliers.length - 2)) > 0 && Array.from({ length: Math.min(3, Math.max(0, mlbTrendOutliers.length - 2)) }).map((_, index) => (
                     <LockedOverlay key={`locked-mlb-trends-${index}`} message="Unlock all alerts with Pro" style={styles.lockedAlertCard} />
                   ))}
                 </View>
               ) : (
                 <View style={styles.emptyState}>
                   <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                     No MLB trend outliers at {MLB_BETTING_TRENDS_THRESHOLD}%+ right now.
                   </Text>
                 </View>
               )}
             </>
           )}

           {/* NBA Accuracy Detail */}
           {selectedCategory === 'nba-accuracy' && (
             <>
               <ToolExplainerBanner
                 accentColor="#14b8a6"
                 title="NBA Model Accuracy"
                 titleIcon="bullseye-arrow"
                 headline="Know when the model is dialed in."
                 description={`Our model's track record on similar matchups. High accuracy (${NBA_ACCURACY_HIGH_THRESHOLD}%+) means reliable signal. Low accuracy (${NBA_ACCURACY_LOW_THRESHOLD}%-) flags a profitable fade.`}
                 examples={[
                   { icon: 'thumb-up', label: 'Celtics spread pick — 82% accurate', value: 'Trust', valueColor: '#22c55e' },
                   { icon: 'thumb-down', label: 'Lakers O/U pick — only 38% accurate', value: 'Fade', valueColor: '#ef4444' },
                   { icon: 'bullseye-arrow', label: 'Nuggets ML pick — 71% accurate', value: 'Trust', valueColor: '#22c55e' },
                 ]}
               />
               {nbaAccuracyLoading ? (
                 <View>{[1, 2, 3].map((i) => <AlertCardShimmer key={`nba-acc-${i}`} />)}</View>
               ) : nbaAccuracyOutliers.length > 0 ? (
                 <View style={styles.cardsGrid}>
                   {nbaAccuracyOutliers.slice(0, shouldShowLocks ? 2 : undefined).map(renderAccuracyOutlierCard)}
                   {shouldShowLocks && Math.min(3, Math.max(0, nbaAccuracyOutliers.length - 2)) > 0 && Array.from({ length: Math.min(3, Math.max(0, nbaAccuracyOutliers.length - 2)) }).map((_, index) => (
                     <LockedOverlay key={`locked-nba-acc-${index}`} message="Unlock all alerts with Pro" style={styles.lockedAlertCard} />
                   ))}
                 </View>
               ) : (
                 <View style={styles.emptyState}>
                   <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                     No NBA model accuracy outliers at {NBA_ACCURACY_HIGH_THRESHOLD}%+ or {NBA_ACCURACY_LOW_THRESHOLD}%- right now.
                   </Text>
                 </View>
               )}
             </>
           )}

           {/* NCAAB Accuracy Detail */}
           {selectedCategory === 'ncaab-accuracy' && (
             <>
               <ToolExplainerBanner
                 accentColor="#f97316"
                 title="NCAAB Model Accuracy"
                 titleIcon="bullseye-arrow"
                 headline="The model's college track record."
                 description={`Games where the model has been extremely accurate (${NCAAB_ACCURACY_HIGH_THRESHOLD}%+) or consistently wrong (${NCAAB_ACCURACY_LOW_THRESHOLD}%-). Both are actionable.`}
                 examples={[
                   { icon: 'thumb-up', label: 'Duke spread pick — 79% accurate', value: 'Trust', valueColor: '#22c55e' },
                   { icon: 'thumb-down', label: 'UNC O/U pick — only 35% accurate', value: 'Fade', valueColor: '#ef4444' },
                   { icon: 'bullseye-arrow', label: 'Kansas ML pick — 74% accurate', value: 'Trust', valueColor: '#22c55e' },
                 ]}
               />
               {ncaabAccuracyLoading ? (
                 <View>{[1, 2, 3].map((i) => <AlertCardShimmer key={`ncaab-acc-${i}`} />)}</View>
               ) : ncaabAccuracyOutliers.length > 0 ? (
                 <View style={styles.cardsGrid}>
                   {ncaabAccuracyOutliers.slice(0, shouldShowLocks ? 2 : undefined).map(renderAccuracyOutlierCard)}
                   {shouldShowLocks && Math.min(3, Math.max(0, ncaabAccuracyOutliers.length - 2)) > 0 && Array.from({ length: Math.min(3, Math.max(0, ncaabAccuracyOutliers.length - 2)) }).map((_, index) => (
                     <LockedOverlay key={`locked-ncaab-acc-${index}`} message="Unlock all alerts with Pro" style={styles.lockedAlertCard} />
                   ))}
                 </View>
               ) : (
                 <View style={styles.emptyState}>
                   <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                     No NCAAB model accuracy outliers at {NCAAB_ACCURACY_HIGH_THRESHOLD}%+ or {NCAAB_ACCURACY_LOW_THRESHOLD}%- right now.
                   </Text>
                 </View>
               )}
             </>
           )}
         </ScrollView>
       </View>
       )}

      {/* Modals */}
      {renderFullListModal(
          showAllValueAlerts,
          () => setShowAllValueAlerts(false),
          "All Prediction Market Alerts",
          filteredValueAlerts,
          renderValueAlertCard
      )}

      {renderFullListModal(
          showAllFadeAlerts,
          () => setShowAllFadeAlerts(false),
          "All Model Fade Alerts",
          filteredFadeAlerts,
          renderFadeAlertCard
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  fixedHeader: {
    width: '100%',
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    gap: 16,
  },
  menuButton: {
    padding: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleMain: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  titleProof: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  chatButton: {
    padding: 8,
  },
  innerTabBar: {
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: 16,
  },
  innerTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  innerTabText: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
  innerTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#00E676',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  pageHeaderContainer: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  filterScroll: {
      marginBottom: 12,
  },
  filterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 8,
  },
  filterPillActive: {
      // Active styles handled by dynamic background color
  },
  filterPillText: {
      fontSize: 13,
      fontWeight: '600',
  },
  filterPillTextActive: {
      color: '#fff',
  },
  cardsGrid: {
    gap: 12,
  },
  alertCard: {
    borderWidth: 1,
  },
  cardHeader: {
    marginBottom: 12,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardContent: {
    gap: 8,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamAbbr: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  atSymbol: {
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  descriptionText: {
    fontSize: 12,
  },
  loadingText: {
    textAlign: 'center',
    marginVertical: 20,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
  showMoreButton: {
      marginTop: 8,
  },
  // Modal Styles
  modalContainer: {
      flex: 1,
      paddingTop: 20, // For status bar in modal
  },
  modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
  },
  closeButton: {
      padding: 4,
  },
  modalScrollContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    padding: 0,
  },
  lockedAlertCard: {
    minHeight: 120,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fadeSuggestionBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  fadeSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  fadeSuggestionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fadeSuggestionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  fadeReasonText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  // Hub styles — Spotify-style sections with horizontal card rows
  hubSection: {
    marginBottom: 28,
  },
  hubSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingRight: 4,
  },
  hubSectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  hubExplainer: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  hubExplainerText: {
    fontSize: 12,
    lineHeight: 17,
  },
  hubCardRow: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  hubScrollBreakout: {
    marginHorizontal: -16,
  },
  hubShimmerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 16,
  },
  hubShimmerCard: {
    width: 160,
    height: 160,
    borderRadius: 14,
  },
  hubCtaCard: {
    width: 160,
    height: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  hubCtaTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  hubCtaDesc: {
    fontSize: 11,
    marginBottom: 10,
  },
  hubCtaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  hubCtaPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Detail view styles
  detailBackButton: {
    padding: 8,
    marginRight: 4,
  },
  detailTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  detailRefreshButton: {
    padding: 8,
  },
});
