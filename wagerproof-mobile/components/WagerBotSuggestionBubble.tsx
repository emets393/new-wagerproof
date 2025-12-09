/**
 * WagerBot Suggestion Bubble
 *
 * A Dynamic Island-style animated component that supports three modes:
 * 1. Menu: Shows "Scan this page" and "Open chat" buttons
 * 2. Scanning: Shows loading animation while fetching AI suggestion
 * 3. Suggestion: Shows the AI-generated betting suggestion
 *
 * Features fluid fill animation from top center and circular countdown timer.
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Svg, { Circle, Defs, ClipPath, Ellipse, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// WagerProof green
const WAGERPROOF_GREEN = '#00E676';

// Auto-dismiss duration (only for suggestion mode)
const AUTO_DISMISS_DURATION = 20000; // 20 seconds

// Typewriter animation speed (ms per character)
const TYPEWRITER_SPEED = 25;

// Heavily dampened spring config
const DAMPENED_SPRING_CONFIG = {
  damping: 28,
  stiffness: 120,
  mass: 1,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

// Circle dimensions for countdown
const CIRCLE_SIZE = 36;
const STROKE_WIDTH = 2;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

type BubbleMode = 'suggestion' | 'menu' | 'scanning';

// Detach threshold - how far down user needs to pull to detach
const DETACH_THRESHOLD = 80;

// Stretch animation constants
const STRETCH_START = 20; // Start stretching after this many pixels
const MAX_STRETCH_SCALE = 1.3; // Maximum vertical stretch before pop

interface WagerBotSuggestionBubbleProps {
  visible: boolean;
  mode: BubbleMode;
  suggestion: string;
  gameId: string | null;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  onDismiss: () => void;
  onTap: (gameId: string, sport: string) => void;
  onScanPage: () => void;
  onOpenChat: () => void;
  onDetach?: () => void; // New: callback when user pulls down to detach
}

export function WagerBotSuggestionBubble({
  visible,
  mode,
  suggestion,
  gameId,
  sport,
  onDismiss,
  onTap,
  onScanPage,
  onOpenChat,
  onDetach,
}: WagerBotSuggestionBubbleProps) {
  const insets = useSafeAreaInsets();
  const autoDismissTimer = useRef<NodeJS.Timeout | null>(null);
  const typewriterTimer = useRef<NodeJS.Timeout | null>(null);

  // Typewriter animation state
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Calculate the total height of the bubble (expanded to show full message)
  const BUBBLE_CONTENT_HEIGHT = mode === 'menu' ? 70 : 80;
  const TOTAL_BUBBLE_HEIGHT = insets.top + BUBBLE_CONTENT_HEIGHT;

  // Animation shared values
  const fillProgress = useSharedValue(0);
  const opacity = useSharedValue(0);
  const iconColorProgress = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const panTranslateY = useSharedValue(0);
  const countdownProgress = useSharedValue(0);

  // Scanning wave animation (fluid expansion from top center like sound wave)
  const scanningWaveProgress = useSharedValue(0);

  // Stretch animation for detach
  const stretchScaleY = useSharedValue(1);
  const stretchScaleX = useSharedValue(1);
  const hasTriggeredDetachHaptic = useRef(false);

  // Clear auto-dismiss timer
  const clearAutoDismissTimer = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
  }, []);

  // Clear typewriter timer
  const clearTypewriterTimer = useCallback(() => {
    if (typewriterTimer.current) {
      clearTimeout(typewriterTimer.current);
      typewriterTimer.current = null;
    }
  }, []);

  // Typewriter animation effect
  useEffect(() => {
    if (mode === 'suggestion' && visible && suggestion) {
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

      // Start after a small delay to let the bubble animate in
      typewriterTimer.current = setTimeout(animateNextChar, 400);

      return () => {
        clearTypewriterTimer();
      };
    } else if (!visible) {
      setDisplayedText('');
      setIsTyping(false);
      clearTypewriterTimer();
    }
  }, [mode, visible, suggestion, clearTypewriterTimer]);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      animateIn();
    } else {
      animateOut();
      clearAutoDismissTimer();
      clearTypewriterTimer();
    }

    return () => {
      clearAutoDismissTimer();
      clearTypewriterTimer();
    };
  }, [visible]);

  // Reset countdown when mode changes to suggestion
  useEffect(() => {
    if (visible && mode === 'suggestion') {
      // Start countdown for suggestion mode
      countdownProgress.value = 0;
      countdownProgress.value = withDelay(
        400,
        withTiming(1, {
          duration: AUTO_DISMISS_DURATION - 400,
          easing: Easing.linear,
        })
      );
    } else {
      // No countdown for menu or scanning mode
      countdownProgress.value = 0;
    }
  }, [mode, visible]);

  // Scanning wave animation effect - fluid expansion from top center
  useEffect(() => {
    if (mode === 'scanning' && visible) {
      // Reset and animate wave expansion
      scanningWaveProgress.value = 0;
      scanningWaveProgress.value = withDelay(
        300, // Wait for bubble to fill in
        withSpring(1, {
          damping: 15,
          stiffness: 25,
          mass: 1,
        })
      );
    } else {
      // Reset animation when not scanning
      scanningWaveProgress.value = 0;
    }
  }, [mode, visible]);

  const animateIn = () => {
    // Strong haptic feedback on appearance
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    panTranslateY.value = 0;
    fillProgress.value = 0;

    opacity.value = withTiming(1, { duration: 50 });

    fillProgress.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });

    iconColorProgress.value = withDelay(
      200,
      withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
    );

    contentOpacity.value = withDelay(300, withTiming(1, { duration: 200 }));
  };

  const animateOut = useCallback(() => {
    contentOpacity.value = withTiming(0, { duration: 80 });
    iconColorProgress.value = withTiming(0, { duration: 100 });

    fillProgress.value = withTiming(0, {
      duration: 250,
      easing: Easing.in(Easing.cubic),
    });

    opacity.value = withDelay(200, withTiming(0, { duration: 80 }));
  }, []);

  const handleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearAutoDismissTimer();
    if (gameId) {
      onTap(gameId, sport);
    }
    onDismiss();
  }, [gameId, sport, onTap, onDismiss, clearAutoDismissTimer]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearAutoDismissTimer();
    onDismiss();
  }, [onDismiss, clearAutoDismissTimer]);

  const handleScanPage = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onScanPage();
  }, [onScanPage]);

  const handleOpenChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenChat();
  }, [onOpenChat]);

  // Haptic feedback for stretch progress
  const triggerStretchHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Haptic feedback when reaching detach threshold
  const triggerDetachReadyHaptic = useCallback(() => {
    if (!hasTriggeredDetachHaptic.current) {
      hasTriggeredDetachHaptic.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  // Reset detach haptic flag
  const resetDetachHaptic = useCallback(() => {
    hasTriggeredDetachHaptic.current = false;
  }, []);

  // Handle detach action with pop animation
  const handleDetach = useCallback(() => {
    if (onDetach) {
      // Heavy haptic for the "pop"
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      clearAutoDismissTimer();

      // Animate the pop - quick squeeze then release
      stretchScaleY.value = withSequence(
        withTiming(0.6, { duration: 80, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 150, easing: Easing.out(Easing.back(2)) })
      );
      stretchScaleX.value = withSequence(
        withTiming(1.3, { duration: 80, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 150, easing: Easing.out(Easing.back(2)) })
      );

      // Call detach after a brief delay for the pop animation
      setTimeout(() => {
        onDetach();
      }, 100);
    }
  }, [onDetach, clearAutoDismissTimer]);

  // Pan gesture for swipe-to-dismiss (up) or detach (down) with stretch effect
  const panGesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(resetDetachHaptic)();
    })
    .onUpdate((event) => {
      const translationY = event.translationY;

      // Upward movement - normal dismiss behavior
      if (translationY < 0) {
        panTranslateY.value = translationY;
        stretchScaleY.value = 1;
        stretchScaleX.value = 1;
      }
      // Downward movement - stretch effect for detach
      else if (translationY > 0 && onDetach) {
        // Limit the actual translation but increase the stretch
        const dampedTranslation = Math.min(translationY * 0.3, 30);
        panTranslateY.value = dampedTranslation;

        // Calculate stretch based on pull distance
        if (translationY > STRETCH_START) {
          const stretchProgress = Math.min((translationY - STRETCH_START) / (DETACH_THRESHOLD - STRETCH_START), 1);

          // Stretch vertically, squeeze horizontally (like pulling taffy)
          const scaleY = 1 + (stretchProgress * (MAX_STRETCH_SCALE - 1));
          const scaleX = 1 - (stretchProgress * 0.1); // Slight horizontal squeeze

          stretchScaleY.value = scaleY;
          stretchScaleX.value = scaleX;

          // Light haptic feedback as user stretches
          if (stretchProgress > 0.3 && stretchProgress < 0.35) {
            runOnJS(triggerStretchHaptic)();
          }
          if (stretchProgress > 0.6 && stretchProgress < 0.65) {
            runOnJS(triggerStretchHaptic)();
          }
        }

        // Trigger "ready to detach" haptic when threshold reached
        if (translationY > DETACH_THRESHOLD) {
          runOnJS(triggerDetachReadyHaptic)();
        }
      }
    })
    .onEnd((event) => {
      // Swipe up to dismiss
      if (event.velocityY < -500 || event.translationY < -40) {
        runOnJS(handleDismiss)();
      }
      // Pull down to detach - threshold reached
      else if (event.translationY > DETACH_THRESHOLD && onDetach) {
        runOnJS(handleDetach)();
      }
      // Snap back with spring animation
      else {
        panTranslateY.value = withSpring(0, DAMPENED_SPRING_CONFIG);
        stretchScaleY.value = withSpring(1, {
          damping: 12,
          stiffness: 180,
          mass: 0.5,
        });
        stretchScaleX.value = withSpring(1, {
          damping: 12,
          stiffness: 180,
          mass: 0.5,
        });
        runOnJS(resetDetachHaptic)();
      }
    });

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: panTranslateY.value },
      { scaleY: stretchScaleY.value },
      { scaleX: stretchScaleX.value },
    ],
    opacity: opacity.value,
  }));

  const clipEllipseProps = useAnimatedProps(() => {
    const rx = interpolate(fillProgress.value, [0, 1], [0, SCREEN_WIDTH]);
    const ry = interpolate(fillProgress.value, [0, 1], [0, TOTAL_BUBBLE_HEIGHT + 40]);
    return { rx, ry };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconColorProgress.value,
  }));

  const countdownCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * countdownProgress.value,
  }));

  // Scanning wave ellipse animated props (main wave)
  const scanningWaveProps = useAnimatedProps(() => {
    const maxRadius = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.5;
    const rx = interpolate(scanningWaveProgress.value, [0, 1], [0, maxRadius]);
    const ry = interpolate(scanningWaveProgress.value, [0, 1], [0, maxRadius]);
    return { rx, ry };
  });

  // Trailing shadow waves (following behind the main wave)
  const scanningWaveTrail1Props = useAnimatedProps(() => {
    const maxRadius = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.5;
    const progress = Math.max(0, scanningWaveProgress.value - 0.08);
    const rx = interpolate(progress, [0, 1], [0, maxRadius]);
    const ry = interpolate(progress, [0, 1], [0, maxRadius]);
    return { rx, ry };
  });

  const scanningWaveTrail2Props = useAnimatedProps(() => {
    const maxRadius = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.5;
    const progress = Math.max(0, scanningWaveProgress.value - 0.16);
    const rx = interpolate(progress, [0, 1], [0, maxRadius]);
    const ry = interpolate(progress, [0, 1], [0, maxRadius]);
    return { rx, ry };
  });

  const scanningWaveTrail3Props = useAnimatedProps(() => {
    const maxRadius = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.5;
    const progress = Math.max(0, scanningWaveProgress.value - 0.24);
    const rx = interpolate(progress, [0, 1], [0, maxRadius]);
    const ry = interpolate(progress, [0, 1], [0, maxRadius]);
    return { rx, ry };
  });

  if (!visible && opacity.value === 0) {
    return null;
  }

  // Render content based on mode
  const renderContent = () => {
    if (mode === 'menu') {
      return (
        <Animated.View style={[styles.menuContent, contentStyle]}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleScanPage}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="magnify-scan" size={18} color="#000000" />
            <Text style={styles.menuButtonText}>Scan this page</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleOpenChat}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="chat" size={18} color="#000000" />
            <Text style={styles.menuButtonText}>Open chat</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    if (mode === 'scanning') {
      return (
        <Animated.View style={[styles.scanningContent, contentStyle]}>
          <ActivityIndicator size="small" color={WAGERPROOF_GREEN} />
          <Text style={styles.scanningText}>Analyzing games...</Text>
        </Animated.View>
      );
    }

    // Suggestion mode - compact two-row layout with typewriter effect
    return (
      <View style={styles.suggestionContent}>
        <Animated.View style={[styles.textContainer, contentStyle]}>
          <Text style={styles.suggestionText} numberOfLines={3}>
            {displayedText}
            {isTyping && <Text style={styles.cursor}>|</Text>}
          </Text>
        </Animated.View>

        <View style={styles.iconContainer}>
          <Svg
            width={CIRCLE_SIZE}
            height={CIRCLE_SIZE}
            style={styles.countdownSvg}
          >
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
            />
            <AnimatedCircle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={WAGERPROOF_GREEN}
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={countdownCircleProps}
              strokeLinecap="round"
              rotation="-90"
              origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
            />
          </Svg>

          <Animated.View style={[styles.iconWrapper, iconStyle]}>
            <MaterialCommunityIcons
              name="robot"
              size={18}
              color={WAGERPROOF_GREEN}
            />
          </Animated.View>
        </View>

        {/* Drawer handle - indicates bubble can be pulled down */}
        {onDetach && (
          <View style={styles.drawerHandleContainer}>
            <View style={styles.drawerHandle} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.container, containerStyle]}>
          <TouchableOpacity
            activeOpacity={mode === 'suggestion' ? 0.95 : 1}
            onPress={mode === 'suggestion' ? handleTap : undefined}
            style={styles.touchable}
            disabled={mode !== 'suggestion'}
          >
            {/* SVG with clip path for fluid fill effect */}
            <Svg
              width={SCREEN_WIDTH}
              height={TOTAL_BUBBLE_HEIGHT}
              style={styles.svgContainer}
            >
              <Defs>
                <ClipPath id="fluidClip">
                  <AnimatedEllipse
                    cx={SCREEN_WIDTH / 2}
                    cy={0}
                    animatedProps={clipEllipseProps}
                  />
                </ClipPath>
              </Defs>

              <Rect
                x={0}
                y={0}
                width={SCREEN_WIDTH}
                height={TOTAL_BUBBLE_HEIGHT}
                rx={20}
                ry={20}
                fill="#000000"
                clipPath="url(#fluidClip)"
              />
            </Svg>

            {/* Content overlay */}
            <View style={[styles.contentOverlay, { paddingTop: insets.top }]}>
              <View style={[styles.contentArea, { height: BUBBLE_CONTENT_HEIGHT }]}>
                {renderContent()}
              </View>
            </View>

            {/* Scanning mode - Fluid wave animation from top center */}
            {mode === 'scanning' && (
              <View style={styles.waveOverlay} pointerEvents="none">
                <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
                  {/* Trailing shadow waves (thicker, more opaque tail) */}
                  <AnimatedEllipse
                    cx={SCREEN_WIDTH / 2}
                    cy={0}
                    animatedProps={scanningWaveTrail3Props}
                    fill="none"
                    stroke={WAGERPROOF_GREEN}
                    strokeWidth={25}
                    opacity={0.15}
                  />
                  <AnimatedEllipse
                    cx={SCREEN_WIDTH / 2}
                    cy={0}
                    animatedProps={scanningWaveTrail2Props}
                    fill="none"
                    stroke={WAGERPROOF_GREEN}
                    strokeWidth={18}
                    opacity={0.25}
                  />
                  <AnimatedEllipse
                    cx={SCREEN_WIDTH / 2}
                    cy={0}
                    animatedProps={scanningWaveTrail1Props}
                    fill="none"
                    stroke={WAGERPROOF_GREEN}
                    strokeWidth={10}
                    opacity={0.4}
                  />
                  {/* Main wave (bright leading edge) */}
                  <AnimatedEllipse
                    cx={SCREEN_WIDTH / 2}
                    cy={0}
                    animatedProps={scanningWaveProps}
                    fill="none"
                    stroke={WAGERPROOF_GREEN}
                    strokeWidth={4}
                    opacity={1}
                  />
                </Svg>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    width: '100%',
  },
  touchable: {
    width: '100%',
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  contentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  contentArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  // Wave overlay styles (fluid scanning animation)
  waveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 99999,
  },
  // Menu mode styles
  menuContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  menuButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },

  // Scanning mode styles
  scanningContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  scanningText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },

  // Suggestion mode styles - compact two rows with icon on right
  suggestionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  countdownSvg: {
    position: 'absolute',
  },
  iconWrapper: {},
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  suggestionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  cursor: {
    color: WAGERPROOF_GREEN,
    fontWeight: '300',
  },
  // Drawer handle at bottom of bubble
  drawerHandleContainer: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  drawerHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
  },
});
