import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';

// MLB Team colors
const MLB_TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  'Yankees': { primary: '#003087', secondary: '#132448' },
  'Red Sox': { primary: '#BD3039', secondary: '#0C2340' },
  'Dodgers': { primary: '#005A9C', secondary: '#EF3E42' },
  'Giants': { primary: '#FD5A1E', secondary: '#27251F' },
  'Mets': { primary: '#002D72', secondary: '#FF5910' },
  'Cubs': { primary: '#0E3386', secondary: '#CC3433' },
  'Cardinals': { primary: '#C41E3A', secondary: '#0C2340' },
  'Braves': { primary: '#CE1141', secondary: '#13274F' },
  'Astros': { primary: '#002D62', secondary: '#EB6E1F' },
  'Phillies': { primary: '#E81828', secondary: '#002D72' },
};

export interface MLBGame {
  id: string;
  away_team: string;
  home_team: string;
  game_date: string;
  game_time: string;
  away_runline: number;
  home_runline: number;
  away_ml: number;
  home_ml: number;
  over_line: number;
}

interface MLBGameCardProps {
  game: MLBGame;
  onPress: () => void;
  cardWidth?: number;
}

const getMLBTeamColors = (teamName: string) => {
  return MLB_TEAM_COLORS[teamName] || { primary: '#333333', secondary: '#666666' };
};

const getMLBTeamInitials = (teamName: string) => {
  const initialsMap: Record<string, string> = {
    'Yankees': 'NYY',
    'Red Sox': 'BOS',
    'Dodgers': 'LAD',
    'Giants': 'SF',
    'Mets': 'NYM',
    'Cubs': 'CHC',
    'Cardinals': 'STL',
    'Braves': 'ATL',
    'Astros': 'HOU',
    'Phillies': 'PHI',
  };
  return initialsMap[teamName] || teamName.substring(0, 3).toUpperCase();
};

const getContrastingTextColor = (primary: string) => {
  // Simple contrast check - if the color is dark, use white text
  const hex = primary.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

const formatMoneyline = (ml: number | null): string => {
  if (ml === null) return '-';
  return ml > 0 ? `+${ml}` : String(ml);
};

const formatRunline = (rl: number | null): string => {
  if (rl === null) return '-';
  return rl > 0 ? `+${rl}` : String(rl);
};

export function MLBGameCard({ game, onPress, cardWidth }: MLBGameCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const awayColors = getMLBTeamColors(game.away_team);
  const homeColors = getMLBTeamColors(game.home_team);

  // Determine favorite based on moneyline
  const favorite = game.home_ml < game.away_ml ? game.home_team : game.away_team;
  const favoriteColors = favorite === game.home_team ? homeColors : awayColors;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={cardWidth ? { width: cardWidth } : undefined}>
      <Card style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        {/* Background gradient of favorite team */}
        <LinearGradient
          colors={[
            `${favoriteColors.primary}15`,
            `${favoriteColors.secondary}10`,
            `${theme.colors.surface}00`
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.backgroundGradient}
        />
        
        {/* Top border gradient */}
        <LinearGradient
          colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientBorder}
        />

        <Card.Content style={styles.content}>
          {/* Date and Time */}
          <View style={styles.dateContainer}>
            <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
              {game.game_date}
            </Text>
            <View style={[styles.timeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                {game.game_time}
              </Text>
            </View>
          </View>

          {/* Teams Row with Circles */}
          <View style={styles.teamsRow}>
            {/* Away Team */}
            <View style={styles.teamColumn}>
              <View style={styles.teamCircleContainer}>
                <LinearGradient
                  colors={[awayColors.primary, awayColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.teamCircle, { borderColor: awayColors.primary }]}
                />
                <View style={styles.teamCircleContent}>
                  <Text style={[styles.teamInitials, { color: getContrastingTextColor(awayColors.primary) }]}>
                    {getMLBTeamInitials(game.away_team)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {game.away_team}
              </Text>
              <View style={styles.teamLinesRow}>
                <Text style={[styles.lineText, { color: game.away_runline < 0 ? '#3b82f6' : '#22c55e' }]}>
                  {formatRunline(game.away_runline)}
                </Text>
                <Text style={[styles.lineText, { color: game.away_ml < 0 ? '#3b82f6' : '#22c55e' }]}>
                  {formatMoneyline(game.away_ml)}
                </Text>
              </View>
            </View>

            {/* Center - @ with O/U Line */}
            <View style={styles.centerColumn}>
              <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
              <View style={[styles.ouLinePill, { backgroundColor: 'rgba(156, 163, 175, 0.15)', borderColor: 'rgba(156, 163, 175, 0.3)' }]}>
                <Text style={[styles.ouLinePillText, { color: theme.colors.onSurfaceVariant }]}>
                  O/U: {game.over_line}
                </Text>
              </View>
            </View>

            {/* Home Team */}
            <View style={styles.teamColumn}>
              <View style={styles.teamCircleContainer}>
                <LinearGradient
                  colors={[homeColors.primary, homeColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.teamCircle, { borderColor: homeColors.primary }]}
                />
                <View style={styles.teamCircleContent}>
                  <Text style={[styles.teamInitials, { color: getContrastingTextColor(homeColors.primary) }]}>
                    {getMLBTeamInitials(game.home_team)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {game.home_team}
              </Text>
              <View style={styles.teamLinesRow}>
                <Text style={[styles.lineText, { color: game.home_runline < 0 ? '#3b82f6' : '#22c55e' }]}>
                  {formatRunline(game.home_runline)}
                </Text>
                <Text style={[styles.lineText, { color: game.home_ml < 0 ? '#3b82f6' : '#22c55e' }]}>
                  {formatMoneyline(game.home_ml)}
                </Text>
              </View>
            </View>
          </View>

          {/* Coming Soon Predictions Badge */}
          <View style={styles.pillsSection}>
            <View style={styles.pillsHeader}>
              <MaterialCommunityIcons name="baseball" size={12} color="#22c55e" />
              <Text style={[styles.pillsHeaderText, { color: theme.colors.onSurfaceVariant }]}>
                Model Picks
              </Text>
            </View>
            <View style={[styles.comingSoonPill, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', borderColor: theme.colors.outlineVariant }]}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#f59e0b" />
              <Text style={[styles.comingSoonText, { color: theme.colors.onSurfaceVariant }]}>
                Predictions coming soon
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 6,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    overflow: 'hidden',
    width: '100%',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1,
  },
  content: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 10,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamColumn: {
    alignItems: 'center',
    flex: 1,
  },
  centerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  teamCircleContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  teamCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
  },
  teamCircleContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitials: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 90,
  },
  atSymbol: {
    fontSize: 24,
    fontWeight: '600',
  },
  ouLinePill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  ouLinePillText: {
    fontSize: 9,
    fontWeight: '600',
  },
  teamLinesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    justifyContent: 'center',
  },
  lineText: {
    fontSize: 9,
    fontWeight: '500',
  },
  pillsSection: {
    marginTop: 8,
  },
  pillsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  pillsHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comingSoonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
