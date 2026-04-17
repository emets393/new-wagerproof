import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { TeamAvatar } from '../TeamAvatar';
import { Button } from '../ui/Button';
import {
  formatSpread,
  formatMoneyline,
  formatCompactDate,
  convertTimeToEST,
  roundToNearestHalf,
} from '@/utils/formatting';
import { getNFLTeamColors, getTeamParts } from '@/utils/teamColors';

// Onboarding demo sheet. Visually mirrors NFLGameBottomSheet but renders
// static mocks of every widget so we never hit the network. Users see the
// full range of pro data we surface per matchup; none of the real widgets
// (PolymarketWidget, PublicBettingBars, H2HSection, LineMovementSection,
// AgentPickRationaleWidget) are rendered because they all fetch live data.

const DEMO_AWAY = 'Kansas City';
const DEMO_HOME = 'Buffalo';
const DEMO_GAME_DATE = '2025-01-26';
const DEMO_GAME_TIME = '18:30:00';
const DEMO_AWAY_SPREAD = -2.5;
const DEMO_HOME_SPREAD = 2.5;
const DEMO_AWAY_ML = -155;
const DEMO_HOME_ML = 135;
const DEMO_OU = 47.5;
const DEMO_SPREAD_CONFIDENCE = 72;
const DEMO_OU_CONFIDENCE = 65;

const EXPLAINER =
  "We pull live pro-grade data for every matchup — model predictions, odds, market movement, public betting, weather, and more — then translate it into plain language right inside the Game Card.";

export interface DemoGameBottomSheetHandle {
  open: () => void;
  close: () => void;
}

interface DemoGameBottomSheetProps {
  onContinue: () => void;
  onClose?: () => void;
}

export const DemoGameBottomSheet = forwardRef<
  DemoGameBottomSheetHandle,
  DemoGameBottomSheetProps
