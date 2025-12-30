import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { parseLabelForRow } from '@/utils/nflDataFetchers';
import { getNFLTeamColors, getTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import Svg, { Path, Circle } from 'react-native-svg';

interface PublicBettingBarsProps {
  // ML data
  homeMlBets: string | null;
  awayMlBets: string | null;
  homeMlHandle: string | null;
  awayMlHandle: string | null;
  mlSplitsLabel: string | null;
  // Spread data
  homeSpreadBets: string | null;
  awaySpreadBets: string | null;
  homeSpreadHandle: string | null;
  awaySpreadHandle: string | null;
  spreadSplitsLabel: string | null;
  // Total data
  overBets: string | null;
  underBets: string | null;
  overHandle: string | null;
  underHandle: string | null;
  totalSplitsLabel: string | null;
  // Teams
  homeTeam: string;
  awayTeam: string;
}

// Convert decimal string to percentage (e.g., "0.61" -> 61)
const toPercent = (value: string | null): number | null => {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
};

// Get position (0-4) for gauge based on percentage
// 0 = Extra Low (0-20%), 1 = Low (21-40%), 2 = Middle (41-60%), 3 = High (61-80%), 4 = Extra High (81-100%)
const getGaugePosition = (percent: number | null): number => {
  if (percent === null) return 2; // Default to middle
  if (percent <= 20) return 0;
  if (percent <= 40) return 1;
  if (percent <= 60) return 2;
  if (percent <= 80) return 3;
  return 4;
};

// Get color for gauge position
const getGaugeColor = (position: number): string => {
  switch (position) {
    case 0: return '#ef4444'; // Red - Extra Low
    case 1: return '#f97316'; // Orange - Low
    case 2: return '#eab308'; // Yellow - Middle
    case 3: return '#84cc16'; // Light Green - High
    case 4: return '#22c55e'; // Green - Extra High
    default: return '#64748b';
  }
};

// Speedometer-style Gauge Component
const SemiGauge = ({ percent }: { percent: number | null }) => {
  const position = getGaugePosition(percent);
  const color = getGaugeColor(position);
  const size = 36;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2 + 2;

  // Segment colors (red to green gradient)
  const segmentColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  // 5 segment boundaries along the arc (180° to 0°)
  const segmentAngles = [
    Math.PI,           // Start of segment 0
    Math.PI * 0.8,     // Start of segment 1
    Math.PI * 0.6,     // Start of segment 2
    Math.PI * 0.4,     // Start of segment 3
    Math.PI * 0.2,     // Start of segment 4
    0,                 // End of segment 4
  ];

  // Calculate needle angle based on exact percentage (smooth positioning)
  const actualPercent = percent ?? 50;
  const needleAngle = Math.PI * (1 - actualPercent / 100); // Maps 0-100% to π-0
  const needleLength = radius - 4;
  const needleEndX = centerX + needleLength * Math.cos(needleAngle);
  const needleEndY = centerY - needleLength * Math.sin(needleAngle);

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size / 2 + 6}>
        {/* Colored arc segments */}
        {[0, 1, 2, 3, 4].map((seg) => {
          const segStart = segmentAngles[seg];
          const segEnd = segmentAngles[seg + 1];
          const x1 = centerX + radius * Math.cos(segStart);
          const y1 = centerY - radius * Math.sin(segStart);
          const x2 = centerX + radius * Math.cos(segEnd);
          const y2 = centerY - radius * Math.sin(segEnd);

          return (
            <Path
              key={seg}
              d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
              stroke={segmentColors[seg]}
              strokeWidth={strokeWidth}
              fill="none"
              opacity={seg === position ? 1 : 0.4}
            />
          );
        })}
        {/* Needle */}
        <Path
          d={`M ${centerX} ${centerY} L ${needleEndX} ${needleEndY}`}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <Circle cx={centerX} cy={centerY} r={3} fill={color} />
      </Svg>
    </View>
  );
};

