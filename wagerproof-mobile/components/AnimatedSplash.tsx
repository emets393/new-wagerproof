import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import LottieView from 'lottie-react-native';

interface AnimatedSplashProps {
  isReady: boolean;
  onAnimationComplete: () => void;
}

export function AnimatedSplash({ isReady, onAnimationComplete }: AnimatedSplashProps) {
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const textSlideAnim = useRef(new Animated.Value(30)).current;
  const lottieFadeAnim = useRef(new Animated.Value(0)).current;
  const fadeOutAnim = useRef(new Animated.Value(1)).current;
  const hasStartedFadeOut = useRef(false);
  const introAnimationComplete = useRef(false);
  const isReadyRef = useRef(false);

  // Keep isReadyRef in sync
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  // Function to start fade-out (only if both conditions are met)
  const tryStartFadeOut = () => {
    if (hasStartedFadeOut.current) return;
    if (!introAnimationComplete.current || !isReadyRef.current) return;

    hasStartedFadeOut.current = true;
    
    // Small delay to let user appreciate the animation before fading out
    setTimeout(() => {
      Animated.timing(fadeOutAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onAnimationComplete();
      });
    }, 300);
  };

  useEffect(() => {
    // Hide native splash immediately so user sees black AnimatedSplash background
    // instead of white native splash
    SplashScreen.hideAsync();

    // Animate text in first, then lottie
    Animated.sequence([
      // Text slides in and fades in
      Animated.parallel([
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textSlideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Then lottie fades in
      Animated.timing(lottieFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Mark intro animation as complete
      introAnimationComplete.current = true;
      // Try to fade out (will only work if isReady is also true)
      tryStartFadeOut();
    });
  }, []);

  useEffect(() => {
    // When the app becomes ready, try to start fade-out
    if (isReady) {
      tryStartFadeOut();
    }
  }, [isReady]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOutAnim }]}>
      <View style={styles.contentContainer}>
        <Animated.View
          style={[
            styles.titleContainer,
            {
              opacity: textFadeAnim,
              transform: [{ translateY: textSlideAnim }],
            },
          ]}
        >
          <Text style={styles.titleMain}>Wager</Text>
          <Text style={styles.titleProof}>Proof</Text>
        </Animated.View>
        <Animated.View style={{ opacity: lottieFadeAnim }}>
          <LottieView
            source={require('../assets/loader.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
        </Animated.View>
      </View>
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
  contentContainer: {
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleMain: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  titleProof: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00E676',
    letterSpacing: -0.5,
  },
  lottie: {
    width: 280,
    height: 210,
  },
});
