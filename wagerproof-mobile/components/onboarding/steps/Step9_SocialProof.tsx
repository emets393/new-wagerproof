import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

  const renderTestimonial = ({ item }: { item: typeof testimonials[0] }) => (
    <View style={[styles.testimonialCard, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
      <Text style={[styles.testimonialName, { color: theme.colors.onBackground }]}>
        {item.name}
      </Text>
      <Text style={[styles.testimonialBody, { color: 'rgba(255, 255, 255, 0.9)' }]}>
        "{item.body}"
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Trusted by data-driven bettors
      </Text>
      
      <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        See community results, discussions, and model transparency.
      </Text>
      
      <FlatList
        data={testimonials}
        renderItem={renderTestimonial}
        keyExtractor={(item) => item.name}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
      
      <View style={[styles.discordBadge, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
        <MaterialCommunityIcons name="message-text" size={24} color="#5865F2" />
        <View style={styles.discordText}>
          <Text style={[styles.discordTitle, { color: theme.colors.onBackground }]}>
            All members get exclusive access to our Discord community
          </Text>
          <Text style={styles.discordSubtitle}>
            Connect with fellow data-driven bettors
          </Text>
        </View>
      </View>
      
      <Button onPress={nextStep} fullWidth>
        Continue
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  list: {
    marginBottom: 24,
  },
  listContent: {
    gap: 12,
    paddingHorizontal: 4,
  },
  testimonialCard: {
    width: 280,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  testimonialName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  testimonialBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  discordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 24,
  },
  discordText: {
    flex: 1,
  },
  discordTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  discordSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

