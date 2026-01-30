import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SituationalTrendRow, parseRecord, formatSituation } from '@/types/nbaBettingTrends';
import { getNBATeamColors, getNBATeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';

type SituationType = 'lastGame' | 'favDog' | 'sideFavDog' | 'restBucket' | 'restComp';

interface TrendsSituationSectionProps {
  title: string;
  icon: string;
  awayTeam: SituationalTrendRow;
  homeTeam: SituationalTrendRow;
  situationType: SituationType;
}

/**
 * Get color based on ATS percentage
 * Green: >55%, Yellow: 45-55%, Red: <45%
 */
function getATSColor(percentage: number | null): string {
  if (percentage === null) return '#9ca3af';
  if (percentage >= 55) return '#22c55e'; // green
  if (percentage >= 45) return '#eab308'; // yellow
  return '#ef4444'; // red
}

/**
 * Get ATS data for a specific situation
 */
function getATSData(team: SituationalTrendRow, situationType: SituationType): { record: string; pct: number | null; label: string } {
  switch (situationType) {
    case 'lastGame':
      return {
        record: team.ats_last_game_record || '-',
        pct: team.ats_last_game_cover_pct,
        label: formatSituation(team.last_game_situation),
      };
    case 'favDog':
      return {
        record: team.ats_fav_dog_record || '-',
        pct: team.ats_fav_dog_cover_pct,
        label: formatSituation(team.fav_dog_situation),
      };
    case 'sideFavDog':
      return {
        record: team.ats_side_fav_dog_record || '-',
        pct: team.ats_side_fav_dog_cover_pct,
        label: formatSituation(team.side_spread_situation),
      };
    case 'restBucket':
      return {
        record: team.ats_rest_bucket_record || '-',
        pct: team.ats_rest_bucket_cover_pct,
        label: formatSituation(team.rest_bucket),
      };
    case 'restComp':
      return {
        record: team.ats_rest_comp_record || '-',
        pct: team.ats_rest_comp_cover_pct,
        label: formatSituation(team.rest_comp),
      };
  }
}

/**
 * Get O/U data for a specific situation
 */
function getOUData(team: SituationalTrendRow, situationType: SituationType): { record: string; overPct: number | null; underPct: number | null } {
  switch (situationType) {
    case 'lastGame':
      return {
        record: team.ou_last_game_record || '-',
        overPct: team.ou_last_game_over_pct,
        underPct: team.ou_last_game_under_pct,
      };
    case 'favDog':
      return {
        record: team.ou_fav_dog_record || '-',
        overPct: team.ou_fav_dog_over_pct,
        underPct: team.ou_fav_dog_under_pct,
      };
    case 'sideFavDog':
      return {
        record: team.ou_side_fav_dog_record || '-',
        overPct: team.ou_side_fav_dog_over_pct,
        underPct: team.ou_side_fav_dog_under_pct,
      };
    case 'restBucket':
      return {
        record: team.ou_rest_bucket_record || '-',
        overPct: team.ou_rest_bucket_over_pct,
        underPct: team.ou_rest_bucket_under_pct,
      };
    case 'restComp':
      return {
        record: team.ou_rest_comp_record || '-',
        overPct: team.ou_rest_comp_over_pct,
        underPct: team.ou_rest_comp_under_pct,
      };
  }
}

/**
 * Format percentage for display
 */
function formatPct(pct: number | null): string {
  if (pct === null) return '-';
  return `${Math.round(pct)}%`;
}

/**
 * Section component for displaying one situational trend comparison
 * Shows both teams side by side with ATS and O/U records
 */
export function TrendsSituationSection({
  title,
  icon,
  awayTeam,
  homeTeam,
  situationType,
}: TrendsSituationSectionProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const awayColors = getNBATeamColors(awayTeam.team_name);
  const homeColors = getNBATeamColors(homeTeam.team_name);

  const awayATS = getATSData(awayTeam, situationType);
  const homeATS = getATSData(homeTeam, situationType);
  const awayOU = getOUData(awayTeam, situationType);
  const homeOU = getOUData(homeTeam, situationType);

  // Check if we have any meaningful data
  const hasData = awayATS.record !== '-' || homeATS.record !== '-';

  if (!hasData) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <View style={styles.header}>
          <MaterialCommunityIcons name={icon as any} size={18} color="#3b82f6" />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
        </View>
        <View style={[styles.noDataContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <Text style={[styles.noDataText, { color: theme.colors.onSurfaceVariant }]}>
            No data available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name={icon as any} size={18} color="#3b82f6" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
      </View>

      {/* Content */}
      <View style={[styles.content, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)' }]}>
        {/* Team Headers */}
        <View style={styles.teamHeaderRow}>
          {/* Spacer to align with record label */}
          <View style={styles.recordLabelSpacer} />
          <View style={styles.teamHeader}>
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
                {awayTeam.team_abbr || getNBATeamInitials(awayTeam.team_name)}
              </Text>
            </LinearGradient>
            <Text
              style={[styles.situationLabel, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {awayATS.label}
            </Text>
          </View>

          <View style={styles.teamHeader}>
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
                {homeTeam.team_abbr || getNBATeamInitials(homeTeam.team_name)}
              </Text>
            </LinearGradient>
            <Text
              style={[styles.situationLabel, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {homeATS.label}
            </Text>
          </View>
        </View>

        {/* ATS Row */}
        <View style={styles.recordRow}>
          <Text style={[styles.recordLabel, { color: theme.colors.onSurfaceVariant }]}>ATS</Text>

          <View style={styles.recordCell}>
            <Text style={[styles.recordValue, { color: theme.colors.onSurface }]}>
              {awayATS.record}
            </Text>
            <View
              style={[
                styles.percentageBadge,
                { backgroundColor: `${getATSColor(awayATS.pct)}20` },
              ]}
            >
              <Text
                style={[styles.percentageText, { color: getATSColor(awayATS.pct) }]}
              >
                {formatPct(awayATS.pct)}
              </Text>
            </View>
          </View>

          <View style={styles.recordCell}>
            <Text style={[styles.recordValue, { color: theme.colors.onSurface }]}>
              {homeATS.record}
            </Text>
            <View
              style={[
                styles.percentageBadge,
                { backgroundColor: `${getATSColor(homeATS.pct)}20` },
              ]}
            >
              <Text
                style={[styles.percentageText, { color: getATSColor(homeATS.pct) }]}
              >
                {formatPct(homeATS.pct)}
              </Text>
            </View>
          </View>
        </View>

        {/* O/U Row */}
        <View style={styles.recordRow}>
          <Text style={[styles.recordLabel, { color: theme.colors.onSurfaceVariant }]}>O/U</Text>

          <View style={styles.recordCell}>
            <Text style={[styles.recordValue, { color: theme.colors.onSurface }]}>
              {awayOU.record}
            </Text>
            <Text style={[styles.ouPercentages, { color: theme.colors.onSurfaceVariant }]}>
              {awayOU.overPct !== null && awayOU.underPct !== null
                ? `${Math.round(awayOU.overPct)}%O / ${Math.round(awayOU.underPct)}%U`
                : '-'}
            </Text>
          </View>

          <View style={styles.recordCell}>
            <Text style={[styles.recordValue, { color: theme.colors.onSurface }]}>
              {homeOU.record}
            </Text>
            <Text style={[styles.ouPercentages, { color: theme.colors.onSurfaceVariant }]}>
              {homeOU.overPct !== null && homeOU.underPct !== null
                ? `${Math.round(homeOU.overPct)}%O / ${Math.round(homeOU.underPct)}%U`
                : '-'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  noDataContainer: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    margin: 12,
    marginTop: 0,
  },
  noDataText: {
    fontSize: 13,
  },
  content: {
    padding: 12,
    paddingTop: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recordLabelSpacer: {
    width: 40,
  },
  teamHeader: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  teamCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitials: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  situationLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 100,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  recordLabel: {
    width: 40,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  recordCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  recordValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ouPercentages: {
    fontSize: 10,
    fontWeight: '500',
  },
  noData: {
    fontSize: 15,
    fontWeight: '500',
  },
});
