import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
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
// AGENT PICK ITEM — compact card with team color gradients
// ============================================================================

interface AgentPickItemProps {
  pick: AgentPick;
  onPress?: () => void;
  /** 'full' shows complete reasoning + key factors, 'summary' truncates to 2 lines */
  showReasoning?: 'full' | 'summary' | false;
}

export function AgentPickItem({ pick, onPress, showReasoning = false }: AgentPickItemProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const { away, home } = parseMatchup(pick.matchup);
  const awayAbbr = getTeamAbbr(away, pick.sport);
  const homeAbbr = getTeamAbbr(home, pick.sport);
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

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress} disabled={!onPress}>
      <View style={[styles.pickCard, { backgroundColor: cardBg, borderColor }]}>
        {/* Team color gradient top border */}
        <LinearGradient
          colors={[
            awayColors.primary,
            awayColors.secondary,
            homeColors.primary,
            homeColors.secondary,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.pickCardTopBorder}
        />

        {/* Subtle team color background gradient (matches game cards) */}
        <LinearGradient
          colors={[
            `${awayColors.primary}15`,
            `${awayColors.secondary}10`,
            `${theme.colors.surface}00`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.backgroundGradient}
        />

        <View style={styles.pickCardContent}>
          {/* Row 1: Teams + result badge */}
          <View style={styles.pickTeamsRow}>
            <View style={styles.pickTeamsInfo}>
              <TeamAvatar teamName={away} sport={pick.sport} size={22} />
              <Text style={[styles.pickTeamAbbr, { color: theme.colors.onSurface }]}>
                {awayAbbr}
              </Text>
              <Text style={[styles.pickAtSymbol, { color: theme.colors.outline }]}>@</Text>
              <TeamAvatar teamName={home} sport={pick.sport} size={22} />
              <Text style={[styles.pickTeamAbbr, { color: theme.colors.onSurface }]}>
                {homeAbbr}
              </Text>
            </View>

            {resultBadge ? (
              <View style={[styles.pickResultBadge, { backgroundColor: resultBadge.bgColor }]}>
                <MaterialCommunityIcons
                  name={resultBadge.icon as any}
                  size={9}
                  color={resultBadge.color}
                />
                <Text style={styles.pickResultText}>{resultBadge.text}</Text>
              </View>
            ) : (
              <View
                style={[
                  styles.pickPendingBadge,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={10}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text style={[styles.pickPendingText, { color: theme.colors.onSurfaceVariant }]}>
                  {formatGameDate(pick.game_date)}
                </Text>
              </View>
            )}
          </View>

          {/* Row 2: Bet type icon + selection + odds + units */}
          <View style={styles.pickDetailsRow}>
            <MaterialCommunityIcons
              name={pickIcon.name as any}
              size={14}
              color={pickIcon.color}
            />
            <Text
              style={[styles.pickSelection, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {pick.pick_selection}
            </Text>
            {pick.odds && (
              <Text style={[styles.pickOdds, { color: theme.colors.onSurfaceVariant }]}>
                ({pick.odds})
              </Text>
            )}
            <View style={{ flex: 1 }} />
            <Text style={[styles.pickUnits, { color: theme.colors.onSurfaceVariant }]}>
              {pick.units}u
            </Text>
          </View>

          {/* Row 3: Reasoning (optional) */}
          {showReasoning && pick.reasoning_text ? (
            <View
              style={[
                styles.reasoningRow,
                {
                  borderTopColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                },
              ]}
            >
              <Text
                style={[styles.reasoningText, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={showReasoning === 'summary' ? 2 : undefined}
              >
                {pick.reasoning_text}
              </Text>
              {showReasoning === 'full' &&
                pick.key_factors &&
                pick.key_factors.length > 0 && (
                  <View style={styles.keyFactorsContainer}>
                    {pick.key_factors.map((factor, index) => (
                      <View key={index} style={styles.factorRow}>
                        <Text
                          style={[
                            styles.factorBullet,
                            { color: theme.colors.primary },
                          ]}
                        >
                          •
                        </Text>
                        <Text
                          style={[
                            styles.factorText,
                            { color: theme.colors.onSurfaceVariant },
                          ]}
                        >
                          {factor}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// PICK CARD SKELETON
// ============================================================================

export function PickCardSkeleton({ isDark }: { isDark: boolean }) {
  const shimmer = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  return (
    <View style={[styles.pickCard, { backgroundColor: cardBg, borderColor }]}>
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
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  pickCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickCardTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  pickCardContent: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
  },
  pickTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pickTeamsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  pickTeamAbbr: {
    fontSize: 12,
    fontWeight: '700',
  },
  pickAtSymbol: {
    fontSize: 11,
    fontWeight: '500',
    marginHorizontal: 1,
  },
  pickDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pickSelection: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  pickOdds: {
    fontSize: 11,
    fontWeight: '500',
  },
  pickUnits: {
    fontSize: 11,
    fontWeight: '600',
  },
  reasoningRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  reasoningText: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  keyFactorsContainer: {
    marginTop: 6,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
    paddingLeft: 2,
  },
  factorBullet: {
    fontSize: 11,
    marginRight: 6,
    lineHeight: 16,
  },
  factorText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  pickResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pickResultText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
  },
  pickPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pickPendingText: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
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
