import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import Svg, { Circle } from 'react-native-svg';

const WAGERPROOF_GREEN = '#00E676';
const MOCK_SUGGESTION = "The Lakers have covered the spread in 8 of their last 10 home games. Consider Lakers -4.5 tonight!";

function CountdownRing({ progress }: { progress: number }) {
  const radius = 22;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={styles.ringContainer}>
      <Svg width={50} height={50} style={styles.ringSvg}>
        {/* Background ring */}
        <Circle
          cx={25}
          cy={25}
          r={radius}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <Circle
          cx={25}
          cy={25}
          r={radius}
          stroke={WAGERPROOF_GREEN}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 25 25)"
        />
      </Svg>
      {/* Robot icon in center */}
      <View style={styles.robotIconContainer}>
        <MaterialCommunityIcons name="robot" size={20} color={WAGERPROOF_GREEN} />
      </View>
    </View>
  );
}

function TypewriterText({ text, speed = 30 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const theme = useTheme();

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <Text style={[styles.suggestionText, { color: '#fff' }]}>
      {displayedText}
      {currentIndex < text.length && <Text style={styles.cursor}>|</Text>}
    </Text>
  );
}

export function Slide3_WagerBot() {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const features = [
    { icon: 'brain', label: 'Auto-Generated Insights', desc: 'WagerBot scans games automatically' },
    { icon: 'gesture-tap', label: 'Tap to View Game', desc: 'Jump to full game details' },
    { icon: 'timer-outline', label: 'Auto-Dismiss Timer', desc: 'Green ring shows countdown' },
    { icon: 'gesture-swipe-down', label: 'Pull to Detach', desc: 'Floating assistant mode' },
  ];

  return (
    <View style={styles.container}>
      {/* Dynamic Island-style bubble */}
      <View style={styles.bubbleContainer}>
        <View style={styles.bubble}>
          {/* Left side - countdown ring with robot */}
          <CountdownRing progress={0.7} />

          {/* Right side - suggestion text */}
          <View style={styles.textContainer}>
            <TypewriterText text={MOCK_SUGGESTION} speed={25} />
          </View>

          {/* Drawer handle at bottom */}
          <View style={styles.drawerHandle} />
        </View>
      </View>

      {/* Feature callouts */}
      <View style={styles.featuresContainer}>
        {features.map((feature, idx) => (
          <View key={idx} style={[styles.featureRow, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }]}>
            <View style={[styles.featureIcon, { backgroundColor: `${WAGERPROOF_GREEN}15` }]}>
              <MaterialCommunityIcons name={feature.icon as any} size={18} color={WAGERPROOF_GREEN} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureLabel, { color: theme.colors.onSurface }]}>
                {feature.label}
              </Text>
              <Text style={[styles.featureDesc, { color: theme.colors.onSurfaceVariant }]}>
                {feature.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  bubbleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bubble: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    minHeight: 80,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  ringContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ringSvg: {
    position: 'absolute',
  },
  robotIconContainer: {
    position: 'absolute',
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  suggestionText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  cursor: {
    color: '#00E676',
    fontWeight: '300',
  },
  drawerHandle: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    marginLeft: -16,
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  featuresContainer: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    gap: 10,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  featureDesc: {
    fontSize: 11,
    marginTop: 1,
  },
});
