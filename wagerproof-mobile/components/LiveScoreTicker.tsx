import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  cancelAnimation
} from 'react-native-reanimated';
import { useLiveScores } from '@/hooks/useLiveScores';
import { useSettings } from '@/contexts/SettingsContext';
import { CompactLiveScorePill } from './CompactLiveScorePill';
import { LiveScoreDetailModal } from './LiveScoreDetailModal';
import { LiveGame } from '@/types/liveScores';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LiveScoreTickerProps {
  onNavigateToScoreboard?: () => void;
}

export function LiveScoreTicker({ onNavigateToScoreboard }: LiveScoreTickerProps) {
  const theme = useTheme();
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const { useDummyData } = useSettings();
  
  const { games: liveGames, hasLiveGames: hasRealLiveGames } = useLiveScores();
  const translateX = useSharedValue(0);

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

  // Setup marquee animation
  useEffect(() => {
    if (contentWidth > 0 && games.length > 0) {
      // Start the continuous scroll animation
      const distance = contentWidth;
      const duration = distance * 40; // Multiplier for speed (higher = slower)
      
      // Start from 0
      translateX.value = 0;
      
      // Animate continuously
      translateX.value = withRepeat(
        withTiming(-distance, {
          duration: duration,
          easing: Easing.linear,
        }),
        -1, // Infinite repeat
        false // Don't reverse
      );
    }

    return () => {
      cancelAnimation(translateX);
    };
  }, [contentWidth, games]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  // Don't render if no live games
  if (!hasLiveGames) {
    return null;
  }

  // Duplicate games twice for seamless infinite loop
  const duplicatedGames = [...games, ...games];

  return (
    <>
      <View style={styles.container}>
        <Animated.View 
          style={[styles.scrollContent, animatedStyle]}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            // Divide by 2 since we doubled the games
            const singleSetWidth = width / 2;
            if (singleSetWidth !== contentWidth) {
              setContentWidth(singleSetWidth);
            }
          }}
        >
          {duplicatedGames.map((game, index) => (
            <CompactLiveScorePill 
              key={`${game.id}-${index}`} 
              game={game} 
              onPress={() => handlePillPress(game)}
            />
          ))}
        </Animated.View>
        
        {/* Left gradient fade */}
        <LinearGradient
          colors={[theme.colors.background, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientLeft}
          pointerEvents="none"
        />
        
        {/* Right gradient fade */}
        <LinearGradient
          colors={['transparent', theme.colors.background]}
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

