import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { TeamAvatar } from '@/components/TeamAvatar';
import {
  getNFLTeamColors,
  getNBATeamColors,
  getCFBTeamColors,
  getTeamInitials,
  getNBATeamInitials,
  getCFBTeamInitials,
} from '@/utils/teamColors';
import { AgentPick, Sport } from '@/types/agent';
import { AgentOverlapFooter } from './AgentOverlapFooter';
import { useNCAABTeamMapping, lookupNCAABTeam } from '@/hooks/useNCAABTeamMapping';

// ============================================================================
// HELPERS
// ============================================================================

export function parseMatchup(matchup: string): { away: string; home: string } {
  const separators = [' @ ', ' vs. ', ' vs '];
  for (const sep of separators) {
    const idx = matchup.indexOf(sep);
    if (idx !== -1) {
      return {
        away: matchup.substring(0, idx).trim(),
        home: matchup.substring(idx + sep.length).trim(),
      };
    }
  }
  return { away: matchup, home: '' };
}

export function getTeamColors(teamName: string, sport: Sport): { primary: string; secondary: string } {
  switch (sport) {
    case 'nfl':
      return getNFLTeamColors(teamName);
    case 'nba':
      return getNBATeamColors(teamName);
    case 'cfb':
    case 'ncaab':
      return getCFBTeamColors(teamName);
    default:
      return { primary: '#666666', secondary: '#999999' };
  }
}

export function getTeamAbbr(teamName: string, sport: Sport): string {
  switch (sport) {
    case 'nfl':
      return getTeamInitials(teamName);
    case 'nba':
      return getNBATeamInitials(teamName);
    case 'cfb':
    case 'ncaab':
      return getCFBTeamInitials(teamName);
    default:
      return teamName.substring(0, 3).toUpperCase();
  }
}

export function formatGameDate(dateStr: string): string {
  if (!dateStr) return 'Pending';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Pending';
  }
}

export function getPickTypeIcon(betType: string): { name: string; color: string } {
  const bt = (betType || '').toLowerCase();
  if (bt.includes('spread')) return { name: 'plus-minus-variant', color: '#3b82f6' };
  if (bt.includes('total') || bt.includes('over') || bt.includes('under'))
    return { name: 'arrow-up-down', color: '#8b5cf6' };
  if (bt.includes('moneyline') || bt.includes('ml'))
    return { name: 'currency-usd', color: '#10b981' };
  return { name: 'arrow-up-down', color: '#9ca3af' };
}

export function getResultBadge(
  result: string | null | undefined,
): { icon: string; color: string; bgColor: string; text: string } | null {
  switch (result) {
    case 'won':
      return { icon: 'check', color: '#ffffff', bgColor: '#22c55e', text: 'WIN' };
    case 'lost':
      return { icon: 'close', color: '#ffffff', bgColor: '#ef4444', text: 'LOSS' };
    case 'push':
      return { icon: 'minus', color: '#ffffff', bgColor: '#eab308', text: 'PUSH' };
    default:
      return null;
  }
}

// ============================================================================
// AGENT PICK ITEM — bet-slip style card
// ============================================================================

interface AgentPickItemProps {
  pick: AgentPick;
  onPress?: () => void;
  /** 'full' shows complete reasoning + key factors, 'summary' truncates to 2 lines */
  showReasoning?: 'full' | 'summary' | false;
  /** Show a loading spinner overlay on the card */
  loading?: boolean;
}

