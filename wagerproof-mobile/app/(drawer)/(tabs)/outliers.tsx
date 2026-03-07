import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Animated, Platform, ActivityIndicator } from 'react-native';
import { useTheme, Button as PaperButton } from 'react-native-paper';
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
import { useNBABettingTrendsSheet } from '@/contexts/NBABettingTrendsSheetContext';
import { useNCAABBettingTrendsSheet } from '@/contexts/NCAABBettingTrendsSheetContext';
import { useNBABettingTrends } from '@/hooks/useNBABettingTrends';
import { useNCAABBettingTrends } from '@/hooks/useNCAABBettingTrends';
import { useNBAModelAccuracy } from '@/hooks/useNBAModelAccuracy';
import { useNCAABModelAccuracy } from '@/hooks/useNCAABModelAccuracy';
import { NBAGameTrendsData, SituationalTrendRow, parseRecord, formatSituation } from '@/types/nbaBettingTrends';
import { NCAABGameTrendsData, NCAABSituationalTrendRow, parseNCAABRecord, formatNCAABSituation } from '@/types/ncaabBettingTrends';
import { GameAccuracyData } from '@/types/modelAccuracy';
import { lookupNBAFullGame, lookupNCAABFullGame } from '@/hooks/useFullGameLookup';

// Helper to filter by sport
const filterBySport = <T extends { sport: 'nfl' | 'cfb' | 'nba' | 'ncaab' }>(
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
    default: return 'circle-outline';
  }
};

