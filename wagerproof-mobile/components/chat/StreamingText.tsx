// StreamingText — Streaming text with blinking caret, matching Ellie's
// TextBlockView pattern. During streaming, renders markdown with a soft
// blinking caret at the end. Once streaming stops, renders full markdown.

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  color?: string;
}

export default function StreamingText({ text, isStreaming }: StreamingTextProps) {
  if (!isStreaming || !text) {
    return (
      <View style={styles.container}>
        <Markdown style={markdownStyles}>{text}</Markdown>
      </View>
    );
  }

  // During streaming: markdown + blinking caret
  return (
    <View style={styles.container}>
      <Markdown style={markdownStyles}>{text}</Markdown>
      <BlinkingCaret />
    </View>
  );
}

// Soft blinking caret at the trailing edge of streaming text,
// matching Ellie's BlinkingCaret (6x14pt, 0.7s blink cycle)
function BlinkingCaret() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.caret, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  caret: {
    width: 6,
    height: 14,
    borderRadius: 1.5,
    backgroundColor: 'rgba(100, 220, 100, 0.9)',
    marginTop: 2,
    alignSelf: 'flex-start',
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
