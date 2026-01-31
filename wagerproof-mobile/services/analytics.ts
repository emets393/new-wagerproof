/**
 * Analytics Service for WagerProof Mobile
 *
 * Provides centralized tracking for onboarding, purchases, and app events.
 * Uses:
 * - Mixpanel for product analytics
 * - Facebook/Meta SDK for purchase attribution (fb_mobile_purchase events)
 */

import { Mixpanel } from 'mixpanel-react-native';
import { Platform } from 'react-native';
import { AppEventsLogger, Settings as FBSettings } from 'react-native-fbsdk-next';

// Mixpanel project token (same as web app)
const MIXPANEL_TOKEN = '1346df53bbd034722047aa8a96d5321e';

// Singleton instance
let mixpanelInstance: Mixpanel | null = null;
let isInitialized = false;
let isFacebookInitialized = false;

/**
 * Initialize Analytics SDKs (Mixpanel + Facebook)
 * Should be called once at app startup
 */
export const initializeAnalytics = async (): Promise<void> => {
  if (isInitialized) {
    console.log('📊 Analytics: Already initialized');
    return;
  }

  // Initialize Mixpanel
  try {
    mixpanelInstance = new Mixpanel(MIXPANEL_TOKEN, true);
    await mixpanelInstance.init();

    // Register super properties that apply to all events
    mixpanelInstance.registerSuperProperties({
      platform: Platform.OS,
      platform_version: Platform.Version,
      app_type: 'mobile',
    });

    isInitialized = true;
    console.log('📊 Analytics: Mixpanel initialized successfully');
  } catch (error) {
    console.error('📊 Analytics: Failed to initialize Mixpanel:', error);
  }

  // Initialize Facebook SDK
  try {
    // Enable auto-logging of app events
    FBSettings.setAutoLogAppEventsEnabled(true);
    FBSettings.setAdvertiserIDCollectionEnabled(true);
    isFacebookInitialized = true;
    console.log('📊 Analytics: Facebook SDK initialized successfully');
  } catch (error) {
    console.error('📊 Analytics: Failed to initialize Facebook SDK:', error);
  }
};

/**
 * Check if analytics is initialized
 */
export const isAnalyticsReady = (): boolean => isInitialized;

/**
 * Identify a user (call after login)
 */
export const identifyUser = async (
  userId: string,
  properties?: Record<string, any>
): Promise<void> => {
  if (!mixpanelInstance || !isInitialized) {
    console.warn('📊 Analytics: Not initialized, skipping identify');
    return;
  }

  try {
    mixpanelInstance.identify(userId);

    if (properties) {
      mixpanelInstance.getPeople().set(properties);
    }

    console.log('📊 Analytics: User identified:', userId);
  } catch (error) {
    console.error('📊 Analytics: Error identifying user:', error);
  }
};

/**
 * Set user properties (people profile)
 */
export const setUserProperties = (properties: Record<string, any>): void => {
  if (!mixpanelInstance || !isInitialized) {
    console.warn('📊 Analytics: Not initialized, skipping user properties');
    return;
  }

  try {
    mixpanelInstance.getPeople().set(properties);
    console.log('📊 Analytics: User properties set:', Object.keys(properties));
  } catch (error) {
    console.error('📊 Analytics: Error setting user properties:', error);
  }
};

/**
 * Set user properties only once (won't overwrite)
 */
export const setUserPropertiesOnce = (properties: Record<string, any>): void => {
  if (!mixpanelInstance || !isInitialized) {
    console.warn('📊 Analytics: Not initialized, skipping user properties once');
    return;
  }

  try {
    mixpanelInstance.getPeople().setOnce(properties);
    console.log('📊 Analytics: User properties set once:', Object.keys(properties));
  } catch (error) {
    console.error('📊 Analytics: Error setting user properties once:', error);
  }
};

/**
 * Track a custom event
 */
