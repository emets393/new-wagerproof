import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function CompetitorComparison() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nextStep();
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>
            Why Choose WagerProof?
          </Text>

          <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
            See how our professional-grade tools stack up
          </Text>

          {/* WagerProof */}
          <View style={[styles.card, { backgroundColor: 'rgba(34, 197, 94, 0.5)', borderColor: 'rgba(34, 197, 94, 0.8)' }]}>
            <View style={styles.cardHeader}>
              <View style={styles.headerWithIcon}>
                <MaterialCommunityIcons name="check-circle" size={28} color="#22c55e" />
                <Text style={[styles.cardTitle, { color: '#fff' }]}>WagerProof</Text>
              </View>
              <Text style={styles.cardSubtitle}>Professional data platform</Text>
            </View>

            <View style={styles.featureSection}>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="check" size={16} color="#22c55e" />
                <Text style={styles.featureText}>Real-time model calculations</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="check" size={16} color="#22c55e" />
                <Text style={styles.featureText}>Quantified betting edges</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="check" size={16} color="#22c55e" />
                <Text style={styles.featureText}>Multi-model consensus</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="check" size={16} color="#22c55e" />
                <Text style={styles.featureText}>Live data integration</Text>
              </View>
            </View>
          </View>

          {/* Generic AI Chatbots */}
          <View style={[styles.card, { backgroundColor: 'rgba(239, 68, 68, 0.5)', borderColor: 'rgba(239, 68, 68, 0.8)' }]}>
            <View style={styles.cardHeader}>
              <View style={styles.headerWithIcon}>
                <MaterialCommunityIcons name="alert-circle" size={28} color="#ef4444" />
                <Text style={[styles.cardTitle, { color: '#fff' }]}>Generic AI Chatbots</Text>
              </View>
              <Text style={styles.cardSubtitle}>ChatGPT, Claude, etc.</Text>
            </View>

            <View style={styles.featureSection}>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="close" size={16} color="#ef4444" />
                <Text style={styles.featureText}>Outdated training data</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="close" size={16} color="#ef4444" />
                <Text style={styles.featureText}>No live game integration</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="close" size={16} color="#ef4444" />
                <Text style={styles.featureText}>Generic predictions</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="close" size={16} color="#ef4444" />
                <Text style={styles.featureText}>No confidence scoring</Text>
              </View>
            </View>
          </View>

          {/* Traditional Sportsbooks */}
          <View style={[styles.card, { backgroundColor: 'rgba(234, 179, 8, 0.5)', borderColor: 'rgba(234, 179, 8, 0.8)' }]}>
            <View style={styles.cardHeader}>
              <View style={styles.headerWithIcon}>
                <MaterialCommunityIcons name="alert-circle" size={28} color="#eab308" />
                <Text style={[styles.cardTitle, { color: '#fff' }]}>Traditional Sportsbooks</Text>
              </View>
              <Text style={styles.cardSubtitle}>DraftKings, FanDuel, etc.</Text>
            </View>

            <View style={styles.featureSection}>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="close" size={16} color="#eab308" />
                <Text style={styles.featureText}>Basic odds only</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="close" size={16} color="#eab308" />
                <Text style={styles.featureText}>No edge analysis</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="close" size={16} color="#eab308" />
                <Text style={styles.featureText}>Designed to favor house</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="close" size={16} color="#eab308" />
                <Text style={styles.featureText}>No predictive modeling</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.floatingButtonContainer}>
        <Button onPress={handleContinue} fullWidth variant="glass" forceDarkMode style={{ backgroundColor: 'rgba(255, 255, 255, .8)' }} textStyle={{ color: '#000000' }}>
          I'm Ready to Win
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 140,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
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
  card: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 20,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  featureSection: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});