>(function DemoGameBottomSheet({ onContinue, onClose }, ref) {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['90%'], []);

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.snapToIndex(0),
    close: () => sheetRef.current?.close(),
  }));

  const awayColors = getNFLTeamColors(DEMO_AWAY);
  const homeColors = getNFLTeamColors(DEMO_HOME);
  const awayParts = getTeamParts(DEMO_AWAY);
  const homeParts = getTeamParts(DEMO_HOME);

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.7}
    />
  );

  const handleClose = () => {
    onClose?.();
  };

  const BannerSection = ({ id }: { id: 'top' | 'bottom' }) => (
    <View
      style={[
        styles.banner,
        { borderColor: 'rgba(34, 197, 94, 0.35)' },
      ]}
    >
      <LinearGradient
        colors={['rgba(34, 197, 94, 0.18)', 'rgba(34, 197, 94, 0.05)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bannerHeader}>
        <MaterialCommunityIcons name="star-four-points" size={18} color="#22c55e" />
        <Text style={styles.bannerTitle}>
          Every matchup, at pro-level depth
        </Text>
      </View>
      <Text style={styles.bannerBody}>{EXPLAINER}</Text>
      <Button
        variant="glass"
        forceDarkMode
        fullWidth
        onPress={onContinue}
        style={styles.bannerButton}
      >
        {id === 'top' ? 'Continue' : "Let's go"}
      </Button>
    </View>
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={handleClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      }}
      handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.4)' }}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BannerSection id="top" />

        {/* WagerBot Insight pill replica */}
        <View style={styles.insightPill}>
          <MaterialCommunityIcons name="robot" size={16} color="#00E676" />
          <Text style={styles.insightText}>
            Model likes the road favorite — sharp money agrees.
          </Text>
        </View>

        {/* Team header + odds */}
        <View style={styles.card}>
          <LinearGradient
            colors={[awayColors.primary, awayColors.secondary, homeColors.primary, homeColors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          />
          <View style={styles.dateTimeRow}>
            <Text style={styles.dateText}>{formatCompactDate(DEMO_GAME_DATE)}</Text>
            <View style={styles.timeBadge}>
              <Text style={styles.timeText}>{convertTimeToEST(DEMO_GAME_TIME)}</Text>
            </View>
          </View>

          <View style={styles.teamsRow}>
            <View style={styles.teamSection}>
              <TeamAvatar teamName={DEMO_AWAY} sport="nfl" size={72} />
              <Text style={styles.teamCity}>{awayParts.city}</Text>
              <Text style={styles.teamName}>{awayParts.name}</Text>
              <View style={styles.teamLines}>
                <View style={[styles.linePill, styles.spreadPill]}>
                  <Text style={[styles.linePillText, { color: '#22c55e' }]}>
                    {formatSpread(DEMO_AWAY_SPREAD)}
                  </Text>
                </View>
                <View style={[styles.linePill, styles.mlPill]}>
                  <Text style={[styles.linePillText, { color: '#3b82f6' }]}>
                    {formatMoneyline(DEMO_AWAY_ML)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.centerSection}>
              <Text style={styles.vsText}>@</Text>
              <View style={styles.totalPill}>
                <Text style={styles.totalText}>O/U: {roundToNearestHalf(DEMO_OU)}</Text>
              </View>
            </View>

            <View style={styles.teamSection}>
              <TeamAvatar teamName={DEMO_HOME} sport="nfl" size={72} />
              <Text style={styles.teamCity}>{homeParts.city}</Text>
              <Text style={styles.teamName}>{homeParts.name}</Text>
              <View style={styles.teamLines}>
                <View style={[styles.linePill, styles.spreadPill]}>
                  <Text style={[styles.linePillText, { color: '#22c55e' }]}>
                    {formatSpread(DEMO_HOME_SPREAD)}
                  </Text>
                </View>
                <View style={[styles.linePill, styles.mlPill]}>
                  <Text style={[styles.linePillText, { color: '#3b82f6' }]}>
                    {formatMoneyline(DEMO_HOME_ML)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Weather */}
        <SectionLabel>Weather</SectionLabel>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="weather-partly-cloudy" size={20} color="#3b82f6" />
            <Text style={styles.rowTitle}>Weather Conditions</Text>
          </View>
          <View style={styles.weatherContent}>
            <WeatherCell icon="thermometer" text="78°F" />
            <WeatherCell icon="weather-windy" text="6 mph" />
            <WeatherCell icon="weather-rainy" text="10%" />
          </View>
        </View>

        {/* Market Odds (Polymarket-style replica) */}
        <SectionLabel>Market Odds</SectionLabel>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="chart-line" size={20} color="#a855f7" />
            <Text style={styles.rowTitle}>Polymarket</Text>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          <MarketRow team={DEMO_AWAY} percent={58} color="#22c55e" />
          <MarketRow team={DEMO_HOME} percent={42} color="#ef4444" />
        </View>

        {/* Spread Prediction */}
        <SectionLabel>Spread Analysis</SectionLabel>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="target" size={20} color="#22c55e" />
            <Text style={styles.rowTitle}>Spread Prediction</Text>
          </View>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonBox}>
              <Text style={styles.comparisonLabel}>Vegas Spread</Text>
              <Text style={styles.comparisonValue}>{formatSpread(DEMO_AWAY_SPREAD)}</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={20} color="rgba(255,255,255,0.5)" />
            <View style={[styles.comparisonBox, styles.comparisonBoxAccent]}>
              <Text style={[styles.comparisonLabel, { color: '#22c55e' }]}>Confidence</Text>
              <Text style={[styles.comparisonValue, { color: '#22c55e' }]}>
                {DEMO_SPREAD_CONFIDENCE}%
              </Text>
            </View>
          </View>
          <View style={styles.edgeRow}>
            <TeamAvatar teamName={DEMO_AWAY} sport="nfl" size={36} />
            <View style={styles.edgeText}>
              <Text style={styles.edgeTeam}>{DEMO_AWAY} covers</Text>
              <Text style={styles.edgeDelta}>
                {formatSpread(DEMO_AWAY_SPREAD)} at {DEMO_SPREAD_CONFIDENCE}.0%
              </Text>
            </View>
          </View>
        </View>

        {/* Over/Under Prediction */}
        <SectionLabel>Total Analysis</SectionLabel>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="arrow-up-bold" size={20} color="#22c55e" />
            <Text style={styles.rowTitle}>Over/Under Prediction</Text>
          </View>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonBox}>
              <Text style={styles.comparisonLabel}>Vegas O/U</Text>
              <Text style={styles.comparisonValue}>{roundToNearestHalf(DEMO_OU)}</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={20} color="rgba(255,255,255,0.5)" />
            <View style={[styles.comparisonBox, styles.comparisonBoxAccent]}>
              <Text style={[styles.comparisonLabel, { color: '#22c55e' }]}>Confidence</Text>
              <Text style={[styles.comparisonValue, { color: '#22c55e' }]}>
                {DEMO_OU_CONFIDENCE}%
              </Text>
            </View>
          </View>
          <View style={styles.edgeRow}>
            <MaterialCommunityIcons name="chevron-up" size={28} color="#22c55e" />
            <View style={styles.edgeText}>
              <Text style={styles.edgeTeam}>Over {roundToNearestHalf(DEMO_OU)}</Text>
              <Text style={styles.edgeDelta}>{DEMO_OU_CONFIDENCE}.0% confidence</Text>
            </View>
          </View>
        </View>

        {/* Public Betting */}
        <SectionLabel>Public Betting</SectionLabel>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="account-group" size={20} color="#f59e0b" />
            <Text style={styles.rowTitle}>Where the public is</Text>
          </View>
          <PublicSplitRow label="Moneyline" awayTeam={DEMO_AWAY} homeTeam={DEMO_HOME} awayPercent={63} homePercent={37} />
          <PublicSplitRow label="Spread" awayTeam={DEMO_AWAY} homeTeam={DEMO_HOME} awayPercent={71} homePercent={29} />
          <PublicSplitRow label="Total" awayTeam="Over" homeTeam="Under" awayPercent={56} homePercent={44} overUnder />
        </View>

        {/* Head-to-Head */}
        <SectionLabel>Head-to-Head</SectionLabel>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="history" size={20} color="#8b5cf6" />
            <Text style={styles.rowTitle}>Last 3 Meetings</Text>
          </View>
          <H2HRow date="Oct 15, 2024" winner={DEMO_AWAY} score="27 - 24" spreadResult="Cover" />
          <H2HRow date="Jan 21, 2024" winner={DEMO_HOME} score="20 - 17" spreadResult="Push" />
          <H2HRow date="Dec 10, 2023" winner={DEMO_AWAY} score="31 - 17" spreadResult="Cover" />
        </View>

        {/* Line Movement */}
        <SectionLabel>Line Movement</SectionLabel>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="trending-up" size={20} color="#06b6d4" />
            <Text style={styles.rowTitle}>Spread Over Time</Text>
            <View style={styles.deltaPill}>
              <MaterialCommunityIcons name="arrow-down" size={10} color="#22c55e" />
              <Text style={styles.deltaText}>1.0</Text>
            </View>
          </View>
          <LineMovementChart />
          <View style={styles.lineMovementLegend}>
            <LegendDot color="#64748b" label="Open -3.5" />
            <LegendDot color="#06b6d4" label="Current -2.5" />
          </View>
        </View>

        <View style={{ height: 12 }} />
        <BannerSection id="bottom" />
        <View style={{ height: 40 }} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

// ─── Subcomponents ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function WeatherCell({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.weatherItem}>
      <MaterialCommunityIcons name={icon} size={16} color="#3b82f6" />
      <Text style={styles.weatherText}>{text}</Text>
    </View>
  );
}

