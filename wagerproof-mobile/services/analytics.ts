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

// In React Native, console.log crosses the JS-native bridge and blocks the thread.
// Only log in development to avoid jank in production.
const analyticsLog = __DEV__ ? console.log : () => {};
const analyticsWarn = __DEV__ ? console.warn : () => {};

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
    analyticsLog('📊 Analytics: Already initialized');
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
    analyticsLog('📊 Analytics: Mixpanel initialized successfully');
  } catch (error) {
    console.error('📊 Analytics: Failed to initialize Mixpanel:', error);
  }

  // Initialize Facebook SDK
  try {
    // Disable auto-logging of app events — it logs every tap/gesture through
    // the RN bridge, causing jank during interaction-heavy flows like onboarding.
    // We track key events (purchases, registration) explicitly instead.
    FBSettings.setAutoLogAppEventsEnabled(false);
    FBSettings.setAdvertiserIDCollectionEnabled(true);
    isFacebookInitialized = true;
    analyticsLog('📊 Analytics: Facebook SDK initialized successfully');
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
    analyticsWarn('📊 Analytics: Not initialized, skipping identify');
    return;
  }

  try {
    mixpanelInstance.identify(userId);

    if (properties) {
      mixpanelInstance.getPeople().set(properties);
    }

    analyticsLog('📊 Analytics: User identified:', userId);
  } catch (error) {
    console.error('📊 Analytics: Error identifying user:', error);
  }
};

/**
 * Set user properties (people profile)
 */
export const setUserProperties = (properties: Record<string, any>): void => {
  if (!mixpanelInstance || !isInitialized) return;

  setTimeout(() => {
    try {
      mixpanelInstance!.getPeople().set(properties);
    } catch (error) {
      console.error('📊 Analytics: Error setting user properties:', error);
    }
  }, 0);
};

/**
 * Set user properties only once (won't overwrite)
 */
export const setUserPropertiesOnce = (properties: Record<string, any>): void => {
  if (!mixpanelInstance || !isInitialized) return;

  setTimeout(() => {
    try {
      mixpanelInstance!.getPeople().setOnce(properties);
    } catch (error) {
      console.error('📊 Analytics: Error setting user properties once:', error);
    }
  }, 0);
};

/**
 * Track a custom event
 */
