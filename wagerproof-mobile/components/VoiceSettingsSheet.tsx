import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import type { WagerBotVoice } from '@/services/wagerBotVoiceService';

interface VoiceOption {
  value: WagerBotVoice;
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { value: 'marin', label: 'Marin', subtitle: 'Sharp and unfiltered', icon: 'microphone' },
  { value: 'cedar', label: 'Cedar', subtitle: 'Deep and savage', icon: 'microphone-variant' },
  { value: 'ash', label: 'Ash', subtitle: 'Balanced and clear', icon: 'account-voice' },
  { value: 'ballad', label: 'Ballad', subtitle: 'Warm and expressive', icon: 'microphone-variant' },
  { value: 'coral', label: 'Coral', subtitle: 'Bright and energetic', icon: 'microphone' },
  { value: 'sage', label: 'Sage', subtitle: 'Calm and thoughtful', icon: 'account-voice' },
  { value: 'verse', label: 'Verse', subtitle: 'Dynamic and confident', icon: 'microphone-variant' },
];

interface VoiceSettingsSheetProps {
  visible: boolean;
  selectedVoice: WagerBotVoice;
  onVoiceChanged: (voice: WagerBotVoice) => void;
  onClose: () => void;
}

export function VoiceSettingsSheet({
  visible,
  selectedVoice,
  onVoiceChanged,
  onClose,
}: VoiceSettingsSheetProps) {
  const insets = useSafeAreaInsets();

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
                    onClose();
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
