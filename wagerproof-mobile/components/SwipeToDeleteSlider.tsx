import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

interface SwipeToDeleteSliderProps {
  onSlideComplete: () => void;
  disabled?: boolean;
}

const TRACK_WIDTH = Dimensions.get('window').width - 64; // 32px padding on each side
const THUMB_SIZE = 56;
const TRACK_HEIGHT = 60;
const SLIDE_THRESHOLD = TRACK_WIDTH - THUMB_SIZE - 8; // How far to slide to trigger

export function SwipeToDeleteSlider({ onSlideComplete, disabled = false }: SwipeToDeleteSliderProps) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const isCompleted = useSharedValue(false);

  const triggerHapticFeedback = (type: 'light' | 'heavy') => {
    if (type === 'light') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  const handleSlideComplete = () => {
    onSlideComplete();
  };

  const resetSlider = () => {
    translateX.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
    isCompleted.value = false;
  };

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      runOnJS(triggerHapticFeedback)('light');
    })
    .onUpdate((event) => {
      // Clamp the translation between 0 and the threshold
      const newValue = Math.max(0, Math.min(event.translationX, SLIDE_THRESHOLD));
      translateX.value = newValue;
    })
    .onEnd(() => {
      if (translateX.value >= SLIDE_THRESHOLD * 0.9) {
        // Slide completed
        translateX.value = withSpring(SLIDE_THRESHOLD, {
          damping: 15,
          stiffness: 150,
        });
        isCompleted.value = true;
        runOnJS(triggerHapticFeedback)('heavy');
        runOnJS(handleSlideComplete)();
      } else {
        // Reset to start
        translateX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
      }
    });

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SLIDE_THRESHOLD * 0.5],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
    };
  });

  const progressAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: translateX.value + THUMB_SIZE,
    };
  });

  // Expose reset method via ref if needed
  React.useEffect(() => {
    // Reset when disabled changes (e.g., after canceling confirmation)
    if (!disabled && isCompleted.value) {
      resetSlider();
    }
  }, [disabled]);

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
        {/* Progress fill */}
        <Animated.View
          style={[
            styles.progressFill,
            { backgroundColor: theme.colors.error },
            progressAnimatedStyle,
          ]}
        />

        {/* Instruction text */}
        <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
          <Text style={[styles.text, { color: theme.colors.error }]}>
            Slide to Delete Account
          </Text>
        </Animated.View>

        {/* Draggable thumb */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.thumb,
              { backgroundColor: theme.colors.error },
              thumbAnimatedStyle,
            ]}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={24}
              color="#FFFFFF"
            />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    opacity: 0.3,
  },
  textContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: THUMB_SIZE,
  },
  thumb: {
    position: 'absolute',
    left: 4,
    width: THUMB_SIZE,
    height: THUMB_SIZE - 8,
    borderRadius: (THUMB_SIZE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default SwipeToDeleteSlider;
