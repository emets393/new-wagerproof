import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, SegmentedButtons, Divider } from 'react-native-paper';

import { useThemeContext } from '@/contexts/ThemeContext';
import { SliderInput } from '@/components/agents/inputs/SliderInput';
import { ToggleInput } from '@/components/agents/inputs/ToggleInput';
import { PersonalityParams, BetType } from '@/types/agent';

// ============================================================================
// TYPES
// ============================================================================

interface Screen3_PersonalityProps {
  params: PersonalityParams;
  onParamChange: <K extends keyof PersonalityParams>(
    key: K,
    value: PersonalityParams[K]
  ) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RISK_TOLERANCE_LABELS: [string, string, string, string, string] = [
  'Very Safe',
  'Conservative',
  'Balanced',
  'Aggressive',
  'High Risk',
];

const UNDERDOG_LEAN_LABELS: [string, string, string, string, string] = [
  'Chalk Only',
  'Prefer Favs',
  'Balanced',
  'Prefer Dogs',
  'Dogs Only',
];

const OVER_UNDER_LEAN_LABELS: [string, string, string, string, string] = [
  'Unders Only',
  'Prefer Under',
  'Balanced',
  'Prefer Over',
  'Overs Only',
];

const CONFIDENCE_LABELS: [string, string, string, string, string] = [
  'Any Edge',
  'Low Bar',
  'Moderate',
  'High Bar',
  'Very Picky',
];

const MAX_PICKS_LABELS: [string, string, string, string, string] = [
  '1 Pick',
  '2 Picks',
  '3 Picks',
  '4 Picks',
  '5 Picks',
];

const BET_TYPE_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'spread', label: 'Spread' },
  { value: 'moneyline', label: 'ML' },
  { value: 'total', label: 'Total' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function Screen3_Personality({
  params,
  onParamChange,
}: Screen3_PersonalityProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const glassSurface = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.8)';
  const glassBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.68)';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.introCard,
          {
            backgroundColor: glassSurface,
            borderColor: glassBorder,
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
          Agent mindset
        </Text>
        <Text style={[styles.introTitle, { color: theme.colors.onSurface }]}>
          Tune how this agent thinks before you fine-tune the data rules.
        </Text>
        <Text
          style={[styles.introDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          Start with broad instincts first. The goal is a readable personality profile, not a wall of settings.
        </Text>
      </View>

      {/* Core Personality Section */}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: glassSurface,
            borderColor: glassBorder,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Core Personality
        </Text>
        <Text
          style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          Define how your agent approaches betting decisions
        </Text>

        <SliderInput
          value={params.risk_tolerance}
          onChange={(value) => onParamChange('risk_tolerance', value)}
          label="Risk Tolerance"
          description="How much risk is your agent willing to take?"
          labels={RISK_TOLERANCE_LABELS}
        />

        <SliderInput
          value={params.underdog_lean}
          onChange={(value) => onParamChange('underdog_lean', value)}
          label="Underdog Lean"
          description="Does your agent prefer favorites or underdogs?"
          labels={UNDERDOG_LEAN_LABELS}
        />

        <SliderInput
          value={params.over_under_lean}
          onChange={(value) => onParamChange('over_under_lean', value)}
          label="Over/Under Lean"
          description="Does your agent lean towards overs or unders on totals?"
          labels={OVER_UNDER_LEAN_LABELS}
        />

        <SliderInput
          value={params.confidence_threshold}
          onChange={(value) => onParamChange('confidence_threshold', value)}
          label="Confidence Threshold"
          description="How confident should your agent be before making a pick?"
          labels={CONFIDENCE_LABELS}
        />

        <ToggleInput
          value={params.chase_value}
          onChange={(value) => onParamChange('chase_value', value)}
          label="Chase Value"
          description="Seek out bets where odds exceed model probability (positive expected value)"
        />
      </View>

      <Divider style={styles.divider} />

      {/* Bet Selection Section */}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: glassSurface,
            borderColor: glassBorder,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Bet Selection
        </Text>
        <Text
          style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          Control what types of bets your agent makes
        </Text>

        {/* Preferred Bet Type */}
        <View style={styles.segmentContainer}>
          <Text style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>
            Preferred Bet Type
          </Text>
          <Text
            style={[styles.fieldDescription, { color: theme.colors.onSurfaceVariant }]}
          >
            Which bet type should your agent focus on?
          </Text>
          <SegmentedButtons
            value={params.preferred_bet_type}
            onValueChange={(value) =>
              onParamChange('preferred_bet_type', value as BetType)
            }
            buttons={BET_TYPE_OPTIONS}
            style={styles.segmentedButtons}
          />
        </View>

        <SliderInput
          value={params.max_picks_per_day}
          onChange={(value) => onParamChange('max_picks_per_day', value)}
          label="Max Picks Per Day"
          description="Maximum number of picks your agent will make on any given day"
          labels={MAX_PICKS_LABELS}
        />

        <ToggleInput
          value={params.skip_weak_slates}
          onChange={(value) => onParamChange('skip_weak_slates', value)}
          label="Skip Weak Slates"
          description="Pass on days with few games or poor betting opportunities"
        />
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  introCard: {
    marginBottom: 18,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  introTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  introDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  sectionCard: {
    marginBottom: 12,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  divider: {
    marginVertical: 8,
    opacity: 0,
  },
  segmentContainer: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldDescription: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  segmentedButtons: {
    marginTop: 4,
  },
});
