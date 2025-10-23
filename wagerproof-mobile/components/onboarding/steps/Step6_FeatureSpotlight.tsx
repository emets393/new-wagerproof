import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Vibration } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  withSequence
} from 'react-native-reanimated';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

type FeatureType = 'edge-finder' | 'public-lean';

export function FeatureSpotlight() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();
  const [activeFeature, setActiveFeature] = useState<FeatureType>('edge-finder');
  const fadeAnim = useSharedValue(1);

  const handleToggleFeature = (feature: FeatureType) => {
    if (feature === activeFeature) return;
    
    Vibration.vibrate([0, 10, 10]);
    
    // Animate fade out, change content, then fade in
    fadeAnim.value = withSequence(
      withTiming(0, { duration: 150 }),
      withTiming(1, { duration: 200 })
    );
    
    // Update the feature after fade out starts
    setTimeout(() => {
      setActiveFeature(feature);
    }, 150);
  };

  const handleContinue = () => {
    Vibration.vibrate([0, 15, 10, 15]);
    nextStep();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Tools built for your goals
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        Use Edge Finder to spot value vs. the market. Use Public Lean to see where money is actually flowing.
      </Text>
      
      {/* Feature Toggle */}
      <View style={styles.toggleContainer}>
        <Button
          variant="glass"
          selected={activeFeature === 'edge-finder'}
          onPress={() => handleToggleFeature('edge-finder')}
          style={styles.toggleButton}
        >
          Edge Finder
        </Button>
        <Button
          variant="glass"
          selected={activeFeature === 'public-lean'}
          onPress={() => handleToggleFeature('public-lean')}
          style={styles.toggleButton}
        >
          Public Lean
        </Button>
      </View>
      
      {/* Feature Demo */}
      <Animated.View style={[animatedStyle]}>
        {activeFeature === 'edge-finder' ? (
          <View style={[styles.demoCard, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)', borderWidth: 1 }]}>
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
          <View style={[styles.demoCard, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)', borderWidth: 1 }]}>
            <View style={styles.demoHeader}>
              <MaterialCommunityIcons name="cash-multiple" size={20} color="#3b82f6" />
              <Text style={[styles.demoTitle, { color: theme.colors.onBackground }]}>
                Public Lean
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
            
            <View style={styles.leanContainer}>
              <View style={[styles.leanBox, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                <View style={styles.leanHeader}>
                  <MaterialCommunityIcons name="account-multiple" size={14} color="#3b82f6" />
                  <Text style={[styles.leanLabel, { color: '#3b82f6' }]}>Public Lean</Text>
                </View>
                <Text style={styles.leanPercentage}>67%</Text>
                <Text style={styles.leanDetail}>Betting on Buffalo +3.5</Text>
              </View>
              <View style={[styles.leanBox, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
                <View style={styles.leanHeader}>
                  <MaterialCommunityIcons name="briefcase" size={14} color="#a855f7" />
                  <Text style={[styles.leanLabel, { color: '#a855f7' }]}>Big Money</Text>
                </View>
                <Text style={styles.leanPercentage}>72%</Text>
                <Text style={styles.leanDetail}>Betting on Kansas City -3.5</Text>
              </View>
            </View>
            
            <View style={styles.benefits}>
              <MaterialCommunityIcons name="chart-line" size={16} color="#3b82f6" />
              <Text style={styles.benefitText}>Public vs. sharp money insights</Text>
            </View>
          </View>
        )}
      </Animated.View>
      
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
  leanContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  leanBox: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  leanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  leanLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  leanPercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  leanDetail: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
  },
});

