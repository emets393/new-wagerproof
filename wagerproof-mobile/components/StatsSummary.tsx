import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { EditorPick } from '@/types/editorsPicks';
import { calculateTotalUnits } from '@/utils/unitsCalculation';
import { useThemeContext } from '@/contexts/ThemeContext';

interface StatsSummaryProps {
  picks: EditorPick[];
}

export function StatsSummary({ picks }: StatsSummaryProps) {
  const { isDark } = useThemeContext();
  
  // Calculate record
  const won = picks.filter(p => p.result === 'won').length;
  const lost = picks.filter(p => p.result === 'lost').length;
  const push = picks.filter(p => p.result === 'push').length;
  const total = won + lost + push;
  const winRate = total > 0 ? ((won / total) * 100).toFixed(1) : '0.0';

  // Calculate units
  const totalUnits = calculateTotalUnits(picks);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Record Card */}
        <LinearGradient
          colors={isDark 
            ? ['rgba(30, 64, 175, 0.2)', 'rgba(30, 64, 175, 0.1)'] 
            : ['rgba(239, 246, 255, 1)', 'rgba(219, 234, 254, 1)']}
          style={[styles.card, { borderColor: isDark ? 'rgba(30, 64, 175, 0.3)' : 'rgba(191, 219, 254, 1)' }]}
        >
          <Text style={[styles.label, { color: isDark ? '#bfdbfe' : '#1e3a8a' }]}>Record</Text>
          <Text style={[styles.value, { color: isDark ? '#ffffff' : '#1e40af' }]}>
            {won}-{lost}{push > 0 ? `-${push}` : ''}
          </Text>
          {total > 0 && (
            <Text style={[styles.subtext, { color: isDark ? '#93c5fd' : '#2563eb' }]}>
              {winRate}% Win Rate
            </Text>
          )}
        </LinearGradient>

        {/* Units Card */}
        <LinearGradient
          colors={totalUnits.netUnits >= 0 
            ? (isDark ? ['rgba(6, 95, 70, 0.2)', 'rgba(6, 95, 70, 0.1)'] : ['rgba(236, 253, 245, 1)', 'rgba(209, 250, 229, 1)'])
            : (isDark ? ['rgba(153, 27, 27, 0.2)', 'rgba(153, 27, 27, 0.1)'] : ['rgba(254, 242, 242, 1)', 'rgba(254, 226, 226, 1)'])
          }
          style={[styles.card, { 
            borderColor: totalUnits.netUnits >= 0 
              ? (isDark ? 'rgba(6, 95, 70, 0.3)' : 'rgba(167, 243, 208, 1)')
              : (isDark ? 'rgba(153, 27, 27, 0.3)' : 'rgba(254, 202, 202, 1)')
          }]}
        >
          <Text style={[styles.label, { 
            color: totalUnits.netUnits >= 0 
              ? (isDark ? '#a7f3d0' : '#065f46')
              : (isDark ? '#fecaca' : '#991b1b')
          }]}>
            Units
          </Text>
          <Text style={[styles.value, { 
            color: totalUnits.netUnits >= 0 
              ? (isDark ? '#ffffff' : '#064e3b')
              : (isDark ? '#ffffff' : '#7f1d1d')
          }]}>
            {totalUnits.netUnits >= 0 ? '+' : ''}{totalUnits.netUnits.toFixed(2)}
          </Text>
          <Text style={[styles.subtext, { 
            color: totalUnits.netUnits >= 0 
              ? (isDark ? '#6ee7b7' : '#059669')
              : (isDark ? '#f87171' : '#dc2626')
          }]}>
            {totalUnits.unitsWon.toFixed(1)} won / {totalUnits.unitsLost.toFixed(1)} lost
          </Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtext: {
    fontSize: 11,
    fontWeight: '500',
  },
});

