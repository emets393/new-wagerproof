import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useThemeContext } from '@/contexts/ThemeContext';
import { CustomInsights } from '@/types/agent';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// TYPES
// ============================================================================

interface Screen5_CustomInsightsProps {
  insights: CustomInsights;
  onInsightChange: <K extends keyof CustomInsights>(
    key: K,
    value: CustomInsights[K]
  ) => void;
}

interface InsightFieldConfig {
  key: keyof CustomInsights;
  title: string;
  icon: string;
  description: string;
  placeholder: string;
  maxLength: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INSIGHT_FIELDS: InsightFieldConfig[] = [
  {
    key: 'betting_philosophy',
    title: 'Betting Philosophy',
    icon: 'book-open-variant',
    description: 'Describe your overall approach to betting. What principles guide your decisions?',
    placeholder: 'e.g., I believe in value betting and only taking plays where I have a significant edge over the market...',
    maxLength: 500,
  },
  {
    key: 'perceived_edges',
    title: 'Perceived Edges',
    icon: 'chart-line',
    description: 'What unique insights or edges do you think you have?',
    placeholder: 'e.g., I\'m particularly good at spotting mispriced totals in divisional games, especially when weather is a factor...',
    maxLength: 500,
  },
  {
    key: 'avoid_situations',
    title: 'Situations to Avoid',
    icon: 'cancel',
    description: 'What types of games or situations should your agent avoid?',
    placeholder: 'e.g., Never bet on primetime games, avoid teams coming off emotional wins, skip games with uncertain QB situations...',
    maxLength: 300,
  },
  {
    key: 'target_situations',
    title: 'Target Situations',
    icon: 'target',
    description: 'What types of games or situations should your agent prioritize?',
    placeholder: 'e.g., Look for home underdogs off a bye week, target early season totals before lines adjust, focus on late-season division games...',
    maxLength: 300,
  },
];

// ============================================================================
// COLLAPSIBLE CARD COMPONENT
// ============================================================================

interface CollapsibleInsightCardProps {
  config: InsightFieldConfig;
  value: string | null;
  onChange: (value: string | null) => void;
}

function CollapsibleInsightCard({
  config,
  value,
  onChange,
}: CollapsibleInsightCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleTextChange = useCallback(
    (text: string) => {
      // Store empty string as null
      onChange(text.length > 0 ? text : null);
    },
    [onChange]
  );

  const charCount = value?.length ?? 0;
  const isOverLimit = charCount > config.maxLength;
  const hasContent = charCount > 0;

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(255, 255, 255, 0.95)',
          borderColor: hasContent
            ? theme.colors.primary
            : isDark
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.08)',
          borderWidth: hasContent ? 1.5 : 1,
        },
      ]}
    >
      {/* Header - Always Visible */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: hasContent
                  ? `${theme.colors.primary}20`
                  : isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.05)',
              },
            ]}
          >
            <MaterialCommunityIcons
              name={config.icon as any}
              size={20}
              color={hasContent ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
              {config.title}
            </Text>
            {hasContent && !isExpanded && (
              <Text
                style={[styles.previewText, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {value}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.headerRight}>
          {hasContent && (
            <View
              style={[
                styles.filledBadge,
                { backgroundColor: `${theme.colors.primary}20` },
              ]}
            >
              <Text style={[styles.filledBadgeText, { color: theme.colors.primary }]}>
                Filled
              </Text>
            </View>
          )}
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          <Text
            style={[styles.fieldDescription, { color: theme.colors.onSurfaceVariant }]}
          >
            {config.description}
          </Text>

          <View
            style={[
              styles.textAreaContainer,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.03)'
                  : 'rgba(0, 0, 0, 0.02)',
                borderColor: isOverLimit
                  ? theme.colors.error
                  : isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
          >
            <TextInput
              style={[styles.textArea, { color: theme.colors.onSurface }]}
              value={value ?? ''}
              onChangeText={handleTextChange}
              placeholder={config.placeholder}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={config.maxLength + 50} // Allow slightly over to show error
            />
          </View>

          <View style={styles.charCountContainer}>
            <Text
              style={[
                styles.charCount,
                {
                  color: isOverLimit
                    ? theme.colors.error
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {charCount}/{config.maxLength}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Screen5_CustomInsights({
  insights,
  onInsightChange,
}: Screen5_CustomInsightsProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const filledCount = Object.values(insights).filter(
    (v) => v !== null && v.length > 0
  ).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Custom Insights
        </Text>
        <Text
          style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          Help your agent understand your unique betting perspective. These fields
          are optional but can improve how well your agent matches your style.
        </Text>

        {/* Progress indicator */}
        <View
          style={[
            styles.progressBar,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.05)',
            },
          ]}
        >
          <View style={styles.progressInfo}>
            <Text
              style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}
            >
              {filledCount} of {INSIGHT_FIELDS.length} completed (optional)
            </Text>
          </View>
        </View>
      </View>

      {/* Insight Cards */}
      <View style={styles.cardsContainer}>
        {INSIGHT_FIELDS.map((field) => (
          <CollapsibleInsightCard
            key={field.key}
            config={field}
            value={insights[field.key]}
            onChange={(value) => onInsightChange(field.key, value)}
          />
        ))}
      </View>

      {/* Helper Note */}
      <View
        style={[
          styles.noteContainer,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(0, 0, 0, 0.03)',
          },
        ]}
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color={theme.colors.onSurfaceVariant}
        />
        <Text style={[styles.noteText, { color: theme.colors.onSurfaceVariant }]}>
          These insights help the AI understand your betting philosophy. You can
          always edit them later from the agent settings.
        </Text>
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
  header: {
    marginBottom: 20,
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
  progressBar: {
    borderRadius: 8,
    padding: 12,
  },
  progressInfo: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewText: {
    fontSize: 13,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filledBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  fieldDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  textAreaContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 120,
  },
  textArea: {
    fontSize: 15,
    lineHeight: 22,
  },
  charCountContainer: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  charCount: {
    fontSize: 12,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