const getSportColor = (sport: string) => {
    switch (sport) {
        case 'nfl': return '#013369';
        case 'cfb': return '#C8102E';
        case 'nba': return '#1D428A';
        case 'ncaab': return '#F58426';
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
  sport: 'nba' | 'ncaab';
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
  const [activeTab, setActiveTab] = useState<'outliers' | 'agentPicks'>('outliers');

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
  const { games: nbaAccuracyGames, isLoading: nbaAccuracyLoading, refetch: refetchNbaAccuracy } = useNBAModelAccuracy();
  const { games: ncaabAccuracyGames, isLoading: ncaabAccuracyLoading, refetch: refetchNcaabAccuracy } = useNCAABModelAccuracy();
  const { openTrendsSheet: openNBATrendsSheet } = useNBABettingTrendsSheet();
  const { openTrendsSheet: openNCAABTrendsSheet } = useNCAABBettingTrendsSheet();

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
      refetchNbaAccuracy(),
      refetchNcaabAccuracy(),
    ]);
    setRefreshing(false);
  }, [queryClient, refetchNbaTrends, refetchNcaabTrends, refetchNbaAccuracy, refetchNcaabAccuracy]);

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

  const filteredValueAlerts = filterBySport(valueAlerts || [], valueAlertsFilter);
  const filteredFadeAlerts = filterBySport(fadeAlerts || [], fadeAlertsFilter);
  const nbaTrendOutliers = useMemo(() => buildNBATrendOutliers(nbaTrendsGames), [nbaTrendsGames]);
  const ncaabTrendOutliers = useMemo(() => buildNCAABTrendOutliers(ncaabTrendsGames), [ncaabTrendsGames]);
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
        if (game) {
          openNBATrendsSheet(game);
        }
      } else {
        const game = ncaabTrendsGames.find((g) => g.gameId === trend.gameId);
        if (game) {
          openNCAABTrendsSheet(game);
        }
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

  // Header slides up completely as user scrolls up
  const headerTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [0, -TOTAL_COLLAPSIBLE_HEIGHT],
    extrapolate: 'clamp',
  });

  // Header fades out as user scrolls up
  const headerOpacity = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Handle scroll event
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const INNER_TABS: { key: 'outliers' | 'agentPicks'; label: string }[] = [
    { key: 'outliers', label: 'Outliers' },
    { key: 'agentPicks', label: 'Top Agent Picks' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
       {/* Fixed Header with Inner Tabs - Animated */}
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

       {/* Outliers Tab */}
       {activeTab === 'outliers' && (
       <Animated.ScrollView
         contentContainerStyle={[
           styles.scrollContent,
           {
             paddingTop: TOTAL_HEADER_HEIGHT + 20,
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

     

        {/* Section 1: Polymarket Value Alerts */}
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={styles.titleRow}>
                    <MaterialCommunityIcons name="trending-up" size={20} color={theme.colors.onSurface} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Prediction Market Alerts</Text>
                </View>
                <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                    Markets where prediction markets odds show disagreement with lines or strong consensus.
                </Text>
            </View>

            {renderSportFilter(valueAlerts || [], valueAlertsFilter, setValueAlertsFilter)}

            {valueAlertsLoading || gamesLoading ? (
                <View>
                    {[1, 2, 3].map((i) => (
                        <AlertCardShimmer key={i} />
                    ))}
                </View>
            ) : filteredValueAlerts.length > 0 ? (
                <View style={styles.cardsGrid}>
                    {topValueAlerts.map(renderValueAlertCard)}

                    {/* Locked placeholder cards for non-pro users */}
                    {lockedValueAlertsCount > 0 && Array.from({ length: lockedValueAlertsCount }).map((_, index) => (
                      <LockedOverlay
                        key={`locked-value-${index}`}
                        message="Unlock all alerts with Pro"
                        style={styles.lockedAlertCard}
                      />
                    ))}

                    {!shouldShowLocks && filteredValueAlerts.length > 5 && (
                        <PaperButton
                            mode="outlined"
                            onPress={() => { setSearchText(''); setShowAllValueAlerts(true); }}
                            style={styles.showMoreButton}
                        >
                            Show More ({filteredValueAlerts.length - 5})
                        </PaperButton>
                    )}
                </View>
            ) : (
                <View style={styles.emptyState}>
                     <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                        No {valueAlertsFilter ? valueAlertsFilter.toUpperCase() : ''} value alerts found for this week.
                     </Text>
                </View>
            )}
        </View>

        {/* Section 2: Model Prediction Fade Alerts */}
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={styles.titleRow}>
                    <MaterialCommunityIcons name="lightning-bolt" size={20} color="#f59e0b" />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Model Fade Alerts</Text>
                </View>
                <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                    When our model shows extreme confidence, historical backtesting reveals that betting the opposite direction has been more profitable. Consider fading these overconfident picks.
                </Text>
            </View>

            {renderSportFilter(fadeAlerts || [], fadeAlertsFilter, setFadeAlertsFilter)}

            {fadeAlertsLoading || gamesLoading ? (
                <View>
                    {[1, 2, 3].map((i) => (
                        <AlertCardShimmer key={i} />
                    ))}
                </View>
            ) : filteredFadeAlerts.length > 0 ? (
                <View style={styles.cardsGrid}>
                    {topFadeAlerts.map(renderFadeAlertCard)}

                    {/* Locked placeholder cards for non-pro users */}
                    {lockedFadeAlertsCount > 0 && Array.from({ length: lockedFadeAlertsCount }).map((_, index) => (
                      <LockedOverlay
                        key={`locked-fade-${index}`}
                        message="Unlock all alerts with Pro"
                        style={styles.lockedAlertCard}
                      />
                    ))}

                    {!shouldShowLocks && filteredFadeAlerts.length > 5 && (
                        <PaperButton
                            mode="outlined"
                            onPress={() => { setSearchText(''); setShowAllFadeAlerts(true); }}
                            style={styles.showMoreButton}
                        >
                            Show More ({filteredFadeAlerts.length - 5})
                        </PaperButton>
                    )}
                </View>
            ) : (
                <View style={styles.emptyState}>
                     <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                        No {fadeAlertsFilter ? fadeAlertsFilter.toUpperCase() : ''} model alerts found for today.
                     </Text>
                </View>
            )}
        </View>

        {/* Section 3: NBA Betting Trends Outliers */}
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={styles.titleRow}>
                    <MaterialCommunityIcons name="basketball" size={20} color={theme.colors.onSurface} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>NBA Betting Trends Outliers</Text>
                </View>
                <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                    Highest ATS and O/U trend widgets at {BETTING_TRENDS_THRESHOLD}%+ win rates.
                </Text>
            </View>

            {nbaTrendsLoading ? (
                <View>
                    {[1, 2, 3].map((i) => (
                        <AlertCardShimmer key={`nba-trends-${i}`} />
                    ))}
                </View>
            ) : nbaTrendOutliers.length > 0 ? (
                <View style={styles.cardsGrid}>
                    {nbaTrendOutliers.slice(0, visibleAlertCount).map(renderTrendOutlierCard)}

                    {shouldShowLocks && Math.min(3, Math.max(0, nbaTrendOutliers.length - 2)) > 0 && Array.from({ length: Math.min(3, Math.max(0, nbaTrendOutliers.length - 2)) }).map((_, index) => (
                      <LockedOverlay
                        key={`locked-nba-trends-${index}`}
                        message="Unlock all alerts with Pro"
                        style={styles.lockedAlertCard}
                      />
                    ))}

                    <PaperButton
                      mode="outlined"
                      onPress={() => router.push('/(drawer)/(tabs)/nba-betting-trends')}
                      style={styles.showMoreButton}
                    >
                      Open NBA Betting Trends
                    </PaperButton>
                </View>
            ) : (
                <View style={styles.emptyState}>
                     <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                        No NBA ATS/O-U trend outliers at {BETTING_TRENDS_THRESHOLD}%+ right now.
                     </Text>
                </View>
            )}
        </View>

        {/* Section 4: NCAAB Betting Trends Outliers */}
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={styles.titleRow}>
                    <MaterialCommunityIcons name="basketball-hoop" size={20} color={theme.colors.onSurface} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>NCAAB Betting Trends Outliers</Text>
                </View>
                <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                    Highest ATS and O/U trend widgets at {BETTING_TRENDS_THRESHOLD}%+ win rates.
                </Text>
            </View>

            {ncaabTrendsLoading ? (
                <View>
                    {[1, 2, 3].map((i) => (
                        <AlertCardShimmer key={`ncaab-trends-${i}`} />
                    ))}
                </View>
            ) : ncaabTrendOutliers.length > 0 ? (
                <View style={styles.cardsGrid}>
                    {ncaabTrendOutliers.slice(0, visibleAlertCount).map(renderTrendOutlierCard)}

                    {shouldShowLocks && Math.min(3, Math.max(0, ncaabTrendOutliers.length - 2)) > 0 && Array.from({ length: Math.min(3, Math.max(0, ncaabTrendOutliers.length - 2)) }).map((_, index) => (
                      <LockedOverlay
                        key={`locked-ncaab-trends-${index}`}
                        message="Unlock all alerts with Pro"
                        style={styles.lockedAlertCard}
                      />
                    ))}

                    <PaperButton
                      mode="outlined"
                      onPress={() => router.push('/(drawer)/(tabs)/ncaab-betting-trends')}
                      style={styles.showMoreButton}
                    >
                      Open NCAAB Betting Trends
                    </PaperButton>
                </View>
            ) : (
                <View style={styles.emptyState}>
                     <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                        No NCAAB ATS/O-U trend outliers at {BETTING_TRENDS_THRESHOLD}%+ right now.
                     </Text>
                </View>
            )}
        </View>

        {/* Section 5: NBA Model Accuracy Outliers */}
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={styles.titleRow}>
                    <MaterialCommunityIcons name="bullseye-arrow" size={20} color="#14b8a6" />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>NBA Model Accuracy Outliers</Text>
                </View>
                <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                    Spread, ML, and O/U predictions with notable historical accuracy ({'>'}={NBA_ACCURACY_HIGH_THRESHOLD}% or {'<'}={NBA_ACCURACY_LOW_THRESHOLD}%) on {NBA_ACCURACY_MIN_GAMES}+ game samples.
                </Text>
            </View>

            {nbaAccuracyLoading ? (
                <View>
                    {[1, 2, 3].map((i) => (
                        <AlertCardShimmer key={`nba-acc-${i}`} />
                    ))}
                </View>
            ) : nbaAccuracyOutliers.length > 0 ? (
                <View style={styles.cardsGrid}>
                    {nbaAccuracyOutliers.slice(0, visibleAlertCount).map(renderAccuracyOutlierCard)}

                    {shouldShowLocks && Math.min(3, Math.max(0, nbaAccuracyOutliers.length - 2)) > 0 && Array.from({ length: Math.min(3, Math.max(0, nbaAccuracyOutliers.length - 2)) }).map((_, index) => (
                      <LockedOverlay
                        key={`locked-nba-acc-${index}`}
                        message="Unlock all alerts with Pro"
                        style={styles.lockedAlertCard}
                      />
                    ))}

                    <PaperButton
                      mode="outlined"
                      onPress={() => router.push('/(drawer)/(tabs)/nba-model-accuracy')}
                      style={styles.showMoreButton}
                    >
                      Open NBA Model Accuracy
                    </PaperButton>
                </View>
            ) : (
                <View style={styles.emptyState}>
                     <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                        No NBA model accuracy outliers at {NBA_ACCURACY_HIGH_THRESHOLD}%+ or {NBA_ACCURACY_LOW_THRESHOLD}%- right now.
                     </Text>
                </View>
            )}
        </View>

        {/* Section 6: NCAAB Model Accuracy Outliers */}
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <View style={styles.titleRow}>
                    <MaterialCommunityIcons name="bullseye-arrow" size={20} color="#f59e0b" />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>NCAAB Model Accuracy Outliers</Text>
                </View>
                <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                    Spread and O/U predictions with extreme historical accuracy ({'>'}={NCAAB_ACCURACY_HIGH_THRESHOLD}% or {'<'}={NCAAB_ACCURACY_LOW_THRESHOLD}%) on {NCAAB_ACCURACY_MIN_GAMES}+ game samples.
                </Text>
            </View>

            {ncaabAccuracyLoading ? (
                <View>
                    {[1, 2, 3].map((i) => (
                        <AlertCardShimmer key={`ncaab-acc-${i}`} />
                    ))}
                </View>
            ) : ncaabAccuracyOutliers.length > 0 ? (
                <View style={styles.cardsGrid}>
                    {ncaabAccuracyOutliers.slice(0, visibleAlertCount).map(renderAccuracyOutlierCard)}

                    {shouldShowLocks && Math.min(3, Math.max(0, ncaabAccuracyOutliers.length - 2)) > 0 && Array.from({ length: Math.min(3, Math.max(0, ncaabAccuracyOutliers.length - 2)) }).map((_, index) => (
                      <LockedOverlay
                        key={`locked-ncaab-acc-${index}`}
                        message="Unlock all alerts with Pro"
                        style={styles.lockedAlertCard}
                      />
                    ))}

                    <PaperButton
                      mode="outlined"
                      onPress={() => router.push('/(drawer)/(tabs)/ncaab-model-accuracy')}
                      style={styles.showMoreButton}
                    >
                      Open NCAAB Model Accuracy
                    </PaperButton>
                </View>
            ) : (
                <View style={styles.emptyState}>
                     <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                        No NCAAB model accuracy outliers at {NCAAB_ACCURACY_HIGH_THRESHOLD}%+ or {NCAAB_ACCURACY_LOW_THRESHOLD}%- right now.
                     </Text>
                </View>
            )}
        </View>

      </Animated.ScrollView>
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
});
