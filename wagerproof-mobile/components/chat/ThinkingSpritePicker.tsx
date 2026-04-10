// ThinkingSpritePicker — Bottom sheet picker for the thinking Lottie
// animation, matching Ellie's ThinkingSpritePicker. Each option shows
// a looping preview in a tile.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import {
  THINKING_SPRITES,
  useThinkingSpriteEditor,
  type SpriteName,
} from '../../hooks/useThinkingSprite';

interface ThinkingSpritePickerProps {
  onDismiss: () => void;
}

// Lottie asset map — requires static require calls
const SPRITE_ASSETS: Record<string, any> = {
  thinking_petals: require('../../assets/thinking_petals.json'),
  thinking_1: require('../../assets/thinking_1.json'),
  thinking_2: require('../../assets/thinking_2.json'),
  thinking_birb: require('../../assets/thinking_birb.json'),
};

export default function ThinkingSpritePicker({ onDismiss }: ThinkingSpritePickerProps) {
  const [selected, setSelected] = useThinkingSpriteEditor();

  const handleSelect = (name: SpriteName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(name);
    setTimeout(onDismiss, 120);
  };

  return (
    <View style={styles.container}>
      <View style={styles.dragHandle} />

      <Text style={styles.title}>Thinking sprite</Text>
      <Text style={styles.subtitle}>
        Pick the animation shown while WagerBot is thinking.
      </Text>

      <View style={styles.grid}>
        {THINKING_SPRITES.map((sprite) => {
          const isSelected = selected === sprite.name;
          return (
            <TouchableOpacity
              key={sprite.name}
              style={styles.tile}
              activeOpacity={0.7}
              onPress={() => handleSelect(sprite.name)}
            >
              <View
                style={[
                  styles.tilePreview,
                  isSelected && styles.tilePreviewSelected,
                ]}
              >
                <LottieView
                  source={SPRITE_ASSETS[sprite.name]}
                  autoPlay
                  loop
                  style={styles.lottie}
                />
              </View>
              <Text
                style={[
                  styles.tileLabel,
                  isSelected && styles.tileLabelSelected,
                ]}
              >
                {sprite.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tile: {
    alignItems: 'center',
    gap: 6,
  },
  tilePreview: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tilePreviewSelected: {
    backgroundColor: 'rgba(100, 220, 100, 0.1)',
    borderColor: 'rgba(100, 220, 100, 0.6)',
  },
  lottie: {
    width: 48,
    height: 48,
  },
  tileLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tileLabelSelected: {
    color: 'rgba(100, 220, 100, 0.9)',
    fontWeight: '600',
  },
});
