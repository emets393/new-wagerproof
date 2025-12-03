import React, { useState, createContext, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { useTheme, ActivityIndicator, Switch } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Button } from '../../ui/Button';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useRevenueCat } from '../../../contexts/RevenueCatContext';

const { width: screenWidth } = Dimensions.get('window');

// Context to share state between Paywall content and BottomCTA
const PaywallContext = createContext<{
  isSubmitting: boolean;
  freeTrialEnabled: boolean;
  handleContinue: () => void;
  selectedPlan: 'yearly' | 'monthly';
  setSelectedPlan: (plan: 'yearly' | 'monthly') => void;
  setFreeTrialEnabled: (enabled: boolean) => void;
  monthlyPrice: string;
  yearlyPrice: string;
  yearlyMonthlyPrice: string;
  rcLoading: boolean;
} | null>(null);

const features = [
  { icon: 'lightbulb-on', title: 'Data-Driven Insights', description: 'Advanced analytics for smarter betting' },
  { icon: 'trending-up', title: 'Trend Analysis', description: 'Historical patterns & winning strategies' },
  { icon: 'account-group', title: 'Expert Community', description: 'Join thousands of winning bettors' },
  { icon: 'shield-check', title: 'Transparent Results', description: 'Track model accuracy in real-time' },
  { icon: 'robot', title: 'WagerBot AI', description: 'AI-powered betting assistant' },
  { icon: 'bell-ring', title: 'Smart Alerts', description: 'Get notified of profitable opportunities' },
];

const lovedByCategories = [
  { icon: 'football', label: 'NFL Bettors', emoji: '🏈' },
  { icon: 'basketball', label: 'NBA Fans', emoji: '🏀' },
  { icon: 'football', label: 'CFB Bettors', emoji: '🎓' },
  { icon: 'chart-line', label: 'Data Analysts', emoji: '📊' },
  { icon: 'trophy', label: 'Pro Bettors', emoji: '🏆' },
  { icon: 'brain', label: 'Strategists', emoji: '🧠' },
];

const testimonial = {
  title: "Game-Changer for Serious Bettors!",
  body: "WagerProof's ML predictions have transformed my betting. The real-time analytics and transparent tracking give me confidence in every bet. Finally, a platform built by data scientists who understand sports!",
  stars: 5,
};

// Shared state hook for Paywall and CTA
function usePaywallState() {
  const { submitOnboardingData } = useOnboarding();
  const router = useRouter();
  const { packages, refreshOfferings, isLoading: rcLoading } = useRevenueCat();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [freeTrialEnabled, setFreeTrialEnabled] = useState(true);
  const [monthlyPrice, setMonthlyPrice] = useState<string>('$19.99');
  const [yearlyPrice, setYearlyPrice] = useState<string>('$99');
  const [yearlyMonthlyPrice, setYearlyMonthlyPrice] = useState<string>('$8.25');

  // Load pricing from RevenueCat
  useEffect(() => {
    refreshOfferings();
  }, []);

  useEffect(() => {
    if (packages && packages.length > 0) {
      console.log('📦 All available packages:', packages.map(pkg => ({
        identifier: pkg.identifier,
        productId: pkg.product?.identifier,
        price: pkg.product?.priceString,
      })));

      // Find regular (non-discount) monthly package
      // Prioritize packages WITHOUT 'discount' in identifier
      const monthlyPkg = packages.find(pkg => 
        !pkg.identifier.toLowerCase().includes('discount') &&
        (pkg.identifier === '$rc_monthly' ||
         pkg.identifier.toLowerCase().includes('monthly') ||
         pkg.product.identifier.toLowerCase().includes('monthly'))
      ) || packages.find(pkg => 
        pkg.identifier.toLowerCase().includes('monthly') ||
        pkg.product.identifier.toLowerCase().includes('monthly')
      );

      // Find regular (non-discount) yearly package
      // Prioritize packages WITHOUT 'discount' in identifier
      // Also prioritize $rc_annual over other annual packages
      const yearlyPkg = packages.find(pkg => 
        !pkg.identifier.toLowerCase().includes('discount') &&
        (pkg.identifier === '$rc_annual' ||
         pkg.identifier.toLowerCase().includes('annual') ||
         pkg.identifier.toLowerCase().includes('yearly') ||
         pkg.product.identifier.toLowerCase().includes('annual') ||
         pkg.product.identifier.toLowerCase().includes('yearly'))
      ) || packages.find(pkg => 
        pkg.identifier.toLowerCase().includes('annual') ||
        pkg.identifier.toLowerCase().includes('yearly') ||
        pkg.product.identifier.toLowerCase().includes('annual') ||
        pkg.product.identifier.toLowerCase().includes('yearly')
      );

      console.log('📌 Selected packages:', {
        monthly: monthlyPkg ? {
          identifier: monthlyPkg.identifier,
          price: monthlyPkg.product?.priceString
        } : null,
        yearly: yearlyPkg ? {
          identifier: yearlyPkg.identifier,
          price: yearlyPkg.product?.priceString
        } : null
      });

      if (monthlyPkg?.product?.priceString) {
        setMonthlyPrice(monthlyPkg.product.priceString);
      }
      if (yearlyPkg?.product?.priceString) {
        setYearlyPrice(yearlyPkg.product.priceString);
        // Calculate monthly equivalent
        const yearlyAmount = yearlyPkg.product.price;
        const monthlyEquivalent = (yearlyAmount / 12).toFixed(2);
        setYearlyMonthlyPrice(`$${monthlyEquivalent}`);
      }
    }
  }, [packages]);

  const handleContinue = async () => {
    if (isSubmitting) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSubmitting(true);
    try {
      console.log('Starting onboarding completion...');
      await submitOnboardingData();
      console.log('Onboarding data submitted successfully!');
      
      setTimeout(() => {
        console.log('Navigating to main app...');
        router.replace('/(tabs)');
      }, 300);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
      
      Alert.alert(
        'Oops!',
        'There was an issue completing your onboarding. Please try again.',
        [
          {
            text: 'Retry',
            onPress: handleContinue,
          },
          {
            text: 'Skip for now',
            onPress: () => router.replace('/(tabs)'),
            style: 'cancel',
          },
        ]
      );
    }
  };

  return {
    isSubmitting,
    selectedPlan,
    setSelectedPlan,
    freeTrialEnabled,
    setFreeTrialEnabled,
    handleContinue,
    monthlyPrice,
    yearlyPrice,
    yearlyMonthlyPrice,
    rcLoading,
  };
}

