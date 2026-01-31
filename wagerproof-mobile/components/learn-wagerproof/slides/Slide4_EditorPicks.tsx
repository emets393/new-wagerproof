import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { TeamAvatar } from '@/components/TeamAvatar';

// Mock picks data
const MOCK_PICKS = [
  {
    sport: 'nfl' as const,
    away_team: 'Kansas City Chiefs',
    home_team: 'Buffalo Bills',
    pick: 'Chiefs -3.5',
    result: 'won',
    net: '+1.8u',
  },
  {
    sport: 'nba' as const,
    away_team: 'Los Angeles Lakers',
    home_team: 'Boston Celtics',
    pick: 'Lakers ML',
    result: 'pending',
    units: '2u',
  },
  {
    sport: 'cfb' as const,
    away_team: 'Ohio State Buckeyes',
    home_team: 'Michigan Wolverines',
    pick: 'Over 52.5',
    result: 'lost',
    net: '-1.0u',
  },
  {
    sport: 'ncaab' as const,
    away_team: 'Duke Blue Devils',
    home_team: 'North Carolina Tar Heels',
    pick: 'Duke -7',
    result: 'won',
    net: '+0.9u',
  },
];

const RESULT_COLORS = {
  won: '#22c55e',
  lost: '#ef4444',
  pending: '#6b7280',
  push: '#eab308',
};

const SPORT_LABELS: Record<string, string> = {
  nfl: 'NFL',
  nba: 'NBA',
  cfb: 'CFB',
  ncaab: 'NCAAB',
};

function MiniPickCard({ pick }: { pick: typeof MOCK_PICKS[0] }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const resultColor = RESULT_COLORS[pick.result as keyof typeof RESULT_COLORS];

  return (
    <View style={[styles.pickCard, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: resultColor }]} />

      {/* Content */}
      <View style={styles.pickContent}>
        {/* Top row - teams and sport */}
        <View style={styles.teamsRow}>
          <View style={styles.teamAvatars}>
            <TeamAvatar teamName={pick.away_team} sport={pick.sport} size={24} />
            <View style={styles.avatarOverlap}>
              <TeamAvatar teamName={pick.home_team} sport={pick.sport} size={24} />
            </View>
          </View>
          <View style={[styles.sportBadge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
            <Text style={[styles.sportText, { color: theme.colors.onSurfaceVariant }]}>
              {SPORT_LABELS[pick.sport]}
            </Text>
          </View>
        </View>

        {/* Bottom row - pick and result */}
        <View style={styles.pickInfoRow}>
          <Text style={[styles.pickText, { color: theme.colors.onSurface }]}>
            {pick.pick}
          </Text>
          <View style={styles.resultContainer}>
            <View style={[styles.resultBadge, { backgroundColor: `${resultColor}20` }]}>
              <Text style={[styles.resultText, { color: resultColor }]}>
                {pick.result === 'won' ? 'WIN' : pick.result === 'lost' ? 'LOSS' : 'Pending'}
              </Text>
            </View>
            {pick.result !== 'pending' && (
              <Text style={[styles.unitsText, { color: pick.result === 'won' ? '#22c55e' : '#ef4444' }]}>
                {pick.net}
              </Text>
            )}
            {pick.result === 'pending' && (
              <Text style={[styles.unitsText, { color: theme.colors.onSurfaceVariant }]}>
                {pick.units}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export function Slide4_EditorPicks() {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  return (
    <View style={styles.container}>
      {/* Picks list */}
      <View style={styles.picksContainer}>
        {MOCK_PICKS.map((pick, idx) => (
          <MiniPickCard key={idx} pick={pick} />
        ))}
      </View>

      {/* Summary stats */}
      <View style={[styles.summaryContainer, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>2-1</Text>
          <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Record</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>+1.7u</Text>
          <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Net Units</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>66.7%</Text>
          <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Win Rate</Text>
        </View>
      </View>

      {/* Callout */}
      <View style={styles.callout}>
        <MaterialCommunityIcons name="check-decagram" size={14} color="#22c55e" />
        <Text style={[styles.calloutText, { color: theme.colors.onSurfaceVariant }]}>
          Full transparency on all pick results
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  picksContainer: {
    gap: 8,
  },
  pickCard: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  accentBar: {
    width: 4,
  },
  pickContent: {
    flex: 1,
    padding: 10,
    gap: 6,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  sportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sportText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pickInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resultText: {
    fontSize: 10,
    fontWeight: '700',
  },
  unitsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center',
  },
  calloutText: {
    fontSize: 12,
  },
});
