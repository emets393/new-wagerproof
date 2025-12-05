import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Animated, Platform } from 'react-native';
import { useTheme, Button as PaperButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { fetchWeekGames, fetchValueAlerts, fetchFadeAlerts, ValueAlert, FadeAlert, GameSummary } from '@/services/outliersService';
import { Card } from '@/components/ui/Card';
import { AlertCardShimmer } from '@/components/AlertCardShimmer';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useDrawer } from '../_layout';
import { useAuth } from '@/contexts/AuthContext';
import { useWagerBotChatSheet } from '@/contexts/WagerBotChatSheetContext';
import { useScroll } from '@/contexts/ScrollContext';
import { useLiveScores } from '@/hooks/useLiveScores';
import { useSettings } from '@/contexts/SettingsContext';

// Game Sheets
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { useNBAGameSheet } from '@/contexts/NBAGameSheetContext';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';

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

export default function OutliersScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { open: openDrawer } = useDrawer();
  const { user } = useAuth();
  const { openChatSheet } = useWagerBotChatSheet();
  const { scrollY, scrollYClamped } = useScroll();
  const { hasLiveGames } = useLiveScores();
  const { scoreboardEnabled } = useSettings();

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


  const renderValueAlertCard = (alert: ValueAlert, index: number) => (
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

  const renderFadeAlertCard = (alert: FadeAlert, index: number) => (
    <Card
      key={`${alert.gameId}-${alert.pickType}-${alert.predictedTeam}-${index}`}
      style={{
        ...styles.alertCard,
        backgroundColor: isDark ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.1)',
        borderColor: isDark ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.3)',
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
          
          {/* Pick Type Pill */}
          <View style={[styles.pill, { backgroundColor: '#a855f720' }]}>
             <Text style={[styles.pillText, { color: '#7e22ce' }]}>{alert.pickType}</Text>
          </View>

          {/* Confidence Pill */}
          <View style={[styles.pill, { backgroundColor: '#a855f7' }]}>
             {alert.sport === 'nfl' ? (
                 <MaterialCommunityIcons name="percent" size={10} color="#fff" />
             ) : null}
             <Text style={[styles.pillText, { color: '#fff' }]}>
                 {alert.sport === 'nfl' ? `${alert.confidence}%` : `${alert.confidence}pt`}
             </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text style={[styles.matchupText, { color: theme.colors.onSurface }]}>
            {alert.awayTeam} @ {alert.homeTeam}
        </Text>
        <Text style={[styles.descriptionText, { color: theme.colors.onSurfaceVariant }]}>
            Model likes <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{alert.predictedTeam}</Text>
            {alert.sport === 'nfl'
              ? ` with ${alert.confidence}% confidence`
              : ` with ${alert.confidence}pt edge against the line`
            }
        </Text>
      </View>
    </Card>
  );

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

  const topValueAlerts = filteredValueAlerts.slice(0, 5);
  const topFadeAlerts = filteredFadeAlerts.slice(0, 5);

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
  
  // Calculate bottom padding (tab bar + ticker + safe area)
  const LIVE_TICKER_HEIGHT = (hasLiveGames && scoreboardEnabled) ? 64 : 0; // 40px ticker + 12px top + 12px bottom padding
  const TAB_BAR_BASE_HEIGHT = 65;
  const TAB_BAR_HEIGHT = TAB_BAR_BASE_HEIGHT + insets.bottom + LIVE_TICKER_HEIGHT;
  
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
          <BlurView
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
                onPress={openChatSheet}
                style={styles.chatButton}
              >
                <MaterialCommunityIcons name="robot" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
            )}
          </View>
        </BlurView>
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
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Polymarket Alerts</Text>
                </View>
                <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                    Markets where Polymarket odds show disagreement with lines or strong consensus.
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
                    
                    {filteredValueAlerts.length > 5 && (
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
                    <MaterialCommunityIcons name="robot-excited-outline" size={20} color={theme.colors.onSurface} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Model Fade Alerts</Text>
                </View>
                <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                    High-confidence model predictions suggesting strong edges.
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

                    {filteredFadeAlerts.length > 5 && (
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
          "All Polymarket Alerts", 
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
});
