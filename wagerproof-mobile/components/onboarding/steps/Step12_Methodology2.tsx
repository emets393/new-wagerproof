import React from 'react';
import { View, Text, StyleSheet, ScrollView, Vibration } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function MethodologyClaim2() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();

  const handleContinue = () => {
    Vibration.vibrate([0, 15, 10, 15]);
    nextStep();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        AI, enhanced with statistics
      </Text>
      
      <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        Our WagerBot has direct access to our scientific modeling and years of sports data that other AI chats don't. It doesn't hallucinate answers, it makes complex statistics accessible.
      </Text>
      
      {/* AI Chat Demo */}
      <View style={[styles.chatWidget, { backgroundColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.2)' }]}>
        <View style={styles.widgetHeader}>
          <MaterialCommunityIcons name="robot" size={20} color="#a855f7" />
          <Text style={[styles.widgetTitle, { color: theme.colors.onBackground }]}>
            AI Assistant
          </Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
            <Text style={styles.badgeText}>Live</Text>
          </View>
        </View>
        
        <View style={styles.chatMessages}>
          {/* User Message */}
          <View style={styles.userMessageContainer}>
            <View style={[styles.userMessage, { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
              <Text style={styles.messageText}>Why does the model favor Buffalo +3.5?</Text>
            </View>
          </View>
          
          {/* AI Response */}
          <View style={styles.aiMessageContainer}>
            <View style={[styles.aiMessage, { backgroundColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.2)' }]}>
              <View style={styles.aiHeader}>
                <MaterialCommunityIcons name="brain" size={14} color="#a855f7" />
                <Text style={styles.aiName}>WagerBot</Text>
              </View>
              <Text style={styles.messageText}>Based on statistical analysis:</Text>
              <View style={styles.bulletPoints}>
                <View style={styles.bulletItem}>
                  <MaterialCommunityIcons name="check-circle" size={10} color="#22c55e" />
                  <Text style={styles.bulletText}>Buffalo covers 68% at home vs top teams</Text>
                </View>
                <View style={styles.bulletItem}>
                  <MaterialCommunityIcons name="check-circle" size={10} color="#22c55e" />
                  <Text style={styles.bulletText}>KC struggles in cold weather (4-7 ATS)</Text>
                </View>
                <View style={styles.bulletItem}>
                  <MaterialCommunityIcons name="check-circle" size={10} color="#22c55e" />
                  <Text style={styles.bulletText}>Sharp money moved line from +2.5 to +3.5</Text>
                </View>
              </View>
            </View>
          </View>
          
          {/* Follow-up User Message */}
          <View style={styles.userMessageContainer}>
            <View style={[styles.userMessage, { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
              <Text style={styles.messageText}>What's the confidence level?</Text>
            </View>
          </View>
          
          {/* AI Confidence Response */}
          <View style={styles.aiMessageContainer}>
            <View style={[styles.aiMessage, { backgroundColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.2)' }]}>
              <View style={styles.aiHeader}>
                <MaterialCommunityIcons name="chart-bar" size={14} color="#a855f7" />
                <Text style={styles.aiName}>Statistical Model</Text>
              </View>
              <View style={styles.confidenceRow}>
                <Text style={styles.messageText}>Confidence:</Text>
                <View style={[styles.confidenceBadge, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                  <Text style={styles.confidenceText}>74%</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        
        {/* Chat Input (Disabled) */}
        <View style={styles.chatInput}>
          <MaterialCommunityIcons name="message-text" size={16} color="rgba(255, 255, 255, 0.4)" />
          <Text style={styles.chatInputText}>Ask about any game or stat...</Text>
        </View>
      </View>
      
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
  chatWidget: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  chatMessages: {
    gap: 12,
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  userMessage: {
    maxWidth: '80%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  aiMessage: {
    maxWidth: '85%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  aiName: {
    fontSize: 12,
    color: '#a855f7',
    fontWeight: '600',
  },
  messageText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  bulletPoints: {
    marginTop: 6,
    gap: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulletText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  confidenceText: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '600',
  },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatInputText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    flex: 1,
  },
});

