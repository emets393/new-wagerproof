import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Divider } from 'react-native-paper';

import { useThemeContext } from '@/contexts/ThemeContext';
import { SliderInput } from '@/components/agents/inputs/SliderInput';
import { ToggleInput } from '@/components/agents/inputs/ToggleInput';
import { OddsInput } from '@/components/agents/inputs/OddsInput';
import {
  PersonalityParams,
  Sport,
  getConditionalParams,
} from '@/types/agent';

// ============================================================================
// TYPES
// ============================================================================

interface Screen4_DataAndConditionsProps {
  params: PersonalityParams;
  selectedSports: Sport[];
  onParamChange: <K extends keyof PersonalityParams>(
    key: K,
    value: PersonalityParams[K]
  ) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRUST_LABELS: [string, string, string, string, string] = [
  'Ignore',
  'Low Trust',
  'Moderate',
  'High Trust',
  'Full Trust',
];

const SENSITIVITY_LABELS: [string, string, string, string, string] = [
  'Minimal',
  'Low',
  'Moderate',
  'High',
  'Maximum',
];

const PUBLIC_THRESHOLD_LABELS: [string, string, string, string, string] = [
  '55%',
  '60%',
  '65%',
  '70%',
  '75%',
];

const HOME_BOOST_LABELS: [string, string, string, string, string] = [
  'Ignore',
  'Slight',
  'Moderate',
  'Strong',
  'Maximum',
];

const RECENT_FORM_LABELS: [string, string, string, string, string] = [
  'Ignore',
  'Light',
  'Moderate',
  'Heavy',
  'Primary',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function Screen4_DataAndConditions({
  params,
  selectedSports,
  onParamChange,
}: Screen4_DataAndConditionsProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  // Get conditional params based on selected sports
  const conditional = getConditionalParams(selectedSports);

  return (
    <View style={styles.container}>
      {/* Data Trust Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Data Trust
        </Text>
        <Text
          style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          How much should your agent trust different data sources?
        </Text>

        <SliderInput
          value={params.trust_model}
          onChange={(value) => onParamChange('trust_model', value)}
          label="Trust WagerProof Model"
          description="How much weight to give our predictive model's probabilities"
          labels={TRUST_LABELS}
        />

        <SliderInput
          value={params.trust_polymarket}
          onChange={(value) => onParamChange('trust_polymarket', value)}
          label="Trust Polymarket"
          description="How much weight to give Polymarket prediction market odds"
          labels={TRUST_LABELS}
        />

        <ToggleInput
          value={params.polymarket_divergence_flag}
          onChange={(value) => onParamChange('polymarket_divergence_flag', value)}
          label="Polymarket Divergence Flag"
          description="Flag games where Polymarket significantly differs from Vegas lines"
        />
      </View>

      <Divider style={styles.divider} />

      {/* Odds Limits Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Odds Limits
        </Text>
        <Text
          style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          Set boundaries on the odds your agent will bet
        </Text>

        <OddsInput
          value={params.max_favorite_odds}
          onChange={(value) => onParamChange('max_favorite_odds', value)}
          label="Max Favorite Odds"
          type="favorite"
        />

        <OddsInput
          value={params.min_underdog_odds}
          onChange={(value) => onParamChange('min_underdog_odds', value)}
          label="Min Underdog Odds"
          type="underdog"
        />
      </View>

      {/* NFL/CFB Section */}
      {conditional.showPublicBetting && (
        <>
          <Divider style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Football Settings
              </Text>
              <View style={styles.sportBadges}>
                {selectedSports.includes('nfl') && (
                  <View style={[styles.badge, { backgroundColor: '#013369' }]}>
                    <Text style={styles.badgeText}>NFL</Text>
                  </View>
                )}
                {selectedSports.includes('cfb') && (
                  <View style={[styles.badge, { backgroundColor: '#C41E3A' }]}>
                    <Text style={styles.badgeText}>CFB</Text>
                  </View>
                )}
              </View>
            </View>
            <Text
              style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
            >
              Football-specific betting conditions
            </Text>

            <ToggleInput
              value={params.fade_public ?? false}
              onChange={(value) => onParamChange('fade_public', value)}
              label="Fade the Public"
              description="Bet against heavy public action on one side"
            />

            {params.fade_public && (
              <SliderInput
                value={params.public_threshold ?? 3}
                onChange={(value) => onParamChange('public_threshold', value)}
                label="Public Threshold"
                description="Percentage of public bets required to trigger a fade"
                labels={PUBLIC_THRESHOLD_LABELS}
              />
            )}

            {conditional.showWeather && (
              <>
                <ToggleInput
                  value={params.weather_impacts_totals ?? false}
                  onChange={(value) => onParamChange('weather_impacts_totals', value)}
                  label="Weather Impacts Totals"
                  description="Factor in weather conditions for total bets (wind, rain, snow)"
                />

                {params.weather_impacts_totals && (
                  <SliderInput
                    value={params.weather_sensitivity ?? 3}
                    onChange={(value) => onParamChange('weather_sensitivity', value)}
                    label="Weather Sensitivity"
                    description="How aggressively to adjust for weather conditions"
                    labels={SENSITIVITY_LABELS}
                  />
                )}
              </>
            )}
          </View>
        </>
      )}

      {/* NBA/NCAAB Section */}
      {conditional.showTeamRatings && (
        <>
          <Divider style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Basketball Settings
              </Text>
              <View style={styles.sportBadges}>
                {selectedSports.includes('nba') && (
                  <View style={[styles.badge, { backgroundColor: '#1D428A' }]}>
                    <Text style={styles.badgeText}>NBA</Text>
                  </View>
                )}
                {selectedSports.includes('ncaab') && (
                  <View style={[styles.badge, { backgroundColor: '#FF6B00' }]}>
                    <Text style={styles.badgeText}>NCAAB</Text>
                  </View>
                )}
              </View>
            </View>
            <Text
              style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
            >
              Basketball-specific betting conditions
            </Text>

            <SliderInput
              value={params.trust_team_ratings ?? 3}
              onChange={(value) => onParamChange('trust_team_ratings', value)}
              label="Trust Team Ratings"
              description="How much to trust advanced team ratings (e.g., NET, KenPom)"
              labels={TRUST_LABELS}
            />

            <ToggleInput
              value={params.pace_affects_totals ?? false}
              onChange={(value) => onParamChange('pace_affects_totals', value)}
              label="Pace Affects Totals"
              description="Factor team pace into over/under decisions"
            />

            {conditional.showBackToBacks && (
              <ToggleInput
                value={params.fade_back_to_backs ?? false}
                onChange={(value) => onParamChange('fade_back_to_backs', value)}
                label="Fade Back-to-Backs"
                description="Bet against teams playing on consecutive days"
              />
            )}
          </View>
        </>
      )}

      {/* NBA Only Section */}
      {conditional.showTrends && (
        <>
          <Divider style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                NBA Trends
              </Text>
              <View style={[styles.badge, { backgroundColor: '#1D428A' }]}>
                <Text style={styles.badgeText}>NBA</Text>
              </View>
            </View>
            <Text
              style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
            >
              NBA-specific trend and streak analysis
            </Text>

            <SliderInput
              value={params.weight_recent_form ?? 3}
              onChange={(value) => onParamChange('weight_recent_form', value)}
              label="Weight Recent Form"
              description="How much to weigh a team's last 10 games vs. season averages"
              labels={RECENT_FORM_LABELS}
            />

            <ToggleInput
              value={params.ride_hot_streaks ?? false}
              onChange={(value) => onParamChange('ride_hot_streaks', value)}
              label="Ride Hot Streaks"
              description="Bet on teams that are winning consistently"
            />

            <ToggleInput
              value={params.fade_cold_streaks ?? false}
              onChange={(value) => onParamChange('fade_cold_streaks', value)}
              label="Fade Cold Streaks"
              description="Bet against teams that are losing consistently"
            />

            <ToggleInput
              value={params.trust_ats_trends ?? false}
              onChange={(value) => onParamChange('trust_ats_trends', value)}
              label="Trust ATS Trends"
              description="Factor in against-the-spread performance trends"
            />

            <ToggleInput
              value={params.regress_luck ?? false}
              onChange={(value) => onParamChange('regress_luck', value)}
              label="Regress Luck"
              description="Expect teams on hot/cold streaks to regress to the mean"
            />
          </View>
        </>
      )}

      {/* Situational Section */}
      <Divider style={styles.divider} />
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Situational Factors
        </Text>
        <Text
          style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          Game situation adjustments
        </Text>

        <SliderInput
          value={params.home_court_boost}
          onChange={(value) => onParamChange('home_court_boost', value)}
          label="Home Court/Field Boost"
          description="How much extra weight to give home teams"
          labels={HOME_BOOST_LABELS}
        />

        {conditional.showUpsetAlert && (
          <ToggleInput
            value={params.upset_alert ?? false}
            onChange={(value) => onParamChange('upset_alert', value)}
            label="Upset Alert"
            description="Flag potential March Madness upsets based on tournament trends"
          />
        )}
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  sportBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    marginVertical: 16,
  },
});
