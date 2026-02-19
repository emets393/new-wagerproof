import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAgentPickAudit } from '@/contexts/AgentPickAuditContext';

interface AgentPickPayloadAuditWidgetProps {
  gameKeys: Array<string | number | null | undefined>;
}

interface LeanedMetric {
  metric_key?: string;
  metric_value?: string;
  why_it_mattered?: string;
  personality_trait?: string;
  weight?: number;
}

export function AgentPickPayloadAuditWidget({ gameKeys }: AgentPickPayloadAuditWidgetProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { selectedAgentPick } = useAgentPickAudit();
  const [showPayload, setShowPayload] = useState(false);

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
  const leanedMetrics = (trace.leaned_metrics as LeanedMetric[] | undefined) ?? [];
  const rationaleSummary = typeof trace.rationale_summary === 'string' ? trace.rationale_summary : selectedAgentPick.reasoning_text;
  const personalityAlignment = typeof trace.personality_alignment === 'string'
    ? trace.personality_alignment
    : 'No explicit personality trace returned for this pick.';
  const payloadJson = JSON.stringify(selectedAgentPick.archived_game_data ?? {}, null, 2);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0b1010' : '#101617', borderColor: isDark ? 'rgba(0, 230, 118, 0.22)' : 'rgba(0, 186, 98, 0.24)' }]}>
      <Text style={[styles.headerText, { color: isDark ? '#9fb3ad' : '#b4c5c0' }]}>
        terminal://pick-audit
      </Text>

      <View style={styles.lineRow}>
        <Text style={[styles.prefix, { color: isDark ? '#00E676' : '#00BA62' }]}>›</Text>
        <Text style={[styles.titleText, { color: isDark ? '#00E676' : '#1ecf7b' }]}>
          Pick: {selectedAgentPick.pick_selection} ({selectedAgentPick.bet_type})
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>Leaned On Metrics</Text>
        {leanedMetrics.length > 0 ? (
          leanedMetrics.map((metric, index) => (
            <View key={`${metric.metric_key || 'metric'}-${index}`} style={styles.metricRow}>
              <Text style={[styles.metricKey, { color: isDark ? '#7ce8ad' : '#79f0b8' }]}>
                {metric.metric_key || 'metric'}
              </Text>
              <Text style={[styles.metricValue, { color: theme.colors.onSurfaceVariant }]}>
                = {metric.metric_value || 'n/a'}
              </Text>
              {typeof metric.weight === 'number' && (
                <Text style={[styles.metricWeight, { color: theme.colors.onSurfaceVariant }]}>
                  ({Math.round(metric.weight * 100)}%)
                </Text>
              )}
              {metric.personality_trait ? (
                <Text style={[styles.metricTrait, { color: theme.colors.primary }]}>
                  {' '}[{metric.personality_trait}]
                </Text>
              ) : null}
              {metric.why_it_mattered ? (
                <Text style={[styles.metricWhy, { color: theme.colors.onSurfaceVariant }]}>
                  {' '}— {metric.why_it_mattered}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No metric-level trace recorded. Showing key factors only.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>Why This Pick</Text>
        <Text style={[styles.bodyText, { color: theme.colors.onSurface }]}>{rationaleSummary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>Personality Audit</Text>
        <Text style={[styles.bodyText, { color: theme.colors.onSurface }]}>{personalityAlignment}</Text>
      </View>

      <Pressable onPress={() => setShowPayload((prev) => !prev)} style={styles.toggleRow}>
        <MaterialCommunityIcons
          name={showPayload ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.onSurfaceVariant}
        />
        <Text style={[styles.toggleText, { color: theme.colors.onSurfaceVariant }]}>
          {showPayload ? 'Hide full payload' : 'Show full payload'}
        </Text>
      </Pressable>

      {showPayload ? (
        <View style={[styles.payloadBlock, { backgroundColor: '#050808' }]}>
          <Text style={[styles.payloadText, { color: '#7fe0a8' }]}>{payloadJson}</Text>
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
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  prefix: {
    marginRight: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  titleText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  section: {
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  metricKey: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metricWeight: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metricTrait: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metricWhy: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
  },
  toggleRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  payloadBlock: {
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    maxHeight: 240,
  },
  payloadText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