function MarketRow({ team, percent, color }: { team: string; percent: number; color: string }) {
  return (
    <View style={styles.marketRow}>
      <View style={styles.marketHeader}>
        <TeamAvatar teamName={team} sport="nfl" size={24} />
        <Text style={styles.marketTeam}>{team}</Text>
        <Text style={[styles.marketPercent, { color }]}>{percent}%</Text>
      </View>
      <View style={styles.marketBarBg}>
        <View style={[styles.marketBarFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function PublicSplitRow({
  label,
  awayTeam,
  homeTeam,
  awayPercent,
  homePercent,
  overUnder = false,
}: {
  label: string;
  awayTeam: string;
  homeTeam: string;
  awayPercent: number;
  homePercent: number;
  overUnder?: boolean;
}) {
  const leftColor = awayPercent > homePercent ? '#22c55e' : '#64748b';
  const rightColor = homePercent > awayPercent ? '#22c55e' : '#64748b';
  return (
    <View style={styles.splitRow}>
      <Text style={styles.splitLabel}>{label}</Text>
      <View style={styles.splitBars}>
        <View style={styles.splitSideLeft}>
          <Text style={styles.splitTeam}>{overUnder ? awayTeam : awayTeam}</Text>
          <Text style={[styles.splitPercent, { color: leftColor }]}>{awayPercent}%</Text>
        </View>
        <View style={styles.splitBarBg}>
          <View style={[styles.splitBarFill, { width: `${awayPercent}%`, backgroundColor: leftColor }]} />
        </View>
        <View style={styles.splitSideRight}>
          <Text style={[styles.splitPercent, { color: rightColor }]}>{homePercent}%</Text>
          <Text style={styles.splitTeam}>{homeTeam}</Text>
        </View>
      </View>
    </View>
  );
}

function H2HRow({
  date,
  winner,
  score,
  spreadResult,
}: {
  date: string;
  winner: string;
  score: string;
  spreadResult: string;
}) {
  const resultColor =
    spreadResult === 'Cover' ? '#22c55e' : spreadResult === 'Push' ? '#eab308' : '#ef4444';
  return (
    <View style={styles.h2hRow}>
      <Text style={styles.h2hDate}>{date}</Text>
      <View style={styles.h2hMiddle}>
        <TeamAvatar teamName={winner} sport="nfl" size={24} />
        <Text style={styles.h2hScore}>{score}</Text>
      </View>
      <View style={[styles.h2hResultPill, { backgroundColor: `${resultColor}22`, borderColor: `${resultColor}55` }]}>
        <Text style={[styles.h2hResultText, { color: resultColor }]}>{spreadResult}</Text>
      </View>
    </View>
  );
}

function LineMovementChart() {
  // Static fake sparkline. No data fetching. Values mimic a spread drifting
  // from -3.5 (open) to -2.5 (now) over 8 data points.
  const points = [12, 10, 14, 18, 22, 28, 32, 40];
  const width = 280;
  const height = 70;
  const stepX = width / (points.length - 1);
  const maxY = Math.max(...points);
  const minY = Math.min(...points);
  const coords = points
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - minY) / (maxY - minY || 1)) * (height - 10) - 5;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          points={coords}
          fill="none"
          stroke="#06b6d4"
          strokeWidth={2}
        />
        {points.map((v, i) => {
          const x = i * stepX;
          const y = height - ((v - minY) / (maxY - minY || 1)) * (height - 10) - 5;
          return <Circle key={i} cx={x} cy={y} r={3} fill="#06b6d4" />;
        })}
      </Svg>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
    gap: 10,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  bannerBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 20,
  },
  bannerButton: {
    marginTop: 8,
  },
  insightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.3)',
  },
  insightText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: -4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#222',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
    overflow: 'hidden',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  timeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  timeText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
  },
  teamSection: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  teamCity: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  teamName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  teamLines: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
  },
  linePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  spreadPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  mlPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  linePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  centerSection: {
    alignItems: 'center',
    gap: 6,
  },
  vsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 20,
    fontWeight: '600',
  },
  totalPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    borderColor: 'rgba(156, 163, 175, 0.3)',
  },
  totalText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rowTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
  weatherContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  weatherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  marketRow: {
    gap: 6,
    marginBottom: 10,
  },
  marketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marketTeam: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  marketPercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  marketBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  marketBarFill: {
    height: '100%',
    borderRadius: 4,
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  comparisonBoxAccent: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },
  comparisonLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  comparisonValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  edgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  edgeText: {
    flex: 1,
  },
  edgeTeam: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  edgeDelta: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  splitRow: {
    marginBottom: 10,
  },
  splitLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  splitBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splitSideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 90,
  },
  splitSideRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 90,
    justifyContent: 'flex-end',
  },
  splitTeam: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  splitPercent: {
    fontSize: 13,
    fontWeight: '700',
  },
  splitBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  splitBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  h2hDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    width: 96,
  },
  h2hMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  h2hScore: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  h2hResultPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  h2hResultText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  deltaText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700',
  },
  chartWrap: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  lineMovementLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
});
