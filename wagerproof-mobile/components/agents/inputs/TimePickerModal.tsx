import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { useTheme, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { US_TIMEZONES, getTimezoneAbbr } from '@/types/agent';

interface TimePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (hours: number, minutes: number, timezone: string) => void;
  hours?: number;
  minutes?: number;
  timezone?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 5-min increments

export function TimePickerModal({
  visible,
  onDismiss,
  onConfirm,
  hours: initialHours = 9,
  minutes: initialMinutes = 0,
  timezone: initialTimezone = 'America/New_York',
}: TimePickerModalProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [selectedHour, setSelectedHour] = useState(initialHours);
  const [selectedMinute, setSelectedMinute] = useState(initialMinutes);
  const [selectedTimezone, setSelectedTimezone] = useState(initialTimezone);

  useEffect(() => {
    if (visible) {
      setSelectedHour(initialHours);
      // Snap to nearest 5-min increment
      setSelectedMinute(Math.round(initialMinutes / 5) * 5);
      setSelectedTimezone(initialTimezone);
    }
  }, [visible, initialHours, initialMinutes, initialTimezone]);

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display} ${period}`;
  };

  const formatMinute = (m: number) => String(m).padStart(2, '0');

  const tzAbbr = getTimezoneAbbr(selectedTimezone);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Select Time & Timezone
          </Text>

          <View style={styles.pickerRow}>
            {/* Hour picker */}
            <View style={styles.pickerColumn}>
              <Text style={[styles.columnLabel, { color: theme.colors.onSurfaceVariant }]}>
                Hour
              </Text>
              <ScrollView
                style={styles.scrollColumn}
                showsVerticalScrollIndicator={false}
              >
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.option,
                      selectedHour === h && {
                        backgroundColor: `${theme.colors.primary}20`,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => setSelectedHour(h)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color:
                            selectedHour === h
                              ? theme.colors.primary
                              : theme.colors.onSurface,
                          fontWeight: selectedHour === h ? '700' : '400',
                        },
                      ]}
                    >
                      {formatHour(h)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Minute picker */}
            <View style={styles.pickerColumn}>
              <Text style={[styles.columnLabel, { color: theme.colors.onSurfaceVariant }]}>
                Minute
              </Text>
              <ScrollView
                style={styles.scrollColumn}
                showsVerticalScrollIndicator={false}
              >
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.option,
                      selectedMinute === m && {
                        backgroundColor: `${theme.colors.primary}20`,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => setSelectedMinute(m)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color:
                            selectedMinute === m
                              ? theme.colors.primary
                              : theme.colors.onSurface,
                          fontWeight: selectedMinute === m ? '700' : '400',
                        },
                      ]}
                    >
                      :{formatMinute(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Timezone selector */}
          <View style={styles.timezoneSection}>
            <Text style={[styles.columnLabel, { color: theme.colors.onSurfaceVariant }]}>
              Timezone
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timezoneRow}
            >
              {US_TIMEZONES.map((tz) => {
                const isSelected = selectedTimezone === tz.value;
                return (
                  <TouchableOpacity
                    key={tz.value}
                    style={[
                      styles.timezoneChip,
                      {
                        backgroundColor: isSelected
                          ? `${theme.colors.primary}20`
                          : isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isSelected
                          ? theme.colors.primary
                          : isDark
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(0, 0, 0, 0.08)',
                      },
                    ]}
                    onPress={() => setSelectedTimezone(tz.value)}
                  >
                    <Text
                      style={[
                        styles.timezoneChipText,
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
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.preview}>
            <Text style={[styles.previewText, { color: theme.colors.onSurface }]}>
              {formatHour(selectedHour).replace(' ', '')} : {formatMinute(selectedMinute)}{' '}
              {selectedHour >= 12 ? 'PM' : 'AM'} {tzAbbr}
            </Text>
          </View>

          <View style={styles.actions}>
            <Button mode="text" onPress={onDismiss} textColor={theme.colors.onSurfaceVariant}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => onConfirm(selectedHour, selectedMinute, selectedTimezone)}
              style={styles.confirmButton}
            >
              Confirm
            </Button>
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
  pickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerColumn: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  scrollColumn: {
    height: 200,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
  },
  timezoneSection: {
    marginTop: 16,
  },
  timezoneRow: {
    gap: 6,
    paddingVertical: 4,
  },
  timezoneChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  timezoneChipText: {
    fontSize: 13,
  },
  preview: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  previewText: {
    fontSize: 20,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  confirmButton: {
    borderRadius: 10,
  },
});
