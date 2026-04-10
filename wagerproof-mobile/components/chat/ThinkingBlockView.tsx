// ThinkingBlockView — Collapsible thinking trace block modeled after
// Ellie's ThinkingBlockView. Shows a Lottie sprite + "Thinking..." while
// streaming, transitions to a green checkmark + "Thought" when done.
//
// When using a reasoning model (o1/o3/o4-mini), real thinking text is
// displayed. Otherwise shows a tool execution summary.

import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  SlideInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThinkingSprite } from '../../hooks/useThinkingSprite';

interface ThinkingBlockViewProps {
  isStreaming: boolean;
  /** Real thinking text from reasoning models, if available */
  thinkingText?: string;
  /** Fallback: number of tools used */
  toolCount: number;
  /** Fallback: display names of tools used */
  toolNames: string[];
}

export default function ThinkingBlockView({
  isStreaming,
  thinkingText,
  toolCount,
  toolNames,
}: ThinkingBlockViewProps) {
  const [expanded, setExpanded] = useState(false);
  const spriteName = useThinkingSprite();

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };

  // Use real thinking text if available, otherwise build a tool summary
  const expandedText = thinkingText
    ? thinkingText
    : toolCount > 0
      ? `Analyzed data from ${toolCount} source${toolCount !== 1 ? 's' : ''}: ${toolNames.join(', ')}`
      : 'Processing your request...';

  // Sprite asset mapping
  const spriteSource = SPRITE_ASSETS[spriteName] || SPRITE_ASSETS['thinking_petals'];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      layout={Layout.springify().damping(20).stiffness(300)}
      style={styles.container}
    >
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.7}
        style={styles.header}
      >
        {isStreaming ? (
          <LottieView
            source={spriteSource}
            autoPlay
            loop
            style={styles.sprite}
          />
        ) : (
          <Animated.View entering={FadeIn.duration(300)}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color="rgba(100, 220, 100, 0.9)"
            />
          </Animated.View>
        )}

        <Text style={styles.label}>
          {isStreaming ? 'Thinking...' : 'Thought'}
        </Text>

        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="rgba(255, 255, 255, 0.35)"
        />
      </TouchableOpacity>

      {expanded && (
        <Animated.View
          entering={SlideInUp.duration(200).withInitialValues({ opacity: 0 })}
          exiting={FadeOut.duration(150)}
          style={styles.expandedContent}
        >
          <Text style={styles.summaryText}>{expandedText}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// Lottie asset map — requires static require calls
const SPRITE_ASSETS: Record<string, any> = {
  thinking_petals: require('../../assets/thinking_petals.json'),
  thinking_1: require('../../assets/thinking_1.json'),
  thinking_2: require('../../assets/thinking_2.json'),
  thinking_birb: require('../../assets/thinking_birb.json'),
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sprite: {
    width: 18,
    height: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  expandedContent: {
    marginTop: 6,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
  },
  summaryText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 18,
  },
});