// Context Provider Component
export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const state = usePaywallState();
  
  return (
    <PaywallContext.Provider value={{ 
      isSubmitting: state.isSubmitting, 
      freeTrialEnabled: state.freeTrialEnabled, 
      handleContinue: state.handleContinue,
      selectedPlan: state.selectedPlan,
      setSelectedPlan: state.setSelectedPlan,
      setFreeTrialEnabled: state.setFreeTrialEnabled,
      monthlyPrice: state.monthlyPrice,
      yearlyPrice: state.yearlyPrice,
      yearlyMonthlyPrice: state.yearlyMonthlyPrice,
      rcLoading: state.rcLoading,
    }}>
      {children}
    </PaywallContext.Provider>
  );
}

// Bottom CTA Component - to be rendered outside ScrollView
export function PaywallBottomCTA() {
  const context = useContext(PaywallContext);
  if (!context) return null;
  
  const { isSubmitting, handleContinue, selectedPlan } = context;

  return (
    <View style={styles.fixedBottomContainer} pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.85)', 'rgba(0, 0, 0, 0.98)', '#000000']}
        style={styles.bottomGradient}
        pointerEvents="auto"
      >
        <View style={styles.bottomContent}>
          <View style={styles.noPaymentRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.noPaymentText}>Cancel Anytime</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.ctaButton, isSubmitting && styles.ctaButtonDisabled]}
            onPress={handleContinue}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.ctaButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
          
          <Text style={styles.billingText}>
            {selectedPlan === 'yearly' 
              ? `${context.yearlyMonthlyPrice} per month – Billed yearly` 
              : `${context.monthlyPrice} per month`}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export function PaywallContent() {
  const context = useContext(PaywallContext);
  if (!context) return null;
  
  const { selectedPlan, setSelectedPlan, freeTrialEnabled, setFreeTrialEnabled, monthlyPrice, yearlyPrice, rcLoading } = context;

  return (
    <View style={styles.contentWrapper}>
        {/* Top spacer for system UI */}
        <View style={styles.topSpacer} />
        
        {/* App Branding */}
        <View style={styles.header}>
          <View style={styles.brandContainer}>
            <Text style={styles.brandName}>WagerProof</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proText}>PRO</Text>
            </View>
          </View>
        </View>

        {/* Pricing Cards */}
        <View style={styles.pricingSection}>
          {/* Yearly Plan */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setSelectedPlan('yearly')}
          >
            <View style={[
              styles.pricingCard,
              selectedPlan === 'yearly' && styles.pricingCardSelected,
              selectedPlan !== 'yearly' && styles.pricingCardInactive
            ]}>
              <View style={styles.pricingHeader}>
                <View>
                  <Text style={[
                    styles.planName,
                    selectedPlan !== 'yearly' && styles.inactiveText
                  ]}>Yearly</Text>
                  {rcLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View>
                      <Text style={[
                        styles.planPrice,
                        selectedPlan !== 'yearly' && styles.inactiveText
                      ]}>{context.yearlyMonthlyPrice} /month</Text>
                      <Text style={[
                        styles.planSubPrice,
                        selectedPlan !== 'yearly' && styles.inactiveText
                      ]}>Billed yearly ({yearlyPrice})</Text>
                    </View>
                  )}
                </View>
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>BEST VALUE</Text>
                </View>
              </View>
              
            
            </View>
          </TouchableOpacity>

          {/* Monthly Plan */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setSelectedPlan('monthly')}
          >
            <View style={[
              styles.pricingCard,
              selectedPlan === 'monthly' && styles.pricingCardSelected,
              selectedPlan !== 'monthly' && styles.pricingCardInactive
            ]}>
              <View style={styles.pricingHeader}>
                <View>
                  <Text style={[
                    styles.planName,
                    selectedPlan !== 'monthly' && styles.inactiveText
                  ]}>Monthly</Text>
                  {rcLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[
                      styles.planPrice,
                      selectedPlan !== 'monthly' && styles.inactiveText
                    ]}>{monthlyPrice} /month</Text>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Award Section 1 - App of the Day */}
        <View style={styles.awardSection}>
          <View style={styles.laurelLeft}>
            <Text style={styles.laurel}>🏆</Text>
          </View>
          <View style={styles.awardContent}>
            <Text style={styles.awardTitle}>FEATURED APP</Text>
            <Text style={styles.awardSubtitle}>BY SPORTS BETTORS</Text>
          </View>
          <View style={styles.laurelRight}>
            <Text style={styles.laurel}>🏆</Text>
          </View>
        </View>

        {/* Loved By Section */}
        <View style={styles.lovedBySection}>
          <Text style={styles.sectionTitle}>LOVED BY</Text>
          <View style={styles.categoriesGrid}>
            {lovedByCategories.map((cat, index) => (
              <View key={index} style={styles.categoryPill}>
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Rating Section */}
        <View style={styles.awardSection}>
          <View style={styles.laurelLeft}>
            <Text style={styles.laurel}>🌟</Text>
          </View>
          <View style={styles.ratingContent}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={styles.starIcon}>⭐</Text>
              ))}
            </View>
            <Text style={styles.ratingText}>4.9 STARS FROM USERS</Text>
          </View>
          <View style={styles.laurelRight}>
            <Text style={styles.laurel}>🌟</Text>
          </View>
        </View>

        {/* Testimonial */}
        <View style={styles.testimonialCard}>
          <Text style={styles.testimonialTitle}>{testimonial.title}</Text>
          <View style={styles.testimonialStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text key={star} style={styles.testimonialStar}>⭐</Text>
            ))}
          </View>
          <Text style={styles.testimonialBody}>{testimonial.body}</Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresSection}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIconContainer}>
                <MaterialCommunityIcons 
                  name={feature.icon as any} 
                  size={24} 
                  color="#22c55e" 
                />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Spacer for bottom gradient */}
        <View style={{ height: 240 }} />
      </View>
  );
}

