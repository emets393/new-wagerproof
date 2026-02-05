import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useTodaysPicks } from '@/hooks/useAgentPicks';
import { TeamAvatar } from '@/components/TeamAvatar';
import {
  getNFLTeamColors,
  getNBATeamColors,
  getCFBTeamColors,
  getTeamInitials,
  getNBATeamInitials,
  getCFBTeamInitials,
} from '@/utils/teamColors';
import {
  AgentWithPerformance,
  AgentPick,
  Sport,
  formatRecord,
  formatNetUnits,
  formatStreak,
} from '@/types/agent';

// ============================================================================
// CONSTANTS
// ============================================================================

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

// ============================================================================
// HELPERS
// ============================================================================

function parseMatchup(matchup: string): { away: string; home: string } {
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

function getTeamColors(teamName: string, sport: Sport): { primary: string; secondary: string } {
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

function getTeamAbbr(teamName: string, sport: Sport): string {
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

function formatGameDate(dateStr: string): string {
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

function getPickTypeIcon(betType: string): { name: string; color: string } {
  const bt = (betType || '').toLowerCase();
  if (bt.includes('spread')) return { name: 'plus-minus-variant', color: '#3b82f6' };
  if (bt.includes('total') || bt.includes('over') || bt.includes('under'))
    return { name: 'arrow-up-down', color: '#8b5cf6' };
  if (bt.includes('moneyline') || bt.includes('ml'))
    return { name: 'currency-usd', color: '#10b981' };
  return { name: 'arrow-up-down', color: '#9ca3af' };
}

function getResultBadge(
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
// COMPACT AGENT HEADER (unchanged)
// ============================================================================

interface CompactAgentHeaderProps {
  agent: AgentWithPerformance;
  onPress: () => void;
}

function CompactAgentHeader({ agent, onPress }: CompactAgentHeaderProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const performance = agent.performance;
  const record = formatRecord(performance);
  const netUnits = performance ? formatNetUnits(performance.net_units) : '+0.00u';
  const streak = performance ? formatStreak(performance.current_streak) : '-';
  const isPositive = performance ? performance.net_units >= 0 : true;
  const streakColor =
    performance && performance.current_streak > 0
      ? '#10b981'
      : performance && performance.current_streak < 0
      ? '#ef4444'
      : theme.colors.onSurfaceVariant;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.headerContainer,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.08)',
          borderLeftColor: agent.avatar_color,
        },
      ]}
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <Text style={styles.headerEmoji}>{agent.avatar_emoji}</Text>
      <Text
        style={[styles.headerName, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {agent.name}
      </Text>

      <View style={styles.headerBadges}>
        {agent.preferred_sports.slice(0, 2).map((sport) => (
          <Text
            key={sport}
            style={[styles.headerSportTag, { color: theme.colors.onSurfaceVariant }]}
          >
            {SPORT_LABELS[sport]}
          </Text>
        ))}
      </View>

      <Text style={[styles.headerRecord, { color: theme.colors.onSurface }]}>
        {record}
      </Text>
      <Text
        style={[
          styles.headerUnits,
          { color: isPositive ? '#10b981' : '#ef4444' },
        ]}
      >
        {netUnits}
      </Text>
      <Text style={[styles.headerStreak, { color: streakColor }]}>{streak}</Text>

      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color={theme.colors.onSurfaceVariant}
      />
    </TouchableOpacity>
  );
}

// ============================================================================
// AGENT PICK ITEM — compact card with team color gradients
// ============================================================================

interface AgentPickItemProps {
  pick: AgentPick;
  onPress: () => void;
}

function AgentPickItem({ pick, onPress }: AgentPickItemProps) {
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
    onPress();
  };

  const cardBg = isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.9)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
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
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// PICK CARD SKELETON — matches new card shape
// ============================================================================

function PickCardSkeleton({ isDark }: { isDark: boolean }) {
  const shimmer = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const cardBg = isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.9)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  return (
    <View style={[styles.pickCard, { backgroundColor: cardBg, borderColor }]}>
      {/* Gradient placeholder */}
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
          <View style={[styles.skeletonBar, { width: '55%', backgroundColor: shimmer }]} />
          <View style={{ flex: 1 }} />
          <View style={[styles.skeletonBar, { width: 30, backgroundColor: shimmer }]} />
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// PICK ROW — vertical line segment + card
// ============================================================================

interface PickRowProps {
  agentColor: string;
  children: React.ReactNode;
}

function PickRow({ agentColor, children }: PickRowProps) {
  return (
    <View style={styles.pickRow}>
      {/* Vertical line segment — stretches to row height via alignItems:stretch */}
      <View style={[styles.lineSegment, { backgroundColor: agentColor }]} />
      {/* Card with left spacing */}
      <View style={styles.pickRowContent}>{children}</View>
    </View>
  );
}

// ============================================================================
// AGENT TIMELINE SECTION
// ============================================================================

interface AgentTimelineSectionProps {
  agent: AgentWithPerformance;
  onAgentPress: () => void;
}

export function AgentTimelineSection({ agent, onAgentPress }: AgentTimelineSectionProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const {
    data: todaysPicks,
    isLoading,
  } = useTodaysPicks(agent.id);

  const agentColor = agent.avatar_color || theme.colors.primary;

  return (
    <View style={styles.sectionContainer}>
      <CompactAgentHeader agent={agent} onPress={onAgentPress} />

      {isLoading ? (
        <View style={styles.picksContainer}>
          {[0, 1].map((i) => (
            <PickRow key={i} agentColor={agentColor}>
              <PickCardSkeleton isDark={isDark} />
            </PickRow>
          ))}
        </View>
      ) : todaysPicks && todaysPicks.length > 0 ? (
        <View style={styles.picksContainer}>
          {todaysPicks.map((pick) => (
            <PickRow key={pick.id} agentColor={agentColor}>
              <AgentPickItem pick={pick} onPress={onAgentPress} />
            </PickRow>
          ))}
        </View>
      ) : (
        <View style={styles.picksContainer}>
          <PickRow agentColor={agentColor}>
            <TouchableOpacity
              style={styles.noPicksRow}
              activeOpacity={0.6}
              onPress={onAgentPress}
            >
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color={theme.colors.onSurfaceVariant}
              />
              <Text style={[styles.noPicksText, { color: theme.colors.onSurfaceVariant }]}>
                No picks today — tap to generate
              </Text>
            </TouchableOpacity>
          </PickRow>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // ---- Compact Agent Header ----
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    gap: 8,
  },
  headerEmoji: {
    fontSize: 20,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
    maxWidth: '28%',
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  headerSportTag: {
    fontSize: 10,
    fontWeight: '600',
  },
  headerRecord: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  headerUnits: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerStreak: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ---- Section / picks container ----
  sectionContainer: {
    marginBottom: 16,
  },
  // ---- Picks container + connector line ----
  picksContainer: {
    marginTop: 4,
  },
  pickRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  lineSegment: {
    width: 2,
    marginLeft: 14,
    marginRight: 8,
    borderRadius: 1,
  },
  pickRowContent: {
    flex: 1,
  },

  // ---- Agent Pick Item card ----
  pickCard: {
    borderRadius: 12,
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
    flex: 1,
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

  // ---- No picks row ----
  noPicksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  noPicksText: {
    fontSize: 13,
    fontStyle: 'italic',
  },

  // ---- Skeleton ----
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
