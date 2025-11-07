import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import Checkbox from 'expo-checkbox';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export function TermsAcceptance() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const theme = useTheme();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isChecked && hasScrolledToBottom) {
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Stop animation
      pulseAnim.setValue(0);
    }
  }, [isChecked, hasScrolledToBottom, pulseAnim]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 50;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isAtBottom && !hasScrolledToBottom) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHasScrolledToBottom(true);
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsChecked(checked);
  };

  const handleNext = () => {
    if (isChecked && hasScrolledToBottom) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Store the timestamp of terms acceptance
      updateOnboardingData({ 
        termsAcceptedAt: new Date().toISOString() 
      });
      nextStep();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Terms and Conditions
      </Text>
      
      <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
        Please read through our terms and conditions before continuing
      </Text>

      {/* Scroll indicator */}
      {!hasScrolledToBottom && (
        <View style={styles.scrollIndicator}>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#22c55e" />
          <Text style={styles.scrollText}>Scroll down to continue</Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#22c55e" />
        </View>
      )}

      {/* Terms content scrollable container */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.termsContainer}
        contentContainerStyle={styles.termsContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.lastUpdated}>**Last Updated: October 15, 2025**</Text>

        <Text style={styles.sectionTitle}>1. Nature of Our Service & Disclaimers</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Sports Betting Advice & Analytics Only</Text>: WagerProof provides data-driven sports betting insights, analysis, and educational tools. Our Service offers statistical models, trend analysis, and predictions to assist users in making informed decisions.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>NOT Financial or Betting Advice</Text>: <Text style={styles.bold}>WagerProof DOES NOT provide financial advice, investment advice, or direct betting recommendations.</Text> The information and tools provided are for informational and entertainment purposes only. You should not consider any content on the Service as a solicitation, recommendation, or endorsement to place any wagers or engage in any gambling activity.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>No Guarantees of Winnings</Text>: <Text style={styles.bold}>We do not guarantee any profits, winnings, or positive outcomes from using our Service.</Text> Sports betting inherently involves risk, and past performance is not indicative of future results.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>User Responsibility</Text>: <Text style={styles.bold}>You are solely responsible for your own betting decisions, actions, and any financial gains or losses incurred.</Text> You acknowledge and agree that you use the Service at your own risk.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Not a Gambling Operator</Text>: WagerProof is not a bookmaker, gambling operator, or a platform for placing bets. We do not accept or process wagers.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Legal Compliance</Text>: You are responsible for ensuring that your use of the Service complies with all applicable laws and regulations in your jurisdiction regarding sports betting and online services. We do not condone illegal gambling.
        </Text>

        <Text style={styles.sectionTitle}>2. User Accounts</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Eligibility</Text>: You must be at least 18 years old to create an account and use our Service. By creating an account, you represent and warrant that you are at least 18 years old.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Account Information</Text>: When you create an account, you agree to provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Account Termination</Text>: We reserve the right to suspend or terminate your account at our sole discretion, without notice or liability, for any reason, including if you violate these Terms.
        </Text>

        <Text style={styles.sectionTitle}>3. Subscriptions and Payments</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Subscription Plans</Text>: We offer various subscription plans (e.g., Basic, Pro, Enterprise) with different features and pricing. Details of these plans are available on our website.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Billing</Text>: Subscriptions are billed on a recurring basis (e.g., monthly or annually) through our third-party payment processor, Stripe. By subscribing, you authorize Stripe to charge your designated payment method at the beginning of each billing cycle.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Price Changes</Text>: We reserve the right to change our subscription fees at any time. Any price changes will be communicated to you in advance, and you will have the option to cancel your subscription before the new prices take effect.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Cancellations and Refunds</Text>: You may cancel your subscription at any time. Cancellations will take effect at the end of your current billing period. We generally do not offer refunds for partial subscription periods, except as required by law.
        </Text>

        <Text style={styles.sectionTitle}>4. Acceptable Use Policy</Text>
        <Text style={styles.paragraph}>You agree not to use the Service to:</Text>
        <Text style={styles.listItem}>• Violate any local, state, national, or international law or regulation.</Text>
        <Text style={styles.listItem}>• Engage in any activity that is fraudulent, misleading, or deceptive.</Text>
        <Text style={styles.listItem}>• Transmit any harmful, threatening, defamatory, obscene, or otherwise objectionable content.</Text>
        <Text style={styles.listItem}>• Interfere with or disrupt the integrity or performance of the Service.</Text>

        <Text style={styles.sectionTitle}>5. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          All content on the Service, including text, graphics, logos, images, software, models, data, and the compilation thereof, is the property of WagerProof or its suppliers and protected by copyright and other intellectual property laws.
        </Text>

        <Text style={styles.sectionTitle}>6. WagerBot and AI Usage</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Informational Tool</Text>: The WagerBot is an AI-powered analytical tool designed to provide insights based on available data.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>AI Limitations</Text>: <Text style={styles.bold}>The responses and analyses provided by WagerBot are machine-generated and should not be taken as definitive or infallible advice.</Text> WagerBot may generate incomplete, inaccurate, or biased information.
        </Text>

        <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WAGERPROOF, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.</Text>
        </Text>

        <Text style={styles.sectionTitle}>8. Indemnification</Text>
        <Text style={styles.paragraph}>
          You agree to indemnify and hold harmless WagerProof, its affiliates, and their respective officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, and expenses arising out of your use of the Service.
        </Text>

        <Text style={styles.sectionTitle}>9. Governing Law and Jurisdiction</Text>
        <Text style={styles.paragraph}>
          These Terms shall be governed and construed in accordance with the laws of Texas. You agree to submit to the exclusive jurisdiction of the courts located in Austin, Texas.
        </Text>

        <Text style={styles.sectionTitle}>10. Changes to These Terms</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify or replace these Terms at any time at our sole discretion. If a revision is material, we will provide at least 30 days' notice.
        </Text>

        <Text style={styles.sectionTitle}>11. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms, please contact us at: admin@wagerproof.bet
        </Text>
      </ScrollView>

      {/* Checkbox and Continue Button */}
      <View style={styles.bottomContainer}>
        <View style={styles.checkboxContainer}>
          <Checkbox
            value={isChecked}
            onValueChange={handleCheckboxChange}
            disabled={!hasScrolledToBottom}
            color={hasScrolledToBottom ? '#22c55e' : '#6b7280'}
            style={styles.checkbox}
          />
          <Text 
            style={[
              styles.checkboxLabel, 
              { opacity: hasScrolledToBottom ? 1 : 0.5 }
            ]}
          >
            I have read and agree to the Terms and Conditions
          </Text>
        </View>

        <Animated.View
          style={[
            styles.buttonWrapper,
            isChecked && hasScrolledToBottom && {
              opacity: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
              }),
            },
          ]}
        >
          <Button
            onPress={handleNext}
            fullWidth
            variant="glass"
            disabled={!isChecked || !hasScrolledToBottom}
            style={[
              styles.continueButton,
              isChecked && hasScrolledToBottom && styles.buttonActive,
            ]}
          >
            Continue
          </Button>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  scrollText: {
    color: '#22c55e',
    fontSize: 14,
  },
  termsContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 16,
  },
  termsContent: {
    padding: 16,
    paddingBottom: 200,
  },
  lastUpdated: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
  },
  paragraph: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  bold: {
    fontWeight: 'bold',
  },
  listItem: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    paddingLeft: 8,
  },
  bottomContainer: {
    paddingTop: 16,
    paddingBottom: 60,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
  },
  checkboxLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    flex: 1,
  },
  buttonWrapper: {
    width: '100%',
  },
  continueButton: {
    marginTop: 8,
  },
  buttonActive: {
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 20,
  },
});

