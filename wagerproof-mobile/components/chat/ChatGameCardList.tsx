// ChatGameCardList — Renders a list of inline game cards in chat.
// Shows first 3 by default, with an expandable "Show N more" button.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { ChatGameCardData } from '../../types/chatTypes';
import ChatGameCard from './ChatGameCard';

const DEFAULT_VISIBLE = 3;

interface ChatGameCardListProps {
  cards: ChatGameCardData[];
  onCardPress: (card: ChatGameCardData) => void;
}

export default function ChatGameCardList({ cards, onCardPress }: ChatGameCardListProps) {
  const [expanded, setExpanded] = useState(false);

  if (cards.length === 0) return null;

  const visibleCards = expanded ? cards : cards.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = cards.length - DEFAULT_VISIBLE;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {visibleCards.map((card, i) => (
        <ChatGameCard key={card.game_id || i} card={card} onPress={onCardPress} />
      ))}

      {hiddenCount > 0 && !expanded && (
        <TouchableOpacity
          style={styles.showMoreButton}
          onPress={() => setExpanded(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
          <Text style={styles.showMoreText}>Show {hiddenCount} more game{hiddenCount !== 1 ? 's' : ''}</Text>
        </TouchableOpacity>
      )}

      {expanded && hiddenCount > 0 && (
        <TouchableOpacity
          style={styles.showMoreButton}
          onPress={() => setExpanded(false)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chevron-up" size={16} color="rgba(255,255,255,0.5)" />
          <Text style={styles.showMoreText}>Show less</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 12,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  showMoreText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
});
