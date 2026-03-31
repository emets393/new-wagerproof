import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAgentHRSheet } from '@/contexts/AgentHRSheetContext';
import { AgentWithPerformance } from '@/types/agent';

// ── Constants ────────────────────────────────────────────────────
const STARTING_BANKROLL = 1000;
const UNIT_SIZE = 100; // $100 per unit

// ── Helpers ──────────────────────────────────────────────────────

function formatDollars(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000) {
    const k = abs / 1000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return `${amount < 0 ? '-' : ''}$${formatted}k`;
  }
  return `${amount < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

function formatPL(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${formatDollars(amount)}`;
}

interface CompanyStats {
  bankroll: number;
  pl: number;
  totalWins: number;
  totalLosses: number;
  totalPushes: number;
  totalPicks: number;
  winRate: number | null;
  bestStreak: number;
  activeAgents: number;
  totalAgents: number;
}

function computeCompanyStats(agents: AgentWithPerformance[]): CompanyStats {
  let totalNetUnits = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalPushes = 0;
  let totalPicks = 0;
  let bestStreak = 0;
  let activeAgents = 0;

  for (const agent of agents) {
    const perf = agent.performance;
    if (perf) {
      totalNetUnits += perf.net_units;
      totalWins += perf.wins;
      totalLosses += perf.losses;
      totalPushes += perf.pushes;
      totalPicks += perf.total_picks;
      if (perf.best_streak > bestStreak) bestStreak = perf.best_streak;
    }
    if (agent.is_active) activeAgents++;
  }

  const settled = totalWins + totalLosses;
  const pl = totalNetUnits * UNIT_SIZE;

  return {
    bankroll: STARTING_BANKROLL + pl,
    pl,
    totalWins,
    totalLosses,
    totalPushes,
    totalPicks,
    winRate: settled > 0 ? (totalWins / settled) * 100 : null,
    bestStreak,
    activeAgents,
    totalAgents: agents.length,
  };
}

// ── Stat cell ────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  valueColor,
  isDark,
}: {
  label: string;
  value: string;
  valueColor?: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.statCell}>
      <Text
        style={[
          styles.statLabel,
          { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)' },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.statValue,
          { color: valueColor ?? (isDark ? '#ffffff' : '#111111') },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────

interface CompanyDashboardBannerProps {
  agents: AgentWithPerformance[];
}

export function CompanyDashboardBanner({ agents }: CompanyDashboardBannerProps) {
  const { isDark } = useThemeContext();
  const { openSheet } = useAgentHRSheet();

  const stats = useMemo(() => computeCompanyStats(agents), [agents]);

  // Don't show if no settled picks at all
  if (stats.totalPicks === 0) return null;

  const isProfit = stats.pl >= 0;
  const accentColor = isProfit ? '#00E676' : '#FF5252';
  const borderColor = isDark ? 'rgba(0, 230, 118, 0.35)' : 'rgba(0, 230, 118, 0.45)';
  const bgColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.6)';
  const scanlineColor = isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.012)';

  const record = stats.totalPushes > 0
    ? `${stats.totalWins}-${stats.totalLosses}-${stats.totalPushes}`
    : `${stats.totalWins}-${stats.totalLosses}`;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.glassContainer, { backgroundColor: bgColor, borderColor }]}>
        <View style={styles.container}>
          {/* Scanline overlay for retro CRT effect */}
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.scanline,
                { top: i * 8, backgroundColor: scanlineColor },
              ]}
            />
          ))}

          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerIcon]}>
              {'>'}_
            </Text>
            <Text
              style={[
                styles.headerTitle,
                { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' },
              ]}
            >
              COMPANY HQ
            </Text>
            <View style={{ flex: 1 }} />
            <Text
              style={[
                styles.agentCount,
                { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)' },
              ]}
            >
              {stats.activeAgents}/{stats.totalAgents} ACTIVE
            </Text>
          </View>

          {/* Hero bankroll + HR button */}
          <View style={styles.heroRow}>
            <View style={styles.heroLeft}>
              <Text
                style={[
                  styles.bankrollLabel,
                  { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' },
                ]}
              >
                BANKROLL
              </Text>
              <Text
                style={[
                  styles.bankrollValue,
                  { color: isDark ? '#ffffff' : '#111111' },
                ]}
              >
                {formatDollars(stats.bankroll)}
              </Text>
              <View style={[styles.plBadge, { backgroundColor: isProfit ? 'rgba(0,230,118,0.12)' : 'rgba(255,82,82,0.12)' }]}>
                <Text style={[styles.plText, { color: accentColor }]}>
                  {formatPL(stats.pl)} FROM $1K
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.hrButton,
                {
                  backgroundColor: isDark ? 'rgba(0,230,118,0.08)' : 'rgba(0,230,118,0.06)',
                  borderColor: isDark ? 'rgba(0,230,118,0.3)' : 'rgba(0,230,118,0.35)',
                },
              ]}
              onPress={() => openSheet(agents)}
              activeOpacity={0.7}
            >
              <Text style={styles.hrButtonText}>TAP FOR</Text>
              <Text style={styles.hrButtonTextBig}>HR</Text>
            </TouchableOpacity>
          </View>

          {/* Pixel divider */}
          <View style={styles.pixelDividerRow}>
            {Array.from({ length: 40 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pixelDividerDot,
                  {
                    backgroundColor: i % 2 === 0
                      ? (isDark ? 'rgba(0,230,118,0.2)' : 'rgba(0,230,118,0.25)')
                      : 'transparent',
                  },
                ]}
              />
            ))}
          </View>

          {/* Stats grid */}
          <View style={styles.statsRow}>
            <StatCell
              label="RECORD"
              value={record}
              isDark={isDark}
            />
            <StatCell
              label="WIN RATE"
              value={stats.winRate !== null ? `${stats.winRate.toFixed(1)}%` : '--'}
              valueColor={
                stats.winRate !== null
                  ? stats.winRate >= 55 ? '#00E676' : stats.winRate >= 50 ? (isDark ? '#ffffff' : '#111111') : '#FF5252'
                  : undefined
              }
              isDark={isDark}
            />
            <StatCell
              label="BEST RUN"
              value={stats.bestStreak > 0 ? `W${stats.bestStreak}` : '--'}
              valueColor={stats.bestStreak >= 5 ? '#00E676' : undefined}
              isDark={isDark}
            />
            <StatCell
              label="PICKS"
              value={`${stats.totalPicks}`}
              isDark={isDark}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  glassContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  headerIcon: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: '#00E676',
  },
  headerTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: 'Courier',
  },
  headerDivider: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginHorizontal: 6,
  },
  headerDot: {
    width: 2,
    height: 2,
  },
  agentCount: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'Courier',
  },
  hrButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hrButtonText: {
    fontSize: 8,
    fontWeight: '700',
    fontFamily: 'Courier',
    letterSpacing: 1,
    color: '#00E676',
  },
  hrButtonTextBig: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Courier',
    letterSpacing: 2,
    color: '#00E676',
    marginTop: -2,
  },
  // Hero bankroll
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroLeft: {
    gap: 1,
  },
  bankrollLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: 'Courier',
  },
  bankrollValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    fontFamily: 'Courier',
  },
  heroRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  plBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  plText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'Courier',
    letterSpacing: -0.5,
  },
  plSubtext: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'Courier',
  },
  // Pixel divider
  pixelDividerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 8,
  },
  pixelDividerDot: {
    width: 2,
    height: 2,
  },
  // Stats grid
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: 'Courier',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Courier',
    letterSpacing: -0.3,
  },
});
