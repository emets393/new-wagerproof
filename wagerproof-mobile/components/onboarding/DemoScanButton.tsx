import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Matches the real "Scan this page" pill in components/WagerBotSuggestionBubble.tsx
// so users recognize it later in the live app.
interface DemoScanButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function DemoScanButton({ onPress, disabled = false }: DemoScanButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.pill}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="magnify-scan" size={18} color="#000000" />
        <Text style={styles.label}>Scan this page</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  label: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});
