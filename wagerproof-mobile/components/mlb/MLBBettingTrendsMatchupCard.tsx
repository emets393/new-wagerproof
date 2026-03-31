import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MLBGameTrendsData } from '@/types/mlbBettingTrends';
import { getMLBTeamColors, getMLBFallbackTeamInfo, getMLBTeamById } from '@/constants/mlbTeams';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useMLBBettingTrendsSheet } from '@/contexts/MLBBettingTrendsSheetContext';
import { TeamAvatar } from '../TeamAvatar';

interface MLBBettingTrendsMatchupCardProps {
  game: MLBGameTrendsData;
}

/**
 * Format game time ET to display format
 */
function formatGameTimeEt(timeString: string | null): string {
  if (!timeString) return 'TBD';

  try {
    const date = new Date(timeString);
    if (isNaN(date.getTime())) return 'TBD';

    const timeStr = date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${timeStr} ET`;
  } catch {
    return timeString;
  }
}

/**
 * Resolve team abbreviation and logo from team_id (primary) or team_name (fallback).
 * Mirrors the web app's mlbStatsApiTeamBrand(tid) approach.
 */
function resolveTeamDisplay(teamId: number | string, teamName: string): { abbrev: string; logoUrl: string | null } {
  // Primary: team_id lookup (authoritative, matches web app)
  const byId = getMLBTeamById(teamId);
  if (byId) return byId;

  // Fallback: name-based lookup
  const byName = getMLBFallbackTeamInfo(teamName);
  if (byName) return { abbrev: byName.team, logoUrl: byName.logo_url };

  // Last resort
  const words = teamName.trim().split(/\s+/);
  return { abbrev: words[words.length - 1].slice(0, 3).toUpperCase(), logoUrl: null };
}

/**
 * Matchup card for each game on the MLB betting trends page.
 * Tapping opens the bottom sheet with detailed trends.
 */
export function MLBBettingTrendsMatchupCard({ game }: MLBBettingTrendsMatchupCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { openTrendsSheet } = useMLBBettingTrendsSheet();

  const awayColors = getMLBTeamColors(game.awayTeam.team_name);
  const homeColors = getMLBTeamColors(game.homeTeam.team_name);

  // Determine favorite team for background gradient
  const favoriteColors = game.homeTeam.fav_dog_situation === 'is_fav'
    ? homeColors
    : game.awayTeam.fav_dog_situation === 'is_fav'
      ? awayColors
      : homeColors;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openTrendsSheet(game);
  };

  const awayDisplay = resolveTeamDisplay(game.awayTeam.team_id, game.awayTeam.team_name);
  const homeDisplay = resolveTeamDisplay(game.homeTeam.team_id, game.homeTeam.team_name);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <View style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        {/* Background gradient of favorite team */}
        <LinearGradient
          colors={[
            `${favoriteColors.primary}15`,
            `${favoriteColors.secondary}10`,
            isDark ? '#1a1a1a00' : '#ffffff00',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.backgroundGradient}
        />

        {/* Gradient stripe at top */}
        <LinearGradient
          colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientStripe}
        />

        <View style={styles.content}>
          {/* Away Team */}
          <View style={styles.teamSection}>
            <TeamAvatar teamName={game.awayTeam.team_name} sport="mlb" size={48} teamAbbr={awayDisplay.abbrev} logoUrl={awayDisplay.logoUrl} />
            <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {awayDisplay.abbrev}
            </Text>
          </View>

          {/* Center Section */}
          <View style={styles.centerSection}>
            <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
            <View style={[styles.timeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                {formatGameTimeEt(game.gameTimeEt)}
              </Text>
            </View>
          </View>

          {/* Home Team */}
          <View style={styles.teamSection}>
            <TeamAvatar teamName={game.homeTeam.team_name} sport="mlb" size={48} teamAbbr={homeDisplay.abbrev} logoUrl={homeDisplay.logoUrl} />
            <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {homeDisplay.abbrev}
            </Text>
          </View>

          {/* Chevron */}
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.colors.onSurfaceVariant}
            style={styles.chevron}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientStripe: {
    height: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  teamAbbr: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 8,
  },
  atSymbol: {
    fontSize: 18,
    fontWeight: '600',
  },
  timeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 4,
  },
});
