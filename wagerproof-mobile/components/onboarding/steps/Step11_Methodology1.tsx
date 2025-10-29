import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function MethodologyClaim1() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        We use statistical modeling, not vibes
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        Our models incorporate historical performance, market movement, and matchup factors—logged and auditable.
      </Text>
      
      {/* Historical Data Widget */}
      <View style={[styles.widget, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }]}>
        <View style={styles.widgetHeader}>
          <MaterialCommunityIcons name="chart-bar" size={20} color="#3b82f6" />
          <Text style={[styles.widgetTitle, { color: theme.colors.onBackground }]}>
            Historical Data
          </Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
            <Text style={styles.badgeText}>5 Years</Text>
          </View>
        </View>
        
        <View style={styles.dataRows}>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Chiefs vs Bills</Text>
            <Text style={styles.dataValue}>7-3 (Last 10)</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Home Field Advantage</Text>
            <Text style={[styles.dataValue, { color: '#22c55e' }]}>+3.2 pts</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Weather Impact</Text>
            <Text style={[styles.dataValue, { color: '#3b82f6' }]}>-1.8 pts</Text>
          </View>
        </View>
        
        <View style={styles.sources}>
          <MaterialCommunityIcons name="calendar" size={14} color="#3b82f6" />
          <Text style={styles.sourcesTitle}>Data Sources</Text>
        </View>
        <View style={styles.sourcesList}>
          <View style={styles.sourceItem}>
            <MaterialCommunityIcons name="check-circle" size={12} color="#22c55e" />
            <Text style={styles.sourceText}>5+ seasons of game logs</Text>
          </View>
          <View style={styles.sourceItem}>
            <MaterialCommunityIcons name="check-circle" size={12} color="#22c55e" />
            <Text style={styles.sourceText}>Weather & injury reports</Text>
          </View>
        </View>
      </View>
      
      {/* Line Movement Widget */}
      <View style={[styles.widget, { backgroundColor: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.2)' }]}>
        <View style={styles.widgetHeader}>
          <MaterialCommunityIcons name="trending-up" size={20} color="#f97316" />
          <Text style={[styles.widgetTitle, { color: theme.colors.onBackground }]}>
            Line Movement
          </Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(249, 115, 22, 0.2)' }]}>
            <Text style={styles.badgeText}>Live</Text>
          </View>
        </View>
        
        <View style={styles.dataRows}>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Opening Line</Text>
            <Text style={styles.dataValue}>KC -2.5</Text>
          </View>
          <View style={[styles.dataRow, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
            <Text style={styles.dataLabel}>Current Line</Text>
            <View style={styles.dataValueRow}>
              <Text style={styles.dataValue}>KC -3.5</Text>
              <MaterialCommunityIcons name="trending-up" size={14} color="#f97316" />
            </View>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Sharp Money</Text>
            <Text style={[styles.dataValue, { color: '#22c55e' }]}>Buffalo +3.5</Text>
          </View>
        </View>
        
        <View style={styles.sources}>
          <MaterialCommunityIcons name="chart-line" size={14} color="#f97316" />
          <Text style={styles.sourcesTitle}>Market Signals</Text>
        </View>
        <View style={styles.sourcesList}>
          <View style={styles.sourceItem}>
            <MaterialCommunityIcons name="check-circle" size={12} color="#22c55e" />
            <Text style={styles.sourceText}>Real-time odds tracking</Text>
          </View>
          <View style={styles.sourceItem}>
            <MaterialCommunityIcons name="check-circle" size={12} color="#22c55e" />
            <Text style={styles.sourceText}>Sharp vs public money flow</Text>
          </View>
        </View>
      </View>
      
      <Button onPress={handleContinue} fullWidth variant="glass">
        Continue
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  widget: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  dataRows: {
    gap: 8,
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dataLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  dataValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  dataValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sources: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sourcesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  sourcesList: {
    gap: 6,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

