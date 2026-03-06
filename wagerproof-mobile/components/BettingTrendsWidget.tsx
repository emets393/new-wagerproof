import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { parseRecord, formatSituation, SituationalTrendRow } from '@/types/nbaBettingTrends';
import { parseNCAABRecord, formatNCAABSituation, NCAABSituationalTrendRow } from '@/types/ncaabBettingTrends';

interface BettingTrendsWidgetProps {
  awayAbbr: string;
  homeAbbr: string;
  awayTeam: SituationalTrendRow | NCAABSituationalTrendRow;
  homeTeam: SituationalTrendRow | NCAABSituationalTrendRow;
  isLoading?: boolean;
  sport: 'nba' | 'ncaab';
}

function getATSColor(pct: number | null): string {
  if (pct === null) return '#9ca3af';
  if (pct >= 55) return '#22c55e';
  if (pct >= 45) return '#eab308';
  return '#ef4444';
}

function getOUColor(overPct: number | null, underPct: number | null): { color: string; label: string } {
  if (overPct === null && underPct === null) return { color: '#9ca3af', label: '-' };
  const over = overPct ?? 0;
  const under = underPct ?? 0;
  if (over > under) {
    return { color: over >= 55 ? '#22c55e' : '#eab308', label: `O ${over.toFixed(0)}%` };
  }
  return { color: under >= 55 ? '#ef4444' : '#eab308', label: `U ${under.toFixed(0)}%` };
}

interface SituationData {
  label: string;
  awayAtsRecord: string;
  awayAtsPct: number | null;
  homeAtsRecord: string;
  homeAtsPct: number | null;
  awayOUOverPct: number | null;
  awayOUUnderPct: number | null;
  homeOUOverPct: number | null;
  homeOUUnderPct: number | null;
}

function extractSituations(
  away: SituationalTrendRow | NCAABSituationalTrendRow,
  home: SituationalTrendRow | NCAABSituationalTrendRow,
  sport: 'nba' | 'ncaab',
): SituationData[] {
  const fmt = sport === 'nba' ? formatSituation : formatNCAABSituation;

  return [
    {
      label: fmt(away.last_game_situation),
      awayAtsRecord: away.ats_last_game_record,
      awayAtsPct: away.ats_last_game_cover_pct,
      homeAtsRecord: home.ats_last_game_record,
      homeAtsPct: home.ats_last_game_cover_pct,
      awayOUOverPct: away.ou_last_game_over_pct,
      awayOUUnderPct: away.ou_last_game_under_pct,
      homeOUOverPct: home.ou_last_game_over_pct,
      homeOUUnderPct: home.ou_last_game_under_pct,
    },
    {
      label: fmt(away.fav_dog_situation),
      awayAtsRecord: away.ats_fav_dog_record,
      awayAtsPct: away.ats_fav_dog_cover_pct,
      homeAtsRecord: home.ats_fav_dog_record,
      homeAtsPct: home.ats_fav_dog_cover_pct,
      awayOUOverPct: away.ou_fav_dog_over_pct,
      awayOUUnderPct: away.ou_fav_dog_under_pct,
      homeOUOverPct: home.ou_fav_dog_over_pct,
      homeOUUnderPct: home.ou_fav_dog_under_pct,
    },
    {
      label: fmt(away.side_spread_situation),
      awayAtsRecord: away.ats_side_fav_dog_record,
      awayAtsPct: away.ats_side_fav_dog_cover_pct,
      homeAtsRecord: home.ats_side_fav_dog_record,
      homeAtsPct: home.ats_side_fav_dog_cover_pct,
      awayOUOverPct: away.ou_side_fav_dog_over_pct,
      awayOUUnderPct: away.ou_side_fav_dog_under_pct,
      homeOUOverPct: home.ou_side_fav_dog_over_pct,
      homeOUUnderPct: home.ou_side_fav_dog_under_pct,
    },
    {
      label: fmt(away.rest_bucket),
      awayAtsRecord: away.ats_rest_bucket_record,
      awayAtsPct: away.ats_rest_bucket_cover_pct,
      homeAtsRecord: home.ats_rest_bucket_record,
      homeAtsPct: home.ats_rest_bucket_cover_pct,
      awayOUOverPct: away.ou_rest_bucket_over_pct,
      awayOUUnderPct: away.ou_rest_bucket_under_pct,
      homeOUOverPct: home.ou_rest_bucket_over_pct,
      homeOUUnderPct: home.ou_rest_bucket_under_pct,
    },
    {
      label: fmt(away.rest_comp),
      awayAtsRecord: away.ats_rest_comp_record,
      awayAtsPct: away.ats_rest_comp_cover_pct,
      homeAtsRecord: home.ats_rest_comp_record,
      homeAtsPct: home.ats_rest_comp_cover_pct,
      awayOUOverPct: away.ou_rest_comp_over_pct,
      awayOUUnderPct: away.ou_rest_comp_under_pct,
      homeOUOverPct: home.ou_rest_comp_over_pct,
      homeOUUnderPct: home.ou_rest_comp_under_pct,
    },
  ];
}

