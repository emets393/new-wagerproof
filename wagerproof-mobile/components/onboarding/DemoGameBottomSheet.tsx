import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Polyline, Circle, Path, Line as SvgLine } from 'react-native-svg';
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
// Model projections — what our numbers say vs what Vegas has.
const DEMO_OUR_SPREAD = -4.0; // KC wins by 4.0 per the model
const DEMO_OUR_OU = 49.2; // model projects 49.2 combined points
const DEMO_SPREAD_DELTA = Math.abs(DEMO_OUR_SPREAD - DEMO_AWAY_SPREAD); // 1.5
const DEMO_OU_DELTA = DEMO_OUR_OU - DEMO_OU; // +1.7
const DEMO_SPREAD_CONFIDENCE = 72;
const DEMO_OU_CONFIDENCE = 65;

// Polymarket history (8 points, oldest → now) for the two-line chart.
const POLY_AWAY_SERIES = [50, 52, 49, 54, 56, 55, 57, 58];
const POLY_HOME_SERIES = [50, 48, 51, 46, 44, 45, 43, 42];

// Public betting splits — matches the bets/money pair the real widget shows.
const DEMO_PUBLIC = {
  ml: { awayBets: 63, awayMoney: 71, homeBets: 37, homeMoney: 29 },
  spread: { awayBets: 71, awayMoney: 78, homeBets: 29, homeMoney: 22 },
  total: { overBets: 56, overMoney: 52, underBets: 44, underMoney: 48 },
};

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
            <MaterialCommunityIcons name="chart-line-variant" size={20} color="#10b981" />
            <Text style={styles.rowTitle}>Polymarket</Text>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          {/* Current odds cards — mirrors the real PolymarketWidget header. */}
          <View style={styles.polyOddsRow}>
            <PolymarketOddsCard
              team={DEMO_AWAY}
              percent={POLY_AWAY_SERIES[POLY_AWAY_SERIES.length - 1]}
              change={POLY_AWAY_SERIES[POLY_AWAY_SERIES.length - 1] - POLY_AWAY_SERIES[0]}
              color={awayColors.primary}
            />
            <PolymarketOddsCard
              team={DEMO_HOME}
              percent={POLY_HOME_SERIES[POLY_HOME_SERIES.length - 1]}
              change={POLY_HOME_SERIES[POLY_HOME_SERIES.length - 1] - POLY_HOME_SERIES[0]}
              color={homeColors.primary}
            />
          </View>

          {/* Two-line mini chart — each side tracked over time. */}
          <PolymarketChart
            awaySeries={POLY_AWAY_SERIES}
            homeSeries={POLY_HOME_SERIES}
            awayColor={awayColors.primary}
            homeColor={homeColors.primary}
          />

          <View style={styles.polyLegendRow}>
            <LegendDot color={awayColors.primary} label={DEMO_AWAY} />
            <LegendDot color={homeColors.primary} label={DEMO_HOME} />
          </View>
        </View>

        {/* Spread Prediction */}
        <SectionLabel>Spread Analysis</SectionLabel>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="target" size={20} color="#22c55e" />
            <Text style={styles.rowTitle}>Spread Prediction</Text>
          </View>
          {/* Vegas + Our + Delta side-by-side makes the edge read at a glance. */}
          <View style={styles.tripleComparisonRow}>
            <ComparisonCell label="Vegas" value={formatSpread(DEMO_AWAY_SPREAD)} />
            <ComparisonCell label="Our Model" value={formatSpread(DEMO_OUR_SPREAD)} />
            <ComparisonCell
              label="Delta"
              value={`+${DEMO_SPREAD_DELTA.toFixed(1)}`}
              accent
            />
          </View>
          <View style={styles.edgeRow}>
            <TeamAvatar teamName={DEMO_AWAY} sport="nfl" size={36} />
            <View style={styles.edgeText}>
              <Text style={styles.edgeTeam}>{DEMO_AWAY} covers</Text>
              <Text style={styles.edgeDelta}>
                {DEMO_SPREAD_DELTA.toFixed(1)} pt edge · {DEMO_SPREAD_CONFIDENCE}% confidence
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
          <View style={styles.tripleComparisonRow}>
            <ComparisonCell label="Vegas" value={roundToNearestHalf(DEMO_OU).toString()} />
            <ComparisonCell label="Our Model" value={DEMO_OUR_OU.toFixed(1)} />
            <ComparisonCell
              label="Delta"
              value={`${DEMO_OU_DELTA >= 0 ? '+' : ''}${DEMO_OU_DELTA.toFixed(1)}`}
              accent
            />
          </View>
          <View style={styles.edgeRow}>
            <MaterialCommunityIcons name="chevron-up" size={28} color="#22c55e" />
            <View style={styles.edgeText}>
              <Text style={styles.edgeTeam}>Over {roundToNearestHalf(DEMO_OU)}</Text>
              <Text style={styles.edgeDelta}>
                {Math.abs(DEMO_OU_DELTA).toFixed(1)} pt edge · {DEMO_OU_CONFIDENCE}% confidence
              </Text>
            </View>
          </View>
        </View>

        {/* Public Betting — uses the same Bets + Money gauge layout as the
            live PublicBettingBars widget so the demo reads like the real UI. */}
        <SectionLabel>Public Betting</SectionLabel>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="account-group" size={20} color="#22c55e" />
            <Text style={styles.rowTitle}>Public Lean</Text>
          </View>

          <PublicSection title="Moneyline" icon="trending-up" iconColor="#3b82f6">
            <PublicGaugeHeader />
            <PublicGaugeRow
              label={DEMO_AWAY}
              labelColor={awayColors.primary}
              bets={DEMO_PUBLIC.ml.awayBets}
              money={DEMO_PUBLIC.ml.awayMoney}
            />
            <PublicGaugeRow
              label={DEMO_HOME}
              labelColor={homeColors.primary}
              bets={DEMO_PUBLIC.ml.homeBets}
              money={DEMO_PUBLIC.ml.homeMoney}
            />
          </PublicSection>

          <PublicSection title="Spread" icon="target" iconColor="#22c55e">
            <PublicGaugeHeader />
            <PublicGaugeRow
              label={DEMO_AWAY}
              labelColor={awayColors.primary}
              bets={DEMO_PUBLIC.spread.awayBets}
              money={DEMO_PUBLIC.spread.awayMoney}
            />
            <PublicGaugeRow
              label={DEMO_HOME}
              labelColor={homeColors.primary}
              bets={DEMO_PUBLIC.spread.homeBets}
              money={DEMO_PUBLIC.spread.homeMoney}
            />
          </PublicSection>

          <PublicSection title="Total" icon="chart-bar" iconColor="#f97316">
            <PublicGaugeHeader />
            <PublicGaugeRow
              label="Over"
              labelColor="#f97316"
              bets={DEMO_PUBLIC.total.overBets}
              money={DEMO_PUBLIC.total.overMoney}
            />
            <PublicGaugeRow
              label="Under"
              labelColor="#3b82f6"
              bets={DEMO_PUBLIC.total.underBets}
              money={DEMO_PUBLIC.total.underMoney}
            />
          </PublicSection>
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

function ComparisonCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.comparisonBox, accent && styles.comparisonBoxAccent]}>
      <Text style={[styles.comparisonLabel, accent && { color: '#22c55e' }]}>{label}</Text>
      <Text style={[styles.comparisonValue, accent && { color: '#22c55e' }]}>{value}</Text>
    </View>
  );
}

function PolymarketOddsCard({
  team,
  percent,
  change,
  color,
}: {
  team: string;
  percent: number;
  change: number;
  color: string;
}) {
  const up = change >= 0;
  return (
    <View style={[styles.polyOddsCard, { borderColor: color }]}>
      <Text style={styles.polyOddsLabel}>{team}</Text>
      <View style={styles.polyOddsValueRow}>
        <Text style={styles.polyOddsValue}>{percent}%</Text>
        <View style={styles.polyChangeContainer}>
          <MaterialCommunityIcons
            name={up ? 'trending-up' : 'trending-down'}
            size={12}
            color={up ? '#22c55e' : '#ef4444'}
          />
          <Text style={[styles.polyChangeText, { color: up ? '#22c55e' : '#ef4444' }]}>
            {up ? '+' : ''}{change}%
          </Text>
        </View>
      </View>
    </View>
  );
}

function PolymarketChart({
  awaySeries,
  homeSeries,
  awayColor,
  homeColor,
}: {
  awaySeries: number[];
  homeSeries: number[];
  awayColor: string;
  homeColor: string;
}) {
  // Fixed 0–100% y-axis so both lines share the same scale — percents on
  // Polymarket are complementary so this mirrors the real chart.
  const width = 300;
  const height = 120;
  const pad = 10;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;
  const stepX = chartW / (awaySeries.length - 1);
  const toY = (v: number) => pad + (1 - v / 100) * chartH;
  const line = (series: number[]) =>
    series.map((v, i) => `${pad + i * stepX},${toY(v)}`).join(' ');

  return (
    <View style={styles.polyChartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* 50% reference line — anchor for "pick 'em" on Polymarket. */}
        <SvgLine
          x1={pad}
          x2={width - pad}
          y1={toY(50)}
          y2={toY(50)}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <Polyline points={line(awaySeries)} fill="none" stroke={awayColor} strokeWidth={2.5} />
        <Polyline points={line(homeSeries)} fill="none" stroke={homeColor} strokeWidth={2.5} />
        {/* End-of-line dots highlight the "now" value. */}
        <Circle
          cx={pad + (awaySeries.length - 1) * stepX}
          cy={toY(awaySeries[awaySeries.length - 1])}
          r={3.5}
          fill={awayColor}
        />
        <Circle
          cx={pad + (homeSeries.length - 1) * stepX}
          cy={toY(homeSeries[homeSeries.length - 1])}
          r={3.5}
          fill={homeColor}
        />
      </Svg>
    </View>
  );
}

