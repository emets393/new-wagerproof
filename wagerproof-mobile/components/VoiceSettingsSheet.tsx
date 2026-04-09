import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import type { WagerBotVoice, WagerBotPersonality } from '@/services/wagerBotVoiceService';

interface VoiceOption {
  value: WagerBotVoice;
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

// Primary voices that map to the 3 Monster Lottie characters (matches Honeydew)
const VOICE_OPTIONS: VoiceOption[] = [
  { value: 'marin', label: 'Donna', subtitle: 'Female voice', icon: 'microphone' },
  { value: 'cedar', label: 'Kevin', subtitle: 'Male voice', icon: 'microphone-variant' },
  { value: 'ash', label: 'Jordan', subtitle: 'British voice', icon: 'account-voice' },
];

interface PersonalityOption {
  value: WagerBotPersonality;
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const PERSONALITY_OPTIONS: PersonalityOption[] = [
  {
    value: 'friendly',
    label: 'Friendly',
    subtitle: 'Warm, helpful, family-safe',
    icon: 'emoticon-happy-outline',
  },
  {
    value: 'spicy',
    label: 'Spicy',
    subtitle: 'Full roast with profanity (adults only)',
    icon: 'fire',
  },
];

interface VoiceSettingsSheetProps {
  visible: boolean;
  selectedVoice: WagerBotVoice;
  selectedPersonality: WagerBotPersonality;
  onVoiceChanged: (voice: WagerBotVoice) => void;
  onPersonalityChanged: (personality: WagerBotPersonality) => void;
  onClose: () => void;
}

/**
 * Multi-step spicy mode confirmation — mirrors Honeydew's exact 3-step warning flow.
 * Returns true if user confirmed through all steps.
 */
function confirmSpicyMode(): Promise<boolean> {
  return new Promise((resolve) => {
    // Step 1 — Subtle warning
    Alert.alert(
      'Turn on Spicy Mode?',
      "Just a heads up — Spicy Mode is meant for novelty and a good laugh. WagerBot's personality gets a little... extra.",
      [
        { text: 'Never mind', style: 'cancel', onPress: () => resolve(false) },
        {
          text: "I'm curious",
          onPress: () => {
            // Step 2 — Serious warning
            Alert.alert(
              'Are you sure?',
              "This is going to be R-rated. WagerBot will be really rude, really mean, and will use explicit profanity. It's definitely not for kids.",
              [
                { text: 'Take me back', style: 'cancel', onPress: () => resolve(false) },
                {
                  text: 'I can handle it',
                  onPress: () => {
                    // Step 3 — Final confirmation
                    Alert.alert(
                      'Last chance!',
                      "Okay, we warned you. We're about to turn on the full roast — uncensored, unfiltered, and absolutely savage. No take-backs.",
                      [
                        { text: 'Actually, no', style: 'cancel', onPress: () => resolve(false) },
                        {
                          text: 'Turn it on',
                          style: 'destructive',
                          onPress: () => resolve(true),
                        },
                      ]
                    );
                  },
                },
              ]
            );
          },
        },
      ]
    );
  });
}

export function VoiceSettingsSheet({
  visible,
  selectedVoice,
  selectedPersonality,
  onVoiceChanged,
  onPersonalityChanged,
  onClose,
}: VoiceSettingsSheetProps) {
  const insets = useSafeAreaInsets();

  const handlePersonalityPress = async (personality: WagerBotPersonality) => {
    if (personality === 'spicy' && selectedPersonality !== 'spicy') {
      const confirmed = await confirmSpicyMode();
      if (!confirmed) return;
    }
    onPersonalityChanged(personality);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={styles.sheetContent}>
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            <Text style={styles.sheetTitle}>Voice Settings</Text>

            {/* Voice section */}
            <Text style={styles.sectionLabel}>VOICE</Text>

            {VOICE_OPTIONS.map((option) => {
              const isSelected = selectedVoice === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionTile,
                    isSelected && styles.optionTileSelected,
                  ]}
                  onPress={() => {
                    onVoiceChanged(option.value);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      isSelected && styles.optionIconSelected,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={22}
                      color={isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)'}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                  </View>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color="#22c55e"
                    />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Personality section */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>PERSONALITY</Text>

            {PERSONALITY_OPTIONS.map((option) => {
              const isSelected = selectedPersonality === option.value;
              const isSpicy = option.value === 'spicy';
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionTile,
                    isSelected && (isSpicy ? styles.optionTileSpicy : styles.optionTileSelected),
                  ]}
                  onPress={() => handlePersonalityPress(option.value)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      isSelected && (isSpicy ? styles.optionIconSpicy : styles.optionIconSelected),
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={22}
                      color={isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)'}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                  </View>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={isSpicy ? '#ef4444' : '#22c55e'}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(20,20,20,0.95)',
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  optionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  optionTileSelected: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
    borderWidth: 1.5,
  },
  optionTileSpicy: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.3)',
    borderWidth: 1.5,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionIconSelected: {
    backgroundColor: '#22c55e',
  },
  optionIconSpicy: {
    backgroundColor: '#ef4444',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  optionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
});
