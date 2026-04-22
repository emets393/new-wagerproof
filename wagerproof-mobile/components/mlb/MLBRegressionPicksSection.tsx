import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useMLBRegressionReport, type SuggestedPick } from '@/hooks/useMLBRegressionReport';
import { useMLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import type { MLBGame } from '@/types/mlb';

type ModelPickSide = 'home' | 'away' | null;
type ModelDir = 'OVER' | 'UNDER' | null;
type Alignment = 'aligns' | 'contradicts' | 'unknown';

// Pick the side (home/away) the model favors for the given horizon, using the
// DB edge fields first and falling back to model win probability. Mirrors the
// selection logic in MLBGameBottomSheet so alignment matches what the user sees.
function modelMlPickSide(game: MLBGame, view: 'full' | 'f5'): ModelPickSide {
  const homeEdge = view === 'full' ? game.home_ml_edge_pct : game.f5_home_ml_edge_pct;
  const awayEdge = view === 'full' ? game.away_ml_edge_pct : game.f5_away_ml_edge_pct;
  if (homeEdge != null && awayEdge != null) {
    return homeEdge >= awayEdge ? 'home' : 'away';
  }
  const homeProb = view === 'full' ? game.ml_home_win_prob : game.f5_home_win_prob;
  const awayProb = view === 'full' ? game.ml_away_win_prob : game.f5_away_win_prob;
  if (homeProb != null && awayProb != null) {
    return homeProb >= awayProb ? 'home' : 'away';
  }
  return null;
}

function modelOuDir(game: MLBGame, view: 'full' | 'f5'): ModelDir {
  if (view === 'full') return game.ou_direction ?? null;
  const e = game.f5_ou_edge;
  return e != null ? (e >= 0 ? 'OVER' : 'UNDER') : null;
}

// Best-effort: figure out which side the report's ML pick is for by checking
// whether the pick text mentions the home or away team's name/abbrev.
function findPickedSide(pickText: string, game: MLBGame): ModelPickSide {
  const hay = pickText.toLowerCase();
  const candidates: Array<{ side: 'home' | 'away'; needle: string }> = [];
  if (game.home_team_name) candidates.push({ side: 'home', needle: game.home_team_name.toLowerCase() });
  if (game.home_team) candidates.push({ side: 'home', needle: String(game.home_team).toLowerCase() });
  if (game.home_abbr) candidates.push({ side: 'home', needle: game.home_abbr.toLowerCase() });
  if (game.away_team_name) candidates.push({ side: 'away', needle: game.away_team_name.toLowerCase() });
  if (game.away_team) candidates.push({ side: 'away', needle: String(game.away_team).toLowerCase() });
  if (game.away_abbr) candidates.push({ side: 'away', needle: game.away_abbr.toLowerCase() });
  // Longest-needle match wins so "Red Sox" beats "Red" (accidental substring).
  candidates.sort((a, b) => b.needle.length - a.needle.length);
  for (const { side, needle } of candidates) {
    if (needle && hay.includes(needle)) return side;
  }
  return null;
}

function computeAlignment(pick: SuggestedPick, game: MLBGame): Alignment {
  if (pick.bet_type === 'full_ml' || pick.bet_type === 'f5_ml') {
    const horizon = pick.bet_type === 'full_ml' ? 'full' : 'f5';
    const pickedSide = findPickedSide(pick.pick, game);
    const modelSide = modelMlPickSide(game, horizon);
    if (!pickedSide || !modelSide) return 'unknown';
    return pickedSide === modelSide ? 'aligns' : 'contradicts';
  }
  if (pick.bet_type === 'full_ou' || pick.bet_type === 'f5_ou') {
    const horizon = pick.bet_type === 'full_ou' ? 'full' : 'f5';
    const hay = pick.pick.toLowerCase();
    const isOver = hay.includes('over');
    const isUnder = hay.includes('under');
    if (!isOver && !isUnder) return 'unknown';
    const modelDir = modelOuDir(game, horizon);
    if (!modelDir) return 'unknown';
    const pickDir: ModelDir = isOver ? 'OVER' : 'UNDER';
    return pickDir === modelDir ? 'aligns' : 'contradicts';
  }
  return 'unknown';
}

const BET_TYPE_LABEL: Record<SuggestedPick['bet_type'], string> = {
  full_ml: 'Full Game · Moneyline',
  full_ou: 'Full Game · Total',
  f5_ml: '1st 5 · Moneyline',
  f5_ou: '1st 5 · Total',
};

export function MLBRegressionPicksSection({ game }: { game: MLBGame }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { data: report } = useMLBRegressionReport();
  const { data: bucketAccuracy } = useMLBBucketAccuracy();
  // Synthetic perfect_storm aggregate row — see
  // scripts/sql/refresh_perfect_storm_accuracy.sql for where it comes from.
  const perfectStormOverall = bucketAccuracy?.perfect_storm?.overall;

  if (!report || !game?.game_pk) return null;
  const picks = (report.suggested_picks || []).filter(p => p.game_pk === game.game_pk);
  if (picks.length === 0) return null;

  return (
    <View style={[
      styles.section,
      { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' },
    ]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={18} color="#a855f7" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Regression Report {picks.length > 1 ? 'Picks' : 'Pick'}
        </Text>
      </View>

      {picks.map((p, i) => {
        const alignment = computeAlignment(p, game);
        const alignmentStyle = alignment === 'aligns'
          ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', fg: '#22c55e', icon: 'check-circle' as const, label: 'Aligns with model' }
          : alignment === 'contradicts'
            ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', fg: '#ef4444', icon: 'close-circle' as const, label: 'Contradicts model' }
            : { bg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: isDark ? '#333' : '#ddd', fg: theme.colors.onSurfaceVariant, icon: 'help-circle' as const, label: 'Comparison unavailable' };

        const confColor = p.confidence_at_suggestion === 'high' ? '#22c55e' : '#f59e0b';

        return (
          <View
            key={`${p.bet_type}-${i}`}
            style={[
              styles.pickCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? '#333' : '#e0e0e0',
              },
            ]}
          >
            <View style={styles.pickHeader}>
              <Text style={[styles.betTypeLabel, { color: theme.colors.onSurfaceVariant }]}>
                {BET_TYPE_LABEL[p.bet_type]}
              </Text>
              <View style={[styles.confPill, { backgroundColor: `${confColor}22`, borderColor: confColor }]}>
                <Text style={{ color: confColor, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 }}>
                  {p.confidence_at_suggestion.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={[styles.pickText, { color: theme.colors.onSurface }]} numberOfLines={2}>
              {p.pick}
            </Text>

            <View style={[styles.alignmentRow, { backgroundColor: alignmentStyle.bg, borderColor: alignmentStyle.border }]}>
              <MaterialCommunityIcons name={alignmentStyle.icon} size={14} color={alignmentStyle.fg} />
              <Text style={[styles.alignmentText, { color: alignmentStyle.fg }]}>{alignmentStyle.label}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Edge</Text>
                <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
                  {p.edge_at_suggestion > 0 ? '+' : ''}{p.edge_at_suggestion}{p.bet_type.includes('ml') ? '%' : ''}
                </Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Bucket</Text>
                <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
                  {p.edge_bucket === 'perfect_storm' ? 'Perfect\nStorm' : p.edge_bucket}
                </Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Bucket W%</Text>
                {(p.edge_bucket || '').toLowerCase() === 'perfect_storm' ? (
                  perfectStormOverall && perfectStormOverall.games > 0 ? (
                    <Text style={[styles.statValue, { color: winColor(perfectStormOverall.win_pct) }]}>
                      {perfectStormOverall.win_pct}%
                    </Text>
                  ) : (
                    <Text style={[styles.statValue, { color: theme.colors.onSurfaceVariant }]}>N/A</Text>
                  )
                ) : (
                  <Text style={[styles.statValue, { color: winColor(p.bucket_win_pct) }]}>
                    {p.bucket_win_pct}%
                  </Text>
                )}
              </View>
            </View>

            {p.reasoning ? (
              <Text style={[styles.reasoning, { color: theme.colors.onSurfaceVariant }]}>
                {p.reasoning}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function winColor(pct: number): string {
  if (pct >= 65) return '#22c55e';
  if (pct >= 55) return '#eab308';
  if (pct >= 50) return '#f97316';
  return '#ef4444';
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  pickCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  pickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  betTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  confPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  pickText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  alignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  alignmentText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  reasoning: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },
});
