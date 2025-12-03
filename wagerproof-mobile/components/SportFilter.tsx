import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useTheme } from 'react-native-paper';

interface SportFilterProps {
  selectedSport: string | null;
  onSportChange: (sport: string | null) => void;
}

export function SportFilter({ selectedSport, onSportChange }: SportFilterProps) {
  const { isDark } = useThemeContext();
  const theme = useTheme();

  const sports = [
    { id: null, label: 'All' },
    { id: 'nfl', label: 'NFL' },
    { id: 'cfb', label: 'CFB' },
    { id: 'nba', label: 'NBA' },
    { id: 'ncaab', label: 'NCAAB' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sports.map((sport) => {
          const isSelected = selectedSport === sport.id;
          return (
            <TouchableOpacity
              key={sport.label}
              style={[
                styles.pill,
                isSelected 
                  ? { backgroundColor: theme.colors.primary } 
                  : { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }
              ]}
              onPress={() => onSportChange(sport.id)}
            >
              <Text 
                style={[
                  styles.pillText,
                  isSelected 
                    ? { color: theme.colors.onPrimary, fontWeight: 'bold' } 
                    : { color: theme.colors.onSurface }
                ]}
              >
                {sport.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

