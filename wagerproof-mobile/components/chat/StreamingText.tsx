// StreamingText — Animated text rendering with word-by-word fade-in.
// Keeps the existing AnimatedWord pattern from the old WagerBotChat
// but works with the new ContentBlock model.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  color?: string;
}

// Word-by-word animation only during streaming. Once streaming stops,
// render the full markdown without animation for performance.
export default function StreamingText({ text, isStreaming, color = '#ffffff' }: StreamingTextProps) {
  const previousLengthRef = useRef(0);

  // Only animate new words during streaming
  if (!isStreaming || !text) {
    previousLengthRef.current = text.length;
    return (
      <View style={styles.container}>
        <Markdown style={markdownStyles}>{text}</Markdown>
      </View>
    );
  }

  // During streaming, show animated words for new content
  const words = text.split(/(\s+)/);
  const prevLength = previousLengthRef.current;
  const newContentStart = prevLength;

  // Track which character index each word starts at
  let charIndex = 0;
  const wordEntries = words.map((word) => {
    const start = charIndex;
    charIndex += word.length;
    return { word, start, isNew: start >= newContentStart };
  });

  // Update ref for next render
  previousLengthRef.current = text.length;

  let newWordIndex = 0;
  return (
    <View style={styles.container}>
      <View style={styles.wordWrap}>
        {wordEntries.map((entry, i) => {
          if (entry.isNew) {
            const delay = Math.min(newWordIndex * 20, 200);
            newWordIndex++;
            return (
              <AnimatedWord
                key={`${i}-${entry.word}`}
                word={entry.word}
                delay={delay}
                color={color}
              />
            );
          }
          return (
            <ReanimatedAnimated.Text key={i} style={{ color }}>
              {entry.word}
            </ReanimatedAnimated.Text>
          );
        })}
      </View>
    </View>
  );
}

function AnimatedWord({ word, delay, color }: { word: string; delay: number; color: string }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) }),
    );
  }, [delay]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <ReanimatedAnimated.Text style={[{ color }, style]}>
      {word}
    </ReanimatedAnimated.Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wordWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

const markdownStyles = StyleSheet.create({
  body: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
  heading1: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  heading2: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 6 },
  heading3: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  strong: { color: '#ffffff', fontWeight: '700' },
  em: { color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' },
  link: { color: '#60a5fa' },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255,255,255,0.2)',
    paddingLeft: 12,
    marginLeft: 0,
  },
  code_inline: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#e2e8f0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 13,
  },
  code_block: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    color: '#e2e8f0',
  },
  table: { borderWidth: 0 },
  thead: { backgroundColor: 'rgba(255,255,255,0.06)' },
  th: { color: '#ffffff', fontWeight: '600', padding: 6 },
  td: { color: 'rgba(255,255,255,0.85)', padding: 6 },
  tr: { borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  bullet_list_icon: { color: 'rgba(255,255,255,0.5)' },
  ordered_list_icon: { color: 'rgba(255,255,255,0.5)' },
  list_item: { marginBottom: 4 },
});
