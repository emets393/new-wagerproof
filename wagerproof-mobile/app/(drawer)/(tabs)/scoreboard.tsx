import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, RefreshControl } from 'react-native';
import { useTheme, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AndroidBlurView } from '@/components/AndroidBlurView';
import { useLiveScores } from '@/hooks/useLiveScores';
import { LiveScoreCard } from '@/components/LiveScoreCard';
import { LiveScoreCardShimmer } from '@/components/LiveScoreCardShimmer';
import { LiveScorePredictionCard } from '@/components/LiveScorePredictionCard';
import { LiveScoreDetailModal } from '@/components/LiveScoreDetailModal';
import { useScroll } from '@/contexts/ScrollContext';
import { LiveGame } from '@/types/liveScores';
import { useDrawer } from '../_layout';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useWagerBotSuggestion } from '@/contexts/WagerBotSuggestionContext';

// League configuration with icons and display names
const LEAGUE_CONFIG: Record<string, { name: string; icon: any; order: number }> = {
  'NFL': { name: 'NFL Games', icon: 'shield-half-full', order: 1 },
  'NCAAF': { name: 'College Football', icon: 'trophy', order: 2 },
  'CFB': { name: 'College Football', icon: 'trophy', order: 2 }, // Alias for NCAAF
  'NBA': { name: 'NBA Games', icon: 'basketball', order: 3 },
  'NCAAB': { name: 'College Basketball', icon: 'basketball-hoop', order: 4 },
  'NHL': { name: 'NHL Games', icon: 'hockey-sticks', order: 5 },
  'MLB': { name: 'MLB Games', icon: 'baseball', order: 6 },
  'MLS': { name: 'MLS Games', icon: 'soccer', order: 7 },
  'EPL': { name: 'EPL Games', icon: 'soccer', order: 8 },
};

