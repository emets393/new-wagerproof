import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { parseBettingSplit } from '@/utils/cfbDataFetchers';
import { getCFBTeamColors, getCFBTeamInitials, getContrastingTextColor } from '@/utils/teamColors';

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
  awayTeam,
}: PublicBettingBarsProps) {
  const theme = useTheme();

  const mlData = mlSplitsLabel ? parseBettingSplit(mlSplitsLabel) : null;
  const spreadData = spreadSplitsLabel ? parseBettingSplit(spreadSplitsLabel) : null;
  const totalData = totalSplitsLabel ? parseBettingSplit(totalSplitsLabel) : null;

  if (!mlData && !spreadData && !totalData) {
    return null;
  }

  const getTeamColors = (teamName: string) => {
    if (teamName === homeTeam) return getCFBTeamColors(homeTeam);
    if (teamName === awayTeam) return getCFBTeamColors(awayTeam);
    return { primary: theme.colors.primary, secondary: theme.colors.primary };
  };

  const renderLeanIndicator = (
    title: string,
    data: { team: string; percentage: number } | null,
    isTotal: boolean = false
  ) => {
    if (!data) return null;

    const teamColors = isTotal ? null : getTeamColors(data.team);
    const isOver = isTotal && data.team.toLowerCase().includes('over');
    const isUnder = isTotal && data.team.toLowerCase().includes('under');

    return (
      <View style={styles.bettingRow}>
        <Text style={[styles.bettingLabel, { color: theme.colors.onSurfaceVariant }]}>
          {title}
        </Text>
        <View style={styles.leanContainer}>
          {isTotal ? (
            <MaterialCommunityIcons 
              name={isOver ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color={isOver ? '#f97316' : '#3b82f6'} 
            />
          ) : (
            teamColors && (
              <LinearGradient
                colors={[teamColors.primary, teamColors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.teamInitialCircle}
              >
                <Text
                  style={[
                    styles.teamInitialText,
                    { color: getContrastingTextColor(teamColors.primary, teamColors.secondary) },
                  ]}
                >
                  {getCFBTeamInitials(data.team)}
                </Text>
              </LinearGradient>
            )
          )}
          <View style={styles.leanTextContainer}>
            <Text style={[styles.leaningText, { color: theme.colors.onSurfaceVariant }]}>
              Leaning:
            </Text>
            <Text style={[styles.teamText, { color: theme.colors.onSurface }]}>
              {data.team}
            </Text>
          </View>
          {data.percentage >= 60 && (
            <View style={[styles.sharpBadge, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
              <MaterialCommunityIcons name="alert" size={12} color="#fbbf24" />
              <Text style={[styles.sharpText, { color: '#fbbf24' }]}>Sharp</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(147, 197, 253, 0.1)', borderColor: 'rgba(147, 197, 253, 0.3)' }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-bar" size={20} color="#3b82f6" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          PUBLIC LEAN
        </Text>
      </View>

      <View style={[styles.content, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
        {renderLeanIndicator('Moneyline', mlData)}
        {renderLeanIndicator('Spread', spreadData)}
        {renderLeanIndicator('Total', totalData, true)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    borderRadius: 8,
    padding: 12,
    gap: 16,
  },
  bettingRow: {
    gap: 8,
  },
  bettingLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  leanContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamInitialCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitialText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  leanTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaningText: {
    fontSize: 13,
    fontWeight: '500',
  },
  teamText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sharpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sharpText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

