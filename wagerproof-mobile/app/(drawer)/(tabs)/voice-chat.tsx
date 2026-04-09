import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';

import { useWagerBotVoice } from '@/hooks/useWagerBotVoice';
import { useAuth } from '@/contexts/AuthContext';
import { useProAccess } from '@/hooks/useProAccess';
import { VoiceSettingsSheet } from '@/components/VoiceSettingsSheet';
import { fetchAndFormatGameContext } from '@/services/gameDataService';
import {
  didPaywallGrantEntitlement,
  ENTITLEMENT_IDENTIFIER,
  PAYWALL_PLACEMENTS,
  presentPaywallForPlacementIfNeeded,
} from '@/services/revenuecat';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import type { WagerBotVoice } from '@/services/wagerBotVoiceService';

// Per-voice Lottie character animations — same 3 Monster files from Honeydew
const VOICE_LOTTIE_MAP: Record<string, any> = {
  marin: require('@/assets/VoiceMonster_Marin.json'),
  cedar: require('@/assets/VoiceMonster_Cedar.json'),
  ash: require('@/assets/VoiceMonster_Ash.json'),
};

// Fallback for voices without a dedicated character
const DEFAULT_LOTTIE = require('@/assets/ChattingRobot.json');

function getLottieSource(voice: WagerBotVoice) {
  return VOICE_LOTTIE_MAP[voice] || DEFAULT_LOTTIE;
}

