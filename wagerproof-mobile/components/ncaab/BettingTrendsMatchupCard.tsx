import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { NCAABGameTrendsData } from '@/types/ncaabBettingTrends';
import { getCFBTeamColors } from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useNCAABBettingTrendsSheet } from '@/contexts/NCAABBettingTrendsSheetContext';
import { TeamAvatar } from '../TeamAvatar';
import { useGameTeamColors } from '@/hooks/useImageColors';

interface NCAABBettingTrendsMatchupCardProps {
  game: NCAABGameTrendsData;
}

/**
 * Format tipoff time UTC to EST display format
 */
function formatTipoffTime(tipoffTimeUtc: string | null): string {
  if (!tipoffTimeUtc) return 'TBD';

  try {
    const utcDate = new Date(tipoffTimeUtc);

    if (isNaN(utcDate.getTime())) {
      return 'TBD';
    }

    // Format time in EST/EDT
    const timeStr = utcDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${timeStr} ET`;
  } catch {
    return tipoffTimeUtc;
  }
}

/**
 * Collapsible card for each matchup on the NCAAB betting trends page
 * Tapping opens the bottom sheet with detailed trends
 */
export function NCAABBettingTrendsMatchupCard({ game }: NCAABBettingTrendsMatchupCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { openTrendsSheet } = useNCAABBettingTrendsSheet();

  // Extract team colors from logo images; fall back to hardcoded CFB colors
  const { awayColors, homeColors } = useGameTeamColors(
    game.awayTeamLogo,
    game.homeTeamLogo,
    getCFBTeamColors(game.awayTeam.team_name),
    getCFBTeamColors(game.homeTeam.team_name),
  );

  // Determine favorite team for background gradient (same pattern as game cards)
  const favoriteColors = game.homeTeam.fav_dog_situation === 'is_fav'
    ? homeColors
    : game.awayTeam.fav_dog_situation === 'is_fav'
      ? awayColors
      : homeColors; // default to home if no clear favorite

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openTrendsSheet(game);
  };

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
            <TeamAvatar
              teamName={game.awayTeam.team_name}
              sport="ncaab"
              size={48}
              teamAbbr={game.awayTeam.team_abbr}
              {...(game.awayTeamLogo ? { logoUrl: game.awayTeamLogo } : {})}
            />
            <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {game.awayTeam.team_abbr}
            </Text>
          </View>

          {/* Center Section */}
          <View style={styles.centerSection}>
            <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
            <View style={[styles.timeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                {formatTipoffTime(game.tipoffTime)}
              </Text>
            </View>
          </View>

          {/* Home Team */}
          <View style={styles.teamSection}>
            <TeamAvatar
              teamName={game.homeTeam.team_name}
              sport="ncaab"
              size={48}
              teamAbbr={game.homeTeam.team_abbr}
              {...(game.homeTeamLogo ? { logoUrl: game.homeTeamLogo } : {})}
            />
            <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {game.homeTeam.team_abbr}
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
