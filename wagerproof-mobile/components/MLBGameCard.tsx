import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { MLBGame, formatMoneyline, formatSpread, formatMLBDateLabel, formatMLBGameTime } from '@/types/mlb';
import { getMLBTeamColors } from '@/constants/mlbTeams';

interface MLBGameCardProps {
  game: MLBGame;
  onPress: () => void;
  cardWidth?: number;
}

function getContrastingTextColor(primary: string): string {
  const hex = primary.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function MLBGameCard({ game, onPress, cardWidth }: MLBGameCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const awayName = game.away_team_name || game.away_team || 'Away';
  const homeName = game.home_team_name || game.home_team || 'Home';
  const awayColors = getMLBTeamColors(awayName);
  const homeColors = getMLBTeamColors(homeName);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  // Determine favorite for background gradient
  const favorite = game.home_ml !== null && game.away_ml !== null
    ? (game.home_ml < game.away_ml ? 'home' : 'away')
    : null;
  const favoriteColors = favorite === 'home' ? homeColors : favorite === 'away' ? awayColors : awayColors;

  // Determine ML pick side (higher win prob)
  const mlPickSide = game.ml_home_win_prob !== null && game.ml_away_win_prob !== null
    ? (game.ml_home_win_prob >= game.ml_away_win_prob ? 'home' : 'away')
    : null;
  const mlPickProb = mlPickSide === 'home' ? game.ml_home_win_prob : game.ml_away_win_prob;
  const mlPickEdge = mlPickSide === 'home' ? game.home_ml_edge_pct : game.away_ml_edge_pct;
  const mlPickStrong = mlPickSide === 'home' ? game.home_ml_strong_signal : game.away_ml_strong_signal;

  // O/U direction
  const ouDirection = game.ou_direction;
  const ouEdge = game.ou_edge !== null ? Math.abs(game.ou_edge) : null;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={cardWidth ? { width: cardWidth } : undefined}>
      <Card style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        {/* Background gradient */}
        <LinearGradient
          colors={[`${favoriteColors.primary}15`, `${favoriteColors.secondary}10`, `${theme.colors.surface}00`]}
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
              {formatMLBDateLabel(game.official_date)}
            </Text>
            <View style={[styles.timeBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                {formatMLBGameTime(game.game_time_et)}
              </Text>
            </View>
          </View>

          {/* Teams Row */}
          <View style={styles.teamsRow}>
            {/* Away Team */}
            <View style={styles.teamColumn}>
              <TeamLogo
                logoUrl={game.away_logo_url}
                abbrev={game.away_abbr}
                colors={awayColors}
              />
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {game.away_abbr}
              </Text>
              <View style={styles.teamLinesRow}>
                {game.away_spread !== null && (
                  <Text style={[styles.lineText, { color: game.away_spread < 0 ? '#3b82f6' : '#22c55e' }]}>
                    {formatSpread(game.away_spread)}
                  </Text>
                )}
                {game.away_ml !== null && (
                  <Text style={[styles.lineText, { color: game.away_ml < 0 ? '#3b82f6' : '#22c55e' }]}>
                    {formatMoneyline(game.away_ml)}
                  </Text>
                )}
              </View>
            </View>

            {/* Center */}
            <View style={styles.centerColumn}>
              <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
              {game.total_line !== null && (
                <View style={[styles.ouLinePill, { backgroundColor: 'rgba(156, 163, 175, 0.15)', borderColor: 'rgba(156, 163, 175, 0.3)' }]}>
                  <Text style={[styles.ouLinePillText, { color: theme.colors.onSurfaceVariant }]}>
                    O/U: {game.total_line}
                  </Text>
                </View>
              )}
            </View>

            {/* Home Team */}
            <View style={styles.teamColumn}>
              <TeamLogo
                logoUrl={game.home_logo_url}
                abbrev={game.home_abbr}
                colors={homeColors}
              />
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {game.home_abbr}
              </Text>
              <View style={styles.teamLinesRow}>
                {game.home_spread !== null && (
                  <Text style={[styles.lineText, { color: game.home_spread < 0 ? '#3b82f6' : '#22c55e' }]}>
                    {formatSpread(game.home_spread)}
                  </Text>
                )}
                {game.home_ml !== null && (
                  <Text style={[styles.lineText, { color: game.home_ml < 0 ? '#3b82f6' : '#22c55e' }]}>
                    {formatMoneyline(game.home_ml)}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Model Predictions */}
          {(mlPickSide !== null || ouDirection !== null) ? (
            <View style={styles.pillsSection}>
              <View style={styles.pillsHeader}>
                <MaterialCommunityIcons name="brain" size={12} color="#22c55e" />
                <Text style={[styles.pillsHeaderText, { color: theme.colors.onSurfaceVariant }]}>
                  Model Picks
                </Text>
              </View>
              <View style={styles.pillsColumn}>
                {/* ML Pick */}
                {mlPickSide !== null && mlPickProb !== null && (
                  <View style={[styles.bettingPill, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', borderColor: theme.colors.outlineVariant }]}>
                    <TeamLogo
                      logoUrl={mlPickSide === 'home' ? game.home_logo_url : game.away_logo_url}
                      abbrev={mlPickSide === 'home' ? game.home_abbr : game.away_abbr}
                      colors={mlPickSide === 'home' ? homeColors : awayColors}
                      size={20}
                    />
                    <Text style={[styles.pillText, { color: theme.colors.onSurface }]}>
                      ML: {mlPickSide === 'home' ? game.home_abbr : game.away_abbr}
                    </Text>
                    <Text style={[styles.pillValue, { color: mlPickStrong ? '#22c55e' : '#eab308' }]}>
                      {(mlPickProb * 100).toFixed(0)}%
                    </Text>
                    {mlPickStrong && (
                      <View style={styles.fadeAlertBadge}>
                        <MaterialCommunityIcons name="lightning-bolt" size={10} color="#22c55e" />
                      </View>
                    )}
                  </View>
                )}

                {/* O/U Pick */}
                {ouDirection !== null && (
                  <View style={[styles.bettingPill, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', borderColor: theme.colors.outlineVariant }]}>
                    <View style={[styles.pillCircle, { backgroundColor: ouDirection === 'OVER' ? '#22c55e' : '#ef4444' }]}>
                      <MaterialCommunityIcons
                        name={ouDirection === 'OVER' ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color="#fff"
                      />
                    </View>
                    <Text style={[styles.pillText, { color: theme.colors.onSurface }]}>
                      O/U: {ouDirection === 'OVER' ? 'Over' : 'Under'}
                    </Text>
                    {ouEdge !== null && (
                      <Text style={[styles.pillValue, { color: game.ou_strong_signal ? '#22c55e' : game.ou_moderate_signal ? '#84cc16' : '#eab308' }]}>
                        +{ouEdge.toFixed(1)}%
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* No predictions available */
            <View style={styles.pillsSection}>
              <View style={styles.pillsHeader}>
                <MaterialCommunityIcons name="baseball" size={12} color="#22c55e" />
                <Text style={[styles.pillsHeaderText, { color: theme.colors.onSurfaceVariant }]}>
                  Model Picks
                </Text>
              </View>
              <View style={[styles.noPredPill, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', borderColor: theme.colors.outlineVariant }]}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#f59e0b" />
                <Text style={[styles.noPredText, { color: theme.colors.onSurfaceVariant }]}>
                  Predictions pending
                </Text>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

/** Team logo with image fallback to gradient circle with initials. */
function TeamLogo({
  logoUrl,
  abbrev,
  colors,
  size = 42,
}: {
  logoUrl: string | null;
  abbrev: string;
  colors: { primary: string; secondary: string };
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const radius = size / 2;

  if (logoUrl && !imgError) {
    return (
      <View style={[styles.teamCircleContainer, { marginBottom: size === 42 ? 6 : 0 }]}>
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size, height: size, borderRadius: radius }}
          onError={() => setImgError(true)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.teamCircleContainer, { marginBottom: size === 42 ? 6 : 0 }]}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: radius, borderWidth: 2, borderColor: colors.primary }}
      />
      <View style={[styles.teamCircleContent, { width: size, height: size }]}>
        <Text style={[styles.teamInitials, { color: getContrastingTextColor(colors.primary), fontSize: size === 42 ? 14 : 9 }]}>
          {abbrev}
        </Text>
      </View>
    </View>
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
  },
  teamCircleContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitials: {
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
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
  pillsColumn: {
    flexDirection: 'column',
    gap: 6,
  },
  bettingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    minHeight: 32,
    gap: 8,
  },
  pillCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pillValue: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 'auto',
    paddingLeft: 8,
  },
  fadeAlertBadge: {
    paddingLeft: 4,
  },
  noPredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  noPredText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
