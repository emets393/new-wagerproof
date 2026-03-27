import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import {
  MLBGame,
  getFullGameRuns,
  getF5Runs,
  formatMoneyline,
  formatSpread,
  formatMLBDateLabel,
  formatMLBGameTime,
  getSignalSeverityColor,
  getSignalCategoryIcon,
  getVenueRoofType,
  windDirectionToDegrees,
  getSkyIcon,
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

  // Implied probability from moneyline odds (for Vegas vs Model comparison)
  const mlToImpliedProb = (ml: number | null): number | null => {
    if (ml === null || ml === undefined) return null;
    return ml < 0 ? Math.abs(ml) / (Math.abs(ml) + 100) : 100 / (ml + 100);
  };
  const vegasImpliedProb = mlPickSide === 'home'
    ? mlToImpliedProb(game?.home_ml ?? null)
    : mlToImpliedProb(game?.away_ml ?? null);

  // O/U
  const ouDirection = game?.ou_direction;
  const ouEdge = game?.ou_edge !== null && game?.ou_edge !== undefined ? Math.abs(game.ou_edge) : null;
  const ouConfLabel = game?.ou_strong_signal ? 'Strong' : game?.ou_moderate_signal ? 'Moderate' : 'Weak';
  const ouConfColor = game?.ou_strong_signal ? '#22c55e' : game?.ou_moderate_signal ? '#84cc16' : '#eab308';
  const ouDelta = game?.ou_fair_total != null && game?.total_line != null
    ? Math.abs(game.ou_fair_total - game.total_line).toFixed(1)
    : null;

  // Signals — show for any game that has them
  const signals = game?.signals || [];
  const showSignals = signals.length > 0 || (game != null);

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
                    <Text style={[styles.lineLabel, { color: theme.colors.onSurfaceVariant }]}>Run Line</Text>
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

            {/* Polymarket */}
            <PolymarketWidget
              awayTeam={awayName}
              homeTeam={homeName}
              gameDate={game.official_date}
              awayTeamColors={awayColors}
              homeTeamColors={homeColors}
              league="mlb"
            />

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

            {/* ML Projection — Vegas vs Model */}
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

                  {/* Vegas vs Model comparison */}
                  <View style={styles.comparisonRow}>
                    <View style={[styles.comparisonBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
                      <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Vegas</Text>
                      <Text style={[styles.comparisonValue, { color: theme.colors.onSurface }]}>
                        {vegasImpliedProb !== null ? `${(vegasImpliedProb * 100).toFixed(1)}%` : '-'}
                      </Text>
                    </View>
                    <View style={styles.comparisonArrow}>
                      <MaterialCommunityIcons name="arrow-right" size={20} color={theme.colors.onSurfaceVariant} />
                    </View>
                    <View style={[styles.comparisonBox, { backgroundColor: mlPickStrong ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)', borderColor: mlPickStrong ? 'rgba(34,197,94,0.25)' : 'rgba(234,179,8,0.25)', borderWidth: 1 }]}>
                      <Text style={[styles.comparisonLabel, { color: mlPickStrong ? '#22c55e' : '#eab308' }]}>Our Model</Text>
                      <Text style={[styles.comparisonValue, { color: mlPickStrong ? '#22c55e' : '#eab308' }]}>
                        {(mlPickProb * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  {/* Edge + Team summary */}
                  <View style={styles.edgeSummaryRow}>
                    <TeamLogoLarge
                      logoUrl={mlPickSide === 'home' ? game.home_logo_url : game.away_logo_url}
                      abbrev={mlPickSide === 'home' ? game.home_abbr : game.away_abbr}
                      colors={mlPickSide === 'home' ? homeColors : awayColors}
                      size={36}
                    />
                    <View style={styles.edgeSummaryText}>
                      <Text style={[styles.edgeSummaryTeam, { color: theme.colors.onSurface }]}>
                        Edge to {mlPickSide === 'home' ? game.home_abbr : game.away_abbr}
                      </Text>
                      {mlPickEdge !== null && mlPickEdge !== undefined && (
                        <Text style={[styles.edgeSummaryDelta, { color: mlPickStrong ? '#22c55e' : '#eab308' }]}>
                          +{Math.abs(mlPickEdge).toFixed(1)}% delta
                        </Text>
                      )}
                    </View>
                    <View style={[styles.confBadge, { backgroundColor: mlPickStrong ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)' }]}>
                      <Text style={{ color: mlPickStrong ? '#22c55e' : '#eab308', fontSize: 11, fontWeight: '600' }}>
                        {mlPickStrong ? 'Strong' : 'Weak'} Signal
                      </Text>
                    </View>
                  </View>

                  {mlExpanded && (
                    <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
                      The model gives {mlPickSide === 'home' ? game.home_abbr : game.away_abbr} a {(mlPickProb * 100).toFixed(1)}% chance to win
                      {vegasImpliedProb !== null ? ` vs Vegas implied ${(vegasImpliedProb * 100).toFixed(1)}%` : ''}
                      {mlPickEdge !== null && mlPickEdge !== undefined ? `, a +${Math.abs(mlPickEdge).toFixed(1)}% edge.` : '.'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* O/U Projection — Vegas vs Model */}
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

                  {/* Vegas vs Model comparison */}
                  <View style={styles.comparisonRow}>
                    <View style={[styles.comparisonBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
                      <Text style={[styles.comparisonLabel, { color: theme.colors.onSurfaceVariant }]}>Vegas O/U</Text>
                      <Text style={[styles.comparisonValue, { color: theme.colors.onSurface }]}>
                        {game.total_line ?? '-'}
                      </Text>
                    </View>
                    <View style={styles.comparisonArrow}>
                      <MaterialCommunityIcons name="arrow-right" size={20} color={theme.colors.onSurfaceVariant} />
                    </View>
                    <View style={[styles.comparisonBox, {
                      backgroundColor: ouDirection === 'OVER' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      borderColor: ouDirection === 'OVER' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
                      borderWidth: 1,
                    }]}>
                      <Text style={[styles.comparisonLabel, { color: ouDirection === 'OVER' ? '#22c55e' : '#ef4444' }]}>Our Model</Text>
                      <Text style={[styles.comparisonValue, { color: ouDirection === 'OVER' ? '#22c55e' : '#ef4444' }]}>
                        {game.ou_fair_total?.toFixed(1) ?? '-'}
                      </Text>
                    </View>
                  </View>

                  {/* Edge summary */}
                  <View style={styles.edgeSummaryRow}>
                    <MaterialCommunityIcons
                      name={ouDirection === 'OVER' ? 'chevron-up' : 'chevron-down'}
                      size={32}
                      color={ouDirection === 'OVER' ? '#22c55e' : '#ef4444'}
                    />
                    <View style={styles.edgeSummaryText}>
                      <Text style={[styles.edgeSummaryTeam, { color: theme.colors.onSurface }]}>
                        Edge to {ouDirection === 'OVER' ? 'Over' : 'Under'}
                      </Text>
                      {ouDelta !== null && (
                        <Text style={[styles.edgeSummaryDelta, { color: ouDirection === 'OVER' ? '#22c55e' : '#ef4444' }]}>
                          {ouDelta} pts delta
                        </Text>
                      )}
                    </View>
                    <View style={[styles.confBadge, { backgroundColor: `${ouConfColor}15` }]}>
                      <Text style={{ color: ouConfColor, fontSize: 11, fontWeight: '600' }}>
                        {ouConfLabel} Signal
                      </Text>
                    </View>
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
            {game.temperature_f !== null && game.temperature_f !== undefined ? (
              <MLBWeatherSection game={game} isDark={isDark} theme={theme} />
            ) : (
              <View style={[styles.section, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' }]}>
                <View style={styles.projectionHeader}>
                  <MaterialCommunityIcons name="weather-partly-cloudy" size={18} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>Weather</Text>
                </View>
                <Text style={[styles.wxPendingText, { color: theme.colors.onSurfaceVariant }]}>
                  Weather data updates ~4 hours before game time
                </Text>
              </View>
            )}

          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

/** Large team logo for bottom sheet. */
/** Animated wind arrow that points in the compass direction. */
function WindArrow({ direction, isDark }: { direction: string | null; isDark: boolean }) {
  const degrees = windDirectionToDegrees(direction);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (degrees !== null) {
      spin.value = withTiming(degrees, { duration: 800, easing: Easing.out(Easing.cubic) });
    }
  }, [degrees]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  if (degrees === null) return null;

  return (
    <Animated.View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
      <MaterialCommunityIcons name="arrow-up" size={22} color={isDark ? '#93c5fd' : '#3b82f6'} />
    </Animated.View>
  );
}

/** Weather section with field visual, wind arrow, temp, sky, and roof indicator. */
function MLBWeatherSection({ game, isDark, theme }: { game: MLBGame; isDark: boolean; theme: any }) {
  const roofType = getVenueRoofType(game.venue_name);
  const skyIcon = getSkyIcon(game.sky) as any;
  const isDome = roofType !== null;

  return (
    <View style={[styles.section, { backgroundColor: isDark ? '#222' : '#f5f5f5', borderColor: isDark ? '#333' : '#e0e0e0' }]}>
      <View style={styles.projectionHeader}>
        <MaterialCommunityIcons name="weather-partly-cloudy" size={18} color={theme.colors.primary} />
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Weather</Text>
        {game.venue_name && (
          <Text style={[styles.wxVenueName, { color: theme.colors.onSurfaceVariant }]}>{game.venue_name}</Text>
        )}
      </View>

      {/* Main weather cards row */}
      <View style={styles.wxCardsRow}>
        {/* Temperature card */}
        <View style={[styles.wxCard, { backgroundColor: isDark ? '#2a1a1a' : '#fef2f2', borderColor: isDark ? '#442d2d' : '#fecaca' }]}>
          <View style={styles.wxCardIcon}>
            <MaterialCommunityIcons name="thermometer" size={24} color={isDark ? '#fca5a5' : '#ef4444'} />
          </View>
          <Text style={[styles.wxCardValue, { color: theme.colors.onSurface }]}>{game.temperature_f}°F</Text>
          <Text style={[styles.wxCardLabel, { color: theme.colors.onSurfaceVariant }]}>Temp</Text>
        </View>

        {/* Sky condition card */}
        {game.sky && (
          <View style={[styles.wxCard, { backgroundColor: isDark ? '#1a2a1a' : '#f0fdf4', borderColor: isDark ? '#2d442d' : '#bbf7d0' }]}>
            <View style={styles.wxCardIcon}>
              <MaterialCommunityIcons name={skyIcon} size={24} color={isDark ? '#86efac' : '#22c55e'} />
            </View>
            <Text style={[styles.wxCardValue, { color: theme.colors.onSurface }]} numberOfLines={1}>{game.sky}</Text>
            <Text style={[styles.wxCardLabel, { color: theme.colors.onSurfaceVariant }]}>Sky</Text>
          </View>
        )}

        {/* Wind card */}
        {game.wind_speed_mph !== null && game.wind_speed_mph !== undefined && (
          <View style={[styles.wxCard, { backgroundColor: isDark ? '#1a1a2e' : '#eff6ff', borderColor: isDark ? '#2d2d44' : '#bfdbfe' }]}>
            <View style={styles.wxCardIcon}>
              <WindArrow direction={game.wind_direction} isDark={isDark} />
            </View>
            <Text style={[styles.wxCardValue, { color: theme.colors.onSurface }]}>{game.wind_speed_mph} mph</Text>
            <Text style={[styles.wxCardLabel, { color: theme.colors.onSurfaceVariant }]}>{game.wind_direction || 'Wind'}</Text>
          </View>
        )}

        {/* Roof / field type card */}
        <View style={[styles.wxCard, { backgroundColor: isDark ? '#1a1a2a' : '#f5f3ff', borderColor: isDark ? '#2d2d44' : '#c4b5fd' }]}>
          <View style={styles.wxCardIcon}>
            <MaterialCommunityIcons
              name={isDome ? 'dome-light' : 'baseball-diamond'}
              size={24}
              color={isDark ? '#c4b5fd' : '#7c3aed'}
            />
          </View>
          <Text style={[styles.wxCardValue, { color: theme.colors.onSurface }]}>
            {roofType === 'dome' ? 'Dome' : roofType === 'retractable' ? 'Dome/Roof' : 'Open Air'}
          </Text>
          <Text style={[styles.wxCardLabel, { color: theme.colors.onSurfaceVariant }]}>Field</Text>
        </View>
      </View>

      {game.weather_imputed && !game.weather_confirmed && (
        <Text style={[styles.wxNote, { color: theme.colors.onSurfaceVariant }]}>
          Weather is estimated — awaiting confirmed inputs
        </Text>
      )}
    </View>
  );
}

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
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  comparisonBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  comparisonLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  comparisonValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  comparisonArrow: {
    paddingHorizontal: 2,
  },
  edgeSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  edgeSummaryText: {
    flex: 1,
  },
  edgeSummaryTeam: {
    fontSize: 14,
    fontWeight: '600',
  },
  edgeSummaryDelta: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  wxVenueName: {
    fontSize: 11,
    fontWeight: '500',
  },
  wxCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  wxCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  wxCardIcon: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wxCardValue: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  wxCardLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wxNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  wxPendingText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
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
