import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { TeamAvatar } from '@/components/TeamAvatar';

// Mock details data
const MOCK_DETAILS = {
  away_team: 'Los Angeles Lakers',
  away_abbr: 'LAL',
  home_team: 'Boston Celtics',
  home_abbr: 'BOS',
  away_spread: 4.5,
  home_spread: -4.5,
  away_ml: '+165',
  home_ml: '-195',
  modelEdge: 2.3,
  modelSpread: -6.8,
  vegasSpread: -4.5,
  publicHome: 62,
  publicAway: 38,
};

// Team colors (simplified)
const LAKERS_COLORS = { primary: '#552583', secondary: '#FDB927' };
const CELTICS_COLORS = { primary: '#007A33', secondary: '#BA9653' };

export function Slide2_GameDetails() {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  return (
    <View style={styles.container}>
      {/* Mini bottom sheet mockup */}
      <View style={[styles.sheetMockup, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' }]} />

        {/* Team gradient header */}
        <LinearGradient
          colors={[`${LAKERS_COLORS.primary}40`, 'transparent', `${CELTICS_COLORS.primary}40`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.teamsRow}>
            <View style={styles.teamCol}>
              <TeamAvatar teamName={MOCK_DETAILS.away_team} sport="nba" size={40} />
              <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>
                {MOCK_DETAILS.away_abbr}
              </Text>
              <Text style={[styles.lineText, { color: theme.colors.onSurfaceVariant }]}>
                +{MOCK_DETAILS.away_spread} | {MOCK_DETAILS.away_ml}
              </Text>
            </View>

            <View style={styles.vsCol}>
              <View style={[styles.atBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <MaterialCommunityIcons name="at" size={16} color={theme.colors.onSurfaceVariant} />
              </View>
            </View>

            <View style={styles.teamCol}>
              <TeamAvatar teamName={MOCK_DETAILS.home_team} sport="nba" size={40} />
              <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>
                {MOCK_DETAILS.home_abbr}
              </Text>
              <Text style={[styles.lineText, { color: theme.colors.onSurfaceVariant }]}>
                {MOCK_DETAILS.home_spread} | {MOCK_DETAILS.home_ml}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Model prediction section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="brain" size={14} color="#22c55e" />
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Model Prediction
            </Text>
          </View>
          <View style={[styles.predictionBox, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
            <View style={styles.predictionRow}>
              <Text style={[styles.predLabel, { color: theme.colors.onSurfaceVariant }]}>
                Vegas Spread:
              </Text>
              <Text style={[styles.predValue, { color: theme.colors.onSurface }]}>
                BOS {MOCK_DETAILS.vegasSpread}
              </Text>
            </View>
            <View style={styles.predictionRow}>
              <Text style={[styles.predLabel, { color: theme.colors.onSurfaceVariant }]}>
                Model Spread:
              </Text>
              <Text style={[styles.predValue, { color: theme.colors.onSurface }]}>
                BOS {MOCK_DETAILS.modelSpread}
              </Text>
            </View>
            <View style={styles.predictionRow}>
              <Text style={[styles.predLabel, { color: theme.colors.onSurfaceVariant }]}>
                Edge:
              </Text>
              <Text style={[styles.predValue, { color: '#22c55e', fontWeight: '700' }]}>
                +{MOCK_DETAILS.modelEdge} to BOS
              </Text>
            </View>
          </View>
        </View>

        {/* Public betting section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="account-group" size={14} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Public Betting
            </Text>
          </View>
          <View style={styles.publicBettingBar}>
            <View style={[styles.publicLeft, { flex: MOCK_DETAILS.publicAway }]}>
              <Text style={styles.publicPercent}>{MOCK_DETAILS.publicAway}%</Text>
            </View>
            <View style={[styles.publicRight, { flex: MOCK_DETAILS.publicHome }]}>
              <Text style={styles.publicPercent}>{MOCK_DETAILS.publicHome}%</Text>
            </View>
          </View>
          <View style={styles.publicLabels}>
            <Text style={[styles.publicTeam, { color: theme.colors.onSurfaceVariant }]}>
              {MOCK_DETAILS.away_abbr}
            </Text>
            <Text style={[styles.publicTeam, { color: theme.colors.onSurfaceVariant }]}>
              {MOCK_DETAILS.home_abbr}
            </Text>
          </View>
        </View>
      </View>

      {/* Callouts */}
      <View style={styles.calloutsContainer}>
        <View style={styles.callout}>
          <MaterialCommunityIcons name="hand-pointing-up" size={14} color={theme.colors.primary} />
          <Text style={[styles.calloutText, { color: theme.colors.onSurfaceVariant }]}>
            Tap any game card to view full analysis
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  sheetMockup: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  headerGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamCol: {
    alignItems: 'center',
    flex: 1,
  },
  vsCol: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  atBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamAbbr: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  lineText: {
    fontSize: 10,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  predictionBox: {
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  predLabel: {
    fontSize: 11,
  },
  predValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  publicBettingBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  publicLeft: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicRight: {
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicPercent: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  publicLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  publicTeam: {
    fontSize: 10,
    fontWeight: '600',
  },
  calloutsContainer: {
    marginTop: 16,
    gap: 8,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calloutText: {
    fontSize: 12,
  },
});
