import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMLBBettingTrendsSheet } from '@/contexts/MLBBettingTrendsSheetContext';
import { getMLBTeamColors, getMLBFallbackTeamInfo, getMLBTeamById } from '@/constants/mlbTeams';
import { useThemeContext } from '@/contexts/ThemeContext';
import { MLBTrendsSituationSection } from './mlb/MLBTrendsSituationSection';
import { TeamAvatar } from './TeamAvatar';

const TOOLTIPS = {
  lastGame: 'How each team performs after a win vs. after a loss. Look for momentum or bounce-back patterns.',
  homeAway: 'Win rate and over rate when playing at home vs. on the road. Home-field advantage varies by park.',
  favDog: 'Performance when favored vs. as underdog. Big win% gaps between the two teams suggest an ML edge.',
  restBucket: 'Performance based on days of rest (1, 2-3, or 4+). Pitching rotations are heavily affected by rest.',
  restComp: 'Rest advantage vs. opponent. Teams with more rest may have a pitching edge.',
  league: 'Performance in league (AL/NL) vs. non-league games. Interleague games can shift dynamics.',
  division: 'Performance in division vs. non-division games. Divisional familiarity can impact results.',
};

function formatTeamName(name: string): { text: string; lines: 1 | 2 } {
  if (!name.includes(' ')) return { text: name, lines: 1 };
  return { text: name.replace(' ', '\n'), lines: 2 };
}

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

function resolveTeamDisplay(teamId: number | string, teamName: string): { abbrev: string; logoUrl: string | null } {
  const byId = getMLBTeamById(teamId);
  if (byId) return byId;
  const byName = getMLBFallbackTeamInfo(teamName);
  if (byName) return { abbrev: byName.team, logoUrl: byName.logo_url };
  const words = teamName.trim().split(/\s+/);
  return { abbrev: words[words.length - 1].slice(0, 3).toUpperCase(), logoUrl: null };
}

export function MLBBettingTrendsBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { selectedGameTrends: game, closeTrendsSheet, bottomSheetRef } = useMLBBettingTrendsSheet();
  const snapPoints = useMemo(() => ['85%', '95%'], []);

  const awayColors = game ? getMLBTeamColors(game.awayTeam.team_name) : { primary: '#000', secondary: '#000' };
  const homeColors = game ? getMLBTeamColors(game.homeTeam.team_name) : { primary: '#000', secondary: '#000' };

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
            {(() => {
              const awayDisplay = resolveTeamDisplay(game.awayTeam.team_id, game.awayTeam.team_name);
              const homeDisplay = resolveTeamDisplay(game.homeTeam.team_id, game.homeTeam.team_name);
              return (
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
                          sport="mlb"
                          size={64}
                          teamAbbr={awayDisplay.abbrev}
                          logoUrl={awayDisplay.logoUrl}
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
                            {formatGameTimeEt(game.gameTimeEt)}
                          </Text>
                        </View>
                      </View>

                      {/* Home Team */}
                      <View style={styles.teamSection}>
                        <TeamAvatar
                          teamName={game.homeTeam.team_name}
                          sport="mlb"
                          size={64}
                          teamAbbr={homeDisplay.abbrev}
                          logoUrl={homeDisplay.logoUrl}
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
              );
            })()}

            {/* Situation Sections — MLB has 7 situations */}
            <MLBTrendsSituationSection
              title="Last Game Situation"
              icon="clock-outline"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="lastGame"
              tooltip={TOOLTIPS.lastGame}
            />

            <MLBTrendsSituationSection
              title="Home / Away"
              icon="home-outline"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="homeAway"
              tooltip={TOOLTIPS.homeAway}
            />

            <MLBTrendsSituationSection
              title="Favorite / Underdog"
              icon="podium"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="favDog"
              tooltip={TOOLTIPS.favDog}
            />

            <MLBTrendsSituationSection
              title="Rest Bucket"
              icon="calendar-clock"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="restBucket"
              tooltip={TOOLTIPS.restBucket}
            />

            <MLBTrendsSituationSection
              title="Rest Comparison"
              icon="scale-balance"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="restComp"
              tooltip={TOOLTIPS.restComp}
            />

            <MLBTrendsSituationSection
              title="League Situation"
              icon="shield-outline"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="league"
              tooltip={TOOLTIPS.league}
            />

            <MLBTrendsSituationSection
              title="Division Situation"
              icon="tournament"
              awayTeam={game.awayTeam}
              homeTeam={game.homeTeam}
              situationType="division"
              tooltip={TOOLTIPS.division}
            />

            {/* How to Use Guide */}
            <View style={[styles.guideContainer, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
              <View style={styles.guideHeader}>
                <MaterialCommunityIcons name="book-open-variant" size={20} color="#16a34a" />
                <Text style={[styles.guideTitle, { color: theme.colors.onSurface }]}>
                  How to Use This Tool
                </Text>
              </View>

              <View style={styles.guideContent}>
                {/* Win% Section */}
                <View style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, { color: theme.colors.onSurface }]}>
                    Win % (Moneyline)
                  </Text>
                  <Text style={[styles.guideText, { color: theme.colors.onSurfaceVariant }]}>
                    Win percentage shows how often each team wins outright in this situation.{'\n\n'}
                    • <Text style={styles.guideHighlight}>Strong signal:</Text> One team ≥60%, other ≤45% (≥15pt gap){'\n'}
                    • <Text style={styles.guideHighlight}>Key insight:</Text> Contrast matters — a big gap between teams suggests moneyline value
                  </Text>
                </View>

                {/* Over% Section */}
                <View style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, { color: theme.colors.onSurface }]}>
                    Over % (Totals)
                  </Text>
                  <Text style={[styles.guideText, { color: theme.colors.onSurfaceVariant }]}>
                    • <Text style={styles.guideHighlight}>Strong Over:</Text> Both teams ≥55% Over rate{'\n'}
                    • <Text style={styles.guideHighlight}>Strong Under:</Text> Both teams ≤45% Over rate{'\n'}
                    • <Text style={styles.guideHighlight}>Key insight:</Text> For totals, alignment matters — both must lean the same way
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
                    • Multiple situations aligning increases confidence{'\n'}
                    • Rest and home/away are especially impactful in baseball{'\n'}
                    • Division games carry familiarity edge — pitchers face same lineups more{'\n'}
                    • Park factors can shift totals — pair with weather data on game cards
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
