import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Platform, InteractionManager } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import LottieView from 'lottie-react-native';

// #region agent log
const debugLog = (location: string, message: string, data: any = {}, hypothesisId: string = 'H3') => {
  fetch('http://127.0.0.1:7243/ingest/d951aa23-37db-46ab-80d8-615d2da9aa8b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location,message,data:{...data,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',hypothesisId})}).catch(()=>{});
};
// #endregion

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
  const hasHiddenNativeSplash = useRef(false);
  const animationsStarted = useRef(false);

  // Keep isReadyRef in sync
  useEffect(() => {
    isReadyRef.current = isReady;
    // #region agent log
    debugLog('AnimatedSplash.tsx:isReadyEffect', 'isReady changed', { isReady });
    // #endregion
  }, [isReady]);

  // #region agent log
  useEffect(() => {
    debugLog('AnimatedSplash.tsx:mount', 'AnimatedSplash MOUNTED', {});
    return () => {
      debugLog('AnimatedSplash.tsx:unmount', 'AnimatedSplash UNMOUNTED', {});
    };
  }, []);
  // #endregion

  // Start intro animations (called after native splash is hidden)
  const startIntroAnimations = useCallback(() => {
    if (animationsStarted.current) return;
    animationsStarted.current = true;

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

  // Function to start fade-out (only if both conditions are met)
  const tryStartFadeOut = () => {
    if (hasStartedFadeOut.current) return;
    if (!introAnimationComplete.current || !isReadyRef.current) return;

    hasStartedFadeOut.current = true;
    
    // #region agent log
    debugLog('AnimatedSplash.tsx:fadeOut', 'Starting fade out animation', {});
    // #endregion
    
    // Small delay to let user appreciate the animation before fading out
    setTimeout(() => {
      Animated.timing(fadeOutAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // #region agent log
        debugLog('AnimatedSplash.tsx:fadeOutComplete', 'Fade out complete, calling onAnimationComplete', {});
        // #endregion
        onAnimationComplete();
      });
    }, 300);
  };

  // Hide native splash only after this component is laid out and painted
  // This prevents the flash between native splash hiding and React splash appearing
  const handleLayout = useCallback(() => {
    if (hasHiddenNativeSplash.current) return;
    hasHiddenNativeSplash.current = true;

    // #region agent log
    debugLog('AnimatedSplash.tsx:onLayout', 'Component laid out, hiding native splash', {});
    // #endregion

    // Wait for next frame to ensure the view is actually painted
    // Then hide native splash and start animations
    requestAnimationFrame(() => {
      // Use InteractionManager to ensure all pending interactions are complete
      InteractionManager.runAfterInteractions(() => {
        SplashScreen.hideAsync().then(() => {
          // #region agent log
          debugLog('AnimatedSplash.tsx:nativeSplashHidden', 'Native splash hidden, starting animations', {});
          // #endregion
          startIntroAnimations();
        });
      });
    });
  }, [startIntroAnimations]);

  useEffect(() => {
    // When the app becomes ready, try to start fade-out
    if (isReady) {
      tryStartFadeOut();
    }
  }, [isReady]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOutAnim }]} onLayout={handleLayout}>
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
