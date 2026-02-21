import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RoastSessionState } from '@/types/roast';

interface RoastMicButtonProps {
  state: RoastSessionState;
  onPress: () => void;
}

export function RoastMicButton({ state, onPress }: RoastMicButtonProps) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing' || state === 'responding';

  useEffect(() => {
    if (isRecording) {
      // Pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        true,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 800 }),
          withTiming(0.1, { duration: 800 }),
        ),
        -1,
        true,
      );
      // Expanding ring
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(2, { duration: 1200, easing: Easing.out(Easing.ease) }),
        ),
        -1,
      );
      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 0 }),
          withTiming(0, { duration: 1200 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0, { duration: 200 });
      ringScale.value = 1;
      ringOpacity.value = 0;
    }
  }, [isRecording, pulseScale, pulseOpacity, ringScale, ringOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const buttonColor = isRecording ? '#22c55e' : isProcessing ? '#6b7280' : '#374151';
  const iconName = isRecording ? 'microphone' : isProcessing ? 'dots-horizontal' : 'microphone';
  const iconColor = isRecording ? '#000' : '#fff';

  return (
    <View style={styles.container}>
      {/* Expanding ring */}
      <Animated.View style={[styles.ring, ringStyle, { borderColor: '#22c55e' }]} />
      {/* Pulse glow */}
      <Animated.View style={[styles.pulse, pulseStyle, { backgroundColor: '#22c55e' }]} />
      {/* Main button */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: buttonColor }]}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={state === 'processing'}
      >
        <MaterialCommunityIcons name={iconName} size={36} color={iconColor} />
      </TouchableOpacity>
    </View>
  );
}

const BUTTON_SIZE = 80;

const styles = StyleSheet.create({
  container: {
    width: BUTTON_SIZE * 2.5,
    height: BUTTON_SIZE * 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulse: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
  },
  ring: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
