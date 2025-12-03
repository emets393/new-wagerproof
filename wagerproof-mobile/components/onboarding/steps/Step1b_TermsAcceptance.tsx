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
    if (isChecked) {
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
  }, [isChecked, pulseAnim]);

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
    if (isChecked) {
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

        <Text style={styles.sectionTitle}>1. Acceptance of the Terms of Service</Text>
        <Text style={styles.paragraph}>
          These terms and conditions of service are entered into by and between you and WagerProof LLC, a Texas limited liability company ("WagerProof," "Company," "we," or "us"). The following terms and conditions of service, together with any documents they expressly incorporate by reference (collectively, "Terms of Service"), govern your access to and use of https://wagerproof.bet (the "Website"), including any content, functionality, and services offered on or through the Website, whether as a guest or a registered user, (collectively, the "Services").
        </Text>
        <Text style={styles.paragraph}>
          Please read the Terms of Service carefully before you start to use the Services. By clicking "I Accept," creating an account, accessing, or using the Services in any manner, you acknowledge that you have read, understood, and agree to be bound and abide by these Terms of Service, including our Privacy Policy, found at https://wagerproof.bet/privacy-policy, which is hereby incorporated herein by reference. If you do not agree to these Terms of Service, you are not authorized to access or use the Services and must immediately cease all use of the Services.
        </Text>

        <Text style={styles.sectionTitle}>2. Nature of Service & Disclaimers</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Sports Data Analytics Only</Text>: WagerProof provides data-driven sports insights, statistical analysis, and educational tools through proprietary machine learning models and algorithms. The Services offer statistical models, trend analysis, predictive analytics, and data visualizations to assist users in making informed decisions. All content is for informational and educational purposes only.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>NOT Financial or Betting Advice</Text>: <Text style={styles.bold}>WagerProof DOES NOT provide financial advice, investment advice, or direct betting recommendations, whether through the Services or otherwise.</Text> The information, data, analytics, and tools provided through the Services are for informational, educational, and entertainment purposes only. You should not consider any materials provided on or through the Services as a solicitation, recommendation, offer, or endorsement to place any wagers or engage in any gambling activity.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>NO GUARANTEES OF ACCURACY OR OUTCOMES</Text>: <Text style={styles.bold}>WE MAKE NO GUARANTEES, REPRESENTATIONS, OR WARRANTIES REGARDING THE ACCURACY, RELIABILITY, OR COMPLETENESS OF OUR DATA, ANALYTICS, PREDICTIONS, OR MODELS. WE DO NOT GUARANTEE ANY PROFITS, WINNINGS, POSITIVE OUTCOMES, OR SPECIFIC RESULTS FROM USING OUR SERVICES. SPORTS OUTCOMES ARE INHERENTLY UNPREDICTABLE AND INVOLVE SUBSTANTIAL RISK OF LOSS. PAST PERFORMANCE OF OUR MODELS OR PREDICTIONS IS NOT INDICATIVE OF FUTURE RESULTS. YOU MAY LOSE MONEY BY RELYING ON OUR SERVICES.</Text>
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>USER RESPONSIBILITY AND ASSUMPTION OF RISK</Text>: <Text style={styles.bold}>YOU ARE SOLELY AND EXCLUSIVELY RESPONSIBLE FOR YOUR OWN DECISIONS, ACTIONS, AND ANY FINANCIAL GAINS OR LOSSES INCURRED. YOU ACKNOWLEDGE AND EXPRESSLY AGREE THAT: (A) YOU USE THE SERVICES ENTIRELY AT YOUR OWN RISK; (B) YOU HAVE CONDUCTED YOUR OWN INDEPENDENT RESEARCH AND ANALYSIS; (C) YOU ARE NOT RELYING SOLELY ON WAGERPROOF'S DATA OR ANALYTICS; (D) YOU UNDERSTAND THE RISKS ASSOCIATED WITH SPORTS BETTING AND GAMBLING; AND (E) YOU HAVE THE FINANCIAL MEANS TO ABSORB ANY LOSSES YOU MAY INCUR. YOU HEREBY RELEASE AND HOLD HARMLESS WAGERPROOF FROM ANY AND ALL CLAIMS ARISING FROM YOUR USE OF THE SERVICES OR ANY BETTING ACTIVITIES.</Text>
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>NOT A GAMBLING OPERATOR</Text>: <Text style={styles.bold}>WAGERPROOF IS NOT A BOOKMAKER, CASINO, GAMBLING OPERATOR, SPORTSBOOK, OR A PLATFORM FOR PLACING BETS. WE DO NOT ACCEPT, PROCESS, FACILITATE, OR HAVE ANY INVOLVEMENT IN WAGERS, BETS, OR GAMBLING TRANSACTIONS OF ANY KIND. WE DO NOT HOLD ANY GAMBLING LICENSES OR PERMITS. WAGERPROOF IS SOLELY A DATA ANALYTICS AND INFORMATION SERVICES PROVIDER. WAGERPROOF DOES NOT CONDONE ILLEGAL GAMBLING.</Text>
        </Text>
        <Text style={styles.paragraph}>
          The information and materials presented on or through the Services are made available solely for general information, educational, and entertainment purposes. We do not warrant the accuracy, completeness, or usefulness of this information. Any reliance you place on such information is strictly at your own risk.
        </Text>

        <Text style={styles.sectionTitle}>3. Accessing Services and Account Security</Text>
        <Text style={styles.paragraph}>
          The Services are offered and available only to users who are 18 years of age or older, and reside in the United States or any of its territories or possessions. By using the Services, you represent and warrant that you are of legal age to form a binding contract with the Company and meet all of the foregoing eligibility requirements. You further warrant that you are legally permitted to access the Services in your jurisdiction.
        </Text>

        <Text style={styles.sectionTitle}>4. Subscriptions and Payments</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Subscription Plans</Text>: We offer various subscription plans (e.g., Basic, Pro, Enterprise) with different features and pricing.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Billing</Text>: Subscriptions are billed on a recurring basis through our third-party payment processor, Stripe.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Price Changes</Text>: We reserve the right to change our subscription fees at any time.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Cancellations and Refunds</Text>: You may cancel your subscription at any time. We do not offer refunds for partial subscription periods, except as expressly provided in these Terms of Service, in cases of material breach by WagerProof, or as may be required by applicable law.
        </Text>

        <Text style={styles.sectionTitle}>5. Prohibited Uses</Text>
        <Text style={styles.paragraph}>
          You may use the Services only for lawful purposes and in accordance with these Terms of Service. You agree not to use the Services in any way that violates any applicable federal, state, local, or international law or regulation, including gambling laws or regulations.
        </Text>

        <Text style={styles.sectionTitle}>6. Monitoring and Enforcement; Termination</Text>
        <Text style={styles.paragraph}>
          We have the right to terminate or suspend your access to all or part of the Services for any or no reason, including without limitation, any violation of these Terms of Service.
        </Text>

        <Text style={styles.sectionTitle}>7. Links</Text>
        <Text style={styles.paragraph}>
          If the Services contains links to other resources provided by third parties, these links are provided for your convenience only. We have no control over the contents of those sites or resources and accept no responsibility for them.
        </Text>

        <Text style={styles.sectionTitle}>8. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          The Services and their contents, features, and functionality are owned by WagerProof, its licensors, or other providers of such material and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
        </Text>

        <Text style={styles.sectionTitle}>9. Use of Artificial Intelligence</Text>
        <Text style={styles.paragraph}>
          The Services use analytical tools that use artificial intelligence and/or machine learning models (collectively, "AI") designed to provide insights based on available data. You understand and acknowledge that: (a) the information or materials provided by or through the Services may be machine-generated using AI; (b) AI may generate incomplete, inaccurate, biased, outdated, or misleading information, hallucinations, and/or other errors; (c) information or materials provided by or through the Services do not constitute financial, gambling, investment, or professional advice of any kind; and (d) you use the Services and the outputs provided by or through the Services solely at your own risk.
        </Text>

        <Text style={styles.sectionTitle}>10. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WAGERPROOF, ITS AFFILIATES, OR ITS OR THEIR MEMBERS, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR DAMAGES OF ANY KIND, INCLUDING WITHOUT LIMITATION, LOSS OF REVENUE, LOSS OF PROFITS, GAMBLING LOSSES, BETTING LOSSES, FINANCIAL LOSSES FROM RELIANCE ON WAGERBOT OR ANY AI-GENERATED CONTENT, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OR INABILITY TO USE THE SERVICES.</Text>
        </Text>

        <Text style={styles.sectionTitle}>11. Indemnification</Text>
        <Text style={styles.paragraph}>
          You agree to defend, indemnify, and hold harmless WagerProof, its affiliates, and its and their respective members, officers, directors, employees, agents, licensors, suppliers, successors, and assigns from and against any and all claims, liabilities, damages, losses, judgements, awards, fees, penalties, fines, and expenses, including reasonable attorneys' fees and costs, arising out of or in any way connected with your access to or use of the Services, your violation of these Terms of Service, any gambling or betting activities you engage in based on information from the Services, or your violation of any applicable laws or regulations.
        </Text>

        <Text style={styles.sectionTitle}>12. Governing Law and Jurisdiction</Text>
        <Text style={styles.paragraph}>
          All matters relating to the Services and these Terms of Service shall be governed and construed in accordance with the laws of Texas, without regard to its conflict of law provisions. Any legal suit, action, or proceeding arising out of, or related to, these Terms of Service or the Services shall be instituted exclusively in the federal courts of the United States or the courts of the State of Texas, in each case located in the City of Austin and County of Travis.
        </Text>

        <Text style={styles.sectionTitle}>13. Arbitration</Text>
        <Text style={styles.paragraph}>
          Any dispute, controversy, or claim arising out of or relating to these Terms of Service or the use of the Services shall be determined by binding arbitration in Austin, Texas, before one arbitrator. The arbitration shall be administered by the American Arbitration Association in accordance with its Commercial Arbitration Rules.
        </Text>

        <Text style={styles.sectionTitle}>14. Limitation on Time to File Claims</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>ANY CAUSE OF ACTION OR CLAIM YOU MAY HAVE ARISING OUT OF OR RELATING TO THESE TERMS OF SERVICE OR THE SERVICES MUST BE COMMENCED WITHIN ONE (1) YEAR AFTER THE CAUSE OF ACTION ACCRUES; OTHERWISE, SUCH CAUSE OF ACTION OR CLAIM IS PERMANENTLY BARRED.</Text>
        </Text>

        <Text style={styles.sectionTitle}>15. Waiver and Severability</Text>
        <Text style={styles.paragraph}>
          Any waiver by WagerProof of any term or condition set out in these Terms of Service must be in writing and signed by an authorized representative of the Company to be effective. If any provision of these Terms of Service is held by a court or other tribunal of competent jurisdiction to be invalid, illegal, or unenforceable, such provision shall be reformed to the minimum extent necessary to make it valid and enforceable while preserving its intent.
        </Text>

        <Text style={styles.sectionTitle}>16. Changes to These Terms of Service</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify or replace these Terms of Service at any time at our sole discretion. If a revision is material, we will provide at least thirty (30) days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
        </Text>

        <Text style={styles.sectionTitle}>17. Entire Agreement</Text>
        <Text style={styles.paragraph}>
          These Terms of Service, including the documents incorporated by reference herein, constitute the sole and entire agreement between you and WagerProof LLC regarding the Services and supersede all prior and contemporaneous understandings, agreements, representations, and warranties, both written and oral, regarding the Services.
        </Text>

        <Text style={styles.sectionTitle}>18. Contact Us</Text>
        <Text style={styles.paragraph}>
          Any notices or questions concerning these Terms of Service should be directed to: admin@wagerproof.bet
        </Text>
      </ScrollView>

      {/* Checkbox and Continue Button */}
      <View style={styles.bottomContainer}>
        <View style={styles.checkboxContainer}>
          <Checkbox
            value={isChecked}
            onValueChange={handleCheckboxChange}
            color={hasScrolledToBottom ? '#22c55e' : '#6b7280'}
            style={styles.checkbox}
          />
          <Text 
            style={[
              styles.checkboxLabel, 
              { opacity: hasScrolledToBottom ? 1 : 0.7 }
            ]}
          >
            I have read and agree to the Terms and Conditions
          </Text>
        </View>

        <Animated.View
          style={[
            styles.buttonWrapper,
            isChecked && {
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
            disabled={!isChecked}
            style={[
              styles.continueButton,
              isChecked && styles.buttonActive,
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