export function PublicBettingBars({
  homeMlBets,
  awayMlBets,
  homeMlHandle,
  awayMlHandle,
  mlSplitsLabel,
  homeSpreadBets,
  awaySpreadBets,
  homeSpreadHandle,
  awaySpreadHandle,
  spreadSplitsLabel,
  overBets,
  underBets,
  overHandle,
  underHandle,
  totalSplitsLabel,
  homeTeam,
  awayTeam
}: PublicBettingBarsProps) {
  const theme = useTheme();

  const homeColors = getNFLTeamColors(homeTeam);
  const awayColors = getNFLTeamColors(awayTeam);

  // Check if we have data for each section (numeric data OR label)
  const hasMlData = homeMlBets || awayMlBets || homeMlHandle || awayMlHandle || mlSplitsLabel;
  const hasSpreadData = homeSpreadBets || awaySpreadBets || homeSpreadHandle || awaySpreadHandle || spreadSplitsLabel;
  const hasTotalData = overBets || underBets || overHandle || underHandle || totalSplitsLabel;

  if (!hasMlData && !hasSpreadData && !hasTotalData) {
    return null;
  }

  // Parse labels to determine which row gets the label
  const mlLabelInfo = parseLabelForRow(mlSplitsLabel, homeTeam, awayTeam);
  const spreadLabelInfo = parseLabelForRow(spreadSplitsLabel, homeTeam, awayTeam);
  const totalLabelInfo = parseLabelForRow(totalSplitsLabel, homeTeam, awayTeam);

  // Render a team row for ML/Spread sections
  const renderTeamRow = (
    team: string,
    colors: { primary: string; secondary: string },
    betsPercent: number | null,
    handlePercent: number | null
  ) => (
    <View style={styles.dataRow}>
      {/* Team circle */}
      <View style={styles.teamCell}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.teamCircle}
        >
          <Text style={[styles.teamInitials, { color: getContrastingTextColor(colors.primary, colors.secondary) }]}>
            {getTeamInitials(team)}
          </Text>
        </LinearGradient>
      </View>

      {/* Bets Gauge */}
      <View style={styles.gaugeCell}>
        <SemiGauge percent={betsPercent} />
      </View>

      {/* Money Gauge */}
      <View style={styles.gaugeCell}>
        <SemiGauge percent={handlePercent} />
      </View>
    </View>
  );

  // Render Over/Under row for Total section
  const renderTotalRow = (
    side: 'Over' | 'Under',
    betsPercent: number | null,
    handlePercent: number | null
  ) => {
    const isOver = side === 'Over';
    const iconColor = isOver ? '#f97316' : '#3b82f6';
    const bgColor = isOver ? 'rgba(249, 115, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)';

    return (
      <View style={styles.dataRow}>
        {/* Over/Under icon */}
        <View style={styles.teamCell}>
          <View style={[styles.totalCircle, { backgroundColor: bgColor }]}>
            <MaterialCommunityIcons
              name={isOver ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={iconColor}
            />
          </View>
          <Text style={[styles.totalSideText, { color: theme.colors.onSurface }]}>{side}</Text>
        </View>

        {/* Bets Gauge */}
        <View style={styles.gaugeCell}>
          <SemiGauge percent={betsPercent} />
        </View>

        {/* Money Gauge */}
        <View style={styles.gaugeCell}>
          <SemiGauge percent={handlePercent} />
        </View>
      </View>
    );
  };

  // Render column headers
  const renderHeaderRow = () => (
    <View style={styles.headerRow}>
      <View style={styles.teamCell}>
        <Text style={[styles.headerText, { color: theme.colors.onSurfaceVariant }]}>Team</Text>
      </View>
      <View style={styles.gaugeCell}>
        <Text style={[styles.headerText, { color: theme.colors.onSurfaceVariant }]}>Bets</Text>
      </View>
      <View style={styles.gaugeCell}>
        <Text style={[styles.headerText, { color: theme.colors.onSurfaceVariant }]}>Money</Text>
      </View>
    </View>
  );

  // Render indicator badge that spans both rows
  const renderIndicator = (labelText: string | null) => {
    if (!labelText) return null;

    return (
      <View style={styles.indicatorContainer}>
        <View style={styles.indicatorBadge}>
          <MaterialCommunityIcons name="information" size={14} color="#22c55e" style={styles.indicatorIcon} />
          <Text style={styles.indicatorText}>{labelText}</Text>
        </View>
      </View>
    );
  };

  // Render a section (ML, Spread, or Total)
  const renderSection = (
    title: string,
    icon: string,
    iconColor: string,
    rows: React.ReactNode,
    labelText: string | null
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon as any} size={14} color={iconColor} />
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{title}</Text>
      </View>
      <View style={[styles.sectionContent, { backgroundColor: 'rgba(100, 116, 139, 0.08)', borderColor: 'rgba(100, 116, 139, 0.2)' }]}>
        <View style={styles.sectionInner}>
          <View style={styles.dataColumn}>
            {renderHeaderRow()}
            {rows}
          </View>
          {renderIndicator(labelText)}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(100, 116, 139, 0.1)', borderColor: 'rgba(100, 116, 139, 0.3)' }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-group" size={20} color="#22c55e" />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Public Lean
        </Text>
      </View>

      <View style={styles.sectionsContainer}>
        {/* Moneyline Section */}
        {hasMlData && renderSection(
          'Moneyline',
          'trending-up',
          '#3b82f6',
          <>
            {renderTeamRow(awayTeam, awayColors, toPercent(awayMlBets), toPercent(awayMlHandle))}
            {renderTeamRow(homeTeam, homeColors, toPercent(homeMlBets), toPercent(homeMlHandle))}
          </>,
          mlLabelInfo?.labelText || null
        )}

        {/* Spread Section */}
        {hasSpreadData && renderSection(
          'Spread',
          'target',
          '#22c55e',
          <>
            {renderTeamRow(awayTeam, awayColors, toPercent(awaySpreadBets), toPercent(awaySpreadHandle))}
            {renderTeamRow(homeTeam, homeColors, toPercent(homeSpreadBets), toPercent(homeSpreadHandle))}
          </>,
          spreadLabelInfo?.labelText || null
        )}

        {/* Total Section */}
        {hasTotalData && renderSection(
          'Total',
          'chart-bar',
          '#f97316',
          <>
            {renderTotalRow('Over', toPercent(overBets), toPercent(overHandle))}
            {renderTotalRow('Under', toPercent(underBets), toPercent(underHandle))}
          </>,
          totalLabelInfo?.labelText || null
        )}
      </View>

      {/* Explanation Section */}
      <View style={styles.explanationContainer}>
        <View style={styles.explanationHeader}>
          <MaterialCommunityIcons name="information-outline" size={14} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.explanationTitle, { color: theme.colors.onSurfaceVariant }]}>How to Read</Text>
        </View>

        <View style={styles.explanationContent}>
          <View style={styles.explanationItem}>
            <Text style={[styles.explanationLabel, { color: theme.colors.onSurface }]}>Bets</Text>
            <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
              % of total bets placed on each side
            </Text>
          </View>

          <View style={styles.explanationItem}>
            <Text style={[styles.explanationLabel, { color: theme.colors.onSurface }]}>Money</Text>
            <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
              % of total dollars wagered on each side
            </Text>
          </View>

          <View style={styles.explanationDivider} />

          <Text style={[styles.explanationSubtitle, { color: theme.colors.onSurface }]}>Indicators:</Text>

          <View style={styles.explanationItem}>
            <Text style={[styles.indicatorLabel, { color: '#22c55e' }]}>Consensus</Text>
            <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
              Both bets and money heavily favor one side
            </Text>
          </View>

          <View style={styles.explanationItem}>
            <Text style={[styles.indicatorLabel, { color: '#3b82f6' }]}>Sharp</Text>
            <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
              Public bets one way, but smart money goes the other — follow the money
            </Text>
          </View>

          <View style={styles.explanationItem}>
            <Text style={[styles.indicatorLabel, { color: '#f97316' }]}>Public</Text>
            <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
              Money is split evenly, but casual bettors lean heavily one way
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionsContainer: {
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionContent: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionInner: {
    flexDirection: 'row',
  },
  dataColumn: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 116, 139, 0.15)',
  },
  headerText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  teamCell: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gaugeCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitials: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  totalCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalSideText: {
    fontSize: 11,
    fontWeight: '600',
  },
  indicatorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(100, 116, 139, 0.15)',
    minWidth: 90,
    maxWidth: 110,
  },
  indicatorBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    alignItems: 'center',
  },
  indicatorIcon: {
    marginBottom: 4,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#22c55e',
    textAlign: 'center',
    lineHeight: 14,
  },
  explanationContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  explanationContent: {
    gap: 8,
  },
  explanationItem: {
    gap: 2,
  },
  explanationLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  explanationText: {
    fontSize: 11,
    lineHeight: 15,
  },
  explanationDivider: {
    height: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    marginVertical: 8,
  },
  explanationSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  indicatorLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
