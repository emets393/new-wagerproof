import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { PixelEmojiInline, hasPixelEmoji } from '@/components/agents/PixelEmojiInline';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { GlowAccentBar } from '@/components/agents/GlowAccentBar';
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

// ── Mini sparkline chart ──────────────────────────────────────────
function generateSparkPoints(perf: AgentWithPerformance['performance']): number[] {
  if (!perf || perf.total_picks === 0) return [0, 0, 0, 0, 0];
  // Simulate a cumulative units curve from W/L data + best/worst streak
  const total = perf.wins + perf.losses + perf.pushes;
  if (total === 0) return [0, 0, 0, 0, 0];

  const points: number[] = [0];
  let cumulative = 0;
  // Generate ~10-12 synthetic points that end at net_units
  const steps = Math.min(Math.max(total, 5), 12);
  const avgPerStep = perf.net_units / steps;

  for (let i = 0; i < steps; i++) {
    // Add variance: wins push up, losses push down
    const winProb = perf.win_rate ?? 0.5;
    const swing = i < (perf.best_streak || 1)
      ? Math.abs(avgPerStep) + 0.3  // best streak section trends up
      : i > steps - Math.abs(perf.worst_streak || 1)
        ? -Math.abs(avgPerStep) - 0.2  // worst streak dips
        : avgPerStep + (Math.sin(i * 2.1) * 0.5); // normal variance
    cumulative += swing;
    points.push(cumulative);
  }

  // Normalize so last point = net_units
  const last = points[points.length - 1];
  if (last !== 0) {
    const scale = perf.net_units / last;
    for (let i = 1; i < points.length; i++) {
      points[i] *= scale;
    }
  }
  return points;
}

function MiniSparkline({ performance }: { performance: AgentWithPerformance['performance'] }) {
  const points = generateSparkPoints(performance);
  const isPositive = (performance?.net_units ?? 0) >= 0;
  const color = isPositive ? '#22c55e' : '#ef4444';

  const CHART_H = 32;
  const [chartW, setChartW] = useState(0);

  const traceAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (chartW === 0) return;
    traceAnim.setValue(0);
    Animated.timing(traceAnim, {
      toValue: 1,
      duration: 1200,
      delay: 300,
      useNativeDriver: false,
    }).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.8, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    });
  }, [chartW, traceAnim, pulseAnim]);

  if (points.length < 2) {
    return <View style={{ height: CHART_H }} />;
  }

  const minY = Math.min(...points);
  const maxY = Math.max(...points);
  const range = maxY - minY || 1;
  const padding = 2;

  const lastY = padding + ((maxY - points[points.length - 1]) / range) * (CHART_H - padding * 2);

  return (
    <View
      style={{ width: '100%', height: CHART_H, position: 'relative', overflow: 'hidden' }}
      onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
    >
      {chartW > 0 && (
        <>
          {/* Zero line */}
          {minY < 0 && maxY > 0 && (
            <View style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: padding + ((maxY - 0) / range) * (CHART_H - padding * 2),
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }} />
          )}

          {/* Animated clip mask — reveals line left-to-right */}
          <Animated.View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: traceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, chartW],
            }),
            overflow: 'hidden',
          }}>
            <View style={{ width: chartW, height: CHART_H }}>
              <SparklineSegments
                points={points}
                minY={minY}
                maxY={maxY}
                range={range}
                padding={padding}
                chartH={CHART_H}
                chartW={chartW}
                color={color}
              />
            </View>
          </Animated.View>

          {/* Pulsing end dot */}
          <Animated.View style={{
            position: 'absolute',
            left: chartW - padding - 5,
            top: lastY - 5,
            width: 10,
            height: 10,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: traceAnim,
          }}>
            <Animated.View style={{
              position: 'absolute',
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: `${color}30`,
              transform: [{ scale: pulseAnim }],
            }} />
            <View style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: color,
            }} />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const SparklineSegments = React.memo(({
  points, minY, maxY, range, padding, chartH, chartW, color,
}: {
  points: number[]; minY: number; maxY: number; range: number;
  padding: number; chartH: number; chartW: number; color: string;
}) => {
  const stepX = (chartW - padding * 2) / (points.length - 1);

  return (
    <>
      {points.slice(0, -1).map((_, i) => {
        const x1 = padding + i * stepX;
        const y1 = padding + ((maxY - points[i]) / range) * (chartH - padding * 2);
        const x2 = padding + (i + 1) * stepX;
        const y2 = padding + ((maxY - points[i + 1]) / range) * (chartH - padding * 2);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: x1,
              top: y1,
              width: length,
              height: 2,
              backgroundColor: color,
              borderRadius: 1,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: 'left center',
              opacity: 0.9,
            }}
          />
        );
      })}
    </>
  );
});

