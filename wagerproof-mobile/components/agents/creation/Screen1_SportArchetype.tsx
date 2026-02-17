import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useThemeContext } from '@/contexts/ThemeContext';
import { usePresetArchetypes } from '@/hooks/usePresetArchetypes';
import { ArchetypeCard } from '@/components/agents/inputs/ArchetypeCard';
import {
  Sport,
  SPORTS,
  ArchetypeId,
  PersonalityParams,
  CustomInsights,
  PresetArchetype,
} from '@/types/agent';

// ============================================================================
// TYPES
// ============================================================================

type CreationPath = 'scratch' | 'preset' | null;

interface Screen1_SportArchetypeProps {
  selectedSports: Sport[];
  selectedArchetype: ArchetypeId | null;
  onSportsChange: (sports: Sport[]) => void;
  onArchetypeChange: (
    archetypeId: ArchetypeId | null,
    personalityParams?: Partial<PersonalityParams>,
    customInsights?: CustomInsights
  ) => void;
  isOnboarding?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SPORT_CONFIG: Record<
  Sport,
  { label: string; icon: string; color: string; desc: string }
> = {
  nfl: { label: 'NFL', icon: 'football', color: '#013369', desc: 'Pro Football' },
  cfb: { label: 'CFB', icon: 'football', color: '#C41E3A', desc: 'College Football' },
  nba: { label: 'NBA', icon: 'basketball', color: '#1D428A', desc: 'Pro Basketball' },
  ncaab: { label: 'NCAAB', icon: 'basketball', color: '#FF6B00', desc: 'College Basketball' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function Screen1_SportArchetype({
  selectedSports,
  selectedArchetype,
  onSportsChange,
  onArchetypeChange,
  isOnboarding = false,
}: Screen1_SportArchetypeProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { data: archetypes, isLoading: archetypesLoading } = usePresetArchetypes();

  // Derive path from current state
  const [path, setPath] = useState<CreationPath>(
    selectedArchetype ? 'preset' : selectedSports.length > 0 ? 'scratch' : null
  );

  const cardBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const activeBorder = '#00E676';
  const activeBg = isDark ? 'rgba(0, 230, 118, 0.08)' : 'rgba(0, 230, 118, 0.05)';

  // Select path
  const handleSelectPath = useCallback(
    (selected: CreationPath) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPath(selected);
      if (selected === 'scratch') {
        // Clear archetype when switching to scratch
        onArchetypeChange(null);
      } else if (selected === 'preset') {
        // Clear sports when switching to preset (archetype will set them)
        onSportsChange([]);
        onArchetypeChange(null);
      }
    },
    [onArchetypeChange, onSportsChange]
  );

  // Toggle sport selection (scratch path)
  const toggleSport = useCallback(
    (sport: Sport) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const isSelected = selectedSports.includes(sport);
      if (isSelected) {
        onSportsChange(selectedSports.filter((s) => s !== sport));
      } else {
        onSportsChange([...selectedSports, sport]);
      }
    },
    [selectedSports, onSportsChange]
  );

  // Handle archetype selection (preset path)
  const handleArchetypeSelect = useCallback(
    (archetype: PresetArchetype) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Auto-fill recommended sports from archetype
      onSportsChange(archetype.recommended_sports);
      onArchetypeChange(
        archetype.id,
        archetype.personality_params,
        archetype.custom_insights
      );
    },
    [onArchetypeChange, onSportsChange]
  );

