import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
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
  const { useDummyData } = useSettings();
  
  const { games: liveGames, hasLiveGames: hasRealLiveGames } = useLiveScores();

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

  // Don't render if no live games
  if (!hasLiveGames) {
    return null;
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.container}
      >
        {games.map((game) => (
          <CompactLiveScorePill 
            key={game.id} 
            game={game} 
            onPress={() => handlePillPress(game)}
          />
        ))}
      </ScrollView>

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
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 4,
    alignItems: 'center',
  },
});

