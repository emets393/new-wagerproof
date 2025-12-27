import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const { height: screenHeight } = Dimensions.get('window');

interface AnimatedSplashProps {
  isReady: boolean;
  onAnimationComplete: () => void;
}

export function AnimatedSplash({ isReady, onAnimationComplete }: AnimatedSplashProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeOutAnim = useRef(new Animated.Value(1)).current;
  const hasStartedAnimation = useRef(false);

  useEffect(() => {
    // Start the entrance animation immediately
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      // Hide the native splash screen after text animation completes
      await SplashScreen.hideAsync();
    });
  }, []);

  useEffect(() => {
    // When the app is ready, fade out the splash
    if (isReady && !hasStartedAnimation.current) {
      hasStartedAnimation.current = true;

      // Wait a moment to show the logo, then fade out
      setTimeout(() => {
        Animated.timing(fadeOutAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          onAnimationComplete();
        });
      }, 500);
    }
  }, [isReady, onAnimationComplete]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOutAnim }]}>
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.logoText}>WAGERPROOF</Text>
        <View style={styles.underline} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  textContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#22c55e',
    letterSpacing: 4,
  },
  underline: {
    width: 60,
    height: 3,
    backgroundColor: '#22c55e',
    marginTop: 12,
    borderRadius: 2,
  },
});
