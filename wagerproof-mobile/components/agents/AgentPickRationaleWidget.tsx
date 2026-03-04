import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAgentPickAudit } from '@/contexts/AgentPickAuditContext';

interface AgentPickRationaleWidgetProps {
  gameKeys: Array<string | number | null | undefined>;
}

export function AgentPickRationaleWidget({ gameKeys }: AgentPickRationaleWidgetProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { selectedAgentPick } = useAgentPickAudit();

  const gameKeySet = useMemo(() => {
    return new Set(
      gameKeys
        .filter((key): key is string | number => key !== null && key !== undefined && String(key).length > 0)
        .map((key) => String(key))
    );
  }, [gameKeys]);

  if (!selectedAgentPick) return null;
  if (!gameKeySet.has(String(selectedAgentPick.game_id))) return null;

  const trace = (selectedAgentPick.ai_decision_trace ?? {}) as Record<string, unknown>;
  const rationaleSummary =
    typeof trace.rationale_summary === 'string' && trace.rationale_summary.trim().length > 0
      ? trace.rationale_summary
      : selectedAgentPick.reasoning_text;
  const keyFactors = Array.isArray(selectedAgentPick.key_factors) ? selectedAgentPick.key_factors.slice(0, 3) : [];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#0b1010' : '#101617',
          borderColor: isDark ? 'rgba(0, 230, 118, 0.22)' : 'rgba(0, 186, 98, 0.24)',
        },
      ]}
    >
      <Text style={[styles.headerText, { color: isDark ? '#9fb3ad' : '#b4c5c0' }]}>
        terminal://agent-rationale
      </Text>

      <View style={styles.titleRow}>
        <MaterialCommunityIcons name="brain" size={16} color={isDark ? '#00E676' : '#1ecf7b'} />
        <Text style={[styles.titleText, { color: isDark ? '#00E676' : '#1ecf7b' }]}>
          {selectedAgentPick.pick_selection}
        </Text>
      </View>

      <Text style={[styles.agentMetaText, { color: theme.colors.onSurfaceVariant }]}>
        {selectedAgentPick.bet_type.toUpperCase()} pick with {selectedAgentPick.confidence}/5 confidence
      </Text>

      <Text style={[styles.bodyText, { color: theme.colors.onSurface }]}>
        {rationaleSummary}
      </Text>

      {keyFactors.length > 0 ? (
        <View style={styles.factorsContainer}>
          {keyFactors.map((factor, index) => (
            <View
              key={`${selectedAgentPick.id}-factor-${index}`}
              style={[
                styles.factorPill,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)',
                },
              ]}
            >
              <Text style={[styles.factorText, { color: theme.colors.onSurfaceVariant }]}>{factor}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  headerText: {
    fontSize: 11,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  titleText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  agentMetaText: {
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '600',
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
  },
  factorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  factorPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  factorText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
});
