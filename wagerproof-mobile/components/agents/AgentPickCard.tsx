import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { AgentPick, BetType, PickResult, Scale1To5 } from '@/types/agent';

interface AgentPickCardProps {
  pick: AgentPick;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const BET_TYPE_LABELS: Record<Exclude<BetType, 'any'>, string> = {
  spread: 'Spread',
  moneyline: 'ML',
  total: 'Total',
};

const BET_TYPE_COLORS: Record<Exclude<BetType, 'any'>, string> = {
  spread: '#3b82f6',
  moneyline: '#8b5cf6',
  total: '#06b6d4',
};

const RESULT_CONFIG: Record<
  PickResult,
  { label: string; color: string; bgColor: string }
> = {
  won: { label: 'WON', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  lost: { label: 'LOST', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  push: { label: 'PUSH', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)' },
  pending: {
    label: 'PENDING',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
  },
};

function ConfidenceDots({ confidence }: { confidence: Scale1To5 }) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  return (
    <View style={styles.confidenceDots}>
      {[1, 2, 3, 4, 5].map((level) => (
        <View
          key={level}
          style={[
            styles.dot,
            {
              backgroundColor:
                level <= confidence
                  ? theme.colors.primary
                  : isDark
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.1)',
            },
          ]}
        />
      ))}
    </View>
  );
}

export function AgentPickCard({
  pick,
  expanded: controlledExpanded,
  onToggleExpand,
}: AgentPickCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Use controlled or internal expanded state
  const expanded = controlledExpanded ?? internalExpanded;

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  const resultConfig = RESULT_CONFIG[pick.result];
  const betTypeColor = BET_TYPE_COLORS[pick.bet_type];

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.08)',
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.7} onPress={handleToggle}>
        <Card.Content style={styles.content}>
          {/* Top Row: Matchup, Result Badge */}
          <View style={styles.topRow}>
            <View style={styles.matchupContainer}>
              <Text
                style={[styles.matchup, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {pick.matchup}
              </Text>
              <Text
                style={[
                  styles.gameDate,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {pick.game_date}
              </Text>
            </View>

            <View
              style={[
                styles.resultBadge,
                { backgroundColor: resultConfig.bgColor },
              ]}
            >
              <Text style={[styles.resultText, { color: resultConfig.color }]}>
                {resultConfig.label}
              </Text>
            </View>
          </View>

          {/* Middle Row: Bet Type Badge, Selection, Odds */}
          <View style={styles.selectionRow}>
            <View
              style={[
                styles.betTypeBadge,
                { backgroundColor: `${betTypeColor}20` },
              ]}
            >
              <Text style={[styles.betTypeText, { color: betTypeColor }]}>
                {BET_TYPE_LABELS[pick.bet_type]}
              </Text>
            </View>

            <Text
              style={[styles.selection, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {pick.pick_selection}
            </Text>

            {pick.odds && (
              <Text
                style={[
                  styles.odds,
                  {
                    color: theme.colors.primary,
                  },
                ]}
              >
                {pick.odds}
              </Text>
            )}
          </View>

          {/* Bottom Row: Confidence, Units, Expand */}
          <View style={styles.bottomRow}>
            <View style={styles.confidenceContainer}>
              <Text
                style={[
                  styles.confidenceLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Confidence
              </Text>
              <ConfidenceDots confidence={pick.confidence} />
            </View>

            <View style={styles.unitsContainer}>
              <Text
                style={[styles.unitsValue, { color: theme.colors.onSurface }]}
              >
                {pick.units}u
              </Text>
            </View>

            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </View>

          {/* Expandable Reasoning */}
          {expanded && (
            <View
              style={[
                styles.expandedSection,
                {
                  borderTopColor: isDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
            >
              <Text
                style={[
                  styles.reasoningLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                REASONING
              </Text>
              <Text
                style={[styles.reasoningText, { color: theme.colors.onSurface }]}
              >
                {pick.reasoning_text}
              </Text>

              {pick.key_factors && pick.key_factors.length > 0 && (
                <View style={styles.keyFactorsContainer}>
                  <Text
                    style={[
                      styles.keyFactorsLabel,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    KEY FACTORS
                  </Text>
                  {pick.key_factors.map((factor, index) => (
                    <View key={index} style={styles.factorRow}>
                      <Text
                        style={[
                          styles.factorBullet,
                          { color: theme.colors.primary },
                        ]}
                      >
                        •
                      </Text>
                      <Text
                        style={[
                          styles.factorText,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        {factor}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </Card.Content>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 6,
  },
  content: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  matchupContainer: {
    flex: 1,
    marginRight: 12,
  },
  matchup: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  gameDate: {
    fontSize: 12,
  },
  resultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  betTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  betTypeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selection: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  odds: {
    fontSize: 15,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confidenceDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unitsContainer: {
    flex: 1,
    alignItems: 'center',
  },
  unitsValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  expandedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  reasoningLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  reasoningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  keyFactorsContainer: {
    marginTop: 12,
  },
  keyFactorsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  factorBullet: {
    fontSize: 14,
    marginRight: 8,
    lineHeight: 20,
  },
  factorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
