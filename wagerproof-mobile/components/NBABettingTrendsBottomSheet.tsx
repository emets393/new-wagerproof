import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { useNBABettingTrendsSheet } from '@/contexts/NBABettingTrendsSheetContext';
import { getNBATeamColors, getNBATeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';
import { TrendsSituationSection } from './nba/TrendsSituationSection';

/**
 * Format team name - single words on one line, multi-word splits across lines
 */
function formatTeamName(name: string): { text: string; lines: 1 | 2 } {
  if (!name.includes(' ')) {
    return { text: name, lines: 1 };
  }
  return { text: name.replace(' ', '\n'), lines: 2 };
}

/**
 * Format tipoff time UTC to display format
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
 * Bottom sheet with detailed situational trends for a selected NBA game
 */
export function NBABettingTrendsBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { selectedGameTrends: game, closeTrendsSheet, bottomSheetRef } = useNBABettingTrendsSheet();
  const snapPoints = useMemo(() => ['85%', '95%'], []);

  const awayColors = game ? getNBATeamColors(game.awayTeam.team_name) : { primary: '#000', secondary: '#000' };
  const homeColors = game ? getNBATeamColors(game.homeTeam.team_name) : { primary: '#000', secondary: '#000' };

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.7}
    />
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={closeTrendsSheet}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.contentContainer, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}
        showsVerticalScrollIndicator={false}
      >
        {game ? (
          <>
            {/* Header with Teams */}
            <View style={[styles.headerCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
              <LinearGradient
                colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerGradient}
              />

              <View style={styles.headerContent}>
                <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>
                  Situational Betting Trends
                </Text>

                <View style={styles.teamsRow}>
                  {/* Away Team */}
                  <View style={styles.teamSection}>
                    <LinearGradient
                      colors={[awayColors.primary, awayColors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.teamCircle}
                    >
                      <Text
                        style={[
                          styles.teamInitials,
                          { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {game.awayTeam.team_abbr || getNBATeamInitials(game.awayTeam.team_name)}
                      </Text>
                    </LinearGradient>
                    {(() => {
                      const { text, lines } = formatTeamName(game.awayTeam.team_name);
                      return (
                        <Text
                          style={[styles.teamName, { color: theme.colors.onSurface }]}
                          numberOfLines={lines}
                          adjustsFontSizeToFit
                          minimumFontScale={0.6}
                        >
                          {text}
                        </Text>
                      );
                    })()}
                  </View>

                  {/* Center */}
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
                    <LinearGradient
                      colors={[homeColors.primary, homeColors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.teamCircle}
                    >
                      <Text
                        style={[
                          styles.teamInitials,
                          { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {game.homeTeam.team_abbr || getNBATeamInitials(game.homeTeam.team_name)}
                      </Text>
                    </LinearGradient>
                    {(() => {
                      const { text, lines } = formatTeamName(game.homeTeam.team_name);
                      return (
                        <Text
                          style={[styles.teamName, { color: theme.colors.onSurface }]}
                          numberOfLines={lines}
                          adjustsFontSizeToFit
                          minimumFontScale={0.6}
                        >
                          {text}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
              </View>
            </View>

            {/* Situation Sections */}
            <TrendsSituationSection
              title="Last Game Situation"
              icon="clock-outline"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="lastGame"
            />

            <TrendsSituationSection
              title="Favorite/Underdog Situation"
              icon="podium"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="favDog"
            />

            <TrendsSituationSection
              title="Side Spread Situation"
              icon="home-outline"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="sideFavDog"
            />

            <TrendsSituationSection
              title="Rest Bucket"
              icon="calendar-clock"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="restBucket"
            />

            <TrendsSituationSection
              title="Rest Comparison"
              icon="scale-balance"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="restComp"
            />

            <View style={{ height: 40 }} />
          </>
        ) : (
          <View style={{ height: 100 }} />
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: 16,
  },
  headerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  headerGradient: {
    height: 4,
  },
  headerContent: {
    padding: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  teamSection: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  teamCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  teamName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  atSymbol: {
    fontSize: 20,
    fontWeight: '600',
  },
  timeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
