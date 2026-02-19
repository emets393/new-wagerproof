import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Modal,
  Platform,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';

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

interface AgentCreationGenerationIntroProps {
  visible: boolean;
  onComplete: () => void;
}

export function AgentCreationGenerationIntro({ visible, onComplete }: AgentCreationGenerationIntroProps) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [lineIndex, setLineIndex] = useState(0);
  const [lineHistory, setLineHistory] = useState<string[]>([]);
  const [runId, setRunId] = useState(0);

  const stageScale = useRef(new Animated.Value(0.7)).current;
  const newLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    setRunId((prev) => prev + 1);
    setStage(1);
    setLineIndex(0);
    setLineHistory([]);
    stageScale.setValue(0.7);

    const timers: ReturnType<typeof setTimeout>[] = [];

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

    scaleIn();
    timers.push(
      setTimeout(() => {
        scaleOut(() => {
          setStage(2);
          stageScale.setValue(0.7);
          scaleIn();

          timers.push(
            setTimeout(() => {
              scaleOut(onComplete);
            }, 3000)
          );
        });
      }, 3000)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [visible, onComplete, stageScale]);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setLineIndex((prev) => prev + 1);
    }, 900);
    return () => clearInterval(interval);
  }, [visible, stage]);

  const currentLine =
    stage === 1
      ? STAGE_1_LINES[lineIndex % STAGE_1_LINES.length]
      : STAGE_2_LINES[lineIndex % STAGE_2_LINES.length];

  useEffect(() => {
    if (!visible) return;
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
  }, [visible, currentLine, newLineAnim]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.statusList}>
          {lineHistory.map((line, index) => {
            const isNewest = index === 0;
            return (
              <Animated.Text
                key={`${runId}-${line}-${index}`}
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
                    : { opacity: Math.max(0.35, 0.85 - index * 0.22) },
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
              key={`galaxy-${runId}`}
              source={require('@/assets/GalaxyPlanet.json')}
              autoPlay
              loop
              style={styles.centerLottie}
            />
          </Animated.View>
        )}

        {stage === 2 && (
          <Animated.View style={[styles.centerLottieWrap, { transform: [{ scale: stageScale }] }]}>
            <LottieView
              key={`orbit-${runId}`}
              source={require('@/assets/OrbitPlanet.json')}
              autoPlay
              loop
              style={styles.centerLottie}
            />
          </Animated.View>
        )}
      </View>
    </Modal>
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