  // ========== PATH SELECTION ==========
  if (path === null) {
    return (
      <View style={styles.container}>
        <Text style={[styles.heading, { color: theme.colors.onSurface }]}>
          How do you want to start?
        </Text>
        <Text style={[styles.headingDesc, { color: theme.colors.onSurfaceVariant }]}>
          Build a custom strategy or pick a proven preset.
        </Text>

        {/* From Scratch */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleSelectPath('scratch')}
          style={[
            styles.pathCard,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
        >
          <View style={[styles.pathIconCircle, { backgroundColor: isDark ? 'rgba(0, 230, 118, 0.1)' : 'rgba(0, 230, 118, 0.08)' }]}>
            <MaterialCommunityIcons name="tune-variant" size={28} color="#00E676" />
          </View>
          <View style={styles.pathTextContainer}>
            <Text style={[styles.pathTitle, { color: theme.colors.onSurface }]}>
              Build from Scratch
            </Text>
            <Text style={[styles.pathDesc, { color: theme.colors.onSurfaceVariant }]}>
              Choose your sports, then fine-tune every parameter yourself.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Preset */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleSelectPath('preset')}
          style={[
            styles.pathCard,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
        >
          <View style={[styles.pathIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)' }]}>
            <MaterialCommunityIcons name="lightning-bolt" size={28} color="#818cf8" />
          </View>
          <View style={styles.pathTextContainer}>
            <Text style={[styles.pathTitle, { color: theme.colors.onSurface }]}>
              Use a Preset
            </Text>
            <Text style={[styles.pathDesc, { color: theme.colors.onSurfaceVariant }]}>
              Start with a proven betting style. Sports and settings are pre-configured.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    );
  }

  // ========== SCRATCH PATH: Sport Selection ==========
  if (path === 'scratch') {
    return (
      <View style={styles.container}>
        {!isOnboarding && (
          <TouchableOpacity
            onPress={() => handleSelectPath(null)}
            style={styles.backLink}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.backLinkText, { color: theme.colors.onSurfaceVariant }]}>
              Change path
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.heading, { color: theme.colors.onSurface }]}>
          Select Sports
        </Text>
        <Text style={[styles.headingDesc, { color: theme.colors.onSurfaceVariant }]}>
          Which sports should your agent analyze? Pick one or more.
        </Text>

        <View style={styles.sportsList}>
          {SPORTS.map((sport) => {
            const config = SPORT_CONFIG[sport];
            const isSelected = selectedSports.includes(sport);

            return (
              <TouchableOpacity
                key={sport}
                activeOpacity={0.7}
                onPress={() => toggleSport(sport)}
                style={[
                  styles.sportCard,
                  {
                    backgroundColor: isSelected ? activeBg : cardBg,
                    borderColor: isSelected ? activeBorder : cardBorder,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
              >
                <View style={[styles.sportIconCircle, { backgroundColor: `${config.color}20` }]}>
                  <MaterialCommunityIcons name={config.icon as any} size={24} color={config.color} />
                </View>
                <View style={styles.sportTextContainer}>
                  <Text style={[styles.sportLabel, { color: theme.colors.onSurface }]}>
                    {config.label}
                  </Text>
                  <Text style={[styles.sportDesc, { color: theme.colors.onSurfaceVariant }]}>
                    {config.desc}
                  </Text>
                </View>
                <View
                  style={[
                    styles.sportCheckbox,
                    {
                      backgroundColor: isSelected ? '#00E676' : 'transparent',
                      borderColor: isSelected ? '#00E676' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                    },
                  ]}
                >
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={14} color="#000000" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedSports.length === 0 && (
          <Text style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
            Select at least one sport to continue
          </Text>
        )}
      </View>
    );
  }

  // ========== PRESET PATH: Archetype Selection ==========
  return (
    <View style={styles.container}>
      {!isOnboarding && (
        <TouchableOpacity
          onPress={() => handleSelectPath(null)}
          style={styles.backLink}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={18} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.backLinkText, { color: theme.colors.onSurfaceVariant }]}>
            Change path
          </Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.heading, { color: theme.colors.onSurface }]}>
        Choose a Preset
      </Text>
      <Text style={[styles.headingDesc, { color: theme.colors.onSurfaceVariant }]}>
        Each preset comes with a tuned strategy and recommended sports. You can customize it later.
      </Text>

      {archetypesLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            Loading presets...
          </Text>
        </View>
      ) : (
        <View style={styles.archetypeGrid}>
          {archetypes?.map((archetype) => (
            <ArchetypeCard
              key={archetype.id}
              archetype={archetype}
              selected={selectedArchetype === archetype.id}
              onSelect={() => handleArchetypeSelect(archetype)}
            />
          ))}
        </View>
      )}
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
  heading: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  headingDesc: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  // Path selection
  pathCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 14,
  },
  pathIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathTextContainer: {
    flex: 1,
  },
  pathTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  pathDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Back link
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Sport selection (scratch)
  sportsList: {
    gap: 10,
  },
  sportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  sportIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sportTextContainer: {
    flex: 1,
  },
  sportLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  sportDesc: {
    fontSize: 13,
    marginTop: 1,
  },
  sportCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
  // Presets
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  archetypeGrid: {
    gap: 0,
  },
});
