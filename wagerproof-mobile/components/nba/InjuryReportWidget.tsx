import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { NBAInjuryReport } from '@/types/nba';
import { getNBATeamColors, getNBATeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';

interface InjuryReportWidgetProps {
  awayTeam: string;
  homeTeam: string;
  awayInjuries: NBAInjuryReport[];
  homeInjuries: NBAInjuryReport[];
  awayInjuryImpact: number;
  homeInjuryImpact: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Format player name as "F. LastName" (first initial + last name)
 */
function formatPlayerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return `${firstName.charAt(0)}. ${lastName}`;
}

/**
 * Format PIE as raw value with 4 decimal places
 */
function formatPIE(pie: string | number | null): string {
  if (pie === null || pie === undefined) return 'N/A';
  const pieNum = typeof pie === 'string' ? parseFloat(pie) : pie;
  if (isNaN(pieNum)) return 'N/A';
  return pieNum.toFixed(4);
}

/**
 * Sort injuries by PIE (highest first)
 */
function sortByPIE(injuries: NBAInjuryReport[]): NBAInjuryReport[] {
  return [...injuries].sort((a, b) => {
    const pieA = a.avg_pie_season === null || a.avg_pie_season === undefined
      ? null
      : typeof a.avg_pie_season === 'string'
        ? parseFloat(a.avg_pie_season)
        : a.avg_pie_season;
    const pieB = b.avg_pie_season === null || b.avg_pie_season === undefined
      ? null
      : typeof b.avg_pie_season === 'string'
        ? parseFloat(b.avg_pie_season)
        : b.avg_pie_season;
    const valueA = pieA === null || isNaN(pieA) ? -Infinity : pieA;
    const valueB = pieB === null || isNaN(pieB) ? -Infinity : pieB;
    return valueB - valueA;
  });
}

export function InjuryReportWidget({
  awayTeam,
  homeTeam,
  awayInjuries,
  homeInjuries,
  awayInjuryImpact,
  homeInjuryImpact,
  isLoading,
  error,
}: InjuryReportWidgetProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [expanded, setExpanded] = useState(false);

  const awayColors = getNBATeamColors(awayTeam);
  const homeColors = getNBATeamColors(homeTeam);

  const handleToggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };

  const hasInjuries = awayInjuries.length > 0 || homeInjuries.length > 0;

  const renderPlayerRow = (injury: NBAInjuryReport, index: number, teamColors: { primary: string; secondary: string }) => (
    <View key={`${injury.player_name}-${index}`} style={styles.playerRow}>
      <Text style={[styles.playerName, { color: theme.colors.onSurface }]} numberOfLines={1}>
        {formatPlayerName(injury.player_name)}
      </Text>
      <Text style={[styles.playerStatus, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
        {injury.status}
      </Text>
      <Text style={[styles.playerPIE, { color: teamColors.primary }]}>
        {formatPIE(injury.avg_pie_season)}
      </Text>
    </View>
  );

  const renderTeamInjuries = (
    injuries: NBAInjuryReport[],
    teamName: string,
    teamColors: { primary: string; secondary: string }
  ) => {
    if (injuries.length === 0) {
      return (
        <Text style={[styles.noInjuriesText, { color: theme.colors.onSurfaceVariant }]}>
          No injuries reported
        </Text>
      );
    }

    return (
      <View style={styles.teamInjuriesContent}>
        {/* Table Header */}
        <View style={[styles.tableHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
          <Text style={[styles.headerText, { color: theme.colors.onSurfaceVariant }]}>Player</Text>
          <Text style={[styles.headerText, { color: theme.colors.onSurfaceVariant }]}>Status</Text>
          <Text style={[styles.headerText, styles.headerPIE, { color: theme.colors.onSurfaceVariant }]}>PIE</Text>
        </View>
        {/* Table Rows */}
        {sortByPIE(injuries).map((injury, index) => renderPlayerRow(injury, index, teamColors))}
      </View>
    );
  };

  // Get impact score color (green = less injury impact/advantage, red = more impact)
  const getImpactColor = (myImpact: number, otherImpact: number) => {
    if (myImpact < otherImpact) return '#ef4444'; // More negative = more injuries = red
    if (myImpact > otherImpact) return '#22c55e'; // Less negative = fewer injuries = green
    return isDark ? '#ffffff' : '#1f2937';
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
      {/* Header - Always visible, tappable */}
      <TouchableOpacity onPress={handleToggleExpand} activeOpacity={0.7}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="bandage" size={20} color="#ef4444" />
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Injury Report</Text>
          </View>
          <View style={styles.headerRight}>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#ef4444" />
          <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
        </View>
      )}

      {/* Expanded Content */}
      {expanded && !isLoading && !error && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 200 }}
        >
          {!hasInjuries ? (
            <View style={[styles.emptyContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={32} color="#22c55e" />
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                No injuries reported for this matchup
              </Text>
            </View>
          ) : (
            <View style={styles.content}>
              {/* Two-column layout for teams */}
              <View style={styles.teamsContainer}>
                {/* Away Team */}
                <View style={styles.teamColumn}>
                  <View style={styles.teamHeader}>
                    <LinearGradient
                      colors={[awayColors.primary, awayColors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.teamCircle}
                    >
                      <Text style={[
                        styles.teamInitials,
                        { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }
                      ]}>
                        {getNBATeamInitials(awayTeam)}
                      </Text>
                    </LinearGradient>
                  </View>
                  {renderTeamInjuries(awayInjuries, awayTeam, awayColors)}
                </View>

                {/* Home Team */}
                <View style={styles.teamColumn}>
                  <View style={styles.teamHeader}>
                    <LinearGradient
                      colors={[homeColors.primary, homeColors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.teamCircle}
                    >
                      <Text style={[
                        styles.teamInitials,
                        { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }
                      ]}>
                        {getNBATeamInitials(homeTeam)}
                      </Text>
                    </LinearGradient>
                  </View>
                  {renderTeamInjuries(homeInjuries, homeTeam, homeColors)}
                </View>
              </View>

              {/* Cumulative Injury Impact Score Footer */}
              <View style={[styles.impactFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                <Text style={[styles.impactLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Cumulative Injury Impact Score
                </Text>
                <View style={styles.impactScores}>
                  <View style={styles.impactTeam}>
                    <LinearGradient
                      colors={[awayColors.primary, awayColors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.impactCircle}
                    >
                      <Text style={[
                        styles.impactInitials,
                        { color: getContrastingTextColor(awayColors.primary, awayColors.secondary) }
                      ]}>
                        {getNBATeamInitials(awayTeam)}
                      </Text>
                    </LinearGradient>
                    <Text style={[
                      styles.impactValue,
                      { color: getImpactColor(awayInjuryImpact, homeInjuryImpact) }
                    ]}>
                      {awayInjuryImpact.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.impactTeam}>
                    <LinearGradient
                      colors={[homeColors.primary, homeColors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.impactCircle}
                    >
                      <Text style={[
                        styles.impactInitials,
                        { color: getContrastingTextColor(homeColors.primary, homeColors.secondary) }
                      ]}>
                        {getNBATeamInitials(homeTeam)}
                      </Text>
                    </LinearGradient>
                    <Text style={[
                      styles.impactValue,
                      { color: getImpactColor(homeInjuryImpact, awayInjuryImpact) }
                    ]}>
                      {homeInjuryImpact.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  errorText: {
    fontSize: 13,
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  teamsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  teamColumn: {
    flex: 1,
  },
  teamHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  teamCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitials: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamInjuriesContent: {
    gap: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  headerText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  headerPIE: {
    textAlign: 'right',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  playerName: {
    flex: 1.2,
    fontSize: 11,
    fontWeight: '500',
  },
  playerStatus: {
    flex: 0.8,
    fontSize: 10,
  },
  playerPIE: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 50,
  },
  noInjuriesText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  impactFooter: {
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  impactLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  impactScores: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  impactTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  impactCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  impactInitials: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  impactValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});