export function BettingTrendsWidget({
  awayAbbr,
  homeAbbr,
  awayTeam,
  homeTeam,
  isLoading,
  sport,
}: BettingTrendsWidgetProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const parse = sport === 'nba' ? parseRecord : parseNCAABRecord;

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="trending-up" size={20} color="#8b5cf6" />
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Betting Trends</Text>
          </View>
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 12 }} />
        </View>
      </View>
    );
  }

  const situations = extractSituations(awayTeam, homeTeam, sport);

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="trending-up" size={20} color="#8b5cf6" />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Betting Trends</Text>
        </View>

        {/* ATS Section */}
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>ATS Records</Text>
        <View style={[styles.tableContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.situationCol, styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>Situation</Text>
            <Text style={[styles.teamCol, styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>{awayAbbr}</Text>
            <Text style={[styles.teamCol, styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>{homeAbbr}</Text>
          </View>
          {situations.map((s, i) => {
            const awayParsed = parse(s.awayAtsRecord);
            const homeParsed = parse(s.homeAtsRecord);
            if (awayParsed.total < 3 && homeParsed.total < 3) return null;
            return (
              <View key={`ats-${i}`} style={styles.tableRow}>
                <Text style={[styles.situationCol, styles.situationText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                  {s.label}
                </Text>
                <View style={styles.teamCol}>
                  <Text style={[styles.recordText, { color: getATSColor(s.awayAtsPct) }]}>
                    {s.awayAtsRecord || '-'}
                  </Text>
                  {s.awayAtsPct !== null && (
                    <Text style={[styles.pctText, { color: getATSColor(s.awayAtsPct) }]}>
                      {s.awayAtsPct.toFixed(0)}%
                    </Text>
                  )}
                </View>
                <View style={styles.teamCol}>
                  <Text style={[styles.recordText, { color: getATSColor(s.homeAtsPct) }]}>
                    {s.homeAtsRecord || '-'}
                  </Text>
                  {s.homeAtsPct !== null && (
                    <Text style={[styles.pctText, { color: getATSColor(s.homeAtsPct) }]}>
                      {s.homeAtsPct.toFixed(0)}%
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* O/U Section */}
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant, marginTop: 12 }]}>O/U Trends</Text>
        <View style={[styles.tableContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.situationCol, styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>Situation</Text>
            <Text style={[styles.teamCol, styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>{awayAbbr}</Text>
            <Text style={[styles.teamCol, styles.tableHeaderText, { color: theme.colors.onSurfaceVariant }]}>{homeAbbr}</Text>
          </View>
          {situations.map((s, i) => {
            const awayOU = getOUColor(s.awayOUOverPct, s.awayOUUnderPct);
            const homeOU = getOUColor(s.homeOUOverPct, s.homeOUUnderPct);
            return (
              <View key={`ou-${i}`} style={styles.tableRow}>
                <Text style={[styles.situationCol, styles.situationText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                  {s.label}
                </Text>
                <View style={styles.teamCol}>
                  <Text style={[styles.ouText, { color: awayOU.color }]}>{awayOU.label}</Text>
                </View>
                <View style={styles.teamCol}>
                  <Text style={[styles.ouText, { color: homeOU.color }]}>{homeOU.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden', marginBottom: 12 },
  content: { padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  tableContainer: { borderRadius: 8, padding: 8, gap: 4 },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  situationCol: { flex: 2 },
  teamCol: { flex: 1, alignItems: 'center' },
  tableHeaderText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  situationText: { fontSize: 11, fontWeight: '500' },
  recordText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  pctText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  ouText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
