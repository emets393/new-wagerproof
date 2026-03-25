import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  MLBGame,
  getFullGameRuns,
  getF5Runs,
  isOfficialDateToday,
  formatMoneyline,
  formatSpread,
  formatMLBDateLabel,
  formatMLBGameTime,
  getSignalSeverityColor,
  getSignalCategoryIcon,
} from '@/types/mlb';
import { useMLBGameSheet } from '@/contexts/MLBGameSheetContext';
import { getMLBTeamColors } from '@/constants/mlbTeams';
import { useThemeContext } from '@/contexts/ThemeContext';
import { PolymarketWidget } from './PolymarketWidget';

type ProjectionView = 'full' | 'f5';

export function MLBGameBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { selectedGame: game, closeGameSheet, bottomSheetRef } = useMLBGameSheet();
  const snapPoints = useMemo(() => ['85%', '95%'], []);
  const [projView, setProjView] = useState<ProjectionView>('full');
  const [mlExpanded, setSpreadExpanded] = useState(false);
  const [ouExpanded, setOuExpanded] = useState(false);

  // Reset state when game changes
  useEffect(() => {
    setProjView('full');
    setSpreadExpanded(false);
    setOuExpanded(false);
  }, [game?.game_pk]);

  const awayName = game?.away_team_name || game?.away_team || 'Away';
  const homeName = game?.home_team_name || game?.home_team || 'Home';
  const awayColors = game ? getMLBTeamColors(awayName) : { primary: '#333', secondary: '#666' };
  const homeColors = game ? getMLBTeamColors(homeName) : { primary: '#333', secondary: '#666' };

  // Derived projected runs
  const fullRuns = game ? getFullGameRuns(game) : null;
  const f5Runs = game ? getF5Runs(game) : null;
  const activeRuns = projView === 'full' ? fullRuns : f5Runs;

  // ML pick
  const mlPickSide = game && game.ml_home_win_prob !== null && game.ml_away_win_prob !== null
    ? (game.ml_home_win_prob >= game.ml_away_win_prob ? 'home' : 'away')
    : null;
  const mlPickProb = mlPickSide === 'home' ? game?.ml_home_win_prob : game?.ml_away_win_prob;
  const mlPickEdge = mlPickSide === 'home' ? game?.home_ml_edge_pct : game?.away_ml_edge_pct;
  const mlPickStrong = mlPickSide === 'home' ? game?.home_ml_strong_signal : game?.away_ml_strong_signal;

  // O/U
  const ouDirection = game?.ou_direction;
  const ouEdge = game?.ou_edge !== null && game?.ou_edge !== undefined ? Math.abs(game.ou_edge) : null;
  const ouConfLabel = game?.ou_strong_signal ? 'Strong' : game?.ou_moderate_signal ? 'Moderate' : 'Weak';
  const ouConfColor = game?.ou_strong_signal ? '#22c55e' : game?.ou_moderate_signal ? '#84cc16' : '#eab308';

  // Signals
  const showSignals = game ? isOfficialDateToday(game.official_date) : false;
  const signals = game?.signals || [];

  // Postponed game
  if (game && game.is_postponed) {
    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={closeGameSheet}
        backgroundStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#555' : '#ccc' }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
        )}
      >
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.section, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {game.away_abbr} @ {game.home_abbr}
            </Text>
            <View style={[styles.postponedBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <MaterialCommunityIcons name="calendar-remove" size={16} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14 }}>Postponed</Text>
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={closeGameSheet}
      backgroundStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: isDark ? '#555' : '#ccc' }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
      )}
    >
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        {game && (
          <>
            {/* Header Card */}
            <View style={[styles.section, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' }]}>
              {/* Date / Time / Status */}
              <View style={styles.headerTopRow}>
                <Text style={[styles.headerDate, { color: theme.colors.onSurface }]}>
                  {formatMLBDateLabel(game.official_date)}
                </Text>
                <View style={[styles.headerTimeBadge, { backgroundColor: isDark ? '#333' : '#e0e0e0' }]}>
                  <Text style={[styles.headerTimeText, { color: theme.colors.onSurfaceVariant }]}>
                    {formatMLBGameTime(game.game_time_et)}
                  </Text>
                </View>
                {game.is_final_prediction !== null && (
                  <View style={[styles.predBadge, {
                    backgroundColor: game.is_final_prediction ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    borderColor: game.is_final_prediction ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                  }]}>
                    {game.is_final_prediction && <MaterialCommunityIcons name="lock" size={10} color="#22c55e" />}
                    <Text style={{ color: game.is_final_prediction ? '#22c55e' : '#f59e0b', fontSize: 10, fontWeight: '700' }}>
                      {game.is_final_prediction ? 'Final' : 'Preliminary'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Teams Matchup */}
              <View style={styles.matchupRow}>
                <View style={styles.matchupTeam}>
                  <TeamLogoLarge logoUrl={game.away_logo_url} abbrev={game.away_abbr} colors={awayColors} />
                  <Text style={[styles.matchupAbbrev, { color: theme.colors.onSurface }]}>{game.away_abbr}</Text>
                  <Text style={[styles.matchupName, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>{awayName}</Text>
                </View>

                <View style={styles.matchupCenter}>
                  <View style={styles.linesColumn}>
                    <Text style={[styles.lineLabel, { color: theme.colors.onSurfaceVariant }]}>ML</Text>
                    <Text style={[styles.lineValue, { color: theme.colors.onSurface }]}>
                      {formatMoneyline(game.away_ml)} / {formatMoneyline(game.home_ml)}
                    </Text>
                  </View>
                  <View style={styles.linesColumn}>
                    <Text style={[styles.lineLabel, { color: theme.colors.onSurfaceVariant }]}>Spread</Text>
                    <Text style={[styles.lineValue, { color: theme.colors.onSurface }]}>
                      {formatSpread(game.away_spread)} / {formatSpread(game.home_spread)}
                    </Text>
                  </View>
                  <View style={styles.linesColumn}>
                    <Text style={[styles.lineLabel, { color: theme.colors.onSurfaceVariant }]}>O/U</Text>
                    <Text style={[styles.lineValue, { color: theme.colors.onSurface }]}>
                      {game.total_line ?? '-'}
                    </Text>
                  </View>
                </View>

                <View style={styles.matchupTeam}>
                  <TeamLogoLarge logoUrl={game.home_logo_url} abbrev={game.home_abbr} colors={homeColors} />
                  <Text style={[styles.matchupAbbrev, { color: theme.colors.onSurface }]}>{game.home_abbr}</Text>
                  <Text style={[styles.matchupName, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>{homeName}</Text>
                </View>
              </View>

              {/* Starting Pitchers */}
              {(game.away_sp_name || game.home_sp_name) && (
                <View style={styles.spRow}>
                  <View style={styles.spItem}>
                    <Text style={[styles.spLabel, { color: theme.colors.onSurfaceVariant }]}>SP</Text>
                    <Text style={[styles.spName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                      {game.away_sp_name || 'TBD'}
                    </Text>
                    <Text style={[styles.spStatus, { color: game.away_sp_confirmed ? '#22c55e' : '#f59e0b' }]}>
                      {game.away_sp_confirmed ? '\u2713' : 'TBD'}
                    </Text>
                  </View>
                  <View style={styles.spItem}>
                    <Text style={[styles.spLabel, { color: theme.colors.onSurfaceVariant }]}>SP</Text>
                    <Text style={[styles.spName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                      {game.home_sp_name || 'TBD'}
                    </Text>
                    <Text style={[styles.spStatus, { color: game.home_sp_confirmed ? '#22c55e' : '#f59e0b' }]}>
                      {game.home_sp_confirmed ? '\u2713' : 'TBD'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Projected Score with Full Game / 1st 5 toggle */}
            {(fullRuns || f5Runs) && (
              <View style={[styles.section, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' }]}>
                <View style={styles.projHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Projected Score</Text>
                  <View style={styles.projToggle}>
                    <TouchableOpacity
                      onPress={() => { setProjView('full'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={[styles.projToggleBtn, projView === 'full' && { backgroundColor: theme.colors.primary }]}
                    >
                      <Text style={[styles.projToggleText, { color: projView === 'full' ? '#fff' : theme.colors.onSurfaceVariant }]}>
                        Full Game
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setProjView('f5'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={[styles.projToggleBtn, projView === 'f5' && { backgroundColor: theme.colors.primary }]}
                    >
                      <Text style={[styles.projToggleText, { color: projView === 'f5' ? '#fff' : theme.colors.onSurfaceVariant }]}>
                        1st 5
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {activeRuns ? (
                  <View style={styles.projScoreRow}>
                    <View style={styles.projScoreTeam}>
                      <TeamLogoLarge logoUrl={game.away_logo_url} abbrev={game.away_abbr} colors={awayColors} size={36} />
                      <Text style={[styles.projScoreValue, { color: theme.colors.onSurface }]}>
                        {activeRuns.away.toFixed(1)}
                      </Text>
                    </View>
                    <Text style={[styles.projScoreDash, { color: theme.colors.onSurfaceVariant }]}>-</Text>
                    <View style={styles.projScoreTeam}>
                      <Text style={[styles.projScoreValue, { color: theme.colors.onSurface }]}>
                        {activeRuns.home.toFixed(1)}
                      </Text>
                      <TeamLogoLarge logoUrl={game.home_logo_url} abbrev={game.home_abbr} colors={homeColors} size={36} />
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.projUnavailable, { color: theme.colors.onSurfaceVariant }]}>
                    Projection unavailable for {projView === 'full' ? 'full game' : '1st 5'}
                  </Text>
                )}
              </View>
            )}

            {/* ML Projection */}
            {mlPickSide !== null && mlPickProb !== null && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { setSpreadExpanded(!mlExpanded); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <View style={[styles.section, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' }]}>
                  <View style={styles.projectionHeader}>
                    <MaterialCommunityIcons name="baseball" size={18} color={theme.colors.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Moneyline Projection</Text>
                    <MaterialCommunityIcons name={mlExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.onSurfaceVariant} />
                  </View>
                  <View style={styles.projectionRow}>
                    <TeamLogoLarge
                      logoUrl={mlPickSide === 'home' ? game.home_logo_url : game.away_logo_url}
                      abbrev={mlPickSide === 'home' ? game.home_abbr : game.away_abbr}
                      colors={mlPickSide === 'home' ? homeColors : awayColors}
                      size={32}
                    />
                    <View style={styles.projectionInfo}>
                      <Text style={[styles.projectionPick, { color: theme.colors.onSurface }]}>
                        {mlPickSide === 'home' ? game.home_abbr : game.away_abbr} ML
                      </Text>
                      <Text style={[styles.projectionProb, { color: mlPickStrong ? '#22c55e' : '#eab308' }]}>
                        {(mlPickProb * 100).toFixed(1)}% win prob
                      </Text>
                    </View>
                    {mlPickEdge !== null && mlPickEdge !== undefined && (
                      <View style={[styles.edgeBadge, { backgroundColor: mlPickStrong ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)' }]}>
                        <Text style={[styles.edgeText, { color: mlPickStrong ? '#22c55e' : '#eab308' }]}>
                          +{Math.abs(mlPickEdge).toFixed(1)}% edge
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.confBadge, { backgroundColor: mlPickStrong ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)' }]}>
                    <Text style={{ color: mlPickStrong ? '#22c55e' : '#eab308', fontSize: 11, fontWeight: '600' }}>
                      {mlPickStrong ? 'Strong' : 'Weak'} Signal
                    </Text>
                  </View>
                  {mlExpanded && (
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                      The model gives {mlPickSide === 'home' ? game.home_abbr : game.away_abbr} a {(mlPickProb * 100).toFixed(1)}% chance to win
                      {mlPickEdge !== null && mlPickEdge !== undefined ? `, representing a +${Math.abs(mlPickEdge).toFixed(1)}% edge over the implied market probability.` : '.'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* O/U Projection */}
            {ouDirection !== null && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { setOuExpanded(!ouExpanded); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <View style={[styles.section, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' }]}>
                  <View style={styles.projectionHeader}>
                    <MaterialCommunityIcons
                      name={ouDirection === 'OVER' ? 'arrow-up-bold' : 'arrow-down-bold'}
                      size={18}
                      color={ouDirection === 'OVER' ? '#22c55e' : '#ef4444'}
                    />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Total Projection</Text>
                    <MaterialCommunityIcons name={ouExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.onSurfaceVariant} />
                  </View>
                  <View style={styles.projectionRow}>
                    <View style={[styles.ouCircle, { backgroundColor: ouDirection === 'OVER' ? '#22c55e' : '#ef4444' }]}>
                      <MaterialCommunityIcons
                        name={ouDirection === 'OVER' ? 'arrow-up' : 'arrow-down'}
                        size={20}
                        color="#fff"
                      />
                    </View>
                    <View style={styles.projectionInfo}>
                      <Text style={[styles.projectionPick, { color: theme.colors.onSurface }]}>
                        {ouDirection === 'OVER' ? 'Over' : 'Under'} {game.total_line ?? ''}
                      </Text>
                      {game.ou_fair_total !== null && game.ou_fair_total !== undefined && (
                        <Text style={[styles.projectionProb, { color: theme.colors.onSurfaceVariant }]}>
                          Fair total: {game.ou_fair_total.toFixed(1)}
                        </Text>
                      )}
                    </View>
                    {ouEdge !== null && (
                      <View style={[styles.edgeBadge, { backgroundColor: `${ouConfColor}20` }]}>
                        <Text style={[styles.edgeText, { color: ouConfColor }]}>
                          +{ouEdge.toFixed(1)}% edge
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.confBadge, { backgroundColor: `${ouConfColor}15` }]}>
                    <Text style={{ color: ouConfColor, fontSize: 11, fontWeight: '600' }}>
                      {ouConfLabel} Signal
                    </Text>
                  </View>
                  {ouExpanded && (
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                      The model projects a fair total of {game.ou_fair_total?.toFixed(1) ?? 'N/A'} vs the market line of {game.total_line ?? 'N/A'}, suggesting the {ouDirection === 'OVER' ? 'Over' : 'Under'}.
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Signals (today's games only) */}
            {showSignals && (
              <View style={[styles.section, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' }]}>
                <View style={styles.projectionHeader}>
                  <MaterialCommunityIcons name="signal-variant" size={18} color={theme.colors.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Game Signals</Text>
                </View>
                {signals.length > 0 ? (
                  <View style={styles.signalsList}>
                    {signals.map((sig, idx) => {
                      const sevColor = getSignalSeverityColor(sig.severity);
                      const iconName = getSignalCategoryIcon(sig.category);
                      return (
                        <View key={idx} style={[styles.signalPill, { backgroundColor: sevColor.bg, borderColor: sevColor.border }]}>
                          <MaterialCommunityIcons name={iconName as any} size={14} color={sevColor.text} />
                          <Text style={[styles.signalText, { color: isDark ? '#e2e8ec' : '#1f2937' }]}>{sig.message}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.signalEmpty, { color: theme.colors.onSurfaceVariant }]}>
                    No supplemental betting signals for this matchup right now. Your projections and edges above are the same full model outputs — this block only adds extra situational or trend context when our system surfaces it.
                  </Text>
                )}
              </View>
            )}

            {/* Weather */}
            {game.temperature_f !== null && game.temperature_f !== undefined && (
              <View style={[styles.section, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' }]}>
                <View style={styles.projectionHeader}>
                  <MaterialCommunityIcons name="weather-partly-cloudy" size={18} color={theme.colors.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Weather</Text>
                </View>
                <View style={styles.weatherRow}>
                  <View style={styles.weatherItem}>
                    <MaterialCommunityIcons name="thermometer" size={16} color={theme.colors.onSurfaceVariant} />
                    <Text style={[styles.weatherText, { color: theme.colors.onSurface }]}>{game.temperature_f}°F</Text>
                  </View>
                  {game.wind_speed_mph !== null && game.wind_speed_mph !== undefined && (
                    <View style={styles.weatherItem}>
                      <MaterialCommunityIcons name="weather-windy" size={16} color={theme.colors.onSurfaceVariant} />
                      <Text style={[styles.weatherText, { color: theme.colors.onSurface }]}>
                        {game.wind_speed_mph} mph {game.wind_direction || ''}
                      </Text>
                    </View>
                  )}
                  {game.sky && (
                    <View style={styles.weatherItem}>
                      <MaterialCommunityIcons name="weather-cloudy" size={16} color={theme.colors.onSurfaceVariant} />
                      <Text style={[styles.weatherText, { color: theme.colors.onSurface }]}>{game.sky}</Text>
                    </View>
                  )}
                </View>
                {game.weather_imputed && !game.weather_confirmed && (
                  <Text style={[styles.weatherNote, { color: theme.colors.onSurfaceVariant }]}>
                    Weather is estimated — awaiting confirmed inputs
                  </Text>
                )}
              </View>
            )}

            {/* Polymarket */}
            <PolymarketWidget
              awayTeam={awayName}
              homeTeam={homeName}
              league="mlb"
            />
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

/** Large team logo for bottom sheet. */
function TeamLogoLarge({
  logoUrl,
  abbrev,
  colors,
  size = 48,
}: {
  logoUrl: string | null;
  abbrev: string;
  colors: { primary: string; secondary: string };
  size?: number;
}) {
  const [imgError, setImgError] = React.useState(false);
  const radius = size / 2;

  if (logoUrl && !imgError) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.3 }}>{abbrev}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  headerDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTimeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  headerTimeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  predBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 'auto',
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchupTeam: {
    alignItems: 'center',
    width: 80,
  },
  matchupAbbrev: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  matchupName: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  matchupCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  linesColumn: {
    alignItems: 'center',
  },
  lineLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lineValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  spRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  spItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  spLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  spName: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  spStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  projHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  projToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
  },
  projToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  projToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  projScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  projScoreTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  projScoreValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  projScoreDash: {
    fontSize: 24,
    fontWeight: '300',
  },
  projUnavailable: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  projectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  projectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  projectionInfo: {
    flex: 1,
  },
  projectionPick: {
    fontSize: 15,
    fontWeight: '700',
  },
  projectionProb: {
    fontSize: 12,
    marginTop: 2,
  },
  edgeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  edgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  confBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  ouCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signalsList: {
    gap: 8,
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  signalText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  signalEmpty: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  weatherRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  weatherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherText: {
    fontSize: 13,
    fontWeight: '500',
  },
  weatherNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
  postponedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    alignSelf: 'center',
  },
});