export const AgentPickItem = React.memo(function AgentPickItem({ pick, onPress, showReasoning = false, loading = false }: AgentPickItemProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { teamMap } = useNCAABTeamMapping();

  const { away, home } = parseMatchup(pick.matchup);

  const isNCAAB = pick.sport === 'ncaab';
  const awayMapping = isNCAAB ? lookupNCAABTeam(away, teamMap) : null;
  const homeMapping = isNCAAB ? lookupNCAABTeam(home, teamMap) : null;

  const awayAbbr = (isNCAAB && awayMapping?.abbrev) ? awayMapping.abbrev : getTeamAbbr(away, pick.sport);
  const homeAbbr = (isNCAAB && homeMapping?.abbrev) ? homeMapping.abbrev : getTeamAbbr(home, pick.sport);
  const awayLogoUrl = isNCAAB ? (awayMapping?.logoUrl ?? undefined) : undefined;
  const homeLogoUrl = isNCAAB ? (homeMapping?.logoUrl ?? undefined) : undefined;

  const awayColors = getTeamColors(away, pick.sport);
  const homeColors = getTeamColors(home, pick.sport);
  const pickIcon = getPickTypeIcon(pick.bet_type);
  const resultBadge = getResultBadge(pick.result);

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const cardBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const pillBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const pillBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  // Determine icon for bet type — game card style
  const bt = (pick.bet_type || '').toLowerCase();
  const isTotal = bt.includes('total') || bt.includes('over') || bt.includes('under');
  const isSpread = bt.includes('spread');
  const isOver = (pick.pick_selection || '').toLowerCase().includes('over');

  // For spread/ML, figure out which team is picked
  const pickSelectionLower = (pick.pick_selection || '').toLowerCase();
  const isAwayPicked = pickSelectionLower.includes(awayAbbr.toLowerCase()) || pickSelectionLower.includes(away.toLowerCase());
  const pickedTeam = isAwayPicked ? away : home;
  const pickedAbbr = isAwayPicked ? awayAbbr : homeAbbr;
  const pickedLogoUrl = isAwayPicked ? awayLogoUrl : homeLogoUrl;

  // Compact selection text: use the team abbreviation (with the logo already in
  // the avatar slot) on ML/spread picks so long team names don't get truncated.
  // Spread picks keep the line portion (e.g. "MIN -3.5"). O/U picks render verbatim.
  const displaySelection = (() => {
    if (isTotal) return pick.pick_selection;
    if (isSpread) {
      const lineMatch = (pick.pick_selection || '').match(/[+-]\d+(?:\.\d+)?/);
      return lineMatch ? `${pickedAbbr} ${lineMatch[0]}` : pickedAbbr;
    }
    return `${pickedAbbr} ML`;
  })();

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress} disabled={!onPress || loading}>
      <View style={[styles.pickCard, { backgroundColor: cardBg, borderColor }]}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        )}
        {/* Team color gradient top border */}
        <LinearGradient
          colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.pickCardTopBorder}
        />

        <View style={styles.pickCardContent}>
          {/* ── HEADER: matchup + date/result ── */}
          <View style={styles.headerRow}>
            <View style={styles.matchupRow}>
              <TeamAvatar teamName={away} sport={pick.sport} size={26} teamAbbr={awayAbbr} logoUrl={awayLogoUrl} />
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]}>{awayAbbr}</Text>
              <Text style={[styles.atSymbol, { color: theme.colors.outline }]}>@</Text>
              <TeamAvatar teamName={home} sport={pick.sport} size={26} teamAbbr={homeAbbr} logoUrl={homeLogoUrl} />
              <Text style={[styles.teamName, { color: theme.colors.onSurface }]}>{homeAbbr}</Text>
            </View>
            <View style={styles.headerBadgeGroup}>
              <View style={[styles.dateBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                <MaterialCommunityIcons name="clock-outline" size={10} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
                  {formatGameDate(pick.game_date)}
                </Text>
              </View>
              {resultBadge ? (
                <View style={[styles.resultBadge, { backgroundColor: resultBadge.bgColor }]}>
                  <MaterialCommunityIcons name={resultBadge.icon as any} size={10} color={resultBadge.color} />
                  <Text style={styles.resultText}>{resultBadge.text}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── PICK PILL — game card style ── */}
          <View style={[styles.pickPill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
            {/* Icon: arrow circle for O/U, team avatar for spread/ML */}
            {isTotal ? (
              <View style={[styles.pickIconCircle, { backgroundColor: isOver ? '#22c55e' : '#ef4444' }]}>
                <MaterialCommunityIcons
                  name={isOver ? 'arrow-up' : 'arrow-down'}
                  size={18}
                  color="#fff"
                />
              </View>
            ) : (
              <View style={styles.pickIconAvatar}>
                <TeamAvatar teamName={pickedTeam} sport={pick.sport} size={30} teamAbbr={pickedAbbr} logoUrl={pickedLogoUrl} />
              </View>
            )}
            {/* Selection text */}
            <Text
              style={[styles.pickSelection, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {displaySelection}
            </Text>
            {/* Odds + Units on far right */}
            <View style={styles.pickMetaRight}>
              {pick.odds && (
                <View style={[styles.oddsPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.oddsValue, { color: theme.colors.onSurface }]}>
                    {pick.odds}
                  </Text>
                </View>
              )}
              <View style={[styles.unitsPill, { backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)' }]}>
                <Text style={styles.unitsValue}>{pick.units}u</Text>
              </View>
            </View>
          </View>

          {/* ── SUMMARY ── */}
          {showReasoning && pick.reasoning_text ? (
            <View style={[styles.reasoningSection, { borderTopColor: dividerColor }]}>
              <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>SUMMARY</Text>
              <Text
                style={[styles.reasoningText, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={showReasoning === 'summary' ? 2 : undefined}
              >
                {pick.reasoning_text}
              </Text>
              {showReasoning === 'full' && pick.key_factors && pick.key_factors.length > 0 && (
                <View style={styles.factorsContainer}>
                  <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>KEY FACTORS</Text>
                  {pick.key_factors.map((factor, index) => (
                    <View key={index} style={styles.factorRow}>
                      <View style={[styles.factorDot, { backgroundColor: pickIcon.color }]} />
                      <Text style={[styles.factorText, { color: theme.colors.onSurfaceVariant }]}>
                        {factor}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* Overlap footer */}
          {pick.overlap && pick.overlap.totalCount > 0 && (
            <AgentOverlapFooter overlap={pick.overlap} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ============================================================================
// PICK CARD SKELETON
// ============================================================================

export const PickCardSkeleton = React.memo(function PickCardSkeleton({ isDark }: { isDark: boolean }) {
  const shimmer = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
  const shimmerOpacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [shimmerOpacity]);

  return (
    <View style={[styles.pickCard, { backgroundColor: cardBg, borderColor }]}>
      <Animated.View style={{ opacity: shimmerOpacity }}>
        <View style={[styles.pickCardTopBorder, { backgroundColor: shimmer }]} />
        <View style={styles.pickCardContent}>
          <View style={styles.skeletonRow}>
            <View style={[styles.skeletonCircle, { backgroundColor: shimmer }]} />
            <View style={[styles.skeletonBar, { width: 30, backgroundColor: shimmer }]} />
            <View style={[styles.skeletonBarSmall, { backgroundColor: shimmer }]} />
            <View style={[styles.skeletonCircle, { backgroundColor: shimmer }]} />
            <View style={[styles.skeletonBar, { width: 30, backgroundColor: shimmer }]} />
          </View>
          <View style={[styles.skeletonRow, { marginTop: 6 }]}>
            <View style={[styles.skeletonBar, { width: '55%' as any, backgroundColor: shimmer }]} />
            <View style={{ flex: 1 }} />
            <View style={[styles.skeletonBar, { width: 30, backgroundColor: shimmer }]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  pickCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 12,
  },
  pickCardTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1,
  },
  pickCardContent: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },

  // ── Header row ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '700',
  },
  atSymbol: {
    fontSize: 11,
    fontWeight: '500',
    marginHorizontal: 1,
  },
  headerBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resultText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // ── Pick pill — game card style ──
  pickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pickIconAvatar: {
    marginRight: 10,
  },
  pickSelection: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  pickMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    paddingLeft: 8,
  },
  oddsPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  oddsValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unitsPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
    fontVariant: ['tabular-nums'],
  },

  // ── Reasoning ──
  reasoningSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },
  reasoningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  factorsContainer: {
    marginTop: 12,
    gap: 5,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  factorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 8,
    marginTop: 7,
  },
  factorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skeletonCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 4,
  },
  skeletonBarSmall: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
});
