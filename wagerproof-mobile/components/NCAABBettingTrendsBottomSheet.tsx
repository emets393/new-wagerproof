import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNCAABBettingTrendsSheet } from '@/contexts/NCAABBettingTrendsSheetContext';
import { getCFBTeamColors } from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';
import { NCAABTrendsSituationSection } from './ncaab/TrendsSituationSection';
import { TeamAvatar } from './TeamAvatar';
import { useGameTeamColors } from '@/hooks/useImageColors';

// Tooltips for each situation type
const TOOLTIPS = {
  lastGame: 'How each team performs ATS and O/U after a win vs. after a loss. Look for momentum patterns.',
  favDog: 'Performance when favored vs. as underdog. Strong ATS contrast (≥15%) suggests an edge.',
  sideFavDog: 'Combines home/away with favorite/underdog role. Home favorites and away underdogs often have distinct patterns.',
  restBucket: 'Performance based on days of rest (1, 2-3, or 4+). Fatigue or rust can impact both ATS and totals.',
  restComp: 'Rest advantage vs. opponent. Teams with more rest often cover, but totals can swing either way.',
};

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
 * Bottom sheet with detailed situational trends for a selected NCAAB game
 */
export function NCAABBettingTrendsBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { selectedGameTrends: game, closeTrendsSheet, bottomSheetRef } = useNCAABBettingTrendsSheet();
  const snapPoints = useMemo(() => ['85%', '95%'], []);

  // Extract team colors from logo images; fall back to hardcoded CFB colors
  const { awayColors, homeColors } = useGameTeamColors(
    game?.awayTeamLogo,
    game?.homeTeamLogo,
    game ? getCFBTeamColors(game.awayTeam.team_name) : { primary: '#000', secondary: '#000' },
    game ? getCFBTeamColors(game.homeTeam.team_name) : { primary: '#000', secondary: '#000' },
  );

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
                    <TeamAvatar
                      teamName={game.awayTeam.team_name}
                      sport="ncaab"
                      size={64}
                      teamAbbr={game.awayTeam.team_abbr}
                      {...(game.awayTeamLogo ? { logoUrl: game.awayTeamLogo } : {})}
                    />
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
                    <TeamAvatar
                      teamName={game.homeTeam.team_name}
                      sport="ncaab"
                      size={64}
                      teamAbbr={game.homeTeam.team_abbr}
                      {...(game.homeTeamLogo ? { logoUrl: game.homeTeamLogo } : {})}
                    />
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
            <NCAABTrendsSituationSection
              title="Last Game Situation"
              icon="clock-outline"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="lastGame"
              tooltip={TOOLTIPS.lastGame}
            />

            <NCAABTrendsSituationSection
              title="Favorite/Underdog Situation"
              icon="podium"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="favDog"
              tooltip={TOOLTIPS.favDog}
            />

            <NCAABTrendsSituationSection
              title="Side Spread Situation"
              icon="home-outline"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="sideFavDog"
              tooltip={TOOLTIPS.sideFavDog}
            />

            <NCAABTrendsSituationSection
              title="Rest Bucket"
              icon="calendar-clock"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="restBucket"
              tooltip={TOOLTIPS.restBucket}
            />

            <NCAABTrendsSituationSection
              title="Rest Comparison"
              icon="scale-balance"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="restComp"
              tooltip={TOOLTIPS.restComp}
            />

            {/* How to Use Guide */}
            <View style={[styles.guideContainer, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
              <View style={styles.guideHeader}>
                <MaterialCommunityIcons name="book-open-variant" size={20} color="#3b82f6" />
                <Text style={[styles.guideTitle, { color: theme.colors.onSurface }]}>
                  How to Use This Tool
                </Text>
              </View>

              <View style={styles.guideContent}>
                {/* ATS Section */}
                <View style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, { color: theme.colors.onSurface }]}>
                    ATS (Against The Spread)
                  </Text>
                  <Text style={[styles.guideText, { color: theme.colors.onSurfaceVariant }]}>
                    ATS means betting on whether a team will "cover" the point spread — win by more than the spread (favorites) or lose by less than the spread (underdogs).{'\n\n'}
                    • <Text style={styles.guideHighlight}>Strong signal:</Text> One team ≥60% ATS, other ≤45% (≥15pt difference){'\n'}
                    • <Text style={styles.guideHighlight}>Weak/No signal:</Text> Both teams 48-55% or both strong{'\n'}
                    • <Text style={styles.guideHighlight}>Key insight:</Text> For ATS, contrast matters more than alignment
                  </Text>
                </View>

                {/* O/U Section */}
                <View style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, { color: theme.colors.onSurface }]}>
                    Over/Under (Totals)
                  </Text>
                  <Text style={[styles.guideText, { color: theme.colors.onSurfaceVariant }]}>
                    • <Text style={styles.guideHighlight}>Strong Over:</Text> Both teams ≥60% Over rate{'\n'}
                    • <Text style={styles.guideHighlight}>Strong Under:</Text> Both teams ≥60% Under rate{'\n'}
                    • <Text style={styles.guideHighlight}>No signal:</Text> One team leans Over, other leans Under{'\n'}
                    • <Text style={styles.guideHighlight}>Key insight:</Text> For totals, alignment matters — both must agree
                  </Text>
                </View>

                {/* Color Legend */}
                <View style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, { color: theme.colors.onSurface }]}>
                    Color Legend
                  </Text>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                    <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                      ≥55% — Strong trend
                    </Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
                    <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                      45-54% — Neutral
                    </Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                    <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                      &lt;45% — Weak/Fade
                    </Text>
                  </View>
                </View>

                {/* Quick Tips */}
                <View style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, { color: theme.colors.onSurface }]}>
                    Quick Tips
                  </Text>
                  <Text style={[styles.guideText, { color: theme.colors.onSurfaceVariant }]}>
                    • Require ≥4 game sample size for reliable signals{'\n'}
                    • Multiple situations aligning increases confidence{'\n'}
                    • Role-based trends (home favorite, away dog) are most predictive{'\n'}
                    • Rest advantages amplify existing ATS edges
                  </Text>
                </View>
              </View>
            </View>

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
  guideContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 8,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  guideContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  guideSection: {
    marginBottom: 16,
  },
  guideSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  guideText: {
    fontSize: 12,
    lineHeight: 20,
  },
  guideHighlight: {
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
  },
});
