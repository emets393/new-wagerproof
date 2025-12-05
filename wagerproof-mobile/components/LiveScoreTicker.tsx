import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle,
  useFrameCallback
} from 'react-native-reanimated';
import { useLiveScores } from '@/hooks/useLiveScores';
import { useSettings } from '@/contexts/SettingsContext';
import { CompactLiveScorePill } from './CompactLiveScorePill';
import { LiveScoreDetailModal } from './LiveScoreDetailModal';
import { LiveGame } from '@/types/liveScores';

interface LiveScoreTickerProps {
  onNavigateToScoreboard?: () => void;
}

export function LiveScoreTicker({ onNavigateToScoreboard }: LiveScoreTickerProps) {
  const theme = useTheme();
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [parentWidth, setParentWidth] = useState(0);
  const [childrenWidth, setChildrenWidth] = useState(0);
  const { useDummyData, scoreboardEnabled } = useSettings();
  
  const { games: liveGames, hasLiveGames: hasRealLiveGames } = useLiveScores();
  
  const offset = useSharedValue(0);
  const duration = 30000; // Duration in milliseconds for one full scroll (slower)

  // DUMMY DATA for testing - Only used when useDummyData is true
  const dummyGames: LiveGame[] = [
    {
      id: '1',
      league: 'NFL',
      home_team: 'Kansas City Chiefs',
      away_team: 'Buffalo Bills',
      home_abbr: 'KC',
      away_abbr: 'BUF',
      home_score: 24,
      away_score: 21,
      quarter: 'Q3',
      time_remaining: '8:42',
      is_live: true,
      game_status: 'live',
      last_updated: new Date().toISOString(),
      predictions: {
        hasAnyHitting: true,
        moneyline: {
          predicted: 'Home',
          isHitting: true,
          probability: 0.65,
          currentDifferential: 3
        },
        spread: {
          predicted: 'Home',
          isHitting: false,
          probability: 0.58,
          line: -6.5,
          currentDifferential: 3
        },
        overUnder: {
          predicted: 'Over',
          isHitting: true,
          probability: 0.62,
          line: 47.5,
          currentDifferential: 45
        }
      }
    },
    {
      id: '2',
      league: 'NFL',
      home_team: 'San Francisco 49ers',
      away_team: 'Dallas Cowboys',
      home_abbr: 'SF',
      away_abbr: 'DAL',
      home_score: 17,
      away_score: 14,
      quarter: 'Q2',
      time_remaining: '2:15',
      is_live: true,
      game_status: 'live',
      last_updated: new Date().toISOString(),
      predictions: {
        hasAnyHitting: false,
        moneyline: {
          predicted: 'Home',
          isHitting: true,
          probability: 0.72,
          currentDifferential: 3
        },
        spread: {
          predicted: 'Home',
          isHitting: false,
          probability: 0.55,
          line: -3.5,
          currentDifferential: 3
        }
      }
    },
    {
      id: '3',
      league: 'CFB',
      home_team: 'Georgia Bulldogs',
      away_team: 'Alabama Crimson Tide',
      home_abbr: 'UGA',
      away_abbr: 'ALA',
      home_score: 28,
      away_score: 31,
      quarter: 'Q4',
      time_remaining: '4:38',
      is_live: true,
      game_status: 'live',
      last_updated: new Date().toISOString(),
      predictions: {
        hasAnyHitting: true,
        spread: {
          predicted: 'Away',
          isHitting: true,
          probability: 0.68,
          line: 2.5,
          currentDifferential: -3
        }
      }
    },
    {
      id: '4',
      league: 'NFL',
      home_team: 'Miami Dolphins',
      away_team: 'Philadelphia Eagles',
      home_abbr: 'MIA',
      away_abbr: 'PHI',
      home_score: 10,
      away_score: 7,
      quarter: 'Q1',
      time_remaining: '11:23',
      is_live: true,
      game_status: 'live',
      last_updated: new Date().toISOString()
    }
  ];

  // Use dummy data if setting is enabled, otherwise use real data
  const games = useDummyData ? dummyGames : liveGames;
  const hasLiveGames = useDummyData ? games.length > 0 : hasRealLiveGames;

  const handlePillPress = (game: LiveGame) => {
    setSelectedGame(game);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
  };

  const handleViewFullScoreboard = () => {
    setModalVisible(false);
    onNavigateToScoreboard?.();
  };

  // Seamless marquee animation using frame callback (based on React Native Reanimated docs)
  // Reference: https://docs.swmansion.com/react-native-reanimated/examples/marquee/
  useFrameCallback((frameInfo) => {
    if (childrenWidth > 0) {
      // Calculate offset based on time elapsed and duration
      const timeDelta = frameInfo.timeSincePreviousFrame ?? 0;
      offset.value -= (timeDelta * childrenWidth) / duration;
      // Use modulo to create seamless loop
      offset.value = offset.value % -childrenWidth;
    }
  }, true);

  // Calculate how many clones we need to fill the screen
  const cloneCount = childrenWidth > 0 ? Math.round(parentWidth / childrenWidth) + 2 : 0;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: offset.value }],
    };
  });

  // Don't render if scoreboard is disabled or no live games
  if (!scoreboardEnabled || !hasLiveGames) {
    return null;
  }

  return (
    <>
      <View 
        style={styles.container}
        onLayout={(event) => {
          setParentWidth(event.nativeEvent.layout.width);
        }}
      >
        {/* Hidden measure element to get children width */}
        <View 
          style={styles.measureContainer}
          onLayout={(event) => {
            setChildrenWidth(event.nativeEvent.layout.width);
          }}
        >
          <View style={styles.scrollContent}>
            {games.map((game) => (
              <CompactLiveScorePill 
                key={game.id} 
                game={game} 
                onPress={() => handlePillPress(game)}
              />
            ))}
          </View>
        </View>

        {/* Visible scrolling content - render clones */}
        {childrenWidth > 0 && parentWidth > 0 && (
          <View style={styles.scrollContainer}>
            {Array.from({ length: cloneCount }).map((_, index) => (
              <Animated.View
                key={`clone-${index}`}
                style={[
                  styles.scrollContent,
                  animatedStyle,
                  {
                    position: 'absolute',
                    left: index * childrenWidth,
                  }
                ]}
              >
                {games.map((game) => (
                  <CompactLiveScorePill 
                    key={game.id} 
                    game={game} 
                    onPress={() => handlePillPress(game)}
                  />
                ))}
              </Animated.View>
            ))}
          </View>
        )}
        
        {/* Left gradient fade */}
        <LinearGradient
          colors={[
            theme.dark ? '#1C1C1E' : '#FFFFFF',
            theme.dark ? 'rgba(28, 28, 30, 0)' : 'rgba(255, 255, 255, 0)'
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientLeft}
          pointerEvents="none"
        />
        
        {/* Right gradient fade */}
        <LinearGradient
          colors={[
            theme.dark ? 'rgba(28, 28, 30, 0)' : 'rgba(255, 255, 255, 0)',
            theme.dark ? '#1C1C1E' : '#FFFFFF'
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientRight}
          pointerEvents="none"
        />
      </View>

      <LiveScoreDetailModal
        game={selectedGame}
        visible={modalVisible}
        onClose={handleModalClose}
        onViewFullScoreboard={handleViewFullScoreboard}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    height: 52,
    position: 'relative',
  },
  measureContainer: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
  },
  scrollContainer: {
    flexDirection: 'row',
    height: 52,
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  gradientLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 30,
    zIndex: 10,
  },
  gradientRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 30,
    zIndex: 10,
  },
});

