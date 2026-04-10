// AssistantActionRow — Copy / Share / Regenerate buttons shown below each
// completed assistant message, matching Ellie's AssistantActionRowView.

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';

interface AssistantActionRowProps {
  text: string;
  onRegenerate?: () => void;
}

export default function AssistantActionRow({ text, onRegenerate }: AssistantActionRowProps) {
  const [didCopy, setDidCopy] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDidCopy(true);
    setTimeout(() => setDidCopy(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: text });
    } catch {
      // User cancelled
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {/* Copy */}
      <TouchableOpacity style={styles.button} onPress={handleCopy} activeOpacity={0.6}>
        <MaterialCommunityIcons
          name={didCopy ? 'check' : 'content-copy'}
          size={14}
          color={didCopy ? 'rgba(100, 220, 100, 0.8)' : 'rgba(255, 255, 255, 0.5)'}
        />
      </TouchableOpacity>

      {/* Share */}
      <TouchableOpacity style={styles.button} onPress={handleShare} activeOpacity={0.6}>
        <MaterialCommunityIcons
          name="share-variant-outline"
          size={14}
          color="rgba(255, 255, 255, 0.5)"
        />
      </TouchableOpacity>

      {/* Regenerate */}
      {onRegenerate && (
        <TouchableOpacity style={styles.button} onPress={onRegenerate} activeOpacity={0.6}>
          <MaterialCommunityIcons
            name="refresh"
            size={14}
            color="rgba(255, 255, 255, 0.5)"
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 12,
  },
  button: {
    padding: 6,
  },
});
