import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Animated, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, Button } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { Sport } from '@/types/agent';
import { LinearGradient } from 'expo-linear-gradient';
import { GlowingCardWrapper } from '@/components/agents/GlowingCardWrapper';

const SPORT_ICONS: Record<Sport, string> = {
  nfl: 'football',
  cfb: 'shield-half-full',
  nba: 'basketball',
  ncaab: 'school',
};

const SPORT_COLORS: Record<Sport, string> = {
  nfl: '#013369',
  cfb: '#C41E3A',
  nba: '#1D428A',
  ncaab: '#FF6B00',
};

function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) {
    return value.replace('gradient:', '').split(',')[0];
  }
  return value;
}

interface AgentBornCreationCelebrationProps {
  visible: boolean;
  agent: {
    name: string;
    avatar_emoji: string;
    avatar_color: string;
    preferred_sports: Sport[];
    is_active: boolean;
  } | null;
  onContinue: () => void;
}

export function AgentBornCreationCelebration({
  visible,
  agent,
  onContinue,
}: AgentBornCreationCelebrationProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [backgroundRunId, setBackgroundRunId] = useState(0);
  const [revealRunId, setRevealRunId] = useState(0);
  const [isRevealComplete, setIsRevealComplete] = useState(false);
  const [pulseReady, setPulseReady] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    setBackgroundRunId((prev) => prev + 1);
    setRevealRunId((prev) => prev + 1);
    setIsRevealComplete(false);
    setPulseReady(false);
    contentOpacity.setValue(0);

    const fadeInTimeout = setTimeout(() => {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }).start();
    }, 1000);

    const revealTimeout = setTimeout(() => {
      setIsRevealComplete(true);
    }, 3000);

    return () => {
      clearTimeout(fadeInTimeout);
      clearTimeout(revealTimeout);
    };
  }, [visible, contentOpacity]);

  useEffect(() => {
    if (!isRevealComplete) return;
    const pulseTimeout = setTimeout(() => setPulseReady(true), 160);
    return () => clearTimeout(pulseTimeout);
  }, [isRevealComplete]);

  const primaryColor = getPrimaryColor(agent?.avatar_color || '#00E676');
  const accentColors = useMemo(
    () => (
      (agent?.preferred_sports?.length ?? 0) >= 2
        ? agent!.preferred_sports.map((sport) => SPORT_COLORS[sport])
        : [primaryColor, `${primaryColor}99`]
    ) as [string, string, ...string[]],
    [agent?.preferred_sports, primaryColor]
  );
  const backgroundWash = [
    `${accentColors[0]}16`,
    `${accentColors[Math.min(1, accentColors.length - 1)]}10`,
    'rgba(255,255,255,0)',
  ] as [string, string, string];

  if (!visible || !agent) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#0b0f12' }]}>
        <LottieView
          key={`agent-born-bg-${backgroundRunId}`}
          source={require('@/assets/WaveLinesAnimation.json')}
          autoPlay
          loop
          style={styles.backgroundLottie}
        />

        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="star-circle-outline" size={20} color="#00E676" />
            <Text style={styles.title}>Agent Created</Text>
          </View>
          <Text style={styles.subtitle}>
            {agent.is_active
              ? 'Your strategy is live and ready for picks.'
              : 'Your agent starts in manual mode until a live auto slot opens up.'}
          </Text>

          <View style={styles.agentCardWrap}>
            <View
              style={[
                styles.agentCard,
                {
                  backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.12)',
                },
              ]}
            >
              <LinearGradient
                colors={backgroundWash}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.backgroundGradient}
              />
              <LinearGradient
                colors={accentColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBorder}
              />
              <GlowingCardWrapper color={primaryColor} borderRadius={20}>
                <View style={[styles.avatar, { backgroundColor: `${primaryColor}25` }]}>
                  <Text style={styles.avatarEmoji}>{agent.avatar_emoji || '🤖'}</Text>
                </View>
              </GlowingCardWrapper>
              <View style={styles.agentInfo}>
                <Text style={[styles.agentName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                  {agent.name || 'Your Agent'}
                </Text>
                <View style={styles.sportsRow}>
                  {agent.preferred_sports.slice(0, 3).map((sport) => (
                    <View
                      key={sport}
                      style={[
                        styles.sportBadge,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={SPORT_ICONS[sport] as any}
                        size={12}
                        color={theme.colors.onSurfaceVariant}
                      />
                      <Text style={[styles.sportText, { color: theme.colors.onSurfaceVariant }]}>
                        {sport.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.autopilotRow}>
                  <Switch
                    value={agent.is_active}
                    disabled
                    trackColor={{
                      false: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
                      true: '#10b981',
                    }}
                    thumbColor={agent.is_active ? '#ffffff' : isDark ? '#9ca3af' : '#6b7280'}
                    style={styles.activeToggle}
                  />
                  <Text style={[styles.autopilotText, !agent.is_active && styles.manualModeText]}>
                    {agent.is_active ? 'autopilot on' : 'manual mode'}
                  </Text>
                  {agent.is_active && pulseReady && (
                    <LottieView
                      source={require('@/assets/pulselottie.json')}
                      autoPlay
                      loop
                      style={styles.autopilotLottie}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={onContinue}
            disabled={!isRevealComplete}
            buttonColor="#00E676"
            textColor="#000000"
            style={styles.continueButton}
          >
            View Agent
          </Button>
        </Animated.View>

        {isRevealComplete && (
          <LottieView
            source={require('@/assets/confetti.json')}
            autoPlay
            loop={false}
            style={styles.confetti}
          />
        )}

        {!isRevealComplete && (
          <View style={styles.revealOverlay} pointerEvents="none">
            <LottieView
              key={`reveal-${revealRunId}`}
              source={require('@/assets/FullscreenGreen.json')}
              autoPlay
              loop={false}
              resizeMode="cover"
              style={styles.revealLottie}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundLottie: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
  },
  revealLottie: {
    ...StyleSheet.absoluteFillObject,
  },
  revealOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  confetti: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
    zIndex: 45,
  },
  content: {
    width: '88%',
    maxWidth: 420,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  agentCardWrap: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
  },
  agentCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  sportsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sportText: {
    fontSize: 11,
    fontWeight: '600',
  },
  autopilotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeToggle: {
    transform: [{ scale: 0.9 }],
  },
  autopilotText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  manualModeText: {
    color: '#fbbf24',
  },
  autopilotLottie: {
    width: 18,
    height: 18,
  },
  continueButton: {
    width: '100%',
    borderRadius: 12,
  },
});