export const trackEvent = (
  eventName: string,
  properties?: Record<string, any>
): void => {
  if (!mixpanelInstance || !isInitialized) return;

  // Defer the Mixpanel bridge call to the next tick so it never blocks
  // the current JS frame (tap handler, animation, etc.).
  setTimeout(() => {
    try {
      mixpanelInstance!.track(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('📊 Analytics: Error tracking event:', error);
    }
  }, 0);
};

/**
 * Increment a numeric user property
 */
export const incrementUserProperty = (property: string, value: number = 1): void => {
  if (!mixpanelInstance || !isInitialized) return;

  setTimeout(() => {
    try {
      mixpanelInstance!.getPeople().increment(property, value);
    } catch (error) {
      console.error('📊 Analytics: Error incrementing property:', error);
    }
  }, 0);
};

/**
 * Reset tracking (call on logout)
 */
export const resetAnalytics = (): void => {
  if (!mixpanelInstance || !isInitialized) {
    analyticsWarn('📊 Analytics: Not initialized, skipping reset');
    return;
  }

  try {
    mixpanelInstance.reset();
    analyticsLog('📊 Analytics: Tracking reset');
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
    analyticsLog('📊 Analytics: Events flushed');
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
    analyticsLog('📊 Analytics: Facebook SDK not initialized, skipping CompleteRegistration');
    return;
  }

  try {
    AppEventsLogger.logEvent('fb_mobile_complete_registration', {
      fb_registration_method: registrationMethod,
      fb_content_name: 'WagerProof Onboarding',
      fb_success: '1',
    });
    analyticsLog('📊 Analytics: Facebook CompleteRegistration event logged');
  } catch (error) {
    console.error('📊 Analytics: Error logging Facebook CompleteRegistration:', error);
  }
};

/**
 * Track Facebook Purchase event (fb_mobile_purchase)
 * This is the KEY event for Facebook ad attribution
 */
const trackFacebookPurchase = async (
  price: number,
  currency: string,
  contentId: string,
  predictedLtv: number,
  transactionId?: string
): Promise<void> => {
  if (!isFacebookInitialized) {
    analyticsLog('📊 Analytics: Facebook SDK not initialized, skipping Purchase');
    return;
  }

  try {
    await AppEventsLogger.logPurchase(price, currency, {
      fb_content_type: 'product',
      fb_content_id: contentId,
      fb_order_id: transactionId || 'unknown',
      fb_predicted_ltv: predictedLtv.toString(),
      fb_success: '1',
      fb_payment_info_available: '1',
    });
    await AppEventsLogger.flush();
    analyticsLog('📊 Analytics: Facebook Purchase event logged:', { price, currency, contentId });
  } catch (error) {
    console.error('📊 Analytics: Error logging Facebook Purchase:', error);
  }
};

// ===== Onboarding Events =====

export const ONBOARDING_TOTAL_STEPS = 21;

const ONBOARDING_STEP_NAMES: Record<number, string> = {
  1: 'PersonalizationIntro',
  2: 'TermsAcceptance',
  3: 'SportsSelection',
  4: 'AgeConfirmation',
  5: 'BettorType',
  6: 'AcquisitionSource',
  7: 'PrimaryGoal',
  8: 'ValueClaim',
  9: 'FeatureSpotlight',
  10: 'DataTransparency',
  11: 'AgentValueAlwaysOn',
  12: 'AgentValueAssistant',
  13: 'AgentValueStrategies',
  14: 'AgentValueLeaderboard',
  15: 'AgentBuilderSportArchetype',
  16: 'AgentBuilderIdentity',
  17: 'AgentBuilderPersonality',
  18: 'AgentBuilderDataConditions',
  19: 'AgentBuilderCustomInsights',
  20: 'AgentGeneration',
  21: 'AgentBorn',
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
  totalSteps: number = ONBOARDING_TOTAL_STEPS
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
// Track the highest step seen so far; the people-profile update is deferred
// to the final trackOnboardingCompleted() call to avoid 2 extra network/bridge
// round-trips on every single step tap.
let _highestCompletedStep = 0;

export const trackOnboardingStepCompleted = (
  stepNumber: number,
  additionalData?: Record<string, any>,
  totalSteps: number = ONBOARDING_TOTAL_STEPS
): void => {
  const stepName = ONBOARDING_STEP_NAMES[stepNumber] || `Step${stepNumber}`;

  trackEvent('Onboarding Step Completed', {
    step_number: stepNumber,
    step_name: stepName,
    total_steps: totalSteps,
    progress_percentage: Math.round((stepNumber / totalSteps) * 100),
    ...additionalData,
  });

  // Track locally — bulk-update the people profile at onboarding completion
  if (stepNumber > _highestCompletedStep) {
    _highestCompletedStep = stepNumber;
  }
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
    steps_completed: ONBOARDING_TOTAL_STEPS,
    favorite_sports: onboardingData?.favoriteSports?.join(', ') || 'none',
    bettor_type: onboardingData?.bettorType || 'unknown',
    main_goal: onboardingData?.mainGoal || 'unknown',
    acquisition_source: onboardingData?.acquisitionSource || 'unknown',
  });

  // Set user properties (includes deferred step tracking from step-by-step events)
  const stepName = ONBOARDING_STEP_NAMES[_highestCompletedStep] || `Step${_highestCompletedStep}`;
  setUserProperties({
    onboarding_completed: true,
    onboarding_completion_date: new Date().toISOString(),
    onboarding_last_step: _highestCompletedStep,
    onboarding_last_step_name: stepName,
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
    progress_percentage: Math.round((lastStep / ONBOARDING_TOTAL_STEPS) * 100),
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

export const trackPaywallDismissed = (source: string, result: string): void => {
  trackEvent('Paywall Dismissed', {
    source,
    result,
  });
};

export const trackTrialStarted = (
  subscriptionType: SubscriptionType,
  source: string,
  price?: number,
  currency: string = 'USD'
): void => {
  trackEvent('Trial Started', {
    subscription_type: subscriptionType,
    source,
    price,
    currency,
  });
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
 * Sends Mixpanel analytics plus the Meta purchase event for attribution
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
  void trackFacebookPurchase(price, currency, contentId, predictedLtv, transactionId);

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

// ===== Meta SDK Debug/Test Functions =====

/**
 * Response structure for test Meta events
 */
export interface MetaTestEventResponse {
  timestamp: string;
  eventName: string;
  isTestEvent: boolean;
  services: {
    meta: {
      success: boolean;
      message: string;
      sentPayload: Record<string, any>;
      error?: string;
    };
    mixpanel: {
      success: boolean;
      message: string;
      sentPayload: Record<string, any>;
      error?: string;
    };
  };
}

/**
 * Check if Facebook SDK is initialized and ready
 */
export const isFacebookSDKReady = (): boolean => {
  return isFacebookInitialized;
};

/**
 * Check if Mixpanel is initialized and ready
 */
export const isMixpanelReady = (): boolean => {
  return isInitialized && mixpanelInstance !== null;
};

/**
 * Flush Facebook events immediately
 * Forces queued events to be sent to Meta servers
 */
export const flushFacebookEvents = async (): Promise<{ success: boolean; message: string }> => {
  if (!isFacebookInitialized) {
    return {
      success: false,
      message: 'Facebook SDK not initialized',
    };
  }

  try {
    // react-native-fbsdk-next uses AppEventsLogger.flush()
    await AppEventsLogger.flush();
    analyticsLog('📊 Analytics: Facebook events flushed');
    return {
      success: true,
      message: 'Events flushed successfully',
    };
  } catch (error: any) {
    console.error('📊 Analytics: Error flushing Facebook events:', error);
    return {
      success: false,
      message: error?.message || 'Failed to flush events',
    };
  }
};

/**
 * Flush all analytics (Mixpanel + Facebook)
 */
export const flushAllAnalytics = async (): Promise<{
  mixpanel: { success: boolean; message: string };
  facebook: { success: boolean; message: string };
}> => {
  // Flush Mixpanel
  let mixpanelResult = { success: false, message: 'Not initialized' };
  if (mixpanelInstance && isInitialized) {
    try {
      mixpanelInstance.flush();
      mixpanelResult = { success: true, message: 'Events flushed successfully' };
    } catch (error: any) {
      mixpanelResult = { success: false, message: error?.message || 'Failed to flush' };
    }
  }

  // Flush Facebook
  const facebookResult = await flushFacebookEvents();

  return {
    mixpanel: mixpanelResult,
    facebook: facebookResult,
  };
};

/**
 * Send a test Meta subscription (fb_mobile_purchase) event
 * Returns detailed response for debugging purposes
 */
export const sendTestMetaSubscriptionEvent = async (params: {
  subscriptionType: SubscriptionType;
  price: number;
  currency?: string;
  isPromo?: boolean;
  transactionId?: string;
}): Promise<MetaTestEventResponse> => {
  const {
    subscriptionType,
    price,
    currency = 'USD',
    isPromo = false,
    transactionId = `test_${Date.now()}`,
  } = params;

  const timestamp = new Date().toISOString();

  // Calculate predicted LTV
  let predictedLtv: number;
  if (subscriptionType === 'monthly') {
    predictedLtv = price * 4;
  } else if (subscriptionType === 'yearly') {
    predictedLtv = price * 1.3;
  } else {
    predictedLtv = price; // Lifetime
  }

  const contentId = isPromo
    ? `${subscriptionType}_promo_subscription`
    : `${subscriptionType}_subscription`;

  // Build the Meta payload
  const metaPayload = {
    _valueToSum: price,
    fb_currency: currency,
    fb_order_id: transactionId,
    fb_content_type: 'product',
    fb_content_id: contentId,
    fb_success: '1',
    fb_payment_info_available: '1',
    fb_predicted_ltv: predictedLtv.toString(),
    is_test_event: 'true',
  };

  // Build the Mixpanel payload
  const mixpanelPayload = {
    subscription_type: subscriptionType,
    price,
    currency,
    transaction_id: transactionId,
    content_id: contentId,
    predicted_ltv: predictedLtv,
    is_promo: isPromo,
    is_test_event: true,
    timestamp,
  };

  const response: MetaTestEventResponse = {
    timestamp,
    eventName: 'fb_mobile_purchase',
    isTestEvent: true,
    services: {
      meta: {
        success: false,
        message: 'Not sent',
        sentPayload: metaPayload,
      },
      mixpanel: {
        success: false,
        message: 'Not sent',
        sentPayload: mixpanelPayload,
      },
    },
  };

  // Send to Meta/Facebook
  if (isFacebookInitialized) {
    try {
      await AppEventsLogger.logPurchase(price, currency, metaPayload);
      await AppEventsLogger.flush();
      response.services.meta.success = true;
      response.services.meta.message = 'Event sent and flushed successfully';
      console.log('📊 Test Meta Purchase event sent:', metaPayload);
    } catch (error: any) {
      response.services.meta.success = false;
      response.services.meta.message = 'Failed to send event';
      response.services.meta.error = error?.message || 'Unknown error';
      console.error('📊 Error sending test Meta Purchase event:', error);
    }
  } else {
    response.services.meta.message = 'Facebook SDK not initialized';
  }

  // Send to Mixpanel
  if (mixpanelInstance && isInitialized) {
    try {
      mixpanelInstance.track('Test Subscription Purchased', mixpanelPayload);
      mixpanelInstance.flush();
      response.services.mixpanel.success = true;
      response.services.mixpanel.message = 'Event sent and flushed successfully';
      console.log('📊 Test Mixpanel Purchase event sent:', mixpanelPayload);
    } catch (error: any) {
      response.services.mixpanel.success = false;
      response.services.mixpanel.message = 'Failed to send event';
      response.services.mixpanel.error = error?.message || 'Unknown error';
      console.error('📊 Error sending test Mixpanel Purchase event:', error);
    }
  } else {
    response.services.mixpanel.message = 'Mixpanel not initialized';
  }

  return response;
};

/**
 * Send a test Meta CompleteRegistration event
 * Returns detailed response for debugging purposes
 */
export const sendTestMetaRegistrationEvent = async (params?: {
  registrationMethod?: string;
}): Promise<MetaTestEventResponse> => {
  const { registrationMethod = 'test_onboarding' } = params || {};

  const timestamp = new Date().toISOString();

  // Build the Meta payload
  const metaPayload = {
    fb_registration_method: registrationMethod,
    fb_content_name: 'WagerProof Onboarding (Test)',
    fb_success: '1',
    is_test_event: 'true',
  };

  // Build the Mixpanel payload
  const mixpanelPayload = {
    registration_method: registrationMethod,
    is_test_event: true,
    timestamp,
  };

  const response: MetaTestEventResponse = {
    timestamp,
    eventName: 'fb_mobile_complete_registration',
    isTestEvent: true,
    services: {
      meta: {
        success: false,
        message: 'Not sent',
        sentPayload: metaPayload,
      },
      mixpanel: {
        success: false,
        message: 'Not sent',
        sentPayload: mixpanelPayload,
      },
    },
  };

  // Send to Meta/Facebook
  if (isFacebookInitialized) {
    try {
      await AppEventsLogger.logEvent('fb_mobile_complete_registration', metaPayload);
      await AppEventsLogger.flush();
      response.services.meta.success = true;
      response.services.meta.message = 'Event sent and flushed successfully';
      console.log('📊 Test Meta CompleteRegistration event sent:', metaPayload);
    } catch (error: any) {
      response.services.meta.success = false;
      response.services.meta.message = 'Failed to send event';
      response.services.meta.error = error?.message || 'Unknown error';
      console.error('📊 Error sending test Meta CompleteRegistration event:', error);
    }
  } else {
    response.services.meta.message = 'Facebook SDK not initialized';
  }

  // Send to Mixpanel
  if (mixpanelInstance && isInitialized) {
    try {
      mixpanelInstance.track('Test Registration Completed', mixpanelPayload);
      mixpanelInstance.flush();
      response.services.mixpanel.success = true;
      response.services.mixpanel.message = 'Event sent and flushed successfully';
      console.log('📊 Test Mixpanel Registration event sent:', mixpanelPayload);
    } catch (error: any) {
      response.services.mixpanel.success = false;
      response.services.mixpanel.message = 'Failed to send event';
      response.services.mixpanel.error = error?.message || 'Unknown error';
      console.error('📊 Error sending test Mixpanel Registration event:', error);
    }
  } else {
    response.services.mixpanel.message = 'Mixpanel not initialized';
  }

  return response;
};
