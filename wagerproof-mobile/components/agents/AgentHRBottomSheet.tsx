import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAgentHRSheet } from '@/contexts/AgentHRSheetContext';
import { AgentWithPerformance, formatRecord } from '@/types/agent';

// ── Constants ────────────────────────────────────────────────────
const UNIT_SIZE = 100;

// ── Types ────────────────────────────────────────────────────────

type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

interface AgentReportCard {
  agent: AgentWithPerformance;
  grade: Grade;
  netUnits: number;
  dollarImpact: number;
  winRate: number | null;
  record: string;
  companyWithout: number; // bankroll if this agent were fired
  recommendation: string;
  isCostingMoney: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────

function getGrade(netUnits: number, winRate: number | null): Grade {
  if (netUnits >= 10) return 'S';
  if (netUnits >= 5) return 'A';
  if (netUnits >= 1) return 'B';
  if (netUnits >= 0) return 'C';
  if (netUnits >= -3) return 'D';
  return 'F';
}

function getGradeColor(grade: Grade): string {
  switch (grade) {
    case 'S': return '#FFD700';
    case 'A': return '#00E676';
    case 'B': return '#69F0AE';
    case 'C': return '#FFC107';
    case 'D': return '#FF9800';
    case 'F': return '#FF5252';
  }
}

function getRecommendation(card: AgentReportCard): string {
  const { grade, agent, netUnits, winRate } = card;
  const name = agent.name;

  if (grade === 'S') return `${name} is your MVP. Protect at all costs.`;
  if (grade === 'A') return `${name} is a top performer. Keep them running.`;
  if (grade === 'B') return `${name} is solid. Pulling their weight.`;
  if (grade === 'C') {
    if (winRate !== null && winRate >= 50) return `${name} is break-even. Could tweak personality params.`;
    return `${name} is on thin ice. Review their strategy.`;
  }
  if (grade === 'D') return `${name} is underperforming. Consider adjusting or replacing.`;
  // F grade
  return `${name} is costing you money. Fire to save $${Math.abs(Math.round(netUnits * UNIT_SIZE))}.`;
}

function formatDollars(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? '+' : '-';
  if (abs >= 1000) {
    const k = abs / 1000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return `${sign}$${formatted}k`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

function buildReportCards(
  agents: AgentWithPerformance[],
): AgentReportCard[] {
  const totalNetUnits = agents.reduce(
    (sum, a) => sum + (a.performance?.net_units ?? 0),
    0
  );
  const totalBankroll = 1000 + totalNetUnits * UNIT_SIZE;

  return agents
    .filter((a) => a.performance && a.performance.total_picks > 0)
    .map((agent) => {
      const perf = agent.performance!;
      const settled = perf.wins + perf.losses;
      const winRate = settled > 0 ? (perf.wins / settled) * 100 : null;
      const grade = getGrade(perf.net_units, winRate);
      const companyWithout = totalBankroll - perf.net_units * UNIT_SIZE;

      const card: AgentReportCard = {
        agent,
        grade,
        netUnits: perf.net_units,
        dollarImpact: perf.net_units * UNIT_SIZE,
        winRate,
        record: formatRecord(perf),
        companyWithout,
        recommendation: '',
        isCostingMoney: perf.net_units < 0,
      };
      card.recommendation = getRecommendation(card);
      return card;
    })
    .sort((a, b) => a.netUnits - b.netUnits); // worst first
}

// ── Report Card Row ──────────────────────────────────────────────

function ReportCardRow({
  card,
  isDark,
  totalBankroll,
}: {
  card: AgentReportCard;
  isDark: boolean;
  totalBankroll: number;
}) {
  const gradeColor = getGradeColor(card.grade);
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const mutedText = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const mainText = isDark ? '#ffffff' : '#111111';

  return (
    <View style={[reportStyles.card, { backgroundColor: cardBg, borderColor }]}>
      {/* Grade badge + agent identity */}
      <View style={reportStyles.cardHeader}>
        <View style={[reportStyles.gradeBadge, { backgroundColor: gradeColor + '20', borderColor: gradeColor + '40' }]}>
          <Text style={[reportStyles.gradeText, { color: gradeColor }]}>
            {card.grade}
          </Text>
        </View>
        <Text style={reportStyles.agentEmoji}>{card.agent.avatar_emoji}</Text>
        <View style={reportStyles.agentInfo}>
          <Text style={[reportStyles.agentName, { color: mainText }]} numberOfLines={1}>
            {card.agent.name}
          </Text>
          <Text style={[reportStyles.agentRecord, { color: mutedText }]}>
            {card.record} | {card.winRate !== null ? `${card.winRate.toFixed(1)}%` : '--'}
          </Text>
        </View>
        <View style={reportStyles.impactContainer}>
          <Text
            style={[
              reportStyles.impactValue,
              { color: card.netUnits >= 0 ? '#00E676' : '#FF5252' },
            ]}
          >
            {formatDollars(card.dollarImpact)}
          </Text>
          <Text style={[reportStyles.impactLabel, { color: mutedText }]}>
            IMPACT
          </Text>
        </View>
      </View>

      {/* Recommendation */}
      <Text style={[reportStyles.recommendation, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }]}>
        {card.recommendation}
      </Text>

      {/* Fire insight for agents costing money */}
      {card.isCostingMoney && (
        <View style={[reportStyles.fireInsight, { backgroundColor: 'rgba(255,82,82,0.08)', borderColor: 'rgba(255,82,82,0.15)' }]}>
          <Text style={reportStyles.fireIcon}>{'>'}_</Text>
          <Text style={reportStyles.fireText}>
            Without {card.agent.name}, your bankroll would be{' '}
            <Text style={reportStyles.fireHighlight}>
              ${card.companyWithout.toLocaleString()}
            </Text>
            {' '}(+${Math.abs(Math.round(card.dollarImpact)).toLocaleString()} saved)
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function AgentHRBottomSheet() {
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { agents, closeSheet, bottomSheetRef } = useAgentHRSheet();

  const snapPoints = useMemo(() => ['85%'], []);

  const reportCards = useMemo(() => buildReportCards(agents), [agents]);

  const totalNetUnits = agents.reduce(
    (sum, a) => sum + (a.performance?.net_units ?? 0),
    0
  );
  const totalBankroll = 1000 + totalNetUnits * UNIT_SIZE;

  const winners = useMemo(() => reportCards.filter((c) => !c.isCostingMoney).sort((a, b) => b.netUnits - a.netUnits), [reportCards]);
  const losers = useMemo(() => reportCards.filter((c) => c.isCostingMoney), [reportCards]);
  const winnersTotal = winners.reduce((sum, c) => sum + c.dollarImpact, 0);
  const losersTotal = losers.reduce((sum, c) => sum + c.dollarImpact, 0);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) closeSheet();
    },
    [closeSheet]
  );

  const bgColor = isDark ? '#0a0a0a' : '#ffffff';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const mutedText = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const mainText = isDark ? '#ffffff' : '#111111';

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: bgColor }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
        width: 40,
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          sheetStyles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Header */}
        <View style={[sheetStyles.header, { borderBottomColor: headerBorder }]}>
          <View style={sheetStyles.headerTitleRow}>
            <Text style={sheetStyles.headerIcon}>{'>'}_</Text>
            <Text style={[sheetStyles.headerTitle, { color: mainText }]}>
              HR DEPARTMENT
            </Text>
          </View>
          <Text style={[sheetStyles.headerSubtitle, { color: mutedText }]}>
            AGENT PERFORMANCE REVIEW
          </Text>
        </View>

        {/* ── WINNERS SECTION ── */}
        {winners.length > 0 && (
          <>
            <View style={[sheetStyles.summaryCard, { backgroundColor: 'rgba(0,230,118,0.06)', borderColor: 'rgba(0,230,118,0.15)' }]}>
              <View style={sheetStyles.summaryHeaderRow}>
                <Text style={[sheetStyles.summaryTitle, { color: '#00E676' }]}>
                  WINNERS
                </Text>
                <Text style={[sheetStyles.summaryStatValue, { color: '#00E676' }]}>
                  {formatDollars(winnersTotal)}
                </Text>
              </View>
              <Text style={[sheetStyles.summaryBody, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }]}>
                {winners.length} agent{winners.length !== 1 ? 's' : ''} earning money for the company.
              </Text>
            </View>

            {winners.map((card) => (
              <ReportCardRow
                key={card.agent.id}
                card={card}
                isDark={isDark}
                totalBankroll={totalBankroll}
              />
            ))}
          </>
        )}

