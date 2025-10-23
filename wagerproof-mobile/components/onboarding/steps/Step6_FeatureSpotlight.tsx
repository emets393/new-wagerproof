import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Vibration } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

type FeatureType = 'edge-finder' | 'ai-simulator';

export function FeatureSpotlight() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();
  const [activeFeature, setActiveFeature] = useState<FeatureType>('edge-finder');

  const handleToggleFeature = (feature: FeatureType) => {
    Vibration.vibrate([0, 10, 10]);
    setActiveFeature(feature);
  };

  const handleContinue = () => {
    Vibration.vibrate([0, 15, 10, 15]);
    nextStep();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Tools built for your goals
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        Use Edge Finder to spot model vs. market discrepancies. Use AI Game Simulator for matchup outcomes and probabilities.
      </Text>
      
      {/* Feature Toggle */}
      <View style={styles.toggleContainer}>
        <Button
          variant={activeFeature === 'edge-finder' ? 'primary' : 'ghost'}
          onPress={() => handleToggleFeature('edge-finder')}
          style={styles.toggleButton}
        >
          Edge Finder
        </Button>
        <Button
          variant={activeFeature === 'ai-simulator' ? 'primary' : 'ghost'}
          onPress={() => handleToggleFeature('ai-simulator')}
          style={styles.toggleButton}
        >
          AI Simulator
        </Button>
      </View>
      
      {/* Feature Demo */}
      {activeFeature === 'edge-finder' ? (
        <View style={[styles.demoCard, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
          <View style={styles.demoHeader}>
            <MaterialCommunityIcons name="target" size={20} color="#22c55e" />
            <Text style={[styles.demoTitle, { color: theme.colors.onBackground }]}>
              Edge Finder
            </Text>
          </View>
          
          <View style={styles.gameHeader}>
            <View style={styles.team}>
              <View style={[styles.teamCircle, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <Text style={styles.teamText}>KC</Text>
              </View>
              <Text style={styles.teamName}>Kansas City</Text>
            </View>
            <Text style={styles.vs}>@</Text>
            <View style={styles.team}>
              <View style={[styles.teamCircle, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                <Text style={styles.teamText}>BUF</Text>
              </View>
              <Text style={styles.teamName}>Buffalo</Text>
            </View>
          </View>
          
          <View style={styles.edgeContainer}>
            <View style={[styles.edgeBox, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
              <Text style={styles.edgeLabel}>Spread Edge: 1.5pt</Text>
              <Text style={styles.edgeDetail}>Market: KC -3.5</Text>
              <Text style={styles.edgeDetail}>Model: KC -2.0</Text>
            </View>
            <View style={[styles.edgeBox, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
              <Text style={styles.edgeLabel}>Total Edge: 2.7pt</Text>
              <Text style={styles.edgeDetail}>Market: 51.5</Text>
              <Text style={styles.edgeDetail}>Model: 54.2</Text>
            </View>
          </View>
          
          <View style={styles.benefits}>
            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#fbbf24" />
            <Text style={styles.benefitText}>Real-time model calculations</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.demoCard, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
          <View style={styles.demoHeader}>
            <MaterialCommunityIcons name="brain" size={20} color="#a855f7" />
            <Text style={[styles.demoTitle, { color: theme.colors.onBackground }]}>
              AI Game Simulator
            </Text>
          </View>
          
          <View style={styles.consensusContainer}>
            <View style={styles.consensusTeams}>
              <View style={[styles.teamCircle, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <Text style={styles.teamText}>KC</Text>
              </View>
              <MaterialCommunityIcons name="trophy" size={24} color="#fbbf24" />
              <View style={[styles.teamCircle, { backgroundColor: 'rgba(59, 130, 246, 0.2)', opacity: 0.5 }]}>
                <Text style={styles.teamText}>BUF</Text>
              </View>
            </View>
            <Text style={[styles.consensusTitle, { color: '#a855f7' }]}>Kansas City Wins</Text>
            <Text style={styles.consensusDetail}>67% Confidence • 3 Models</Text>
          </View>
          
          <View style={styles.benefits}>
            <MaterialCommunityIcons name="brain" size={16} color="#a855f7" />
            <Text style={styles.benefitText}>Multi-model consensus predictions</Text>
          </View>
        </View>
      )}
      
      <Button onPress={handleContinue} fullWidth variant="glass">
        Continue
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
  },
  demoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  demoTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  team: {
    alignItems: 'center',
  },
  teamCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  teamText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  teamName: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  vs: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 18,
    fontWeight: 'bold',
  },
  edgeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  edgeBox: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
  },
  edgeLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    marginBottom: 8,
  },
  edgeDetail: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  consensusContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginBottom: 16,
  },
  consensusTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  consensusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  consensusDetail: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  benefits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
});

