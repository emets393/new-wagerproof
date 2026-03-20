import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';

interface MatchSimulatorTerminalProps {
  /** Called when the terminal animation finishes all steps */
  onComplete: () => void;
}

const SIMULATION_STEPS = [
  'Initializing match engine...',
  'Loading team rosters and depth charts...',
  'Ingesting season averages and recent form...',
  'Adjusting for home-court advantage and travel fatigue...',
  'Factoring in injury reports and lineup changes...',
  'Analyzing pace-of-play and tempo matchup...',
  'Running 10,000 Monte Carlo game simulations...',
  'Weighting offensive and defensive efficiency ratings...',
  'Calibrating against current Vegas lines and market odds...',
  'Aggregating scenario outcomes and finalizing score...',
];

const CHAR_INTERVAL_MS = 14;
const LINE_PAUSE_MS = 200;
const CURSOR_BLINK_MS = 500;

export function MatchSimulatorTerminal({ onComplete }: MatchSimulatorTerminalProps) {
  const { isDark } = useThemeContext();
  const scrollViewRef = useRef<ScrollView>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const [historyLines, setHistoryLines] = useState<string[]>([]);
  const [activeLine, setActiveLine] = useState('');
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, CURSOR_BLINK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
    };

    clearTimers();
    setHistoryLines([]);
    setActiveLine('');
    setActiveLineIndex(0);
    setCursorVisible(true);

    let lineIndex = 0;
    let charIndex = 0;

    const typeCurrentLine = () => {
      const fullLine = SIMULATION_STEPS[lineIndex];
      if (!fullLine) return;

      setActiveLineIndex(lineIndex);
      setActiveLine('');
      charIndex = 0;

      const typeNextChar = () => {
        if (charIndex < fullLine.length) {
          setActiveLine(fullLine.substring(0, charIndex + 1));
          charIndex += 1;
          const timer = setTimeout(typeNextChar, CHAR_INTERVAL_MS);
          timersRef.current.push(timer);
          return;
        }

        if (lineIndex < SIMULATION_STEPS.length - 1) {
          setHistoryLines((prev) => [...prev, fullLine]);
          lineIndex += 1;
          const timer = setTimeout(typeCurrentLine, LINE_PAUSE_MS);
          timersRef.current.push(timer);
          return;
        }

        // Last line finished — notify parent
        setHistoryLines(SIMULATION_STEPS.slice(0, SIMULATION_STEPS.length - 1));
        setActiveLineIndex(SIMULATION_STEPS.length - 1);
        setActiveLine(fullLine);

        const doneTimer = setTimeout(onComplete, 400);
        timersRef.current.push(doneTimer);
      };

      typeNextChar();
    };

    const initialTimer = setTimeout(typeCurrentLine, 120);
    timersRef.current.push(initialTimer);

    return clearTimers;
  }, []); // runs once on mount

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [historyLines, activeLine]);

  const lineColor = '#00E676';
  const historyColor = isDark ? '#8ca89b' : '#a8bbb5';
  const headerColor = '#9fb3ad';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#070a0a' : '#101617', borderColor: 'rgba(0, 230, 118, 0.25)' }]}>
      <Text style={[styles.headerText, { color: headerColor }]}>
        terminal://match-simulator
      </Text>

      <ScrollView
        ref={scrollViewRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      >
        {historyLines.map((line, index) => (
          <View key={`sim-history-${index}`} style={styles.lineRow}>
            <Text style={[styles.prefix, { color: lineColor }]}>›</Text>
            <Text style={[styles.lineText, { color: historyColor }]}>{line}</Text>
          </View>
        ))}

        <View style={styles.lineRow}>
          <Text style={[styles.prefix, { color: lineColor }]}>›</Text>
          <Text style={[styles.lineText, { color: lineColor }]}>
            {activeLine}
            {cursorVisible ? ' █' : '  '}
          </Text>
        </View>

        <Text style={[styles.statusText, { color: headerColor }]}>
          Step {Math.min(activeLineIndex + 1, SIMULATION_STEPS.length)} of {SIMULATION_STEPS.length}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    minHeight: 150,
    maxHeight: 210,
  },
  headerText: {
    fontSize: 12,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingBottom: 2,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  prefix: {
    marginRight: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  lineText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusText: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