        {/* ── LOSERS SECTION ── */}
        {losers.length > 0 && (
          <>
            <View style={[sheetStyles.summaryCard, { backgroundColor: 'rgba(255,82,82,0.06)', borderColor: 'rgba(255,82,82,0.15)', marginTop: winners.length > 0 ? 8 : 0 }]}>
              <View style={sheetStyles.summaryHeaderRow}>
                <Text style={[sheetStyles.summaryTitle, { color: '#FF5252' }]}>
                  LOSERS
                </Text>
                <Text style={[sheetStyles.summaryStatValue, { color: '#FF5252' }]}>
                  {formatDollars(losersTotal)}
                </Text>
              </View>
              <Text style={[sheetStyles.summaryBody, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }]}>
                {losers.length} agent{losers.length !== 1 ? 's are' : ' is'} costing money.
                Firing {losers.length === 1 ? 'them' : 'all'} saves{' '}
                <Text style={{ color: '#00E676', fontWeight: '800' }}>
                  ${Math.abs(Math.round(losersTotal)).toLocaleString()}
                </Text>
                {' '}and brings bankroll to{' '}
                <Text style={{ color: '#00E676', fontWeight: '800' }}>
                  ${(totalBankroll - losersTotal).toLocaleString()}
                </Text>
                .
              </Text>
            </View>

            {losers.map((card) => (
              <ReportCardRow
                key={card.agent.id}
                card={card}
                isDark={isDark}
                totalBankroll={totalBankroll}
              />
            ))}
          </>
        )}

        {reportCards.length === 0 && (
          <View style={sheetStyles.emptyState}>
            <Text style={[sheetStyles.emptyText, { color: mutedText }]}>
              No agents with settled picks yet. Check back after picks are graded.
            </Text>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ── Sheet Styles ─────────────────────────────────────────────────

const sheetStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerIcon: {
    fontSize: 14,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: '#00E676',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'Courier',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Courier',
    letterSpacing: 1.5,
    marginLeft: 24,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Courier',
    letterSpacing: 1.5,
  },
  summaryStatValue: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  summaryBody: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Courier',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Courier',
    textAlign: 'center',
  },
});

// ── Report Card Styles ───────────────────────────────────────────

const reportStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  gradeBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeText: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  agentEmoji: {
    fontSize: 20,
  },
  agentInfo: {
    flex: 1,
    gap: 1,
  },
  agentName: {
    fontSize: 14,
    fontWeight: '700',
  },
  agentRecord: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '600',
  },
  impactContainer: {
    alignItems: 'flex-end',
    gap: 1,
  },
  impactValue: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  impactLabel: {
    fontSize: 7,
    fontWeight: '700',
    fontFamily: 'Courier',
    letterSpacing: 1,
  },
  recommendation: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Courier',
  },
  fireInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  fireIcon: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: '#FF5252',
    marginTop: 2,
  },
  fireText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Courier',
    color: '#FF5252',
  },
  fireHighlight: {
    fontWeight: '900',
    color: '#00E676',
  },
});
