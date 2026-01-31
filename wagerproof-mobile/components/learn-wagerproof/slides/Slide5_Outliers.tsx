import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';

const VALUE_ALERT_COLOR = '#22c55e';
const FADE_ALERT_COLOR = '#f59e0b';

function AlertCard({
  type,
  sport,
  matchup,
  description,
  confidence,
  suggestedBet,
}: {
  type: 'value' | 'fade';
  sport: string;
  matchup: string;
  description: string;
  confidence: number;
  suggestedBet?: string;
}) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const alertColor = type === 'value' ? VALUE_ALERT_COLOR : FADE_ALERT_COLOR;

  return (
    <View
      style={[
        styles.alertCard,
        {
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          borderColor: `${alertColor}40`,
        },
      ]}
    >
      {/* Top border accent */}
      <View style={[styles.topAccent, { backgroundColor: alertColor }]} />

      {/* Badges row */}
      <View style={styles.badgesRow}>
        <View style={[styles.sportBadge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
          <Text style={[styles.sportText, { color: theme.colors.onSurfaceVariant }]}>
            {sport}
          </Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: `${alertColor}20` }]}>
          <MaterialCommunityIcons
            name={type === 'value' ? 'trending-up' : 'lightning-bolt'}
            size={12}
            color={alertColor}
          />
          <Text style={[styles.typeText, { color: alertColor }]}>
            {type === 'value' ? 'VALUE' : 'FADE'}
          </Text>
        </View>
        <View style={[styles.confidenceBadge, { backgroundColor: `${alertColor}20` }]}>
          <Text style={[styles.confidenceText, { color: alertColor }]}>
            {confidence}%
          </Text>
        </View>
      </View>

      {/* Matchup */}
      <Text style={[styles.matchupText, { color: theme.colors.onSurface }]}>
        {matchup}
      </Text>

      {/* Description */}
      <Text style={[styles.descriptionText, { color: theme.colors.onSurfaceVariant }]}>
        {description}
      </Text>

      {/* Suggested bet (for fade alerts) */}
      {suggestedBet && (
        <View style={[styles.suggestedBetBox, { backgroundColor: `${alertColor}10`, borderColor: `${alertColor}30` }]}>
          <Text style={[styles.suggestedLabel, { color: theme.colors.onSurfaceVariant }]}>
            Suggested:
          </Text>
          <Text style={[styles.suggestedValue, { color: alertColor }]}>
            {suggestedBet}
          </Text>
        </View>
      )}

      {/* Pro lock badge */}
      <View style={[styles.proLockBadge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
        <MaterialCommunityIcons name="lock" size={10} color="#f59e0b" />
        <Text style={[styles.proLockText, { color: '#f59e0b' }]}>Pro Feature</Text>
      </View>
    </View>
  );
}

export function Slide5_Outliers() {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  return (
    <View style={styles.container}>
      {/* Alert cards */}
      <View style={styles.alertsContainer}>
        <AlertCard
          type="value"
          sport="NFL"
          matchup="Patriots @ Dolphins"
          description="Polymarket shows 67% on Patriots +3.5"
          confidence={67}
        />

        <AlertCard
          type="fade"
          sport="NFL"
          matchup="Bills @ Jets"
          description="Model predicts Bills at 82% - Historical fade opportunity"
          confidence={82}
          suggestedBet="Jets +7"
        />
      </View>

      {/* Explanation */}
      <View style={styles.explanationContainer}>
        <View style={styles.explanationItem}>
          <View style={[styles.legendDot, { backgroundColor: VALUE_ALERT_COLOR }]} />
          <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
            Value alerts: Market disagrees with Vegas
          </Text>
        </View>
        <View style={styles.explanationItem}>
          <View style={[styles.legendDot, { backgroundColor: FADE_ALERT_COLOR }]} />
          <Text style={[styles.explanationText, { color: theme.colors.onSurfaceVariant }]}>
            Fade alerts: High confidence = fade opportunity
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  alertsContainer: {
    gap: 12,
  },
  alertCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sportText: {
    fontSize: 10,
    fontWeight: '700',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  matchupText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 12,
    lineHeight: 18,
  },
  suggestedBetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  suggestedLabel: {
    fontSize: 11,
  },
  suggestedValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  proLockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proLockText: {
    fontSize: 9,
    fontWeight: '600',
  },
  explanationContainer: {
    marginTop: 20,
    gap: 8,
  },
  explanationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  explanationText: {
    fontSize: 12,
  },
});
