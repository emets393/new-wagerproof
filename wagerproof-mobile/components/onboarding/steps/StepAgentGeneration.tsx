import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const STAGE_1_LINES = [
  'Hacking Vegas computers...',
  'Mining sharp-market signals...',
  'Decoding suspicious line movement...',
];

const STAGE_2_LINES = [
  'Calibrating confidence engines...',
  'Simulating 10,000 bet outcomes...',
  'Assembling your agent brain...',
];

export function AgentGenerationStep() {
  const { nextStep } = useOnboarding();
  const [stage, setStage] = useState<1 | 2>(1);
  const [lineIndex, setLineIndex] = useState(0);
  const [lineHistory, setLineHistory] = useState<string[]>([]);

  const stageScale = useRef(new Animated.Value(0.7)).current;
  const newLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    const scaleIn = () => {
      Animated.timing(stageScale, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start();
    };

    const scaleOut = (onDone: () => void) => {
      Animated.timing(stageScale, {
        toValue: 0.55,
        duration: 220,
        useNativeDriver: true,
      }).start(onDone);
    };

    // Stage 1: Galaxy planet scales in and holds for 3s
    stageScale.setValue(0.7);
    scaleIn();
    timeouts.push(
      setTimeout(() => {
        scaleOut(() => {
          // Stage 2: Orbit planet scales in and holds for 3s
          setStage(2);
          stageScale.setValue(0.7);
          scaleIn();

          timeouts.push(
            setTimeout(() => {
              scaleOut(() => {
                // Green-screen transition now happens on Agent Born step.
                nextStep();
              });
            }, 3000)
          );
        });
      }, 3000)
    );

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [nextStep, stageScale]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLineIndex((prev) => prev + 1);
    }, 900);
    return () => clearInterval(interval);
  }, [stage]);

  const currentLine =
    stage === 1
      ? STAGE_1_LINES[lineIndex % STAGE_1_LINES.length]
      : STAGE_2_LINES[lineIndex % STAGE_2_LINES.length];

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLineHistory((prev) => {
      const next = [currentLine, ...prev];
      return next.slice(0, 4);
    });

    newLineAnim.setValue(0);
    Animated.timing(newLineAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [currentLine, newLineAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.statusList}>
        {lineHistory.map((line, index) => {
          const isNewest = index === 0;
          return (
            <Animated.Text
              key={`${line}-${index}`}
              style={[
                styles.statusText,
                isNewest
                  ? {
                      opacity: newLineAnim,
                      transform: [
                        {
                          scale: newLineAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.96, 1],
                          }),
                        },
                        {
                          translateY: newLineAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-6, 0],
                          }),
                        },
                      ],
                    }
                  : {
                      opacity: Math.max(0.35, 0.85 - index * 0.22),
                    },
              ]}
              numberOfLines={1}
            >
              {line}
            </Animated.Text>
          );
        })}
      </View>

      {stage === 1 && (
        <Animated.View style={[styles.centerLottieWrap, { transform: [{ scale: stageScale }] }]}>
          <LottieView
            source={{ uri: 'file:///Users/chrishabib/Downloads/1_Galaxy_Planet.json' }}
            autoPlay
            loop
            style={styles.centerLottie}
          />
        </Animated.View>
      )}

      {stage === 2 && (
        <Animated.View style={[styles.centerLottieWrap, { transform: [{ scale: stageScale }] }]}>
          <LottieView
            source={{ uri: 'file:///Users/chrishabib/Downloads/2_Orbit_Planet.json' }}
            autoPlay
            loop
            style={styles.centerLottie}
          />
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusList: {
    position: 'absolute',
    top: 104,
    left: 24,
    right: 24,
    gap: 8,
  },
  statusText: {
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  centerLottieWrap: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLottie: {
    width: 260,
    height: 260,
  },
});
