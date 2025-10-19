/**
 * Mixpanel Analytics Tracking Utility
 * 
 * Centralized tracking functions for WagerProof analytics.
 * All tracking calls should go through these functions for consistency.
 */

import debug from '@/utils/debug';

// Extend Window interface to include Mixpanel
declare global {
  interface Window {
    mixpanel?: {
      track: (eventName: string, properties?: Record<string, any>) => void;
      identify: (userId: string) => void;
      people: {
        set: (properties: Record<string, any>) => void;
        set_once: (properties: Record<string, any>) => void;
        increment: (property: string, value?: number) => void;
      };
      reset: () => void;
      register: (properties: Record<string, any>) => void;
    };
  }
}

/**
 * Check if Mixpanel is loaded and available
 */
export const isMixpanelLoaded = (): boolean => {
  return typeof window !== 'undefined' && !!window.mixpanel;
};

/**
 * Track a custom event
 * @param eventName - Name of the event (use Title Case)
 * @param properties - Additional properties to include with the event
 */
export const trackEvent = (
  eventName: string,
  properties?: Record<string, any>
): void => {
  if (!isMixpanelLoaded()) {
    debug.warn('[Mixpanel] Not loaded, skipping event:', eventName);
    return;
  }

  try {
    window.mixpanel!.track(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
    debug.log('[Mixpanel] Event tracked:', eventName, properties);
  } catch (error) {
    debug.error('[Mixpanel] Error tracking event:', error);
  }
};

/**
 * Set user properties
 * @param properties - Properties to set for the user
 */
export const setUserProperties = (properties: Record<string, any>): void => {
  if (!isMixpanelLoaded()) {
    debug.warn('[Mixpanel] Not loaded, skipping user properties');
    return;
  }

  try {
    window.mixpanel!.people.set(properties);
    debug.log('[Mixpanel] User properties set:', properties);
  } catch (error) {
    debug.error('[Mixpanel] Error setting user properties:', error);
  }
};

/**
 * Set user properties only once (won't overwrite existing values)
 * @param properties - Properties to set for the user
 */
export const setUserPropertiesOnce = (properties: Record<string, any>): void => {
  if (!isMixpanelLoaded()) {
    debug.warn('[Mixpanel] Not loaded, skipping user properties (once)');
    return;
  }

  try {
    window.mixpanel!.people.set_once(properties);
    debug.log('[Mixpanel] User properties set once:', properties);
  } catch (error) {
    debug.error('[Mixpanel] Error setting user properties once:', error);
  }
};

/**
 * Increment a numeric user property
 * @param property - Property name to increment
 * @param value - Amount to increment by (default: 1)
 */
export const incrementUserProperty = (property: string, value: number = 1): void => {
  if (!isMixpanelLoaded()) {
    debug.warn('[Mixpanel] Not loaded, skipping increment');
    return;
  }

  try {
    window.mixpanel!.people.increment(property, value);
    debug.log(`[Mixpanel] Incremented ${property} by ${value}`);
  } catch (error) {
    debug.error('[Mixpanel] Error incrementing property:', error);
  }
};

/**
 * Identify a user with Mixpanel
 * @param userId - Unique identifier for the user
 * @param properties - Optional properties to set for the user
 */
export const identifyUser = (
  userId: string,
  properties?: Record<string, any>
): void => {
  if (!isMixpanelLoaded()) {
    debug.warn('[Mixpanel] Not loaded, skipping identify');
    return;
  }

  try {
    window.mixpanel!.identify(userId);
    if (properties) {
      window.mixpanel!.people.set(properties);
    }
    debug.log('[Mixpanel] User identified:', userId);
  } catch (error) {
    debug.error('[Mixpanel] Error identifying user:', error);
  }
};

/**
 * Reset Mixpanel tracking (call on logout)
 */
export const resetTracking = (): void => {
  if (!isMixpanelLoaded()) {
    debug.warn('[Mixpanel] Not loaded, skipping reset');
    return;
  }

  try {
    window.mixpanel!.reset();
    debug.log('[Mixpanel] Tracking reset');
  } catch (error) {
    debug.error('[Mixpanel] Error resetting:', error);
  }
};

/**
 * Register super properties (included with every event)
 * @param properties - Properties to register
 */
export const registerSuperProperties = (properties: Record<string, any>): void => {
  if (!isMixpanelLoaded()) {
    debug.warn('[Mixpanel] Not loaded, skipping super properties');
    return;
  }

  try {
    window.mixpanel!.register(properties);
    debug.log('[Mixpanel] Super properties registered:', properties);
  } catch (error) {
    debug.error('[Mixpanel] Error registering super properties:', error);
  }
};

// ===== Specific Event Tracking Functions =====

/**
 * Track landing page CTA clicks
 */
export const trackCTAClick = (
  ctaText: string,
  ctaLocation: string,
  ctaDestination: string
): void => {
  trackEvent('CTA Clicked', {
    cta_text: ctaText,
    cta_location: ctaLocation,
    cta_destination: ctaDestination,
  });
};

/**
 * Track navigation link clicks
 */
export const trackNavigationClick = (
  linkText: string,
  linkDestination: string
): void => {
  trackEvent('Navigation Link Clicked', {
    link_text: linkText,
    link_destination: linkDestination,
  });
};

/**
 * Track footer link clicks
 */
export const trackFooterClick = (
  linkText: string,
  linkDestination: string,
  linkCategory: string
): void => {
  trackEvent('Footer Link Clicked', {
    link_text: linkText,
    link_destination: linkDestination,
    link_category: linkCategory,
  });
};

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
export const trackSignOut = (sessionDuration?: number): void => {
  trackEvent('User Signed Out', {
    session_duration: sessionDuration,
  });
};

/**
 * Track onboarding started
 */
export const trackOnboardingStarted = (): void => {
  trackEvent('Onboarding Started', {
    start_time: new Date().toISOString(),
  });
};

/**
 * Track onboarding step viewed
 */
export const trackOnboardingStepViewed = (
  stepNumber: number,
  stepName: string,
  totalSteps: number = 16
): void => {
  trackEvent('Onboarding Step Viewed', {
    step_number: stepNumber,
    step_name: stepName,
    total_steps: totalSteps,
  });
};

/**
 * Track onboarding step completed
 */
export const trackOnboardingStepCompleted = (
  stepNumber: number,
  stepName: string,
  timeOnStep?: number,
  additionalData?: Record<string, any>
): void => {
  trackEvent('Onboarding Step Completed', {
    step_number: stepNumber,
    step_name: stepName,
    total_steps: 16,
    time_on_step: timeOnStep,
    ...additionalData,
  });
};

/**
 * Track onboarding completed
 */
export const trackOnboardingCompleted = (totalDuration: number): void => {
  trackEvent('Onboarding Completed', {
    completion_time: new Date().toISOString(),
    total_duration: totalDuration,
    steps_completed: 16,
  });

  // Set user property
  setUserProperties({
    onboarding_completed: true,
    onboarding_completion_date: new Date().toISOString(),
  });
};

/**
 * Track prediction viewed
 */
export const trackPredictionViewed = (
  sport: 'NFL' | 'College Football',
  gameCount: number,
  filter?: string,
  sort?: string
): void => {
  trackEvent('Prediction Viewed', {
    sport,
    game_count: gameCount,
    filter: filter || 'All Games',
    sort: sort || 'none',
  });
};

/**
 * Track prediction card clicked
 */
export const trackPredictionCardClicked = (
  sport: 'NFL' | 'College Football',
  homeTeam: string,
  awayTeam: string,
  gameId: string,
  predictionType?: string
): void => {
  trackEvent('Prediction Card Clicked', {
    sport,
    home_team: homeTeam,
    away_team: awayTeam,
    game_id: gameId,
    prediction_type: predictionType,
  });
};

/**
 * Track game analysis opened
 */
export const trackGameAnalysisOpened = (
  sport: 'NFL' | 'College Football',
  gameId: string,
  homeTeam: string,
  awayTeam: string,
  analysisType?: string
): void => {
  trackEvent('Game Analysis Opened', {
    sport,
    game_id: gameId,
    home_team: homeTeam,
    away_team: awayTeam,
    analysis_type: analysisType,
  });

  // Increment counter
  incrementUserProperty('game_analysis_opened_count');
};

/**
 * Track filter applied
 */
export const trackFilterApplied = (
  page: string,
  filterType: string,
  gamesShown: number
): void => {
  trackEvent('Filter Applied', {
    page,
    filter_type: filterType,
    games_shown: gamesShown,
  });
};

/**
 * Track sort applied
 */
export const trackSortApplied = (
  page: string,
  sortType: string,
  direction: string = 'desc'
): void => {
  trackEvent('Sort Applied', {
    page,
    sort_type: sortType,
    direction,
  });
};

/**
 * Track analytics page viewed
 */
export const trackAnalyticsViewed = (
  page: string,
  teamsVisible?: number,
  statCategory?: string
): void => {
  trackEvent('Analytics Viewed', {
    page,
    teams_visible: teamsVisible,
    stat_category: statCategory,
  });
};

/**
 * Track WagerBot usage
 */
export const trackWagerBotOpened = (): void => {
  trackEvent('WagerBot Chat Opened');
};

export const trackWagerBotMessageSent = (
  messageLength: number,
  messageNumber: number
): void => {
  trackEvent('WagerBot Message Sent', {
    message_length: messageLength,
    message_number: messageNumber,
  });

  // Increment counter
  incrementUserProperty('wagerbot_messages_sent');
};

/**
 * Track learn page interactions
 */
export const trackLearnPageViewed = (section?: string): void => {
  trackEvent('Learn Page Viewed', {
    section,
  });
};

export const trackLearnSectionClicked = (
  sectionName: string,
  sectionId: string
): void => {
  trackEvent('Learn Section Clicked', {
    section_name: sectionName,
    section_id: sectionId,
  });
};

