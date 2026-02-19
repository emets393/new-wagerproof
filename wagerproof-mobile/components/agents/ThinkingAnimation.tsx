import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';

interface ThinkingAnimationProps {
  variant?: 'loadingAgent' | 'generatingPicks';
  steps?: string[];
  stage?: string;
}

const LOADING_STEPS = [
  'Syncing agent profile...',
  'Loading performance snapshot...',
  'Preparing pick workspace...',
];

const GENERATING_STEPS = [
  'Connection established. Running pick engine...',
  'Checking today\'s slate and active markets...',
  'Applying your risk profile and bet preferences...',
  'Scoring model edges across candidate games...',
  'Filtering for confidence and value thresholds...',
  'Finalizing picks and writing results...',
];

const INITIAL_DELAY_MS = 250;
const CHAR_INTERVAL_MS = 18;
const LINE_PAUSE_MS = 350;
const CURSOR_BLINK_MS = 500;

export function ThinkingAnimation({
  variant = 'generatingPicks',
  steps,
  stage,
}: ThinkingAnimationProps) {
  const { isDark } = useThemeContext();
  const scrollViewRef = useRef<ScrollView>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const [historyLines, setHistoryLines] = useState<string[]>([]);
  const [activeLine, setActiveLine] = useState('');
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  const resolvedSteps = useMemo(() => {
    if (steps && steps.length > 0) return steps;
    if (stage) return [stage];
    return variant === 'loadingAgent' ? LOADING_STEPS : GENERATING_STEPS;
  }, [steps, stage, variant]);

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

    if (!resolvedSteps.length) return clearTimers;

    let lineIndex = 0;
    let charIndex = 0;

    const typeCurrentLine = () => {
      const fullLine = resolvedSteps[lineIndex];
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

        if (lineIndex < resolvedSteps.length - 1) {
          setHistoryLines((prev) => [...prev, fullLine]);
          lineIndex += 1;
          const timer = setTimeout(typeCurrentLine, LINE_PAUSE_MS);
          timersRef.current.push(timer);
          return;
        }

        setHistoryLines(resolvedSteps.slice(0, resolvedSteps.length - 1));
        setActiveLineIndex(resolvedSteps.length - 1);
        setActiveLine(fullLine);
      };

      typeNextChar();
    };

    const initialTimer = setTimeout(typeCurrentLine, INITIAL_DELAY_MS);
    timersRef.current.push(initialTimer);

    return clearTimers;
  }, [resolvedSteps]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [historyLines, activeLine]);

  const terminalBackground = isDark ? '#070a0a' : '#101617';
  const terminalBorder = isDark ? 'rgba(0, 230, 118, 0.25)' : 'rgba(0, 186, 98, 0.28)';
  const terminalHeader = isDark ? '#9fb3ad' : '#b5c3bf';
  const lineColor = isDark ? '#00E676' : '#33F08A';
  const historyColor = isDark ? '#8ca89b' : '#a8bbb5';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: terminalBackground,
          borderColor: terminalBorder,
        },
      ]}
    >
      <Text style={[styles.headerText, { color: terminalHeader }]}>
        terminal://agent-thinking
      </Text>

      <ScrollView
        ref={scrollViewRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      >
        {historyLines.map((line, index) => (
          <View key={`history-${index}`} style={styles.lineRow}>
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

        <Text style={[styles.statusText, { color: terminalHeader }]}>
          Step {Math.min(activeLineIndex + 1, resolvedSteps.length)} of {resolvedSteps.length}
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
    marginVertical: 16,
    minHeight: 170,
    maxHeight: 230,
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
    marginBottom: 6,
  },
  prefix: {
    marginRight: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  lineText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusText: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
