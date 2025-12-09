/**
 * FloatingAssistantBubble
 *
 * A detached, draggable floating assistant that provides contextual
 * AI insights as the user navigates through the app.
 *
 * Features:
 * - Draggable anywhere on screen
 * - Auto-scans when game details open
 * - "Tell me more" / "Another insight" action buttons
 * - Typewriter text animation
 * - Swipe off screen to dismiss
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// WagerProof green
const WAGERPROOF_GREEN = '#00E676';

// Bubble dimensions
const BUBBLE_WIDTH = 200;
const BUBBLE_MIN_HEIGHT = 120;
const BUBBLE_MAX_HEIGHT = 200;
const BORDER_RADIUS = 24;

// Typewriter animation speed (ms per character)
const TYPEWRITER_SPEED = 20;

// Spring config for dragging
const DRAG_SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};


// Dismiss threshold (distance from edge)
const DISMISS_THRESHOLD = 80;

// Snap point margin from screen edges
const SNAP_MARGIN = 16;
const SNAP_MARGIN_TOP = 60; // Extra margin for status bar

// 8 magnetic snap points around the perimeter (pre-calculated)
const SNAP_POINTS = [
  // Top row: left, center, right
  { x: SNAP_MARGIN, y: SNAP_MARGIN_TOP },
  { x: (SCREEN_WIDTH - BUBBLE_WIDTH) / 2, y: SNAP_MARGIN_TOP },
  { x: SCREEN_WIDTH - BUBBLE_WIDTH - SNAP_MARGIN, y: SNAP_MARGIN_TOP },
  // Middle row: left, right
  { x: SNAP_MARGIN, y: (SCREEN_HEIGHT - BUBBLE_MIN_HEIGHT) / 2 },
  { x: SCREEN_WIDTH - BUBBLE_WIDTH - SNAP_MARGIN, y: (SCREEN_HEIGHT - BUBBLE_MIN_HEIGHT) / 2 },
  // Bottom row: left, center, right
  { x: SNAP_MARGIN, y: SCREEN_HEIGHT - BUBBLE_MIN_HEIGHT - 100 },
  { x: (SCREEN_WIDTH - BUBBLE_WIDTH) / 2, y: SCREEN_HEIGHT - BUBBLE_MIN_HEIGHT - 100 },
  { x: SCREEN_WIDTH - BUBBLE_WIDTH - SNAP_MARGIN, y: SCREEN_HEIGHT - BUBBLE_MIN_HEIGHT - 100 },
];

interface FloatingAssistantBubbleProps {
  visible: boolean;
  isScanning: boolean;
  suggestion: string;
  position: { x: number; y: number };
  onPositionChange: (x: number, y: number) => void;
  onDismiss: () => void;
  onTellMeMore: () => void;
  onAnotherInsight: () => void;
  hasGameContext: boolean;
}

export function FloatingAssistantBubble({
  visible,
  isScanning,
  suggestion,
  position,
  onPositionChange,
  onDismiss,
  onTellMeMore,
  onAnotherInsight,
  hasGameContext,
}: FloatingAssistantBubbleProps) {
  const typewriterTimer = useRef<NodeJS.Timeout | null>(null);

  // Typewriter animation state
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Animation shared values
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const animatedHeight = useSharedValue(BUBBLE_MIN_HEIGHT);

  // Track drag start position
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Track if initial height has been set
  const hasInitialHeight = useRef(false);

  // Clear typewriter timer
  const clearTypewriterTimer = useCallback(() => {
    if (typewriterTimer.current) {
      clearTimeout(typewriterTimer.current);
      typewriterTimer.current = null;
    }
  }, []);

  // Typewriter animation effect
  useEffect(() => {
    if (visible && suggestion && !isScanning) {
      // Reset and start typewriter animation
      setDisplayedText('');
      setIsTyping(true);
      clearTypewriterTimer();

      let currentIndex = 0;
      const animateNextChar = () => {
        if (currentIndex < suggestion.length) {
          setDisplayedText(suggestion.substring(0, currentIndex + 1));
          currentIndex++;
          typewriterTimer.current = setTimeout(animateNextChar, TYPEWRITER_SPEED);
        } else {
          setIsTyping(false);
        }
      };

      // Start after a small delay
      typewriterTimer.current = setTimeout(animateNextChar, 200);

      return () => {
        clearTypewriterTimer();
      };
    } else if (!visible) {
      setDisplayedText('');
      setIsTyping(false);
      clearTypewriterTimer();
    }
  }, [visible, suggestion, isScanning, clearTypewriterTimer]);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      animateIn();
    } else {
      animateOut();
    }

    return () => {
      clearTypewriterTimer();
    };
  }, [visible]);

  // Update position when props change
  useEffect(() => {
    translateX.value = withSpring(position.x, DRAG_SPRING_CONFIG);
    translateY.value = withSpring(position.y, DRAG_SPRING_CONFIG);
  }, [position.x, position.y]);

  const animateIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(1, { duration: 200 });
    contentOpacity.value = withTiming(1, { duration: 300 });
  };

  const animateOut = useCallback(() => {
    contentOpacity.value = withTiming(0, { duration: 100 });
    scale.value = withTiming(0.8, { duration: 150 });
    opacity.value = withTiming(0, { duration: 150 });
  }, []);

  const handleDismissComplete = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const handleTellMeMore = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTellMeMore();
  }, [onTellMeMore]);

  const handleAnotherInsight = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAnotherInsight();
  }, [onAnotherInsight]);

  // Handle content layout changes for smooth height animation
  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    // Add padding for container (paddingTop: 20, padding: 12 top/bottom = 32 + some margin)
    const targetHeight = Math.min(Math.max(height + 44, BUBBLE_MIN_HEIGHT), BUBBLE_MAX_HEIGHT);

    if (!hasInitialHeight.current) {
      // Set initial height without animation
      animatedHeight.value = targetHeight;
      hasInitialHeight.current = true;
    } else {
      // Smooth linear timing animation - no bounce
      animatedHeight.value = withTiming(targetHeight, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
    }
  }, []);

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd((event) => {
      // Check if bubble should be dismissed (near screen edge)
      const finalX = translateX.value;
      const finalY = translateY.value;

      const nearLeftEdge = finalX < -DISMISS_THRESHOLD;
      const nearRightEdge = finalX > SCREEN_WIDTH - BUBBLE_WIDTH + DISMISS_THRESHOLD;
      const nearTopEdge = finalY < -DISMISS_THRESHOLD;
      const nearBottomEdge = finalY > SCREEN_HEIGHT - BUBBLE_MIN_HEIGHT + DISMISS_THRESHOLD;

      if (nearLeftEdge || nearRightEdge || nearTopEdge || nearBottomEdge) {
        // Animate off screen and dismiss
        let targetX = finalX;
        let targetY = finalY;

        if (nearLeftEdge) targetX = -BUBBLE_WIDTH - 50;
        if (nearRightEdge) targetX = SCREEN_WIDTH + 50;
        if (nearTopEdge) targetY = -BUBBLE_MIN_HEIGHT - 50;
        if (nearBottomEdge) targetY = SCREEN_HEIGHT + 50;

        translateX.value = withTiming(targetX, { duration: 200 });
        translateY.value = withTiming(targetY, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });

        runOnJS(handleDismissComplete)();
      } else {
        // Find nearest snap point (inline to work in worklet)
        let nearestX = SNAP_POINTS[0].x;
        let nearestY = SNAP_POINTS[0].y;
        let minDistance = Infinity;

        for (let i = 0; i < SNAP_POINTS.length; i++) {
          const px = SNAP_POINTS[i].x;
          const py = SNAP_POINTS[i].y;
          const distance = Math.sqrt((finalX - px) * (finalX - px) + (finalY - py) * (finalY - py));
          if (distance < minDistance) {
            minDistance = distance;
            nearestX = px;
            nearestY = py;
          }
        }

        translateX.value = withSpring(nearestX, DRAG_SPRING_CONFIG);
        translateY.value = withSpring(nearestY, DRAG_SPRING_CONFIG);

        // Update position in context
        runOnJS(onPositionChange)(nearestX, nearestY);
      }
    });

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    height: animatedHeight.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  if (!visible && opacity.value === 0) {
    return null;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Robot icon in corner */}
        <View style={styles.robotIconContainer}>
          <MaterialCommunityIcons
            name="robot"
            size={14}
            color={WAGERPROOF_GREEN}
          />
        </View>

        {/* Inner content wrapper for measuring height */}
        <View onLayout={handleContentLayout} style={styles.innerContent}>
          {/* Content area */}
          <Animated.View style={[styles.contentArea, contentStyle]}>
            {isScanning ? (
              <View style={styles.scanningContent}>
                <ActivityIndicator size="small" color={WAGERPROOF_GREEN} />
                <Text style={styles.scanningText}>Analyzing...</Text>
              </View>
            ) : (
              <Text style={styles.suggestionText} numberOfLines={6}>
                {displayedText}
                {isTyping && <Text style={styles.cursor}>|</Text>}
              </Text>
            )}
          </Animated.View>

          {/* Action buttons - only show when we have game context and not scanning */}
          {hasGameContext && !isScanning && !isTyping && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleTellMeMore}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButtonText}>Tell me more</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleAnotherInsight}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButtonText}>Another insight</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: BUBBLE_WIDTH,
    backgroundColor: '#000000',
    borderRadius: BORDER_RADIUS,
    padding: 12,
    paddingTop: 20,
    overflow: 'hidden',
    // Elevated shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 99999,
  },
  innerContent: {
    // This wrapper measures the actual content height
  },
  robotIconContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentArea: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  scanningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanningText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  suggestionText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  cursor: {
    color: WAGERPROOF_GREEN,
    fontWeight: '300',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: WAGERPROOF_GREEN,
    fontSize: 11,
    fontWeight: '600',
  },
});
