import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme, Button, Chip, Switch, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAgent, useUpdateAgent, useDeleteAgent } from '@/hooks/useAgents';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { SliderInput } from '@/components/agents/inputs/SliderInput';
import { ToggleInput } from '@/components/agents/inputs/ToggleInput';
import { OddsInput } from '@/components/agents/inputs/OddsInput';
import { TimePickerModal } from '@/components/agents/inputs/TimePickerModal';
import {
  Sport,
  SPORTS,
  BetType,
  BET_TYPES,
  Scale1To5,
  PersonalityParams,
  CustomInsights,
  getConditionalParams,
  DEFAULT_PERSONALITY_PARAMS,
  DEFAULT_CUSTOM_INSIGHTS,
  getTimezoneAbbr,
} from '@/types/agent';
import { useAuth } from '@/contexts/AuthContext';
import { ensureAutoPickNotificationPermission } from '@/services/notificationService';

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

const BET_TYPE_LABELS: Record<BetType, string> = {
  spread: 'Spread',
  moneyline: 'Moneyline',
  total: 'Total',
  any: 'Any',
};

// Emoji picker is now a shared swipeable component
import { SwipeableEmojiPicker } from '@/components/agents/inputs/SwipeableEmojiPicker';

const COLOR_OPTIONS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
];