export default function ScoreboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { open: openDrawer } = useDrawer();
  const { user } = useAuth();
  const { isDark } = useThemeContext();
  const { scrollY, scrollYClamped } = useScroll();
  
  const { games, hasLiveGames, isLoading, refetch } = useLiveScores();
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // WagerBot floating assistant
  const { onPageChange, openManualMenu, setScoreboardData } = useWagerBotSuggestion();

  // Always notify context which page we're on (needed for openManualMenu)
  useEffect(() => {
    onPageChange('scoreboard');
  }, [onPageChange]);

  // Update scoreboard data in WagerBot context for scanning
  useEffect(() => {
    if (games.length > 0) {
      setScoreboardData(games);
    }
  }, [games, setScoreboardData]);

  const handleGamePress = (game: LiveGame) => {
    setSelectedGame(game);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedGame(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Header Animation Constants
  const HEADER_TOP_HEIGHT = 56;
  // We don't have tabs here, but we want the header to slide up/down
  const TOTAL_HEADER_HEIGHT = insets.top + HEADER_TOP_HEIGHT;
  const TOTAL_COLLAPSIBLE_HEIGHT = TOTAL_HEADER_HEIGHT;

  const headerTranslate = scrollYClamped.interpolate({
    inputRange: [0, TOTAL_COLLAPSIBLE_HEIGHT],
    outputRange: [0, -TOTAL_COLLAPSIBLE_HEIGHT],
    extrapolate: 'clamp',
  });

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

  // Group games by league
  const gamesByLeague = games.reduce((acc, game) => {
    const leagueKey = game.league;
    if (!acc[leagueKey]) {
      acc[leagueKey] = [];
    }
    acc[leagueKey].push(game);
    return acc;
  }, {} as Record<string, LiveGame[]>);

  // Sort leagues by configured order
  const sortedLeagues = Object.keys(gamesByLeague).sort((a, b) => {
    const orderA = LEAGUE_CONFIG[a]?.order ?? 999;
    const orderB = LEAGUE_CONFIG[b]?.order ?? 999;
    return orderA - orderB;
  });

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      {/* Standard Fixed Header with Frosted Glass Effect */}
      <Animated.View
        style={[
          styles.fixedHeaderContainer,
          {
            transform: [{ translateY: headerTranslate }],
            opacity: headerOpacity,
          },
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

      {/* Scrollable Content */}
      <Animated.ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: TOTAL_HEADER_HEIGHT,
            paddingBottom: 65 + insets.bottom + 20 
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
            colors={[theme.colors.primary]}
            progressViewOffset={TOTAL_HEADER_HEIGHT}
          />
        }
      >
        {/* Page Controls / Title Sub-header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={[styles.pageTitle, { color: theme.colors.onSurface }]}>Live Scoreboard</Text>
            <Text style={[styles.pageSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Real-time scores & predictions
            </Text>
          </View>
          
          <View style={styles.controlsContainer}>
            <Button
              mode="text"
              compact
              onPress={() => setIsExpanded(!isExpanded)}
              icon={({ size, color }) => (
                <MaterialCommunityIcons 
                  name={isExpanded ? "arrow-collapse" : "arrow-expand"} 
                  size={size} 
                  color={color} 
                />
              )}
            >
              {isExpanded ? "Compact" : "Expand"}
            </Button>
          </View>
        </View>

        {isLoading && !hasLiveGames ? (
          <View style={styles.leagueSection}>
             {/* Simulate League Header */}
             <View style={styles.leagueHeader}>
                <View style={{ height: 24, width: 120, backgroundColor: theme.colors.surfaceVariant, borderRadius: 6, opacity: 0.5 }} />
             </View>
             
             {/* Shimmer Grid */}
             <View style={styles.gamesGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <View key={i} style={styles.gameItemCompact}>
                        <LiveScoreCardShimmer />
                    </View>
                ))}
             </View>
          </View>
        ) : !hasLiveGames ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
              <MaterialCommunityIcons name="trophy-outline" size={48} color={theme.colors.onSurfaceVariant} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>No Live Games</Text>
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              There are currently no live games. Check back later!
            </Text>
          </View>
        ) : (
          sortedLeagues.map(league => {
            const leagueGames = gamesByLeague[league];
            const leagueConfig = LEAGUE_CONFIG[league] || { name: `${league} Games`, icon: 'trophy', order: 999 };
            const hittingCount = leagueGames.filter(g => g.predictions?.hasAnyHitting).length;

            return (
              <View key={league} style={styles.leagueSection}>
                <View style={styles.leagueHeader}>
                  <View style={styles.leagueTitleContainer}>
                    <MaterialCommunityIcons name={leagueConfig.icon} size={20} color={theme.colors.primary} />
                    <Text style={[styles.leagueTitle, { color: theme.colors.onSurface }]}>
                      {leagueConfig.name}
                    </Text>
                  </View>
                  <View style={styles.leagueBadges}>
                    <View style={[styles.badge, { backgroundColor: theme.colors.secondaryContainer }]}>
                      <Text style={[styles.badgeText, { color: theme.colors.onSecondaryContainer }]}>
                        {leagueGames.length} {leagueGames.length === 1 ? 'Game' : 'Games'}
                      </Text>
                    </View>
                    {hittingCount > 0 && (
                      <View style={[styles.badge, { backgroundColor: 'rgba(34, 211, 95, 0.1)' }]}>
                        <Text style={[styles.badgeText, { color: '#22D35F' }]}>
                          {hittingCount} Hitting
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={[
                  styles.gamesGrid,
                  isExpanded ? styles.gamesListExpanded : styles.gamesGridCompact
                ]}>
                  {leagueGames.map(game => (
                    <View key={game.id} style={isExpanded ? styles.gameItemExpanded : styles.gameItemCompact}>
                      {isExpanded ? (
                        <LiveScorePredictionCard game={game} />
                      ) : (
                        <LiveScoreCard game={game} onPress={() => handleGamePress(game)} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </Animated.ScrollView>

      {/* Game Detail Modal */}
      <LiveScoreDetailModal
        game={selectedGame}
        visible={modalVisible}
        onClose={handleCloseModal}
        onViewFullScoreboard={() => {
          handleCloseModal();
          setIsExpanded(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollContent: {
    paddingHorizontal: 16,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 24,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 250,
  },
  leagueSection: {
    marginBottom: 24,
  },
  leagueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  leagueTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leagueTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  leagueBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4, // offset for item padding
  },
  gamesGridCompact: {
    // Just flex wrap
  },
  gamesListExpanded: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    marginHorizontal: 0,
  },
  gameItemCompact: {
    width: '50%', // 2 cols
    padding: 4,
  },
  gameItemExpanded: {
    width: '100%',
    marginBottom: 0,
  },
});