export const trackEvent = (
  eventName: string,
  properties?: Record<string, any>
): void => {
  if (!mixpanelInstance || !isInitialized) {
    console.warn(`📊 Analytics: Not initialized, skipping event: ${eventName}`);
    return;
  }

  try {
    mixpanelInstance.track(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Analytics: Event tracked:', eventName);
  } catch (error) {
    console.error('📊 Analytics: Error tracking event:', error);
  }
};

/**
 * Increment a numeric user property
 */
export const incrementUserProperty = (property: string, value: number = 1): void => {
  if (!mixpanelInstance || !isInitialized) {
    console.warn('📊 Analytics: Not initialized, skipping increment');
    return;
  }

  try {
    mixpanelInstance.getPeople().increment(property, value);
    console.log(`📊 Analytics: Incremented ${property} by ${value}`);
  } catch (error) {
    console.error('📊 Analytics: Error incrementing property:', error);
  }
};

/**
 * Reset tracking (call on logout)
 */
export const resetAnalytics = (): void => {
  if (!mixpanelInstance || !isInitialized) {
    console.warn('📊 Analytics: Not initialized, skipping reset');
    return;
  }

  try {
    mixpanelInstance.reset();
    console.log('📊 Analytics: Tracking reset');
  } catch (error) {
    console.error('📊 Analytics: Error resetting:', error);
  }
};

/**
 * Flush events immediately (call after important events)
 */
export const flushAnalytics = (): void => {
  if (!mixpanelInstance || !isInitialized) {
    return;
  }

  try {
    mixpanelInstance.flush();
    console.log('📊 Analytics: Events flushed');
  } catch (error) {
    console.error('📊 Analytics: Error flushing:', error);
  }
};

// ===== Specific Event Tracking Functions =====

/**
 * Track user sign up
 */
export const trackSignUp = (authMethod: 'email' | 'google' | 'apple'): void => {
  trackEvent('User Signed Up', {
    auth_method: authMethod,
  });
};

/**
 * Track user sign in
 */
export const trackSignIn = (authMethod: 'email' | 'google' | 'apple'): void => {
  trackEvent('User Signed In', {
    auth_method: authMethod,
  });
};

/**
 * Track user sign out
 */
export const trackSignOut = (): void => {
  trackEvent('User Signed Out');
  resetAnalytics();
};

// ===== Facebook/Meta Event Tracking =====

/**
 * Track Facebook CompleteRegistration event
 * Called when user completes onboarding
 */
const trackFacebookCompleteRegistration = (registrationMethod: string): void => {
  if (!isFacebookInitialized) {
    console.log('📊 Analytics: Facebook SDK not initialized, skipping CompleteRegistration');
    return;
  }

  try {
    AppEventsLogger.logEvent('fb_mobile_complete_registration', {
      fb_registration_method: registrationMethod,
      fb_content_name: 'WagerProof Onboarding',
      fb_success: '1',
    });
    console.log('📊 Analytics: Facebook CompleteRegistration event logged');
  } catch (error) {
    console.error('📊 Analytics: Error logging Facebook CompleteRegistration:', error);
  }
};

/**
 * Track Facebook Purchase event (fb_mobile_purchase)
 * This is the KEY event for Facebook ad attribution
 */
const trackFacebookPurchase = (
  price: number,
  currency: string,
  contentId: string,
  predictedLtv: number,
  transactionId?: string
): void => {
  if (!isFacebookInitialized) {
    console.log('📊 Analytics: Facebook SDK not initialized, skipping Purchase');
    return;
  }

  try {
    AppEventsLogger.logPurchase(price, currency, {
      fb_content_type: 'product',
      fb_content_id: contentId,
      fb_order_id: transactionId || 'unknown',
      fb_predicted_ltv: predictedLtv.toString(),
      fb_success: '1',
      fb_payment_info_available: '1',
    });
    console.log('📊 Analytics: Facebook Purchase event logged:', { price, currency, contentId });
  } catch (error) {
    console.error('📊 Analytics: Error logging Facebook Purchase:', error);
  }
};

/**
 * Track Facebook Subscribe event
 * Alternative event for subscription-specific tracking
 */
const trackFacebookSubscribe = (
  price: number,
  currency: string,
  subscriptionType: string
): void => {
  if (!isFacebookInitialized) {
    console.log('📊 Analytics: Facebook SDK not initialized, skipping Subscribe');
    return;
  }

  try {
    AppEventsLogger.logEvent('Subscribe', price, {
      fb_currency: currency,
      fb_content_type: 'subscription',
      fb_content_id: `${subscriptionType}_subscription`,
    });
    console.log('📊 Analytics: Facebook Subscribe event logged:', { price, subscriptionType });
  } catch (error) {
    console.error('📊 Analytics: Error logging Facebook Subscribe:', error);
  }
};

// ===== Onboarding Events =====

const ONBOARDING_STEP_NAMES: Record<number, string> = {
  1: 'PersonalizationIntro',
  2: 'TermsAcceptance',
  3: 'SportsSelection',
  4: 'AgeConfirmation',
  5: 'BettorType',
  6: 'PrimaryGoal',
  7: 'Methodology',
  8: 'FeatureSpotlight',
  9: 'CompetitorComparison',
  10: 'EmailOptIn',
  11: 'SocialProof',
  12: 'DiscordCommunity',
  13: 'ValueClaim',
  14: 'AcquisitionSource',
  15: 'DataTransparency',
};

/**
 * Track onboarding started
 */
export const trackOnboardingStarted = (): void => {
  trackEvent('Onboarding Started', {
    start_time: new Date().toISOString(),
  });

  setUserPropertiesOnce({
    onboarding_started_at: new Date().toISOString(),
  });
};

/**
 * Track onboarding step viewed
 */
export const trackOnboardingStepViewed = (
  stepNumber: number,
  totalSteps: number = 15
): void => {
  const stepName = ONBOARDING_STEP_NAMES[stepNumber] || `Step${stepNumber}`;

  trackEvent('Onboarding Step Viewed', {
    step_number: stepNumber,
    step_name: stepName,
    total_steps: totalSteps,
    progress_percentage: Math.round((stepNumber / totalSteps) * 100),
  });
};

/**
 * Track onboarding step completed
 */
export const trackOnboardingStepCompleted = (
  stepNumber: number,
  additionalData?: Record<string, any>,
  totalSteps: number = 15
): void => {
  const stepName = ONBOARDING_STEP_NAMES[stepNumber] || `Step${stepNumber}`;

  trackEvent('Onboarding Step Completed', {
    step_number: stepNumber,
    step_name: stepName,
    total_steps: totalSteps,
    progress_percentage: Math.round((stepNumber / totalSteps) * 100),
    ...additionalData,
  });

  // Update user profile with highest completed step
  setUserProperties({
    onboarding_last_step: stepNumber,
    onboarding_last_step_name: stepName,
  });
};

/**
 * Track onboarding completed
 * Sends events to both Mixpanel and Facebook
 */
export const trackOnboardingCompleted = (onboardingData?: {
  favoriteSports?: string[];
  bettorType?: string;
  mainGoal?: string;
  acquisitionSource?: string;
}): void => {
  // Mixpanel event
  trackEvent('Onboarding Completed', {
    completion_time: new Date().toISOString(),
    steps_completed: 15,
    favorite_sports: onboardingData?.favoriteSports?.join(', ') || 'none',
    bettor_type: onboardingData?.bettorType || 'unknown',
    main_goal: onboardingData?.mainGoal || 'unknown',
    acquisition_source: onboardingData?.acquisitionSource || 'unknown',
  });

  // Set user properties
  setUserProperties({
    onboarding_completed: true,
    onboarding_completion_date: new Date().toISOString(),
    favorite_sports: onboardingData?.favoriteSports || [],
    bettor_type: onboardingData?.bettorType || 'unknown',
    main_goal: onboardingData?.mainGoal || 'unknown',
    acquisition_source: onboardingData?.acquisitionSource || 'unknown',
  });

  // Facebook CompleteRegistration event
  trackFacebookCompleteRegistration('onboarding');

  // Flush immediately for important event
  flushAnalytics();
};

/**
 * Track onboarding skipped/abandoned
 */
export const trackOnboardingAbandoned = (lastStep: number): void => {
  const stepName = ONBOARDING_STEP_NAMES[lastStep] || `Step${lastStep}`;

  trackEvent('Onboarding Abandoned', {
    last_step: lastStep,
    last_step_name: stepName,
    progress_percentage: Math.round((lastStep / 15) * 100),
  });
};

// ===== Purchase/Subscription Events =====

export type SubscriptionType = 'monthly' | 'yearly' | 'lifetime';

/**
 * Track paywall viewed
 */
export const trackPaywallViewed = (source: string): void => {
  trackEvent('Paywall Viewed', {
    source,
  });

  incrementUserProperty('paywall_views');
};

/**
 * Track subscription started (purchase initiated)
 */
export const trackSubscriptionStarted = (
  subscriptionType: SubscriptionType,
  price: number,
  currency: string = 'USD'
): void => {
  trackEvent('Subscription Started', {
    subscription_type: subscriptionType,
    price,
    currency,
  });
};

/**
 * Track subscription purchased (successful purchase)
 * Sends events to both Mixpanel and Facebook for attribution
 */
export const trackSubscriptionPurchased = (
  subscriptionType: SubscriptionType,
  price: number,
  currency: string = 'USD',
  transactionId?: string,
  isPromo: boolean = false,
  isTrial: boolean = false
): void => {
  // Calculate predicted LTV based on subscription type
  let predictedLtv: number;
  if (subscriptionType === 'monthly') {
    predictedLtv = price * 4; // 4 month average retention
  } else if (subscriptionType === 'yearly') {
    predictedLtv = price * 1.3; // 30% renewal rate
  } else {
    predictedLtv = price; // Lifetime
  }

  const contentId = isPromo
    ? `${subscriptionType}_promo_subscription`
    : `${subscriptionType}_subscription`;

  // Mixpanel event
  trackEvent('Subscription Purchased', {
    subscription_type: subscriptionType,
    price,
    currency,
    transaction_id: transactionId || 'unknown',
    content_id: contentId,
    predicted_ltv: predictedLtv,
    is_promo: isPromo,
    is_trial: isTrial,
  });

  // Set user properties
  setUserProperties({
    subscription_type: subscriptionType,
    subscription_purchase_date: new Date().toISOString(),
    is_subscriber: true,
    lifetime_value: price,
  });

  // Track revenue in Mixpanel
  mixpanelInstance?.getPeople().trackCharge(price, {
    subscription_type: subscriptionType,
  });

  // ===== Facebook/Meta Events =====
  // fb_mobile_purchase - KEY event for ad attribution
  trackFacebookPurchase(price, currency, contentId, predictedLtv, transactionId);

  // Also log Subscribe event for additional tracking
  trackFacebookSubscribe(price, currency, subscriptionType);

  // Flush immediately - critical for attribution
  flushAnalytics();
};

/**
 * Track subscription restored
 */
export const trackSubscriptionRestored = (subscriptionType: SubscriptionType): void => {
  trackEvent('Subscription Restored', {
    subscription_type: subscriptionType,
  });

  setUserProperties({
    subscription_type: subscriptionType,
    is_subscriber: true,
  });
};

/**
 * Track purchase failed
 */
export const trackPurchaseFailed = (
  subscriptionType: SubscriptionType,
  error: string
): void => {
  trackEvent('Purchase Failed', {
    subscription_type: subscriptionType,
    error_message: error,
  });
};

/**
 * Track purchase cancelled
 */
export const trackPurchaseCancelled = (subscriptionType: SubscriptionType): void => {
  trackEvent('Purchase Cancelled', {
    subscription_type: subscriptionType,
  });
};

// ===== App Usage Events =====

/**
 * Track app opened
 */
export const trackAppOpened = (): void => {
  trackEvent('App Opened');
  incrementUserProperty('app_opens');
};

/**
 * Track screen viewed
 */
export const trackScreenViewed = (screenName: string): void => {
  trackEvent('Screen Viewed', {
    screen_name: screenName,
  });
};

/**
 * Track feature used
 */
export const trackFeatureUsed = (
  featureName: string,
  properties?: Record<string, any>
): void => {
  trackEvent('Feature Used', {
    feature_name: featureName,
    ...properties,
  });
};

/**
 * Track game card opened
 */
export const trackGameCardOpened = (
  sport: 'NFL' | 'CFB' | 'NBA' | 'NCAAB',
  homeTeam: string,
  awayTeam: string,
  gameId: string
): void => {
  trackEvent('Game Card Opened', {
    sport,
    home_team: homeTeam,
    away_team: awayTeam,
    game_id: gameId,
  });

  incrementUserProperty('games_viewed');
};

/**
 * Track WagerBot chat interaction
 */
export const trackWagerBotMessage = (messageLength: number): void => {
  trackEvent('WagerBot Message Sent', {
    message_length: messageLength,
  });

  incrementUserProperty('wagerbot_messages_sent');
};