// Collapsible Section component
function CollapsibleSection({
  title,
  icon,
  iconColor = '#6366f1',
  children,
  defaultExpanded = false,
  isDark,
}: {
  title: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isDark: boolean;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(255, 255, 255, 0.82)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(255, 255, 255, 0.72)',
          shadowColor: '#000000',
        },
      ]}
    >
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpanded(!expanded);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          {icon && (
            <View style={[styles.sectionIcon, { backgroundColor: `${iconColor}20` }]}>
              <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
            </View>
          )}
          <View style={styles.sectionTitleWrap}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.primary }]}>
              Settings
            </Text>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {title}
          </Text>
        </View>
        </View>
        <View
          style={[
            styles.chevronBadge,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(15, 23, 42, 0.06)',
            },
          ]}
        >
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
      </TouchableOpacity>
      {expanded && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

export default function AgentSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canCreatePublicAgent, canUseAutopilot } = useAgentEntitlements();
  const { user } = useAuth();

  // Fetch agent data
  const { data: agent, isLoading } = useAgent(id || '');

  // Mutations
  const updateAgentMutation = useUpdateAgent();
  const deleteAgentMutation = useDeleteAgent();

  // Form state
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [color, setColor] = useState('#3b82f6');
  const [sports, setSports] = useState<Sport[]>([]);
  const [personality, setPersonality] = useState<PersonalityParams>(
    DEFAULT_PERSONALITY_PARAMS
  );
  const [customInsights, setCustomInsights] = useState<CustomInsights>(
    DEFAULT_CUSTOM_INSIGHTS
  );
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [autoGenerateTime, setAutoGenerateTime] = useState('09:00');
  const [autoGenerateTimezone, setAutoGenerateTimezone] = useState('America/New_York');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form from agent data
  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setEmoji(agent.avatar_emoji);
      setColor(agent.avatar_color);
      setSports(agent.preferred_sports);
      setPersonality(agent.personality_params);
      setCustomInsights(agent.custom_insights);
      setAutoGenerate(agent.auto_generate);
      setAutoGenerateTime(agent.auto_generate_time || '09:00');
      setAutoGenerateTimezone(agent.auto_generate_timezone || 'America/New_York');
      setIsPublic(agent.is_public);
      setHasChanges(false);
    }
  }, [agent]);

  // Get conditional params based on selected sports
  const conditionalParams = useMemo(
    () => getConditionalParams(sports),
    [sports]
  );

  // Mark changes
  const markChanged = useCallback(() => {
    setHasChanges(true);
  }, []);

  // Handle sport toggle
  const handleSportToggle = useCallback(
    (sport: Sport) => {
      setSports((prev) => {
        if (prev.includes(sport)) {
          if (prev.length === 1) return prev; // Keep at least one
          return prev.filter((s) => s !== sport);
        }
        return [...prev, sport];
      });
      markChanged();
    },
    [markChanged]
  );

  // Handle personality param change
  const handlePersonalityChange = useCallback(
    <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => {
      setPersonality((prev) => ({ ...prev, [key]: value }));
      markChanged();
    },
    [markChanged]
  );

  // Handle custom insight change
  const handleInsightChange = useCallback(
    <K extends keyof CustomInsights>(key: K, value: CustomInsights[K]) => {
      setCustomInsights((prev) => ({ ...prev, [key]: value }));
      markChanged();
    },
    [markChanged]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!id || !hasChanges) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await updateAgentMutation.mutateAsync({
        agentId: id,
        data: {
          name,
          avatar_emoji: emoji,
          avatar_color: color,
          preferred_sports: sports,
          personality_params: personality,
          custom_insights: customInsights,
          auto_generate: autoGenerate,
          auto_generate_time: autoGenerateTime,
          auto_generate_timezone: autoGenerateTimezone,
          is_public: isPublic,
        },
      });

      setHasChanges(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Agent settings saved successfully');
    } catch (error) {
      console.error('Error saving agent:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save agent settings');
    }
  }, [
    id,
    hasChanges,
    name,
    emoji,
    color,
    sports,
    personality,
    customInsights,
    autoGenerate,
    autoGenerateTime,
    autoGenerateTimezone,
    isPublic,
    updateAgentMutation,
  ]);

  // Handle delete
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Agent',
      `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAgentMutation.mutateAsync(id || '');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/agents' as any);
            } catch (error) {
              console.error('Error deleting agent:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete agent');
            }
          },
        },
      ]
    );
  }, [id, name, deleteAgentMutation, router]);

  // Handle back with unsaved changes warning
  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [hasChanges, router]);

  // Render loading
  if (isLoading || !agent) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContent,
          { backgroundColor: isDark ? '#000000' : '#ffffff' },
        ]}
      >
        <Text style={{ color: theme.colors.onSurfaceVariant }}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff' },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            borderBottomColor: isDark
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.08)',
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.colors.onSurface}
            />
          </TouchableOpacity>

          <View style={styles.headerTitleSection}>
            <Text style={styles.headerEmoji}>{emoji}</Text>
            <Text
              style={[styles.headerTitle, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              Settings
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity Section */}
        <CollapsibleSection title="Identity" icon="card-account-details-outline" iconColor="#6366f1" defaultExpanded isDark={isDark}>
          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text
              style={[styles.inputLabel, { color: theme.colors.onSurface }]}
            >
              Agent Name
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: theme.colors.onSurface,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                markChanged();
              }}
              placeholder="Enter agent name"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              maxLength={50}
            />
          </View>

          {/* Emoji Picker */}
          <View style={styles.inputGroup}>
            <Text
              style={[styles.inputLabel, { color: theme.colors.onSurface }]}
            >
              Emoji
            </Text>
            <SwipeableEmojiPicker
              selectedEmoji={emoji}
              selectedColor={color}
              onEmojiSelect={(e) => {
                setEmoji(e);
                markChanged();
              }}
            />
          </View>

          {/* Color Picker */}
          <View style={styles.inputGroup}>
            <Text
              style={[styles.inputLabel, { color: theme.colors.onSurface }]}
            >
              Color
            </Text>
            <View style={styles.colorGrid}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorOption,
                    {
                      backgroundColor: c,
                      borderWidth: color === c ? 3 : 0,
                      borderColor: '#ffffff',
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setColor(c);
                    markChanged();
                  }}
                >
                  {color === c && (
                    <MaterialCommunityIcons
                      name="check"
                      size={18}
                      color="#ffffff"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </CollapsibleSection>

        {/* Sports Section */}
        <CollapsibleSection title="Sports" icon="basketball" iconColor="#ef4444" defaultExpanded isDark={isDark}>
          <View style={styles.chipGrid}>
            {SPORTS.map((sport) => (
              <Chip
                key={sport}
                mode={sports.includes(sport) ? 'flat' : 'outlined'}
                selected={sports.includes(sport)}
                onPress={() => handleSportToggle(sport)}
                style={[
                  styles.sportChip,
                  sports.includes(sport) && {
                    backgroundColor: theme.colors.primaryContainer,
                  },
                ]}
                textStyle={{
                  color: sports.includes(sport)
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.onSurfaceVariant,
                }}
              >
                {SPORT_LABELS[sport]}
              </Chip>
            ))}
          </View>
        </CollapsibleSection>

        {/* Core Personality Section */}
        <CollapsibleSection title="Core Personality" icon="head-cog-outline" iconColor="#8b5cf6" isDark={isDark}>
          <SliderInput
            value={personality.risk_tolerance}
            onChange={(v) => handlePersonalityChange('risk_tolerance', v)}
            label="Risk Tolerance"
            description="How aggressive should your agent be with bet sizing?"
            labels={['Very Safe', 'Safe', 'Balanced', 'Aggressive', 'Very Aggressive']}
          />

          <SliderInput
            value={personality.underdog_lean}
            onChange={(v) => handlePersonalityChange('underdog_lean', v)}
            label="Underdog Lean"
            description="Preference for betting on underdogs vs favorites"
            labels={['Favorites', 'Slight Fav', 'Neutral', 'Slight Dog', 'Underdogs']}
          />

          <SliderInput
            value={personality.over_under_lean}
            onChange={(v) => handlePersonalityChange('over_under_lean', v)}
            label="Over/Under Lean"
            description="Preference for overs vs unders on totals"
            labels={['Strong Under', 'Under', 'Neutral', 'Over', 'Strong Over']}
          />

          <SliderInput
            value={personality.confidence_threshold}
            onChange={(v) => handlePersonalityChange('confidence_threshold', v)}
            label="Confidence Threshold"
            description="Minimum confidence needed to make a pick"
            labels={['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High']}
          />

          <ToggleInput
            value={personality.chase_value}
            onChange={(v) => handlePersonalityChange('chase_value', v)}
            label="Chase Value"
            description="Prioritize finding value over win probability"
          />
        </CollapsibleSection>

        {/* Bet Selection Section */}
        <CollapsibleSection title="Bet Selection" icon="target" iconColor="#f59e0b" isDark={isDark}>
          <View style={styles.inputGroup}>
            <Text
              style={[styles.inputLabel, { color: theme.colors.onSurface }]}
            >
              Preferred Bet Type
            </Text>
            <View style={styles.chipGrid}>
              {BET_TYPES.map((type) => (
                <Chip
                  key={type}
                  mode={personality.preferred_bet_type === type ? 'flat' : 'outlined'}
                  selected={personality.preferred_bet_type === type}
                  onPress={() => handlePersonalityChange('preferred_bet_type', type)}
                  style={[
                    styles.betTypeChip,
                    personality.preferred_bet_type === type && {
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                  textStyle={{
                    color:
                      personality.preferred_bet_type === type
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurfaceVariant,
                  }}
                >
                  {BET_TYPE_LABELS[type]}
                </Chip>
              ))}
            </View>
          </View>

          <OddsInput
            value={personality.max_favorite_odds}
            onChange={(v) => handlePersonalityChange('max_favorite_odds', v)}
            label="Max Favorite Odds"
            type="favorite"
          />

          <OddsInput
            value={personality.min_underdog_odds}
            onChange={(v) => handlePersonalityChange('min_underdog_odds', v)}
            label="Min Underdog Odds"
            type="underdog"
          />

          <SliderInput
            value={personality.max_picks_per_day}
            onChange={(v) => handlePersonalityChange('max_picks_per_day', v)}
            label="Max Picks Per Day"
            description="Maximum number of picks to generate daily"
            labels={['1', '2', '3', '4', '5']}
          />

          <ToggleInput
            value={personality.skip_weak_slates}
            onChange={(v) => handlePersonalityChange('skip_weak_slates', v)}
            label="Skip Weak Slates"
            description="Don't force picks when no good opportunities exist"
          />
        </CollapsibleSection>

        {/* Data Trust Section */}
        <CollapsibleSection title="Data Trust" icon="database-check-outline" iconColor="#06b6d4" isDark={isDark}>
          <SliderInput
            value={personality.trust_model}
            onChange={(v) => handlePersonalityChange('trust_model', v)}
            label="Trust Model Predictions"
            description="How much to weight WagerProof model predictions"
            labels={['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High']}
          />

          <SliderInput
            value={personality.trust_polymarket}
            onChange={(v) => handlePersonalityChange('trust_polymarket', v)}
            label="Trust Polymarket"
            description="How much to weight Polymarket prediction markets"
            labels={['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High']}
          />

          <ToggleInput
            value={personality.polymarket_divergence_flag}
            onChange={(v) => handlePersonalityChange('polymarket_divergence_flag', v)}
            label="Flag Polymarket Divergence"
            description="Highlight when model and Polymarket strongly disagree"
          />

          <SliderInput
            value={personality.home_court_boost}
            onChange={(v) => handlePersonalityChange('home_court_boost', v)}
            label="Home Court/Field Boost"
            description="How much to factor in home advantage"
            labels={['None', 'Slight', 'Normal', 'Strong', 'Very Strong']}
          />

          {/* Conditional: Football params */}
          {conditionalParams.showPublicBetting && (
            <>
              <ToggleInput
                value={personality.fade_public ?? false}
                onChange={(v) => handlePersonalityChange('fade_public', v)}
                label="Fade Public"
                description="Bet against heavy public action"
              />

              {personality.fade_public && (
                <SliderInput
                  value={personality.public_threshold ?? 3}
                  onChange={(v) => handlePersonalityChange('public_threshold', v)}
                  label="Public Threshold"
                  description="Minimum public % to trigger fade"
                  labels={['60%', '65%', '70%', '75%', '80%']}
                />
              )}
            </>
          )}

          {conditionalParams.showWeather && (
            <>
              <ToggleInput
                value={personality.weather_impacts_totals ?? false}
                onChange={(v) => handlePersonalityChange('weather_impacts_totals', v)}
                label="Weather Impacts Totals"
                description="Adjust totals picks based on weather"
              />

              {personality.weather_impacts_totals && (
                <SliderInput
                  value={personality.weather_sensitivity ?? 3}
                  onChange={(v) => handlePersonalityChange('weather_sensitivity', v)}
                  label="Weather Sensitivity"
                  description="How much weather should affect picks"
                  labels={['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High']}
                />
              )}
            </>
          )}

          {/* Conditional: Basketball params */}
          {conditionalParams.showTeamRatings && (
            <SliderInput
              value={personality.trust_team_ratings ?? 3}
              onChange={(v) => handlePersonalityChange('trust_team_ratings', v)}
              label="Trust Team Ratings"
              description="Weight given to team efficiency ratings"
              labels={['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High']}
            />
          )}

          {conditionalParams.showTrends && (
            <>
              <SliderInput
                value={personality.weight_recent_form ?? 3}
                onChange={(v) => handlePersonalityChange('weight_recent_form', v)}
                label="Weight Recent Form"
                description="How much to weight recent performance"
                labels={['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High']}
              />

              <ToggleInput
                value={personality.ride_hot_streaks ?? false}
                onChange={(v) => handlePersonalityChange('ride_hot_streaks', v)}
                label="Ride Hot Streaks"
                description="Bet on teams that are on hot streaks"
              />

              <ToggleInput
                value={personality.fade_cold_streaks ?? false}
                onChange={(v) => handlePersonalityChange('fade_cold_streaks', v)}
                label="Fade Cold Streaks"
                description="Bet against teams on cold streaks"
              />
            </>
          )}

          {conditionalParams.showBackToBacks && (
            <ToggleInput
              value={personality.fade_back_to_backs ?? false}
              onChange={(v) => handlePersonalityChange('fade_back_to_backs', v)}
              label="Fade Back-to-Backs"
              description="Bet against teams on the second game of a back-to-back"
            />
          )}

          {conditionalParams.showUpsetAlert && (
            <ToggleInput
              value={personality.upset_alert ?? false}
              onChange={(v) => handlePersonalityChange('upset_alert', v)}
              label="Upset Alert"
              description="Look for potential upset situations in NCAAB"
            />
          )}
        </CollapsibleSection>

        {/* Custom Insights Section */}
        <CollapsibleSection title="Custom Insights" icon="lightbulb-on-outline" iconColor="#10b981" isDark={isDark}>
          <View style={styles.inputGroup}>
            <Text
              style={[styles.inputLabel, { color: theme.colors.onSurface }]}
            >
              Betting Philosophy
            </Text>
            <Text
              style={[
                styles.inputHelper,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Describe your overall betting approach (max 500 chars)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: theme.colors.onSurface,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
              value={customInsights.betting_philosophy || ''}
              onChangeText={(text) =>
                handleInsightChange('betting_philosophy', text || null)
              }
              placeholder="e.g., I believe in value betting and fading public sentiment..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              maxLength={500}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[styles.inputLabel, { color: theme.colors.onSurface }]}
            >
              Perceived Edges
            </Text>
            <Text
              style={[
                styles.inputHelper,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              What edges do you think you have? (max 500 chars)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: theme.colors.onSurface,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
              value={customInsights.perceived_edges || ''}
              onChangeText={(text) =>
                handleInsightChange('perceived_edges', text || null)
              }
              placeholder="e.g., I'm good at spotting value in player props..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              maxLength={500}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[styles.inputLabel, { color: theme.colors.onSurface }]}
            >
              Situations to Avoid
            </Text>
            <Text
              style={[
                styles.inputHelper,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              What situations should the agent avoid? (max 300 chars)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: theme.colors.onSurface,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
              value={customInsights.avoid_situations || ''}
              onChangeText={(text) =>
                handleInsightChange('avoid_situations', text || null)
              }
              placeholder="e.g., Avoid betting on teams traveling across time zones..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              maxLength={300}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[styles.inputLabel, { color: theme.colors.onSurface }]}
            >
              Target Situations
            </Text>
            <Text
              style={[
                styles.inputHelper,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              What situations should the agent target? (max 300 chars)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: theme.colors.onSurface,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
              value={customInsights.target_situations || ''}
              onChangeText={(text) =>
                handleInsightChange('target_situations', text || null)
              }
              placeholder="e.g., Look for revenge games and divisional matchups..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              maxLength={300}
            />
          </View>
        </CollapsibleSection>

        {/* Auto-Generation Section */}
        <CollapsibleSection title="Auto-Generation" icon="robot-outline" iconColor="#3b82f6" isDark={isDark}>
          <ToggleInput
            value={autoGenerate}
            onChange={(v) => {
              if (!canUseAutopilot) return;
              setAutoGenerate(v);
              markChanged();
              console.log('🔔 Auto-gen toggled:', v, 'user?.id:', user?.id);
              if (v && user?.id) {
                ensureAutoPickNotificationPermission(user.id);
              }
            }}
            label="Auto-Generate Picks"
            description={
              canUseAutopilot
                ? "Automatically generate picks daily when games are available"
                : "Upgrade to Pro to enable daily auto-generation"
            }
            disabled={!canUseAutopilot}
            variant="autopilot"
          />
          <Text
            style={[
              styles.helperText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {canUseAutopilot
              ? 'When enabled, your agent will automatically analyze available games and generate picks each day. You can always manually generate picks as well.'
              : 'Pro subscribers get automatic daily pick generation. Free users can still generate picks manually.'}
          </Text>

          {autoGenerate && canUseAutopilot && (
            <>
              <View style={styles.timePickerRow}>
                <Text style={[styles.inputLabel, { color: theme.colors.onSurface, marginBottom: 0 }]}>
                  Preferred Time
                </Text>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(true)}
                  style={[
                    styles.timePickerButton,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.15)'
                        : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={18}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.timePickerText, { color: theme.colors.onSurface }]}>
                    {autoGenerateTime} {getTimezoneAbbr(autoGenerateTimezone)}
                  </Text>
                </TouchableOpacity>
              </View>
              <TimePickerModal
                visible={showTimePicker}
                onDismiss={() => setShowTimePicker(false)}
                onConfirm={(hours, minutes, timezone) => {
                  const h = String(hours).padStart(2, '0');
                  const m = String(minutes).padStart(2, '0');
                  setAutoGenerateTime(`${h}:${m}`);
                  setAutoGenerateTimezone(timezone);
                  setShowTimePicker(false);
                  markChanged();
                }}
                hours={parseInt(autoGenerateTime.split(':')[0], 10)}
                minutes={parseInt(autoGenerateTime.split(':')[1], 10)}
                timezone={autoGenerateTimezone}
              />
            </>
          )}
        </CollapsibleSection>

        {/* Visibility Section */}
        <CollapsibleSection title="Visibility" isDark={isDark}>
          <ToggleInput
            value={isPublic}
            onChange={(v) => {
              if (v && !canCreatePublicAgent) {
                Alert.alert(
                  'Pro Feature',
                  'Only Pro users can make agents public and appear on the leaderboard.'
                );
                return;
              }
              setIsPublic(v);
              markChanged();
            }}
            label="Public Agent"
            description="Allow your agent to appear on the leaderboard"
          />
          {!canCreatePublicAgent && (
            <Text style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
              Free agents are private by default and cannot be made public.
            </Text>
          )}
          {isPublic && (
            <View
              style={[
                styles.warningBox,
                { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
              ]}
            >
              <MaterialCommunityIcons
                name="alert-outline"
                size={20}
                color="#f59e0b"
              />
              <Text style={[styles.warningText, { color: '#f59e0b' }]}>
                Public agents can be viewed by other users. Your pick history
                and performance will be visible on the leaderboard.
              </Text>
            </View>
          )}
        </CollapsibleSection>

        {/* Danger Zone */}
        <View
          style={[
            styles.dangerSection,
            {
              borderColor: 'rgba(239, 68, 68, 0.3)',
            },
          ]}
        >
          <Text style={[styles.dangerTitle, { color: '#ef4444' }]}>
            Danger Zone
          </Text>
          <Text
            style={[
              styles.dangerDescription,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Deleting your agent is permanent and cannot be undone. All picks and
            performance history will be lost.
          </Text>
          <Button
            mode="outlined"
            onPress={handleDelete}
            textColor="#ef4444"
            style={styles.deleteButton}
            icon="delete"
            loading={deleteAgentMutation.isPending}
          >
            Delete Agent
          </Button>
        </View>

        {/* Spacer for save button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Save Button */}
      {hasChanges && (
        <View
          style={[
            styles.saveButtonContainer,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: isDark ? '#000000' : '#ffffff',
              borderTopColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          <Button
            mode="contained"
            onPress={handleSave}
            loading={updateAgentMutation.isPending}
            disabled={updateAgentMutation.isPending}
            style={styles.saveButton}
            labelStyle={styles.saveButtonLabel}
          >
            Save Changes
          </Button>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: 16,
  },
  // Section styles
  section: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitleWrap: {
    gap: 4,
    flex: 1,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  chevronBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  // Input styles
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputHelper: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Chip grids
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportChip: {
    borderRadius: 20,
  },
  betTypeChip: {
    borderRadius: 20,
  },
  // Helper text
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  // Warning box
  warningBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  // Danger zone
  dangerSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  dangerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  dangerDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  deleteButton: {
    borderColor: '#ef4444',
  },
  // Time picker
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  timePickerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Save button
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    borderRadius: 12,
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 4,
  },
});
