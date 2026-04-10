// ToolCallsPill — Condensed tool execution summary, modeled after Ellie's
// ToolCallsBlockView. Shows stacked icons when collapsed, expands to show
// individual tool calls with name, icon, and duration.
//
// Auto-expands when any tool is running, collapses when all are done.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import type { ContentBlock, ToolStatus } from '../../types/chatTypes';
import { TOOL_DISPLAY_NAMES, TOOL_ICONS } from '../../types/chatTypes';

interface ToolCallsPillProps {
  toolBlocks: Array<Extract<ContentBlock, { type: 'tool_use' }>>;
}

export default function ToolCallsPill({ toolBlocks }: ToolCallsPillProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter out suggest_follow_ups from display — it's a UX tool, not a data tool
  const visibleTools = toolBlocks.filter((t) => t.name !== 'suggest_follow_ups');

  const anyRunning = visibleTools.some((t) => t.status.state === 'running');
  const allDone = visibleTools.every((t) => t.status.state === 'done');

  // Auto-expand when tools are running, auto-collapse when done
  useEffect(() => {
    if (anyRunning) setIsExpanded(true);
    else if (allDone) {
      const timer = setTimeout(() => setIsExpanded(false), 800);
      return () => clearTimeout(timer);
    }
  }, [anyRunning, allDone]);

  if (visibleTools.length === 0) return null;

  const runningCount = visibleTools.filter((t) => t.status.state === 'running').length;
  const statusLabel = anyRunning
    ? `${runningCount} searching...`
    : `${visibleTools.length} source${visibleTools.length !== 1 ? 's' : ''} checked`;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      layout={Layout.springify()}
      style={styles.container}
    >
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        {/* Stacked icons */}
        <View style={styles.iconStack}>
          {visibleTools.slice(0, 4).map((tool, i) => (
            <View
              key={tool.id}
              style={[
                styles.iconCircle,
                { marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i },
                tool.status.state === 'running' && styles.iconCircleRunning,
              ]}
            >
              <MaterialCommunityIcons
                name={(TOOL_ICONS[tool.name] || 'wrench') as any}
                size={14}
                color="#ffffff"
              />
            </View>
          ))}
        </View>

        {/* Status label */}
        <View style={styles.labelRow}>
          {anyRunning && (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={{ marginRight: 6 }} />
          )}
          {allDone && !anyRunning && (
            <MaterialCommunityIcons
              name="check-circle"
              size={14}
              color="rgba(100, 220, 100, 0.8)"
              style={{ marginRight: 4 }}
            />
          )}
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        </View>

        {/* Expand/collapse chevron */}
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="rgba(255,255,255,0.4)"
        />
      </TouchableOpacity>

      {/* Expanded list */}
      {isExpanded && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.expandedList}>
          {visibleTools.map((tool) => (
            <ToolRow key={tool.id} tool={tool} />
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function ToolRow({ tool }: { tool: Extract<ContentBlock, { type: 'tool_use' }> }) {
  const isRunning = tool.status.state === 'running';
  const isDone = tool.status.state === 'done';
  const displayName = TOOL_DISPLAY_NAMES[tool.name] || tool.name;
  const durationMs = isDone ? (tool.status as { state: 'done'; ms: number }).ms : 0;

  return (
    <View style={styles.toolRow}>
      <View style={[styles.toolIconSmall, isRunning && styles.iconCircleRunning]}>
        <MaterialCommunityIcons
          name={(TOOL_ICONS[tool.name] || 'wrench') as any}
          size={12}
          color="#ffffff"
        />
      </View>
      <Text style={styles.toolName}>{displayName}</Text>
      {isRunning && <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />}
      {isDone && (
        <Text style={styles.toolDuration}>
          {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
        </Text>
      )}
      {isDone && (
        <MaterialCommunityIcons
          name={(tool.status as any).ok ? 'check' : 'alert-circle'}
          size={14}
          color={(tool.status as any).ok ? 'rgba(100, 220, 100, 0.8)' : 'rgba(255, 100, 100, 0.8)'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  iconStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.3)',
  },
  iconCircleRunning: {
    backgroundColor: 'rgba(100, 150, 255, 0.25)',
    borderColor: 'rgba(100, 150, 255, 0.4)',
  },
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  expandedList: {
    marginTop: 6,
    paddingLeft: 8,
    gap: 4,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  toolIconSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolName: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  toolDuration: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
    marginRight: 4,
  },
});
