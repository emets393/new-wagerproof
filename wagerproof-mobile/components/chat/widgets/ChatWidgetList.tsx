// ChatWidgetList — Renders widgets grouped by game. Each game's widgets
// stack vertically with analysis text after the last widget.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { ChatWidgetData } from '../../../types/chatTypes';
import ChatWidgetRenderer from './ChatWidgetRenderer';

interface Props {
  widgets: ChatWidgetData[];
  onWidgetPress: (widget: ChatWidgetData) => void;
}

export default function ChatWidgetList({ widgets, onWidgetPress }: Props) {
  if (widgets.length === 0) return null;

  // Group widgets by game_id to stack them together
  const gameGroups: Map<string, ChatWidgetData[]> = new Map();
  for (const w of widgets) {
    const key = w.game_id || 'unknown';
    if (!gameGroups.has(key)) gameGroups.set(key, []);
    gameGroups.get(key)!.push(w);
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {Array.from(gameGroups.entries()).map(([gameId, group]) => (
        <View key={gameId} style={styles.gameGroup}>
          {group.map((widget, i) => (
            <ChatWidgetRenderer
              key={`${gameId}-${widget.widget_type}-${i}`}
              widget={widget}
              onPress={onWidgetPress}
              isLast={i === group.length - 1}
            />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginTop: 12,
  },
  gameGroup: {
    gap: 4,
  },
});
