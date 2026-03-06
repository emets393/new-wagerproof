import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { GameAccuracyData, roundToNearestHalf, formatTipoffTime } from '@/types/modelAccuracy';
import { getCFBTeamColors } from '@/utils/teamColors';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useGameTeamColors } from '@/hooks/useImageColors';
import { TeamAvatar } from '../TeamAvatar';

interface Props {
  game: GameAccuracyData;
}

function getAccuracyColor(pct: number): string {
  if (pct >= 60) return '#00C853';
  if (pct >= 50) return '#FFD600';
  return '#FF5252';
}

export function NCAABModelAccuracyMatchupCard({ game }: Props) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const { awayColors, homeColors } = useGameTeamColors(
    game.awayTeamLogo || null,
    game.homeTeamLogo || null,
    getCFBTeamColors(game.awayTeam),
    getCFBTeamColors(game.homeTeam),
  );

  // Spread pick
  const homePredictedToCover = game.homeSpreadDiff != null && game.homeSpreadDiff > 0;
  const spreadPickAbbr = homePredictedToCover ? game.homeAbbr : game.awayAbbr;
  const spreadPickLine =
    game.homeSpread != null
      ? homePredictedToCover
        ? `${game.homeSpread > 0 ? '+' : ''}${game.homeSpread}`
        : `${-Number(game.homeSpread) > 0 ? '+' : ''}${-Number(game.homeSpread)}`
      : null;
  const spreadEdge =
    game.homeSpreadDiff != null ? `+${roundToNearestHalf(Math.abs(game.homeSpreadDiff))}` : null;

  // Moneyline pick
  const mlPickAbbr = game.mlPickIsHome ? game.homeAbbr : game.awayAbbr;
  const mlLabel =
    game.mlPickProbRounded != null
      ? `${mlPickAbbr} ${Math.round(game.mlPickProbRounded * 100)}%`
      : null;

  // O/U pick
  const ouDirection =
    game.overLineDiff != null && game.overLine != null
      ? game.overLineDiff > 0
        ? `Over ${game.overLine}`
        : `Under ${game.overLine}`
      : null;
  const ouEdge =
    game.overLineDiff != null ? `+${roundToNearestHalf(Math.abs(game.overLineDiff))}` : null;

  const sectionBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const sectionBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const mutedText = theme.colors.onSurfaceVariant;

  const renderAccuracyRow = (acc: { games: number; accuracy_pct: number } | null) => {
    if (!acc) return <Text style={[styles.valueText, { color: mutedText }]}>{'\u2014'}</Text>;
    const color = getAccuracyColor(acc.accuracy_pct);
    return (
      <Text style={[styles.valueText, { color }]}>
        {acc.accuracy_pct.toFixed(1)}% <Text style={{ color: mutedText, fontSize: 11 }}>(n={acc.games})</Text>
      </Text>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
      {/* Team color stripe */}
      <LinearGradient
        colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientStripe}
      />

      {/* Header: teams + time */}
      <View style={styles.header}>
        <View style={styles.teamRow}>
          <TeamAvatar
            teamName={game.awayTeam}
            sport="ncaab"
            size={32}
            teamAbbr={game.awayAbbr}
            {...(game.awayTeamLogo ? { logoUrl: game.awayTeamLogo } : {})}
          />
          <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>{game.awayAbbr}</Text>
          <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
          <TeamAvatar
            teamName={game.homeTeam}
            sport="ncaab"
            size={32}
            teamAbbr={game.homeAbbr}
            {...(game.homeTeamLogo ? { logoUrl: game.homeTeamLogo } : {})}
          />
          <Text style={[styles.teamAbbr, { color: theme.colors.onSurface }]}>{game.homeAbbr}</Text>
        </View>
        <Text style={[styles.timeText, { color: mutedText }]}>
          {formatTipoffTime(game.tipoffTime, game.gameDate)}
        </Text>
      </View>

      {/* Spread */}
      <View style={[styles.section, { backgroundColor: sectionBg, borderColor: sectionBorder }]}>
        <View style={styles.sectionRow}>
          <Text style={[styles.labelText, { color: mutedText }]}>Spread</Text>
          <Text style={[styles.valueText, { color: theme.colors.onSurface }]}>
            {spreadPickLine != null ? `${spreadPickAbbr} ${spreadPickLine}` : '\u2014'}
            {spreadEdge ? <Text style={{ color: mutedText, fontSize: 11 }}> (edge {spreadEdge})</Text> : null}
          </Text>
        </View>
        <View style={styles.sectionRow}>
          <Text style={[styles.labelText, { color: mutedText }]}>Accuracy</Text>
          {renderAccuracyRow(game.spreadAccuracy)}
        </View>
      </View>

      {/* Moneyline */}
      <View style={[styles.section, { backgroundColor: sectionBg, borderColor: sectionBorder }]}>
        <View style={styles.sectionRow}>
          <Text style={[styles.labelText, { color: mutedText }]}>ML Win Prob</Text>
          <Text style={[styles.valueText, { color: theme.colors.onSurface }]}>
            {mlLabel || '\u2014'}
          </Text>
        </View>
        <View style={styles.sectionRow}>
          <Text style={[styles.labelText, { color: mutedText }]}>Accuracy</Text>
          {renderAccuracyRow(game.mlAccuracy)}
        </View>
      </View>

      {/* Over/Under */}
      <View style={[styles.section, { backgroundColor: sectionBg, borderColor: sectionBorder, marginBottom: 0 }]}>
        <View style={styles.sectionRow}>
          <Text style={[styles.labelText, { color: mutedText }]}>Over/Under</Text>
          <Text style={[styles.valueText, { color: theme.colors.onSurface }]}>
            {ouDirection || '\u2014'}
            {ouEdge ? <Text style={{ color: mutedText, fontSize: 11 }}> (edge {ouEdge})</Text> : null}
          </Text>
        </View>
        <View style={styles.sectionRow}>
          <Text style={[styles.labelText, { color: mutedText }]}>Accuracy</Text>
          {renderAccuracyRow(game.ouAccuracy)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingBottom: 14,
  },
  gradientStripe: {
    height: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamAbbr: {
    fontSize: 13,
    fontWeight: '700',
  },
  atSymbol: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
