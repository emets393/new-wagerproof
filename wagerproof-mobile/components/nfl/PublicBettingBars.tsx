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

  const renderLeanIndicator = (
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
    let bgColor = 'rgba(156, 163, 175, 0.15)';
    let borderColor = 'rgba(156, 163, 175, 0.3)';
    
    if (isTotal) {
      // Over/Under colors
      if (data.team.toLowerCase().includes('over')) {
        teamColors = { primary: '#f97316', secondary: '#fb923c' };
        bgColor = 'rgba(249, 115, 22, 0.15)';
        borderColor = 'rgba(249, 115, 22, 0.3)';
      } else {
        teamColors = { primary: '#3b82f6', secondary: '#60a5fa' };
        bgColor = 'rgba(59, 130, 246, 0.15)';
        borderColor = 'rgba(59, 130, 246, 0.3)';
      }
    } else if (isHomeTeam) {
      teamColors = getNFLTeamColors(homeTeam);
      bgColor = `${teamColors.primary}26`;
      borderColor = `${teamColors.primary}4D`;
    } else if (isAwayTeam) {
      teamColors = getNFLTeamColors(awayTeam);
      bgColor = `${teamColors.primary}26`;
      borderColor = `${teamColors.primary}4D`;
    }

    return (
      <View key={title} style={styles.leanSection}>
        <View style={styles.leanHeader}>
          <MaterialCommunityIcons name={icon as any} size={16} color={iconColor} />
          <Text style={[styles.leanTitle, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
        </View>

        <View style={[styles.leanPill, { backgroundColor: bgColor, borderColor: borderColor }]}>
          {isTotal ? (
            <MaterialCommunityIcons 
              name={data.team.toLowerCase().includes('over') ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color={data.team.toLowerCase().includes('over') ? '#f97316' : '#3b82f6'} 
            />
          ) : (
            <LinearGradient
              colors={[teamColors.primary, teamColors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.leanCircle}
            >
              <Text style={[
                styles.leanInitials,
                { color: getContrastingTextColor(teamColors.primary, teamColors.secondary) }
              ]}>
                {getTeamInitials(data.team)}
              </Text>
            </LinearGradient>
          )}
          <Text style={[styles.leanText, { color: theme.colors.onSurface }]}>
            Leaning: <Text style={{ fontWeight: '700' }}>{data.team}</Text>
          </Text>
          {data.isSharp && (
            <View style={styles.sharpBadge}>
              <Text style={styles.sharpText}>💎</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(100, 116, 139, 0.1)', borderColor: 'rgba(100, 116, 139, 0.3)' }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-group" size={20} color="#22c55e" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Public Lean
        </Text>
      </View>

      <View style={styles.leansContainer}>
        {renderLeanIndicator(mlSplitsLabel, 'Moneyline', 'trending-up', '#3b82f6')}
        {renderLeanIndicator(spreadSplitsLabel, 'Spread', 'target', '#22c55e')}
        {renderLeanIndicator(totalSplitsLabel, 'Total', 'chart-bar', '#f97316')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  leansContainer: {
    gap: 12,
  },
  leanSection: {
    gap: 8,
  },
  leanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leanTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  leanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  leanCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leanInitials: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  leanText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  sharpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  sharpText: {
    fontSize: 12,
  },
});

