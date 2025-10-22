import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function CompetitorComparison() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Why Choose WagerProof?
      </Text>
      
      <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        See how our professional-grade tools stack up
      </Text>
      
      {/* WagerProof */}
      <View style={[styles.card, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.icon, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
            <MaterialCommunityIcons name="check-circle" size={32} color="#22c55e" />
          </View>
          <Text style={[styles.cardTitle, { color: '#22c55e' }]}>WagerProof</Text>
          <Text style={styles.cardSubtitle}>Professional betting platform</Text>
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
      <View style={[styles.card, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.icon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
            <MaterialCommunityIcons name="alert-circle" size={32} color="#ef4444" />
          </View>
          <Text style={[styles.cardTitle, { color: '#ef4444' }]}>Generic AI Chatbots</Text>
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
      <View style={[styles.card, { backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)' }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.icon, { backgroundColor: 'rgba(234, 179, 8, 0.2)' }]}>
            <MaterialCommunityIcons name="alert-circle" size={32} color="#eab308" />
          </View>
          <Text style={[styles.cardTitle, { color: '#eab308' }]}>Traditional Sportsbooks</Text>
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
      
      <Button onPress={nextStep} fullWidth>
        I'm Ready to Win
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
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

