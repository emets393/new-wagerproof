import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, Button, Card, Switch } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useThemeContext } from '@/contexts/ThemeContext';
import { useArchetypeById } from '@/hooks/usePresetArchetypes';
import {
  Sport,
  PersonalityParams,
  BET_TYPES,
} from '@/types/agent';
import { CreateAgentFormState } from '@/types/agent';

// ============================================================================
// TYPES
// ============================================================================

interface Screen6_ReviewProps {
  formState: CreateAgentFormState;
  autoGenerate: boolean;
  onAutoGenerateChange: (value: boolean) => void;
  onCreate: () => void;
  isCreating: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SPORT_CONFIG: Record<Sport, { label: string; color: string }> = {
  nfl: { label: 'NFL', color: '#013369' },
  cfb: { label: 'CFB', color: '#C41E3A' },
  nba: { label: 'NBA', color: '#1D428A' },
  ncaab: { label: 'NCAAB', color: '#FF6B00' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseAvatarColor(value: string): { isGradient: boolean; colors: string[]; primary: string } {
  if (value.startsWith('gradient:')) {
    const colors = value.replace('gradient:', '').split(',');
    return { isGradient: true, colors, primary: colors[0] };
  }
  return { isGradient: false, colors: [value], primary: value };
}

function generatePersonalitySummary(params: PersonalityParams): string[] {
  const summary: string[] = [];

  // Risk tolerance
  if (params.risk_tolerance <= 2) {
    summary.push('Plays it safe with conservative picks');
  } else if (params.risk_tolerance >= 4) {
    summary.push('Aggressive risk-taker looking for big payouts');
  } else {
    summary.push('Balanced approach to risk');
  }

  // Underdog lean
  if (params.underdog_lean <= 2) {
    summary.push('Prefers betting on favorites');
  } else if (params.underdog_lean >= 4) {
    summary.push('Loves hunting for underdog value');
  }

  // Over/Under lean
  if (params.over_under_lean <= 2) {
    summary.push('Tends to bet unders on totals');
  } else if (params.over_under_lean >= 4) {
    summary.push('Leans towards overs on totals');
  }

  // Confidence threshold
  if (params.confidence_threshold >= 4) {
    summary.push('Very selective, only picks high-confidence plays');
  } else if (params.confidence_threshold <= 2) {
    summary.push('Willing to take smaller edges');
  }

  // Chase value
  if (params.chase_value) {
    summary.push('Seeks positive expected value opportunities');
  }

  // Data trust
  if (params.trust_model >= 4) {
    summary.push('Heavily relies on WagerProof model predictions');
  }
  if (params.trust_polymarket >= 4) {
    summary.push('Incorporates Polymarket prediction data');
  }

  // Bet type
  if (params.preferred_bet_type !== 'any') {
    const betTypeLabel = params.preferred_bet_type === 'spread'
      ? 'spreads'
      : params.preferred_bet_type === 'moneyline'
      ? 'moneylines'
      : 'totals';
    summary.push(`Focuses primarily on ${betTypeLabel}`);
  }

  return summary.slice(0, 7); // Max 7 bullet points
}

function generateAgentDescription(
  archetypeName: string | null,
  params: PersonalityParams,
  sports: Sport[]
): string {
  const sportNames = sports.map((s) => SPORT_CONFIG[s].label).join(', ');

  if (archetypeName) {
    return `This agent follows the "${archetypeName}" style and will analyze ${sportNames} games to find betting opportunities that match your preferences.`;
  }

  // Generate description based on params
  const riskDesc =
    params.risk_tolerance >= 4
      ? 'an aggressive'
      : params.risk_tolerance <= 2
      ? 'a conservative'
      : 'a balanced';

  const focusDesc =
    params.underdog_lean >= 4
      ? 'underdog hunting'
      : params.underdog_lean <= 2
      ? 'chalk grinding'
      : 'value betting';

  return `This is ${riskDesc} ${focusDesc} agent that will analyze ${sportNames} games. It will generate picks based on your custom settings and preferences.`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Screen6_Review({
  formState,
  autoGenerate,
  onAutoGenerateChange,
  onCreate,
  isCreating,
}: Screen6_ReviewProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  // Get archetype info if selected
  const { archetype } = useArchetypeById(formState.archetype);

  // Generate personality summary
  const personalitySummary = useMemo(
    () => generatePersonalitySummary(formState.personality_params),
    [formState.personality_params]
  );

  // Generate description
  const agentDescription = useMemo(
    () =>
      generateAgentDescription(
        archetype?.name || null,
        formState.personality_params,
        formState.preferred_sports
      ),
    [archetype, formState.personality_params, formState.preferred_sports]
  );

  // Check if custom insights are filled
  const hasCustomInsights = Object.values(formState.custom_insights).some(
    (v) => v !== null && v.length > 0
  );

  return (
    <View style={styles.container}>
      {/* Agent Preview Card */}
      <Card
        style={[
          styles.previewCard,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(255, 255, 255, 0.95)',
            borderColor: parseAvatarColor(formState.avatar_color).primary,
            borderWidth: 2,
          },
        ]}
      >
        {/* Color accent bar */}
        {(() => {
          const parsed = parseAvatarColor(formState.avatar_color);
          if (parsed.isGradient) {
            return (
              <LinearGradient
                colors={parsed.colors as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.accentBar}
              />
            );
          }
          return (
            <View
              style={[styles.accentBar, { backgroundColor: formState.avatar_color }]}
            />
          );
        })()}

        <Card.Content style={styles.previewContent}>
          {/* Avatar and Name */}
          <View style={styles.avatarRow}>
            {(() => {
              const parsed = parseAvatarColor(formState.avatar_color);
              if (parsed.isGradient) {
                return (
                  <LinearGradient
                    colors={parsed.colors as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarContainer}
                  >
                    <Text style={styles.avatarEmoji}>{formState.avatar_emoji}</Text>
                  </LinearGradient>
                );
              }
              return (
                <View
                  style={[
                    styles.avatarContainer,
                    { backgroundColor: `${formState.avatar_color}30` },
                  ]}
                >
                  <Text style={styles.avatarEmoji}>{formState.avatar_emoji}</Text>
                </View>
              );
            })()}
            <View style={styles.nameContainer}>
              <Text style={[styles.agentName, { color: theme.colors.onSurface }]}>
                {formState.name}
              </Text>
              {archetype && (
                <Text
                  style={[styles.archetypeLabel, { color: theme.colors.primary }]}
                >
                  {archetype.name}
                </Text>
              )}
            </View>
          </View>

          {/* Sport Badges */}
          <View style={styles.sportBadges}>
            {formState.preferred_sports.map((sport) => (
              <View
                key={sport}
                style={[
                  styles.sportBadge,
                  { backgroundColor: SPORT_CONFIG[sport].color },
                ]}
              >
                <Text style={styles.sportBadgeText}>
                  {SPORT_CONFIG[sport].label}
                </Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Description */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          This Agent Will...
        </Text>
        <Text
          style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
        >
          {agentDescription}
        </Text>
      </View>

      {/* Personality Summary */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Key Traits
        </Text>
        <View style={styles.traitsList}>
          {personalitySummary.map((trait, index) => (
            <View key={index} style={styles.traitItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={18}
                color={theme.colors.primary}
                style={styles.traitIcon}
              />
              <Text
                style={[styles.traitText, { color: theme.colors.onSurface }]}
              >
                {trait}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Custom Insights Indicator */}
      {hasCustomInsights && (
        <View
          style={[
            styles.insightsIndicator,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.03)',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="text-box-check"
            size={20}
            color={theme.colors.primary}
          />
          <Text
            style={[
              styles.insightsIndicatorText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Custom insights will personalize this agent's behavior
          </Text>
        </View>
      )}

      {/* Auto-Generate Toggle */}
      <View
        style={[
          styles.autoGenerateCard,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(0, 0, 0, 0.03)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.05)',
          },
        ]}
      >
        <View style={styles.autoGenerateContent}>
          <View style={styles.autoGenerateTextContainer}>
            <Text
              style={[styles.autoGenerateTitle, { color: theme.colors.onSurface }]}
            >
              Auto-Generate Picks
            </Text>
            <Text
              style={[
                styles.autoGenerateDescription,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Let this agent automatically generate picks each day based on its
              settings
            </Text>
          </View>
          <Switch
            value={autoGenerate}
            onValueChange={onAutoGenerateChange}
            color={theme.colors.primary}
          />
        </View>
      </View>

      {/* Create Button */}
      <View style={styles.createButtonContainer}>
        <Button
          mode="contained"
          onPress={onCreate}
          disabled={isCreating}
          style={styles.createButton}
          contentStyle={styles.createButtonContent}
          labelStyle={styles.createButtonLabel}
        >
          {isCreating ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.loadingText}>Creating Agent...</Text>
            </View>
          ) : (
            'Create Agent'
          )}
        </Button>
      </View>

      {/* Note */}
      <Text style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
        You can edit your agent's settings at any time after creation.
      </Text>
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
  previewCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  previewContent: {
    padding: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  nameContainer: {
    flex: 1,
  },
  agentName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  archetypeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  sportBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sportBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  traitsList: {
    gap: 10,
  },
  traitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  traitIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  traitText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  insightsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  insightsIndicatorText: {
    fontSize: 14,
    flex: 1,
  },
  autoGenerateCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  autoGenerateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  autoGenerateTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  autoGenerateTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  autoGenerateDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  createButtonContainer: {
    marginBottom: 16,
  },
  createButton: {
    borderRadius: 14,
  },
  createButtonContent: {
    paddingVertical: 8,
  },
  createButtonLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  note: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