// ── Picks Action Section ─────────────────────────────────────────
function PicksActionSection({
  agent, primary, pillBg, dimText, onPress, debugForcePicksReady,
}: {
  agent: AgentWithPerformance; primary: string;
  pillBg: string; dimText: string; onPress: () => void;
  debugForcePicksReady?: boolean;
}) {
  const theme = useTheme();
  const [picksViewed, setPicksViewed] = useState(false);

  const getCountdown = (): string => {
    if (!agent.auto_generate_time) return '';
    const [h, m] = agent.auto_generate_time.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const diff = target.getTime() - now.getTime();
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const hasPicksToday = agent.last_generated_at &&
    new Date(agent.last_generated_at).toDateString() === new Date().toDateString();
  const showGetPicks = (debugForcePicksReady && !picksViewed) || (hasPicksToday && !picksViewed);
  const countdown = getCountdown();

  const handleGetPicks = () => {
    setPicksViewed(true);
    // TODO: trigger reveal animation, then navigate
    onPress();
  };

  return (
    <View style={[actionStyles.section, { backgroundColor: pillBg }]}>
      {showGetPicks ? (
        <TouchableOpacity style={[actionStyles.button, { backgroundColor: 'rgba(0,230,118,0.15)' }]} onPress={handleGetPicks}>
          <MaterialCommunityIcons name="lightning-bolt" size={14} color="#00E676" />
          <Text style={[actionStyles.buttonText, { color: '#00E676' }]}>Picks Ready</Text>
        </TouchableOpacity>
      ) : (
        <View style={actionStyles.countdownContainer}>
          <MaterialCommunityIcons name="clock-outline" size={13} color={dimText} />
          <Text style={[actionStyles.countdownLabel, { color: dimText }]}>Next run in</Text>
          <Text style={[actionStyles.countdownValue, { color: theme.colors.onSurface }]}>{countdown}</Text>
        </View>
      )}
    </View>
  );
}

const actionStyles = StyleSheet.create({
  section: {
    borderRadius: 12,
    marginTop: 6,
    padding: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  countdownLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  countdownValue: {
    fontSize: 14,
    fontWeight: '800',
  },
});

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

export function AgentIdCard({ agent, onPress, onLongPress, debugForcePicksReady }: AgentIdCardProps) {
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

  const primary = getPrimaryColor(agent.avatar_color);
  const secondary = getSecondaryColor(agent.avatar_color);
  const cardBg = isDark ? '#1a1a1a' : '#ffffff';
  const pillBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const dimText = isDark ? '#8b949e' : '#6b7280';

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
      {/* Glowing accent bar */}
      <GlowAccentBar color={primary} />

      {/* Background color gradient */}
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
              {hasPixelEmoji(agent.avatar_emoji)
                ? <PixelEmojiInline emoji={agent.avatar_emoji} size={22} fps={5} />
                : <Text style={styles.emoji}>{agent.avatar_emoji}</Text>
              }
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
                <LottieView
                  source={require('@/assets/pulselottie.json')}
                  autoPlay
                  loop
                  style={styles.autoLottie}
                />
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
}

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
    paddingRight: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  autoLottie: {
    width: 24,
    height: 24,
    marginLeft: 4,
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