function PublicSection({
  title,
  icon,
  iconColor,
  children,
}: {
  title: string;
  icon: any;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.publicSection}>
      <View style={styles.publicSectionHeader}>
        <MaterialCommunityIcons name={icon} size={14} color={iconColor} />
        <Text style={styles.publicSectionTitle}>{title}</Text>
      </View>
      <View style={styles.publicSectionBody}>{children}</View>
    </View>
  );
}

function PublicGaugeHeader() {
  return (
    <View style={styles.publicHeaderRow}>
      <Text style={[styles.publicHeaderCell, { flex: 1.4 }]}>Side</Text>
      <Text style={styles.publicHeaderCell}>Bets</Text>
      <Text style={styles.publicHeaderCell}>Money</Text>
    </View>
  );
}

function PublicGaugeRow({
  label,
  labelColor,
  bets,
  money,
}: {
  label: string;
  labelColor: string;
  bets: number;
  money: number;
}) {
  return (
    <View style={styles.publicDataRow}>
      <View style={styles.publicLabelCell}>
        <View style={[styles.publicLabelDot, { backgroundColor: labelColor }]} />
        <Text style={styles.publicLabelText} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.publicGaugeCell}>
        <SemiGauge percent={bets} />
        <Text style={styles.publicPercentText}>{bets}%</Text>
      </View>
      <View style={styles.publicGaugeCell}>
        <SemiGauge percent={money} />
        <Text style={styles.publicPercentText}>{money}%</Text>
      </View>
    </View>
  );
}

function SemiGauge({ percent }: { percent: number }) {
  const size = 42;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2 + 2;

  const segmentColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
  const segmentAngles = [
    Math.PI,
    Math.PI * 0.8,
    Math.PI * 0.6,
    Math.PI * 0.4,
    Math.PI * 0.2,
    0,
  ];
  const position = (() => {
    if (percent <= 20) return 0;
    if (percent <= 40) return 1;
    if (percent <= 60) return 2;
    if (percent <= 80) return 3;
    return 4;
  })();
  const activeColor = segmentColors[position];

  // Needle angle maps 0–100% → π–0 across the semicircle.
  const needleAngle = Math.PI * (1 - percent / 100);
  const needleLen = radius - 4;
  const needleX = cx + needleLen * Math.cos(needleAngle);
  const needleY = cy - needleLen * Math.sin(needleAngle);

  return (
    <Svg width={size} height={size / 2 + 6}>
      {[0, 1, 2, 3, 4].map((seg) => {
        const a = segmentAngles[seg];
        const b = segmentAngles[seg + 1];
        const x1 = cx + radius * Math.cos(a);
        const y1 = cy - radius * Math.sin(a);
        const x2 = cx + radius * Math.cos(b);
        const y2 = cy - radius * Math.sin(b);
        return (
          <Path
            key={seg}
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
            stroke={segmentColors[seg]}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={seg === position ? 1 : 0.35}
          />
        );
      })}
      <Path
        d={`M ${cx} ${cy} L ${needleX} ${needleY}`}
        stroke={activeColor}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={cx} cy={cy} r={3} fill={activeColor} />
    </Svg>
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
  polyOddsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  polyOddsCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  polyOddsLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  polyOddsValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  polyOddsValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  polyChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 3,
  },
  polyChangeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  polyChartWrap: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 10,
  },
  polyLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  tripleComparisonRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  comparisonBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
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
  publicSection: {
    marginTop: 12,
  },
  publicSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  publicSectionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  publicSectionBody: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  publicHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  publicHeaderCell: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  publicDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  publicLabelCell: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  publicLabelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  publicLabelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  publicGaugeCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  publicPercentText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
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