// Main Paywall component - just renders content (Provider is in parent)
export function Paywall() {
  return <PaywallContent />;
}

// Attach components as properties for easy access
Paywall.BottomCTA = PaywallBottomCTA;
Paywall.Provider = PaywallProvider;

const styles = StyleSheet.create({
  contentWrapper: {
    paddingTop: 0,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  topSpacer: {
    height: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  proBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  proText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  
  // Pricing Section
  pricingSection: {
    gap: 12,
    marginBottom: 32,
  },
  pricingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  pricingCardSelected: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 2,
  },
  pricingCardInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  planSubPrice: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  inactiveText: {
    opacity: 0.5,
  },
  bestValueBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  bestValueText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  freeTrialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  freeTrialText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Award Sections
  awardSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  laurelLeft: {
    marginRight: 12,
  },
  laurelRight: {
    marginLeft: 12,
  },
  laurel: {
    fontSize: 32,
  },
  awardContent: {
    alignItems: 'center',
  },
  awardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
    textAlign: 'center',
  },
  awardSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
    marginTop: 4,
  },
  ratingContent: {
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  starIcon: {
    fontSize: 24,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  
  // Loved By Section
  lovedBySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Testimonial
  testimonialCard: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  testimonialTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  testimonialStars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  testimonialStar: {
    fontSize: 16,
  },
  testimonialBody: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  
  // Features Section
  featuresSection: {
    gap: 16,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
  },
  
  // Bottom Gradient & CTA
  fixedBottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  bottomGradient: {
    paddingTop: 80,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  bottomContent: {
    alignItems: 'center',
  },
  noPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  noPaymentText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  ctaButton: {
    backgroundColor: '#fff',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  billingText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 12,
  },
  seeAllPlans: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
