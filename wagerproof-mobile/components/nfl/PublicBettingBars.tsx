import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { parseBettingSplit, BettingSplitData } from '@/utils/nflDataFetchers';
import { getNFLTeamColors, getTeamInitials, getContrastingTextColor } from '@/utils/teamColors';

interface PublicBettingBarsProps {
  mlSplitsLabel: string | null;
  spreadSplitsLabel: string | null;
  totalSplitsLabel: string | null;
  homeTeam: string;
  awayTeam: string;
}

export function PublicBettingBars({
  mlSplitsLabel,
  spreadSplitsLabel,
  totalSplitsLabel,
  homeTeam,
  awayTeam
}: PublicBettingBarsProps) {
  const theme = useTheme();

  const renderBettingBar = (
    label: string | null,
    title: string,
    icon: string,
    iconColor: string
  ) => {
    if (!label) return null;
    
    const data = parseBettingSplit(label);
    if (!data || !data.team) return null;

    // Determine team colors
    const isHomeTeam = data.team === homeTeam;
    const isAwayTeam = data.team === awayTeam;
    const isTotal = data.direction !== undefined;
    
    let teamColors = { primary: '#64748b', secondary: '#94a3b8' };
    if (isHomeTeam) {
      teamColors = getNFLTeamColors(homeTeam);
    } else if (isAwayTeam) {
      teamColors = getNFLTeamColors(awayTeam);
    }

    const percentage = data.percentage;
    const oppositePercentage = 100 - percentage;

    return (
      <View key={title} style={styles.barSection}>
        <View style={styles.barHeader}>
          <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
          <Text style={[styles.barTitle, { color: theme.colors.onSurface }]}>{title}</Text>
        </View>

        <View style={[styles.barContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          {/* Team/Side with higher percentage */}
          <View style={[styles.barSide, { alignItems: 'flex-start' }]}>
            {!isTotal && (
              <View style={styles.teamIndicator}>
                <LinearGradient
                  colors={[teamColors.primary, teamColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.teamCircleSmall}
                >
                  <Text style={[
                    styles.teamInitialsSmall,
                    { color: getContrastingTextColor(teamColors.primary, teamColors.secondary) }
                  ]}>
                    {getTeamInitials(data.team)}
                  </Text>
                </LinearGradient>
              </View>
            )}
            <Text style={[styles.percentageText, { color: theme.colors.onSurface }]}>
              {percentage.toFixed(0)}%
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { backgroundColor: 'rgba(100, 116, 139, 0.2)' }]}>
              <LinearGradient
                colors={[teamColors.primary, teamColors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${percentage}%` }]}
              />
            </View>
            <Text style={[styles.barLabel, { color: theme.colors.onSurfaceVariant }]}>
              {isTotal ? data.team : data.team}
            </Text>
          </View>

          {/* Opposite side */}
          <View style={[styles.barSide, { alignItems: 'flex-end' }]}>
            <Text style={[styles.percentageTextSecondary, { color: theme.colors.onSurfaceVariant }]}>
              {oppositePercentage.toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Type indicator */}
        <View style={styles.typeIndicator}>
          <Text style={[styles.typeText, { color: theme.colors.onSurfaceVariant }]}>
            {data.isSharp ? '🟢 Sharp Money' : '👥 Public'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(100, 116, 139, 0.1)' }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-group" size={24} color="#64748b" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Public Betting Distribution
        </Text>
      </View>

      {renderBettingBar(mlSplitsLabel, 'Moneyline', 'trending-up', '#3b82f6')}
      {renderBettingBar(spreadSplitsLabel, 'Spread', 'target', '#22c55e')}
      {renderBettingBar(totalSplitsLabel, 'Total', 'chart-bar', '#f97316')}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  barSection: {
    marginBottom: 20,
  },
  barHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  barTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  barSide: {
    minWidth: 50,
  },
  teamIndicator: {
    marginBottom: 4,
  },
  teamCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitialsSmall: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  percentageText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  percentageTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    flex: 1,
    gap: 4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  typeIndicator: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  typeText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

