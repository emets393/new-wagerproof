// FollowUpPills — Tappable suggestion pills at the end of an assistant
// response. Replaces the static welcome screen suggestions.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';

interface FollowUpPillsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export default function FollowUpPills({ questions, onSelect }: FollowUpPillsProps) {
  if (questions.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {questions.map((question, index) => (
          <TouchableOpacity
            key={index}
            style={styles.pill}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(question);
            }}
          >
            <Text style={styles.pillText} numberOfLines={2}>
              {question}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingLeft: 16,
  },
  scrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: 240,
  },
  pillText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
