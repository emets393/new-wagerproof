import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeContext } from '@/contexts/ThemeContext';
import {
  AgentWithPerformance,
  Sport,
  formatRecord,
  formatNetUnits,
  formatStreak,
} from '@/types/agent';

const SPORT_ICONS: Record<Sport, string> = {
  nfl: 'football',
  cfb: 'shield-half-full',
  nba: 'basketball',
  ncaab: 'school',
  mlb: 'baseball',
};

function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) {
    return value.replace('gradient:', '').split(',')[0];
  }
  return value;
}

function getSecondaryColor(value: string): string {
  if (value.startsWith('gradient:')) {
    const parts = value.replace('gradient:', '').split(',');
    return parts[1] || parts[0];
  }
  return value;
}

// ── Static sparkline chart (no animations) ──────────────────────────
function generateSparkPoints(perf: AgentWithPerformance['performance']): number[] {
  if (!perf || perf.total_picks === 0) return [0, 0, 0, 0, 0];
  const total = perf.wins + perf.losses + perf.pushes;
  if (total === 0) return [0, 0, 0, 0, 0];

  const points: number[] = [0];
  let cumulative = 0;
  const steps = Math.min(Math.max(total, 5), 12);
  const avgPerStep = perf.net_units / steps;

  for (let i = 0; i < steps; i++) {
    const swing = i < (perf.best_streak || 1)
      ? Math.abs(avgPerStep) + 0.3
      : i > steps - Math.abs(perf.worst_streak || 1)
        ? -Math.abs(avgPerStep) - 0.2
        : avgPerStep + (Math.sin(i * 2.1) * 0.5);
    cumulative += swing;
    points.push(cumulative);
  }

  const last = points[points.length - 1];
  if (last !== 0) {
    const scale = perf.net_units / last;
    for (let i = 1; i < points.length; i++) {
      points[i] *= scale;
    }
  }
  return points;
}

const SPARKLINE_H = 32;

function MiniSparkline({ performance }: { performance: AgentWithPerformance['performance'] }) {
  const [chartW, setChartW] = useState(0);
  const points = useMemo(() => generateSparkPoints(performance), [
    performance?.total_picks,
    performance?.wins,
    performance?.losses,
    performance?.pushes,
    performance?.net_units,
    performance?.best_streak,
    performance?.worst_streak,
  ]);
  const isPositive = (performance?.net_units ?? 0) >= 0;
  const color = isPositive ? '#22c55e' : '#ef4444';

  if (points.length < 2) {
    return <View style={{ height: SPARKLINE_H }} />;
  }

  const minY = Math.min(...points);
  const maxY = Math.max(...points);
  const range = maxY - minY || 1;
  const padding = 2;

  return (
    <View
      style={{ width: '100%', height: SPARKLINE_H, position: 'relative' }}
      onLayout={(e) => { if (!chartW) setChartW(e.nativeEvent.layout.width); }}
    >
      {chartW > 0 && (
        <>
          {/* Zero line */}
          {minY < 0 && maxY > 0 && (
            <View style={{
              position: 'absolute', left: 0, right: 0,
              top: padding + ((maxY - 0) / range) * (SPARKLINE_H - padding * 2),
              height: 1, backgroundColor: 'rgba(255,255,255,0.06)',
            }} />
          )}
          {/* Static line segments */}
          {points.slice(0, -1).map((_, i) => {
            const stepX = (chartW - padding * 2) / (points.length - 1);
            const x1 = padding + i * stepX;
            const y1 = padding + ((maxY - points[i]) / range) * (SPARKLINE_H - padding * 2);
            const x2 = padding + (i + 1) * stepX;
            const y2 = padding + ((maxY - points[i + 1]) / range) * (SPARKLINE_H - padding * 2);
            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View key={i} style={{
                position: 'absolute', left: x1, top: y1,
                width: length, height: 2,
                backgroundColor: color, borderRadius: 1, opacity: 0.9,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }} />
            );
          })}
          {/* End dot */}
          <View style={{
            position: 'absolute',
            left: chartW - padding - 3,
            top: padding + ((maxY - points[points.length - 1]) / range) * (SPARKLINE_H - padding * 2) - 3,
            width: 6, height: 6, borderRadius: 3, backgroundColor: color,
          }} />
        </>
      )}
    </View>
  );
}

function formatNextRun(time: string, tz: string): string {
  const [h, m] = time.split(':').map(Number);
  const hr12 = h % 12 || 12;
  const ampm = h < 12 ? 'a' : 'p';
  const tzAbbr = tz.includes('New_York') ? 'ET'
    : tz.includes('Chicago') ? 'CT'
    : tz.includes('Denver') ? 'MT'
    : tz.includes('Los_Angeles') ? 'PT'
    : tz.split('/').pop()?.replace(/_/g, ' ') || '';
  return `${hr12}:${String(m).padStart(2, '0')}${ampm} ${tzAbbr}`;
}

interface AgentIdCardProps {
  agent: AgentWithPerformance;
  onPress: () => void;
  onLongPress?: () => void;
  debugForcePicksReady?: boolean;
}

