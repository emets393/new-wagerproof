import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Animated, Platform } from 'react-native';
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
import { useThemeContext } from '@/contexts/ThemeContext';
import { useDrawer } from '../_layout';
import { useAuth } from '@/contexts/AuthContext';
import { useScroll } from '@/contexts/ScrollContext';
import { useSettings } from '@/contexts/SettingsContext';

// Game Sheets
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { useNBAGameSheet } from '@/contexts/NBAGameSheetContext';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';
import { useProAccess } from '@/hooks/useProAccess';
import { LockedOverlay } from '@/components/LockedOverlay';

// Utils for mapping data to game sheet expectations
import { getNFLTeamColors, getCFBTeamColors, getNBATeamColors } from '@/utils/teamColors';

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

export default function OutliersScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { open: openDrawer } = useDrawer();
  const { user } = useAuth();
  const { scrollY, scrollYClamped } = useScroll();
  const { isPro, isLoading: isProLoading } = useProAccess();

  const [refreshing, setRefreshing] = useState(false);
  
  // Modals for "Show More"
  const [showAllValueAlerts, setShowAllValueAlerts] = useState(false);
  const [showAllFadeAlerts, setShowAllFadeAlerts] = useState(false);
  const [searchText, setSearchText] = useState('');

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

  // 1. Fetch Week Games
  const { data: weekGames, isLoading: gamesLoading } = useQuery({
    queryKey: ['week-games'],
    queryFn: fetchWeekGames,
  });

  // 2. Fetch Value Alerts
  const { data: valueAlerts, isLoading: valueAlertsLoading } = useQuery({
    queryKey: ['value-alerts', weekGames?.length],
    queryFn: () => fetchValueAlerts(weekGames || []),
    enabled: !!weekGames && weekGames.length > 0,
  });

  // 3. Fetch Fade Alerts
  const { data: fadeAlerts, isLoading: fadeAlertsLoading } = useQuery({
    queryKey: ['fade-alerts', weekGames?.length],
    queryFn: () => fetchFadeAlerts(weekGames || []),
    enabled: !!weekGames && weekGames.length > 0,
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
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const handleGamePress = useCallback((gameSummary: GameSummary) => {
      if (!gameSummary.originalData) return;

      const data = gameSummary.originalData;
      
      // Map data based on sport to what the sheets expect
      // This is a simplified mapping. In a real app, better to share the mapping logic from FeedScreen.
      if (gameSummary.sport === 'nfl') {
          // NFL sheet expects NFLPrediction
          const nflGame = {
              ...data,
              id: data.id || gameSummary.gameId,
              away_team: gameSummary.awayTeam,
              home_team: gameSummary.homeTeam,
              game_time: gameSummary.gameTime || data.game_time,
              // Add default values for missing fields to prevent crashes
              home_away_ml_prob: data.home_away_ml_prob || null,
              home_away_spread_cover_prob: data.home_away_spread_cover_prob || null,
              ou_result_prob: data.ou_result_prob || null,
          };
          openNFLSheet(nflGame);
      } else if (gameSummary.sport === 'cfb') {
          // CFB sheet expects CFBPrediction
           const cfbGame = {
              ...data,
              id: data.id || gameSummary.cfbId,
              away_team: gameSummary.awayTeam,
              home_team: gameSummary.homeTeam,
              // CFB sheet needs specific fields
              api_spread: gameSummary.homeSpread,
              api_over_line: gameSummary.totalLine,
           };
          openCFBSheet(cfbGame);
      } else if (gameSummary.sport === 'nba') {
          // NBA sheet expects NBAGame
          const nbaGame = {
              ...data,
              id: String(data.game_id),
              game_id: data.game_id,
              away_team: gameSummary.awayTeam,
              home_team: gameSummary.homeTeam,
          };
          openNBASheet(nbaGame);
      } else if (gameSummary.sport === 'ncaab') {
          // NCAAB sheet expects NCAABGame
          const ncaabGame = {
              ...data,
              id: String(data.game_id),
              game_id: data.game_id,
              away_team: gameSummary.awayTeam,
              home_team: gameSummary.homeTeam,
          };
          openNCAABSheet(ncaabGame);
      }
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
          <Text style={[styles.matchupText, { color: theme.colors.onSurface }]}>
              {alert.awayTeam} @ {alert.homeTeam}
          </Text>
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
          <Text style={[styles.matchupText, { color: theme.colors.onSurface }]}>
              {alert.awayTeam} @ {alert.homeTeam}
          </Text>

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

  // Calculate header heights (must match tab bar calculation)
  const HEADER_TOP_HEIGHT = 56; // Header top section height
  const TOTAL_HEADER_HEIGHT = insets.top + HEADER_TOP_HEIGHT;
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

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
       {/* Fixed Header (No Tabs) - Animated */}
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
                try {
                  openDrawer();
                } catch (error) {
                  console.error('Error opening drawer:', error);
                }
              }} 
              style={styles.menuButton}
            >
              <MaterialCommunityIcons name="menu" size={28} color={theme.colors.onSurface} />
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
        </AndroidBlurView>
       </Animated.View>

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
                        No {fadeAlertsFilter ? fadeAlertsFilter.toUpperCase() : ''} model alerts found for this week.
                     </Text>
                </View>
            )}
        </View>

      </Animated.ScrollView>

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
    gap: 4,
  },
  matchupText: {
    fontSize: 16,
    fontWeight: 'bold',
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
