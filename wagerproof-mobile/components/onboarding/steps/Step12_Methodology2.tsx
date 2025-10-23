import React from 'react';
import { View, Text, StyleSheet, ScrollView, Vibration, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withDelay, 
  withTiming, 
  FadeInUp 
} from 'react-native-reanimated';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function MethodologyClaim2() {
  const { nextStep } = useOnboarding();
  const theme = useTheme();

  // Animation values for each message
  const userMsg1Opacity = useSharedValue(0);
  const aiMsg1Opacity = useSharedValue(0);
  const userMsg2Opacity = useSharedValue(0);
  const aiMsg2Opacity = useSharedValue(0);

  React.useEffect(() => {
    // Animate messages in sequence
    userMsg1Opacity.value = withTiming(1, { duration: 400 });
    aiMsg1Opacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    userMsg2Opacity.value = withDelay(700, withTiming(1, { duration: 400 }));
    aiMsg2Opacity.value = withDelay(1100, withTiming(1, { duration: 400 }));
  }, []);

  const userMsg1Style = useAnimatedStyle(() => ({
    opacity: userMsg1Opacity.value,
    transform: [{ translateY: (1 - userMsg1Opacity.value) * 20 }],
  }));

  const aiMsg1Style = useAnimatedStyle(() => ({
    opacity: aiMsg1Opacity.value,
    transform: [{ translateY: (1 - aiMsg1Opacity.value) * 20 }],
  }));

  const userMsg2Style = useAnimatedStyle(() => ({
    opacity: userMsg2Opacity.value,
    transform: [{ translateY: (1 - userMsg2Opacity.value) * 20 }],
  }));

  const aiMsg2Style = useAnimatedStyle(() => ({
    opacity: aiMsg2Opacity.value,
    transform: [{ translateY: (1 - aiMsg2Opacity.value) * 20 }],
  }));

  const handleContinue = () => {
    Vibration.vibrate([0, 15, 10, 15]);
    nextStep();
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>
            Only AI app with real statistics fed in live. 
          </Text>
          
          <Text style={[styles.description, { color: 'rgba(255, 255, 255, 0.8)' }]}>
            WagerBot has live scientific modeling and years of sports data that other AI chats don't. It doesn't hallucinate answers.
          </Text>
          
          {/* AI Chat Demo */}
          <View style={[styles.chatWidget, { backgroundColor: 'rgba(255, 255, 255, 0.18)', borderColor: 'rgba(255, 255, 255, 0.25)' }]}>
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
              <Animated.View style={[styles.userMessageContainer, userMsg1Style]}>
                <View style={[styles.userMessage, { backgroundColor: 'rgba(59, 130, 246, 0.4)', borderColor: 'rgba(59, 130, 246, 0.8)' }]}>
                  <Text style={styles.messageText}>Why does the model favor Buffalo +3.5?</Text>
                </View>
              </Animated.View>
              
              {/* AI Response */}
              <Animated.View style={[styles.aiMessageContainer, aiMsg1Style]}>
                <View style={[styles.aiMessage, { backgroundColor: 'rgba(168, 85, 247, 0.4)', borderColor: 'rgba(168, 85, 247, 0.8)' }]}>
                  <View style={styles.aiHeader}>
                    <MaterialCommunityIcons name="brain" size={14} color="#fff" />
                    <Text style={[styles.aiName, { color: '#fff' }]}>WagerBot</Text>
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
              </Animated.View>
              
              {/* Follow-up User Message */}
              <Animated.View style={[styles.userMessageContainer, userMsg2Style]}>
                <View style={[styles.userMessage, { backgroundColor: 'rgba(59, 130, 246, 0.4)', borderColor: 'rgba(59, 130, 246, 0.8)' }]}>
                  <Text style={styles.messageText}>What's the confidence level?</Text>
                </View>
              </Animated.View>
              
              {/* AI Confidence Response */}
              <Animated.View style={[styles.aiMessageContainer, aiMsg2Style]}>
                <View style={[styles.aiMessage, { backgroundColor: 'rgba(168, 85, 247, 0.4)', borderColor: 'rgba(168, 85, 247, 0.8)' }]}>
                  <View style={styles.aiHeader}>
                    <MaterialCommunityIcons name="chart-bar" size={14} color="#fff" />
                    <Text style={[styles.aiName, { color: '#fff' }]}>Statistical Model</Text>
                  </View>
                  <View style={styles.confidenceRow}>
                    <Text style={styles.messageText}>Confidence:</Text>
                    <View style={[styles.confidenceBadge, { backgroundColor: 'rgba(34, 197, 94, 0.3)' }]}>
                      <Text style={styles.confidenceText}>74%</Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </View>
            
            {/* Chat Input (Disabled) */}
            <View style={styles.chatInput}>
              <MaterialCommunityIcons name="message-text" size={16} color="rgba(255, 255, 255, 0.4)" />
              <Text style={styles.chatInputText}>Ask about any game or stat...</Text>
            </View>
          </View>

        </View>
      </ScrollView>
    
      <View style={styles.floatingButtonContainer}>
        <Button onPress={handleContinue} fullWidth variant="glass">
          Continue
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
    minHeight: SCREEN_HEIGHT,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 120,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    zIndex: 10000,
    elevation: 1000,
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
    minHeight: 560,
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
    gap: 14,
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    width: '100%',
  },
  userMessage: {
    width: '75%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
    width: '100%',
  },
  aiMessage: {
    width: '85%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    minHeight: 80,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  aiName: {
    fontSize: 12,
    color: '#a855f7',
    fontWeight: '600',
  },
  messageText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
    flexShrink: 1,
  },
  bulletPoints: {
    marginTop: 8,
    gap: 8,
    width: '100%',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  bulletText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
    lineHeight: 17,
    flexShrink: 1,
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