export const AgentIdCard = React.memo(function AgentIdCard({ agent, onPress, onLongPress, debugForcePicksReady }: AgentIdCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const performance = agent.performance;
  const record = formatRecord(performance);
  const netUnits = performance ? formatNetUnits(performance.net_units) : '+0.00u';
  const streak = performance ? formatStreak(performance.current_streak) : '-';
  const winRate = performance && performance.total_picks > 0
    ? `${Math.round((performance.win_rate ?? 0) * 100)}%`
    : '-';
  const isPositive = performance ? performance.net_units >= 0 : true;
  const streakColor =
    performance && performance.current_streak > 0
      ? '#22c55e'
      : performance && performance.current_streak < 0
        ? '#ef4444'
        : '#8b949e';

  const primary = useMemo(() => getPrimaryColor(agent.avatar_color), [agent.avatar_color]);
  const secondary = useMemo(() => getSecondaryColor(agent.avatar_color), [agent.avatar_color]);
  const { cardBg, pillBg, dimText } = useMemo(() => ({
    cardBg: isDark ? '#1a1a1a' : '#ffffff',
    pillBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    dimText: isDark ? '#8b949e' : '#6b7280',
  }), [isDark]);

  return (
    <TouchableOpacity
      style={[styles.cardShadow, {
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.4 : 0.12,
        shadowRadius: 8,
      }]}
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={[styles.card, {
        backgroundColor: cardBg,
        borderWidth: isDark ? 0 : 1,
        borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.06)',
      }]}>
      {/* Top gradient border */}
      <LinearGradient
        colors={[primary, secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBorder}
      />
      {/* Background color gradient wash */}
      <LinearGradient
        colors={[`${primary}15`, `${secondary}10`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.backgroundGradient}
      />

      <View style={styles.content}>
        {/* ── Top section: Identity ── */}
        <View style={styles.identitySection}>
          {/* Emoji + Name row */}
          <View style={styles.identityRow}>
            <View style={[styles.emojiCircle, { backgroundColor: `${primary}20` }]}>
              <Text style={styles.emoji}>{agent.avatar_emoji}</Text>
            </View>
            <View style={styles.nameCol}>
              <Text
                style={[styles.name, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {agent.name}
              </Text>
              <View style={styles.sportRow}>
                {agent.preferred_sports.slice(0, 4).map((sport) => (
                  <View key={sport} style={[styles.sportBadge, { backgroundColor: pillBg }]}>
                    <MaterialCommunityIcons
                      name={SPORT_ICONS[sport] as any}
                      size={10}
                      color={dimText}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>

        </View>

        {/* ── Performance mini chart ── */}
        <View style={[styles.chartSection, { backgroundColor: pillBg }]}>
          <View style={styles.chartHeader}>
            <MaterialCommunityIcons name="chart-line" size={11} color={dimText} />
            <Text style={[styles.sectionLabel, { color: dimText }]}>PERFORMANCE</Text>
            <Text style={[styles.chartUnits, { color: isPositive ? '#22c55e' : '#ef4444' }]}>
              {netUnits}
            </Text>
          </View>
          <MiniSparkline performance={performance} />
          <View style={styles.chartFooter}>
            <Text style={[styles.chartStat, { color: dimText }]}>{record}</Text>
            <View style={[styles.streakChip, { backgroundColor: `${streakColor}18` }]}>
              <MaterialCommunityIcons
                name={performance && performance.current_streak > 0 ? 'fire' : performance && performance.current_streak < 0 ? 'snowflake' : 'minus'}
                size={9}
                color={streakColor}
              />
              <Text style={[styles.streakChipText, { color: streakColor }]}>{streak}</Text>
            </View>
          </View>
        </View>

        {/* ── Bottom row: autopilot status ── */}
        <View style={styles.bottomRow}>
          {agent.is_active ? (
            <>
              <View style={styles.autoBadge}>
                <View style={styles.autoDot} />
                <Text style={styles.autoText}>autopilot on</Text>
              </View>
              {agent.auto_generate_time && (
                <View style={styles.nextRunBadge}>
                  <Text style={styles.nextRunText}>
                    {formatNextRun(agent.auto_generate_time, agent.auto_generate_timezone)}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.autoOffBadge}>
              <MaterialCommunityIcons name="pause-circle-outline" size={14} color="#ef4444" />
              <Text style={styles.autoOffText}>autopilot off</Text>
            </View>
          )}
        </View>
      </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  cardShadow: {
    flex: 1,
    height: 195,
    marginVertical: 4,
    borderRadius: 20,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradientBorder: {
    height: 3,
    zIndex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },

  // ── Identity section ──
  identitySection: {
    marginBottom: 4,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  nameCol: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  sportRow: {
    flexDirection: 'row',
    gap: 3,
  },
  sportBadge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },


  // ── Chart section ──
  chartSection: {
    borderRadius: 12,
    paddingTop: 4,
    paddingBottom: 6,
    paddingHorizontal: 8,
    gap: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  chartUnits: {
    fontSize: 12,
    fontWeight: '800',
  },
  chartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  chartStat: {
    fontSize: 10,
    fontWeight: '600',
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  streakChipText: {
    fontSize: 9,
    fontWeight: '700',
  },

  // ── Bottom badge ──
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  nextRunBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  nextRunText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
    gap: 5,
  },
  autoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  autoText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  autoOffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.1)',
    gap: 4,
  },
  autoOffText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ef4444',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

});
