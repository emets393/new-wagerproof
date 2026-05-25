import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { BRAND_GREEN } from '@/utils/mlbPlayerProps';

const MISS_RED = '#ef4444';

interface ChartBar {
  value: number;
  cleared: boolean;
  isDay: boolean;
  archetype: string | null;
  date: string | null;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  return `${Number(m[2])}/${Number(m[3])}`;
}

interface RecentPropBarChartProps {
  bars: ChartBar[];
  line: number;
  valueLabel?: string;
  isDark: boolean;
}

const CHART_HEIGHT = 180;
const CHART_WIDTH = 320;
const LABEL_PAD = 14; // headroom for value label above bars
const DATE_PAD = 22;  // reserved at the bottom for the rotated date labels

function formatBarValue(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function RecentPropBarChart({ bars, line, isDark }: RecentPropBarChartProps) {
  const maxVal = useMemo(() => {
    const vals = bars.map(b => b.value);
    return Math.max(line * 1.5, ...vals, line + 1, 1);
  }, [bars, line]);

  const usableHeight = CHART_HEIGHT - LABEL_PAD - DATE_PAD;
  const barsBottom = CHART_HEIGHT - DATE_PAD;
  const thresholdY = LABEL_PAD + (1 - line / maxVal) * usableHeight;
  const barWidth = bars.length > 0 ? Math.min(18, (CHART_WIDTH - 8) / bars.length - 3) : 12;

  if (bars.length === 0) {
    return <Text style={{ color: isDark ? '#888' : '#666', fontStyle: 'italic' }}>No recent games</Text>;
  }

  return (
    <View>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <Line
          x1={0}
          y1={thresholdY}
          x2={CHART_WIDTH}
          y2={thresholdY}
          stroke={BRAND_GREEN}
          strokeWidth={1.2}
          strokeDasharray="4,3"
          opacity={0.75}
        />
        <SvgText
          x={CHART_WIDTH - 4}
          y={thresholdY - 3}
          fontSize="9"
          fontWeight="700"
          fill={BRAND_GREEN}
          textAnchor="end"
        >
          Line {formatBarValue(line)}
        </SvgText>
        {bars.map((bar, i) => {
          const rawPct = bar.value / maxVal;
          const h = Math.max(10, rawPct * usableHeight);
          const x = 6 + i * (barWidth + 3);
          const y = barsBottom - h;
          const labelCx = x + barWidth / 2;
          const labelY = barsBottom + 4;
          const dateLabel = formatShortDate(bar.date);
          return (
            <React.Fragment key={i}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={2}
                fill={bar.cleared ? BRAND_GREEN : MISS_RED}
                opacity={bar.cleared ? 1 : 0.7}
              />
              <SvgText
                x={labelCx}
                y={y - 3}
                fontSize="9"
                fontWeight="700"
                fill={bar.cleared ? BRAND_GREEN : MISS_RED}
                textAnchor="middle"
              >
                {formatBarValue(bar.value)}
              </SvgText>
              {dateLabel ? (
                <SvgText
                  x={labelCx}
                  y={labelY}
                  fontSize="8"
                  fill={isDark ? '#9aa0a6' : '#666'}
                  textAnchor="end"
                  transform={`rotate(-45 ${labelCx} ${labelY})`}
                >
                  {dateLabel}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
      <Text style={[styles.caption, { color: isDark ? '#888' : '#666' }]}>
        Last {bars.length} games · oldest left → most recent right
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 10, marginTop: 4, textAlign: 'center' },
});