function formatDuration(connectedAt: Date | null): string {
  if (!connectedAt) return '00:00';
  const elapsed = Math.floor((Date.now() - connectedAt.getTime()) / 1000);
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function VoiceChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isPro, isLoading: isProLoading } = useProAccess();
  const { refreshCustomerInfo } = useRevenueCat();

  const [gameContext, setGameContext] = useState<string>('');
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [durationText, setDurationText] = useState('00:00');

  const {
    isConnecting,
    isConnected,
    isListening,
    isWaitingForResponse,
    isSpeaking,
    selectedVoice,
    selectedPersonality,
    lastError,
    connectedAt,
    promptSource,
    promptText,
    connect,
    startTalking,
    stopTalking,
    hangUp,
    changeVoice,
    changePersonality,
  } = useWagerBotVoice(gameContext);

  // Animation controllers
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const orbGlowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const orbAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Load game context
  useEffect(() => {
    (async () => {
      try {
        setIsLoadingContext(true);
        const context = await fetchAndFormatGameContext();
        setGameContext(context);
      } catch (error) {
        console.error('Failed to load game context:', error);
      } finally {
        setIsLoadingContext(false);
      }
    })();
  }, []);

  // Duration timer
  useEffect(() => {
    if (!connectedAt) {
      setDurationText('00:00');
      return;
    }
    const interval = setInterval(() => {
      setDurationText(formatDuration(connectedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [connectedAt]);

  // Pulse animation (mic active or AI speaking)
  const isActive = isListening || isSpeaking || isWaitingForResponse;

  useEffect(() => {
    if (isActive) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimRef.current = anim;
      anim.start();
    } else {
      pulseAnimRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => {
      pulseAnimRef.current?.stop();
    };
  }, [isActive]);

  // Orb glow animation
  useEffect(() => {
    if (isActive) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(orbGlowAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: false,
          }),
          Animated.timing(orbGlowAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: false,
          }),
        ])
      );
      orbAnimRef.current = anim;
      anim.start();
    } else {
      orbAnimRef.current?.stop();
      orbGlowAnim.setValue(0);
    }
    return () => {
      orbAnimRef.current?.stop();
    };
  }, [isActive]);

  // Status text and dot color
  const statusText = (() => {
    if (lastError) return 'Reconnect needed';
    if (isListening) return 'Listening...';
    if (isSpeaking) return 'Speaking...';
    if (isWaitingForResponse) return 'Thinking...';
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Ready';
    return 'Disconnected';
  })();

  const statusDotColor = (() => {
    if (lastError) return '#ef4444';
    if (isListening) return '#f59e0b';
    if (isSpeaking || isWaitingForResponse) return '#22c55e';
    if (isConnected) return '#22c55e';
    return 'rgba(255,255,255,0.4)';
  })();

  // Spicy mode uses red accent instead of green
  const isSpicy = selectedPersonality === 'spicy';
  const accentColor = isSpicy ? '#ef4444' : '#22c55e';

  const orbBorderColor = orbGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.15)', accentColor],
  });

  const orbShadowOpacity = orbGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  const orbBorderWidth = orbGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 4],
  });

  const handleHoldStart = useCallback(() => {
    startTalking();
  }, [startTalking]);

  const handleHoldEnd = useCallback(() => {
    stopTalking();
  }, [stopTalking]);

  const handleUnlockPress = async () => {
    try {
      const result = await presentPaywallForPlacementIfNeeded(
        ENTITLEMENT_IDENTIFIER,
        PAYWALL_PLACEMENTS.GENERIC_FEATURE
      );
      if (didPaywallGrantEntitlement(result)) {
        await refreshCustomerInfo();
      }
    } catch (error) {
      console.error('Error presenting paywall:', error);
    }
  };

  if (!user) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  // Pro gate
  if (!isProLoading && !isPro) {
    return (
      <LinearGradient colors={['#0a0a0a', '#111827', '#0a0a0a']} style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerSideButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerDuration}>WagerBot Voice</Text>
          <View style={styles.headerSideButton} />
        </View>
        <View style={styles.lockedContainer}>
          <MaterialCommunityIcons name="lock" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.lockedTitle}>WagerBot Voice</Text>
          <Text style={styles.lockedSubtitle}>
            Talk to WagerBot like a phone call. Get real-time betting analysis with your voice.
          </Text>
          <TouchableOpacity style={styles.unlockButton} onPress={handleUnlockPress}>
            <Text style={styles.unlockButtonText}>Unlock with Pro</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const holdDisabled = !isConnected || isConnecting;

  // Voice name mapping for display
  const voiceDisplayNames: Record<string, string> = {
    marin: 'Donna',
    cedar: 'Kevin',
    ash: 'Jordan',
  };

  return (
    <LinearGradient
      colors={['#0a0a0a', '#0d1117', '#0a0a0a']}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerSideButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerDuration}>{durationText}</Text>
        <TouchableOpacity
          onPress={() => setShowVoiceSettings(true)}
          style={styles.headerSideButton}
        >
          <MaterialCommunityIcons name="cog-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Status pills */}
      <View style={styles.statusPillContainer}>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: `${statusDotColor}18`, borderColor: `${statusDotColor}40` },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        {isSpicy && (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: 'rgba(239,68,68,0.12)',
                borderColor: 'rgba(239,68,68,0.3)',
              },
            ]}
          >
            <MaterialCommunityIcons name="fire" size={12} color="#ef4444" />
            <Text style={[styles.statusText, { color: '#ef4444' }]}>Spicy</Text>
          </View>
        )}
        {promptSource && (
          <TouchableOpacity
            onPress={() => Alert.alert(
              promptSource === 'supabase' ? 'Supabase Prompt' : 'Fallback Prompt',
              promptText || 'No prompt loaded',
            )}
            style={[
              styles.statusPill,
              {
                backgroundColor: promptSource === 'supabase' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                borderColor: promptSource === 'supabase' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
              },
            ]}
          >
            <MaterialCommunityIcons
              name={promptSource === 'supabase' ? 'database-check' : 'database-off'}
              size={12}
              color={promptSource === 'supabase' ? '#22c55e' : '#ef4444'}
            />
            <Text style={[styles.statusText, { color: promptSource === 'supabase' ? '#22c55e' : '#ef4444' }]}>
              {promptSource === 'supabase' ? 'DB Prompt' : 'Fallback'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title}>WagerBot</Text>
      <Text style={styles.voiceLabel}>
        {voiceDisplayNames[selectedVoice] || selectedVoice}
      </Text>
      {isLoadingContext && (
        <Text style={styles.contextLoading}>Loading game data...</Text>
      )}

      {/* Center orb — Lottie character changes per voice */}
      <View style={styles.orbContainer}>
        <Animated.View
          style={[
            styles.orbScaleWrapper,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Animated.View
            style={[
              styles.orb,
              {
                borderColor: orbBorderColor,
                borderWidth: orbBorderWidth,
                shadowColor: accentColor,
                shadowOpacity: orbShadowOpacity,
                shadowRadius: 30,
              },
            ]}
          >
            <View style={styles.lottieClip}>
              <LottieView
                source={getLottieSource(selectedVoice)}
                autoPlay
                loop
                style={styles.lottie}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Error card */}
      {lastError && (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{lastError}</Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
        {/* Hold to talk */}
        <TouchableOpacity
          style={[
            styles.holdButton,
            { backgroundColor: accentColor },
            holdDisabled && styles.holdButtonDisabled,
            isListening && { backgroundColor: `${accentColor}d9` },
          ]}
          onPressIn={holdDisabled ? undefined : handleHoldStart}
          onPressOut={holdDisabled ? undefined : handleHoldEnd}
          activeOpacity={0.8}
          disabled={holdDisabled}
        >
          <MaterialCommunityIcons
            name={isListening ? 'microphone' : 'gesture-tap-hold'}
            size={24}
            color="#ffffff"
          />
          <Text style={styles.holdButtonText}>
            {holdDisabled
              ? 'Connecting...'
              : isListening
              ? 'Release To Send'
              : 'Press And Hold To Talk'}
          </Text>
        </TouchableOpacity>

        {/* Reconnect / Hang Up row */}
        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={connect} activeOpacity={0.7}>
            <MaterialCommunityIcons name="refresh" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={styles.secondaryButtonText}>Reconnect</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.hangUpButton} onPress={hangUp} activeOpacity={0.7}>
            <MaterialCommunityIcons name="phone-hangup" size={20} color="#ef4444" />
            <Text style={styles.hangUpButtonText}>Hang Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Voice & Personality Settings */}
      <VoiceSettingsSheet
        visible={showVoiceSettings}
        selectedVoice={selectedVoice}
        selectedPersonality={selectedPersonality}
        onVoiceChanged={changeVoice}
        onPersonalityChanged={changePersonality}
        onClose={() => setShowVoiceSettings(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDuration: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  statusPillContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: -0.5,
  },
  voiceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 4,
  },
  contextLoading: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 6,
  },
  orbContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbScaleWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  orb: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    overflow: 'hidden',
  },
  // Clip the Lottie to a circle matching Honeydew's oval clip (orbSize * 0.82)
  lottieClip: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 180,
    height: 180,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 22,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(239,68,68,0.9)',
  },
  controls: {
    paddingHorizontal: 22,
  },
  holdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#22c55e',
    gap: 12,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  holdButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    shadowOpacity: 0,
  },
  holdButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  hangUpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    gap: 8,
  },
  hangUpButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  // Locked state
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
  },
  lockedSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  unlockButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#22c55e',
  },
  unlockButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
