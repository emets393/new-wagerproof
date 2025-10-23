import React, { useState } from 'react';
import { View, Text, StyleSheet, Vibration } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle,
  useFrameCallback,
  withTiming
} from 'react-native-reanimated';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const testimonials = [
  {
    name: 'Sarah M.',
    body: 'WagerProof has transformed the way I bet. The data-driven predictions have improved my win rate significantly!',
  },
  {
    name: 'Mark T.',
    body: "I used to bet on gut feelings. Now with WagerProof's analytics, I'm making smarter bets and actually profitable!",
  },
  {
    name: 'Priya K.',
    body: 'The trend analysis tools have helped me find edges I never knew existed. This platform is a game-changer!',
  },
  {
    name: 'James L.',
    body: 'The model accuracy tracking gives me confidence in my bets. Finally, a transparent sports betting analytics platform!',
  },
  {
    name: 'Maria R.',
    body: 'The historical data and trend tracking is incredibly accurate! Finally found a platform that\'s transparent about results.',
  },
  {
    name: 'David K.',
    body: 'WagerProof has made betting fun again. The interface is intuitive and the predictions are spot on!',
  },
];

export function SocialProof() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();
  const [childrenWidth, setChildrenWidth] = useState(0);
  
  const offset = useSharedValue(0);
  const duration = 20000; // 20 seconds for full scroll
  
  // Duplicate testimonials for seamless loop
  const duplicatedTestimonials = [...testimonials, ...testimonials];
  
  // Marquee animation
  useFrameCallback((frameInfo) => {
    if (childrenWidth > 0) {
      const timeDiff = frameInfo.timeSincePreviousFrame || 0;
      const distancePerFrame = (childrenWidth / 2 / duration) * timeDiff;
      
      offset.value -= distancePerFrame;
      
      // Reset when first set completes
      if (Math.abs(offset.value) >= childrenWidth / 2) {
        offset.value = 0;
      }
    }
  });
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const renderTestimonial = (item: typeof testimonials[0], index: number) => (
    <View 
      key={`${item.name}-${index}`} 
      style={[styles.testimonialCard, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}
    >
      <View style={styles.testimonialHeader}>
        <MaterialCommunityIcons name="account-circle" size={20} color="rgba(255, 255, 255, 0.7)" />
        <Text style={[styles.testimonialName, { color: theme.colors.onBackground }]}>
          {item.name}
        </Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <MaterialCommunityIcons key={star} name="star" size={12} color="#FFD700" />
          ))}
        </View>
      </View>
      <Text style={[styles.testimonialBody, { color: 'rgba(255, 255, 255, 0.85)' }]}>
        "{item.body}"
      </Text>
    </View>
  );

  const handleContinue = () => {
    Vibration.vibrate([0, 15, 10, 15]);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Trusted by data-driven bettors
      </Text>
      
      <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        See community results, discussions, and model transparency.
      </Text>
      
      <View style={styles.marqueeContainer}>
        <Animated.View 
          style={[styles.marqueeContent, animatedStyle]}
          onLayout={(e) => {
            if (childrenWidth === 0) {
              setChildrenWidth(e.nativeEvent.layout.width);
            }
          }}
        >
          {duplicatedTestimonials.map((item, index) => renderTestimonial(item, index))}
        </Animated.View>
      </View>
      
      <View style={[styles.discordBadge, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
        <MaterialCommunityIcons name="message-text" size={24} color="#5865F2" />
        <View style={styles.discordText}>
          <Text style={[styles.discordTitle, { color: theme.colors.onBackground }]}>
            Join our Discord community
          </Text>
          <Text style={styles.discordSubtitle}>
            Connect with fellow data-driven bettors
          </Text>
        </View>
      </View>
      
      <Button onPress={handleContinue} fullWidth variant="glass">
        Continue
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  marqueeContainer: {
    height: 130,
    marginBottom: 20,
    overflow: 'hidden',
  },
  marqueeContent: {
    flexDirection: 'row',
    gap: 12,
  },
  testimonialCard: {
    width: 260,
    height: 120,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  testimonialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  testimonialName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  testimonialBody: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  discordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 20,
  },
  discordText: {
    flex: 1,
  },
  discordTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  discordSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

