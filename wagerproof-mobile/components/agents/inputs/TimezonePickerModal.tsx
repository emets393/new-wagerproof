import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { US_TIMEZONES } from '@/types/agent';

interface TimezonePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (timezone: string) => void;
  selected: string;
}

export function TimezonePickerModal({
  visible,
  onDismiss,
  onSelect,
  selected,
}: TimezonePickerModalProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={[
            styles.container,
            { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Select Timezone
          </Text>

          <View style={styles.options}>
            {US_TIMEZONES.map((tz) => {
              const isSelected = selected === tz.value;
              return (
                <TouchableOpacity
                  key={tz.value}
                  style={[
                    styles.option,
                    isSelected && {
                      backgroundColor: `${theme.colors.primary}15`,
                      borderColor: theme.colors.primary,
                    },
                    !isSelected && {
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                  onPress={() => {
                    onSelect(tz.value);
                    onDismiss();
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: isSelected
                          ? theme.colors.primary
                          : theme.colors.onSurface,
                        fontWeight: isSelected ? '700' : '400',
                      },
                    ]}
                  >
                    {tz.label}
                  </Text>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={theme.colors.primary}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 300,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  options: {
    gap: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
});
