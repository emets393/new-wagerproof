import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useThemeContext } from '@/contexts/ThemeContext';
import { TeamAvatar } from '@/components/TeamAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 16px padding on each side + 16px gap

// Mock game data
const MOCK_GAMES = [
  {
    sport: 'nba' as const,
    away_team: 'Los Angeles Lakers',
    away_abbr: 'LAL',
    home_team: 'Boston Celtics',
    home_abbr: 'BOS',
    away_spread: 4.5,
    home_spread: -4.5,
    over_line: 218.5,
    spread_confidence: 72,
    ou_confidence: 65,
    spread_pick: 'home',
    ou_pick: 'over',
  },
  {
    sport: 'nfl' as const,
    away_team: 'Kansas City Chiefs',
    away_abbr: 'KC',
    home_team: 'Buffalo Bills',
    home_abbr: 'BUF',
    away_spread: -3.5,
    home_spread: 3.5,
    over_line: 51.5,
    spread_confidence: 82,
    ou_confidence: 58,
    spread_pick: 'away',
    ou_pick: 'under',
    isFadeAlert: true,
  },
];

// Confidence colors
const getConfidenceColor = (confidence: number) => {
  if (confidence >= 80) return '#22c55e'; // Strong green
  if (confidence >= 70) return '#84cc16'; // Light green
  if (confidence >= 60) return '#eab308'; // Yellow
  return '#f97316'; // Orange
};

function MiniGameCard({ game }: { game: typeof MOCK_GAMES[0] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const spreadTeam = game.spread_pick === 'home' ? game.home_team : game.away_team;
  const spreadAbbr = game.spread_pick === 'home' ? game.home_abbr : game.away_abbr;
  const spreadValue = game.spread_pick === 'home' ? game.home_spread : game.away_spread;

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff', width: CARD_WIDTH }]}>
      {/* Top gradient border */}
      <LinearGradient
        colors={['#00E676', '#00C853', '#00E676']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topBorder}
      />

      {/* Sport badge */}
      <View style={[styles.sportBadge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
        <Text style={[styles.sportText, { color: theme.colors.onSurfaceVariant }]}>
          {game.sport.toUpperCase()}
        </Text>
      </View>

      {/* Teams row */}
      <View style={styles.teamsRow}>
        <View style={styles.teamCol}>
          <TeamAvatar teamName={game.away_team} sport={game.sport} size={28} />
          <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>
            {game.away_abbr}
          </Text>
        </View>
        <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
        <View style={styles.teamCol}>
          <TeamAvatar teamName={game.home_team} sport={game.sport} size={28} />
          <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>
            {game.home_abbr}
          </Text>
        </View>
      </View>

      {/* O/U line */}
      <View style={[styles.ouLinePill, { backgroundColor: isDark ? 'rgba(156, 163, 175, 0.15)' : 'rgba(156, 163, 175, 0.2)' }]}>
        <Text style={[styles.ouLineText, { color: theme.colors.onSurfaceVariant }]}>
          O/U: {game.over_line}
        </Text>
      </View>

      {/* Model Picks header */}
      <View style={styles.pillsHeader}>
        <MaterialCommunityIcons name="brain" size={10} color="#22c55e" />
        <Text style={[styles.pillsHeaderText, { color: theme.colors.onSurfaceVariant }]}>
          Model Picks
        </Text>
      </View>

      {/* Prediction pills */}
      <View style={styles.pillsContainer}>
        {/* Spread pill */}
        <View style={[styles.predictionPill, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
          <TeamAvatar teamName={spreadTeam} sport={game.sport} size={14} />
          <Text style={[styles.pillLabel, { color: theme.colors.onSurface }]}>
            {spreadValue > 0 ? `+${spreadValue}` : spreadValue}
          </Text>
          <View style={[styles.confidenceBadge, { backgroundColor: `${getConfidenceColor(game.spread_confidence)}20` }]}>
            <Text style={[styles.confidenceText, { color: getConfidenceColor(game.spread_confidence) }]}>
              {game.spread_confidence}%
            </Text>
          </View>
          {game.isFadeAlert && (
            <MaterialCommunityIcons name="lightning-bolt" size={10} color={getConfidenceColor(game.spread_confidence)} />
          )}
        </View>

        {/* O/U pill */}
        <View style={[styles.predictionPill, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
          <View style={[styles.ouIndicator, { backgroundColor: game.ou_pick === 'over' ? '#22c55e' : '#ef4444' }]}>
            <MaterialCommunityIcons
              name={game.ou_pick === 'over' ? 'arrow-up' : 'arrow-down'}
              size={8}
              color="#fff"
            />
          </View>
          <Text style={[styles.pillLabel, { color: theme.colors.onSurface }]}>
            {game.ou_pick === 'over' ? 'Over' : 'Under'}
          </Text>
          <View style={[styles.confidenceBadge, { backgroundColor: `${getConfidenceColor(game.ou_confidence)}20` }]}>
            <Text style={[styles.confidenceText, { color: getConfidenceColor(game.ou_confidence) }]}>
              {game.ou_confidence}%
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function Slide1_GameCards() {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  return (
    <View style={styles.container}>
      {/* Cards side by side */}
      <View style={styles.cardsRow}>
        {MOCK_GAMES.map((game, idx) => (
          <MiniGameCard key={idx} game={game} />
        ))}
      </View>

      {/* Callouts - Glassmorphic */}
      <View style={styles.calloutsWrapper}>
        <BlurView
          intensity={isDark ? 30 : 50}
          tint={isDark ? 'dark' : 'light'}
          style={styles.calloutsBlur}
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']
                : ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.6)']
            }
            style={styles.calloutsContainer}
          >
            <View style={styles.callout}>
              <View style={[styles.calloutDot, { backgroundColor: '#22c55e' }]} />
              <Text style={[styles.calloutText, { color: theme.colors.onSurfaceVariant }]}>
                Green = Strong pick (70%+)
              </Text>
            </View>
            <View style={styles.callout}>
              <View style={[styles.calloutDot, { backgroundColor: '#eab308' }]} />
              <Text style={[styles.calloutText, { color: theme.colors.onSurfaceVariant }]}>
                Yellow = Moderate confidence
              </Text>
            </View>
            <View style={styles.callout}>
              <MaterialCommunityIcons name="lightning-bolt" size={12} color="#f59e0b" />
              <Text style={[styles.calloutText, { color: theme.colors.onSurfaceVariant }]}>
                Fade Alert (82%+ confidence)
              </Text>
            </View>
          </LinearGradient>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    borderRadius: 16,
    padding: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  sportBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sportText: {
    fontSize: 8,
    fontWeight: '700',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  teamCol: {
    alignItems: 'center',
    gap: 2,
  },
  teamAbbr: {
    fontSize: 9,
    fontWeight: '600',
  },
  atSymbol: {
    fontSize: 14,
    fontWeight: '600',
  },
  ouLinePill: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  ouLineText: {
    fontSize: 9,
    fontWeight: '600',
  },
  pillsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  pillsHeaderText: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pillsContainer: {
    gap: 4,
  },
  predictionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 9,
    fontWeight: '700',
  },
  ouIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calloutsWrapper: {
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  calloutsBlur: {
    overflow: 'hidden',
  },
  calloutsContainer: {
    padding: 12,
    gap: 8,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calloutDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  calloutText: {
    fontSize: 11,
  },
});
