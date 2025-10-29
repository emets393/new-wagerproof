import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { ReviewRequestModal } from '../../ReviewRequestModal';

const { width: screenWidth } = Dimensions.get('window');

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
  const [showReviewModal, setShowReviewModal] = useState(true);
  
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  const handleReviewModalDismiss = () => {
    setShowReviewModal(false);
  };

  return (
    <View style={styles.container}>
      <ReviewRequestModal 
        visible={showReviewModal}
        onDismiss={handleReviewModalDismiss}
      />
      
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Trusted by data-driven bettors
      </Text>
      
      <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        See community results, discussions, and model transparency.
      </Text>
      
      <View style={styles.scrollViewWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.marqueeContent}
          scrollEventThrottle={16}
          onLayout={(e) => {
            if (childrenWidth === 0) {
              setChildrenWidth(e.nativeEvent.layout.width);
            }
          }}
        >
          {testimonials.map((item, index) => renderTestimonial(item, index))}
          {testimonials.map((item, index) => renderTestimonial(item, index))}
        </ScrollView>
      </View>
      
      <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 }}>
        <Button onPress={handleContinue} fullWidth variant="glass">
          Continue
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 80,
    paddingBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  marqueeContainer: {
    height: 130,
    marginBottom: 0,
    overflow: 'hidden',
  },
  marqueeContent: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  scrollViewWrapper: {
    height: 130,
    marginBottom: 0,
  },
  testimonialCard: {
    width: screenWidth - 140,
    height: 130,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 0,
    marginHorizontal: 8,
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
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 8,
    marginHorizontal: 24,
    marginTop: 8,
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

