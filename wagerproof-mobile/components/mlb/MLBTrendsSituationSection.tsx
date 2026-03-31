import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MLBSituationalTrendRow, MLBSituationType, toTrendPct, formatMLBSituation } from '@/types/mlbBettingTrends';
import { getMLBFallbackTeamInfo, getMLBTeamById } from '@/constants/mlbTeams';
import { useThemeContext } from '@/contexts/ThemeContext';
import { TeamAvatar } from '../TeamAvatar';

interface MLBTrendsSituationSectionProps {
  title: string;
  icon: string;
  awayTeam: MLBSituationalTrendRow;
  homeTeam: MLBSituationalTrendRow;
  situationType: MLBSituationType;
  tooltip?: string;
}

/**
 * Get color based on percentage
 * Green: >55%, Yellow: 45-55%, Red: <45%
 */
function getPctColor(percentage: number | null): string {
  if (percentage === null) return '#9ca3af';
  if (percentage >= 55) return '#22c55e';
  if (percentage >= 45) return '#eab308';
  return '#ef4444';
}

/**
 * Get win% data for a specific situation
 */
function getWinPctData(team: MLBSituationalTrendRow, situationType: MLBSituationType): { pct: number | null; label: string } {
  switch (situationType) {
    case 'lastGame':
      return { pct: toTrendPct(team.win_pct_last_game), label: formatMLBSituation(team.last_game_situation) };
    case 'homeAway':
      return { pct: toTrendPct(team.win_pct_home_away), label: formatMLBSituation(team.home_away_situation) };
    case 'favDog':
      return { pct: toTrendPct(team.win_pct_fav_dog), label: formatMLBSituation(team.fav_dog_situation) };
    case 'restBucket':
      return { pct: toTrendPct(team.win_pct_rest_bucket), label: formatMLBSituation(team.rest_bucket) };
    case 'restComp':
      return { pct: toTrendPct(team.win_pct_rest_comp), label: formatMLBSituation(team.rest_comp) };
    case 'league':
      return { pct: toTrendPct(team.win_pct_league), label: formatMLBSituation(team.league_situation) };
    case 'division':
      return { pct: toTrendPct(team.win_pct_division), label: formatMLBSituation(team.division_situation) };
  }
}

/**
 * Get over% data for a specific situation
 */
function getOverPctData(team: MLBSituationalTrendRow, situationType: MLBSituationType): number | null {
  switch (situationType) {
    case 'lastGame': return toTrendPct(team.over_pct_last_game);
    case 'homeAway': return toTrendPct(team.over_pct_home_away);
    case 'favDog': return toTrendPct(team.over_pct_fav_dog);
    case 'restBucket': return toTrendPct(team.over_pct_rest_bucket);
    case 'restComp': return toTrendPct(team.over_pct_rest_comp);
    case 'league': return toTrendPct(team.over_pct_league);
    case 'division': return toTrendPct(team.over_pct_division);
  }
}

function formatPct(pct: number | null): string {
  if (pct === null) return '—';
  return `${Math.round(pct)}%`;
}

function resolveTeamDisplay(teamId: number | string, teamName: string): { abbrev: string; logoUrl: string | null } {
  const byId = getMLBTeamById(teamId);
  if (byId) return byId;
  const byName = getMLBFallbackTeamInfo(teamName);
  if (byName) return { abbrev: byName.team, logoUrl: byName.logo_url };
  const words = teamName.trim().split(/\s+/);
  return { abbrev: words[words.length - 1].slice(0, 3).toUpperCase(), logoUrl: null };
}

/**
 * Section component for displaying one situational trend comparison for MLB.
 * Shows both teams side by side with Win% and Over% (no W-L records).
 */
export function MLBTrendsSituationSection({
  title,
  icon,
  awayTeam,
  homeTeam,
  situationType,
  tooltip,
}: MLBTrendsSituationSectionProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const awayWin = getWinPctData(awayTeam, situationType);
  const homeWin = getWinPctData(homeTeam, situationType);
  const awayOver = getOverPctData(awayTeam, situationType);
  const homeOver = getOverPctData(homeTeam, situationType);

  const hasData = awayWin.pct !== null || homeWin.pct !== null || awayOver !== null || homeOver !== null;

  const awayDisplay = resolveTeamDisplay(awayTeam.team_id, awayTeam.team_name);
  const homeDisplay = resolveTeamDisplay(homeTeam.team_id, homeTeam.team_name);

  if (!hasData) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <View style={styles.header}>
          <MaterialCommunityIcons name={icon as any} size={18} color="#16a34a" />
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
        <MaterialCommunityIcons name={icon as any} size={18} color="#16a34a" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
      </View>

      {/* Content */}
      <View style={[styles.content, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)' }]}>
        {/* Team Headers */}
        <View style={styles.teamHeaderRow}>
          <View style={styles.recordLabelSpacer} />
          <View style={styles.teamHeader}>
            <TeamAvatar teamName={awayTeam.team_name} sport="mlb" size={40} teamAbbr={awayDisplay.abbrev} logoUrl={awayDisplay.logoUrl} />
            <Text
              style={[styles.situationLabel, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {awayWin.label}
            </Text>
          </View>

          <View style={styles.teamHeader}>
            <TeamAvatar teamName={homeTeam.team_name} sport="mlb" size={40} teamAbbr={homeDisplay.abbrev} logoUrl={homeDisplay.logoUrl} />
            <Text
              style={[styles.situationLabel, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {homeWin.label}
            </Text>
          </View>
        </View>

        {/* Win% Row */}
        <View style={styles.recordRow}>
          <Text style={[styles.recordLabel, { color: theme.colors.onSurfaceVariant }]}>WIN%</Text>

          <View style={styles.recordCell}>
            <View
              style={[styles.percentageBadge, { backgroundColor: `${getPctColor(awayWin.pct)}20` }]}
            >
              <Text style={[styles.percentageText, { color: getPctColor(awayWin.pct) }]}>
                {formatPct(awayWin.pct)}
              </Text>
            </View>
          </View>

          <View style={styles.recordCell}>
            <View
              style={[styles.percentageBadge, { backgroundColor: `${getPctColor(homeWin.pct)}20` }]}
            >
              <Text style={[styles.percentageText, { color: getPctColor(homeWin.pct) }]}>
                {formatPct(homeWin.pct)}
              </Text>
            </View>
          </View>
        </View>

        {/* Over% Row */}
        <View style={styles.recordRow}>
          <Text style={[styles.recordLabel, { color: theme.colors.onSurfaceVariant }]}>OVER%</Text>

          <View style={styles.recordCell}>
            <View
              style={[styles.percentageBadge, { backgroundColor: `${getPctColor(awayOver)}20` }]}
            >
              <Text style={[styles.percentageText, { color: getPctColor(awayOver) }]}>
                {formatPct(awayOver)}
              </Text>
            </View>
          </View>

          <View style={styles.recordCell}>
            <View
              style={[styles.percentageBadge, { backgroundColor: `${getPctColor(homeOver)}20` }]}
            >
              <Text style={[styles.percentageText, { color: getPctColor(homeOver) }]}>
                {formatPct(homeOver)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tooltip */}
      {tooltip && (
        <View style={styles.tooltipContainer}>
          <MaterialCommunityIcons name="information-outline" size={12} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.tooltipText, { color: theme.colors.onSurfaceVariant }]}>
            {tooltip}
          </Text>
        </View>
      )}
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
    width: 48,
  },
  teamHeader: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
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
    width: 48,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  recordCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  percentageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tooltipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
    marginTop: -4,
  },
  tooltipText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
    fontStyle: 'italic',
  },
});
