// FollowUpPills — Vertical list of suggested follow-up questions, matching
// Ellie's FollowUpsBlockView. Each row has an arrow icon, question text,
// and a plus icon, separated by hairline dividers.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
      {questions.map((question, index) => (
        <View key={index}>
          {index > 0 && <View style={styles.divider} />}
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(question);
            }}
          >
            <MaterialCommunityIcons
              name="arrow-bottom-right"
              size={16}
              color="rgba(255, 255, 255, 0.5)"
              style={styles.arrowIcon}
            />
            <Text style={styles.questionText}>{question}</Text>
            <MaterialCommunityIcons
              name="plus"
              size={14}
              color="rgba(255, 255, 255, 0.3)"
            />
          </TouchableOpacity>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 10,
  },
  arrowIcon: {
    marginTop: 2,
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 21,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 34, // Indent past the arrow icon
  },
});
