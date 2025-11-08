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
      toString: () => string;
      __loaded?: boolean;
    };
  }
}

/**
 * Production-safe logging for critical Mixpanel errors
 * These errors should always be visible, even in production
 */
const logMixpanelError = (message: string, ...args: any[]) => {
  // Always log Mixpanel errors to console for debugging
  console.error(`[Mixpanel Error] ${message}`, ...args);
};

const logMixpanelWarn = (message: string, ...args: any[]) => {
  // Always log Mixpanel warnings to console for debugging
  console.warn(`[Mixpanel Warning] ${message}`, ...args);
};

/**
 * Check if Mixpanel real library is loaded (not just the stub)
 * The Mixpanel snippet creates a stub immediately, but the real library
 * loads asynchronously from CDN. This function checks if the real library loaded.
 */
export const isMixpanelLoaded = (): boolean => {
  if (typeof window === 'undefined' || !window.mixpanel) {
    return false;
  }

  // Check if the real library loaded using multiple methods:
  
  // Method 1: Check for __loaded flag (if it exists)
  if (window.mixpanel.__loaded !== undefined) {
    return window.mixpanel.__loaded === true;
  }

  // Method 2: Check if toString() returns the stub indicator
  try {
    const mixpanelString = window.mixpanel.toString();
    // If it's still the stub, toString() will include "(stub)"
    if (mixpanelString && mixpanelString.includes('(stub)')) {
      return false;
    }
  } catch (e) {
    // If toString fails, assume not loaded
    return false;
  }

  // Method 3: Check if track function is a real function (not a stub queue)
  // The stub's track pushes to an array, the real library actually tracks
  if (window.mixpanel.track && typeof window.mixpanel.track === 'function') {
    // Try to detect if it's the stub by checking the function signature
    const trackStr = window.mixpanel.track.toString();
    // The stub function will have 'push' in it
    if (trackStr.includes('push([')) {
      return false;
    }
  }

  // If all checks pass, assume it's loaded
  return true;
};

/**
 * Get diagnostic information about Mixpanel status
 * Useful for debugging why events aren't being tracked
 */
export const getMixpanelStatus = (): {
  exists: boolean;
  loaded: boolean;
  isStub: boolean;
  status: string;
  error?: string;
} => {
  if (typeof window === 'undefined') {
    return {
      exists: false,
      loaded: false,
      isStub: false,
      status: 'window not available (SSR)',
    };
  }

  if (!window.mixpanel) {
    return {
      exists: false,
      loaded: false,
      isStub: false,
      status: 'Mixpanel not initialized',
      error: 'window.mixpanel is undefined - script may be blocked by ad blocker or failed to load',
    };
  }

  const mixpanelString = window.mixpanel.toString ? window.mixpanel.toString() : '';
  const isStub = mixpanelString.includes('(stub)');

  if (isStub) {
    return {
      exists: true,
      loaded: false,
      isStub: true,
      status: 'Stub loaded, real library pending',
      error: 'Real Mixpanel library not loaded - check network, ad blockers, or CSP policies',
    };
  }

  return {
    exists: true,
    loaded: true,
    isStub: false,
    status: 'Fully loaded and operational',
  };
};

/**
 * Log Mixpanel status to console for debugging
 * Safe to call in production
 */
export const logMixpanelStatus = (): void => {
  const status = getMixpanelStatus();
  
  if (status.loaded) {
    console.info('[Mixpanel] Status:', status.status);
  } else {
    logMixpanelWarn(status.status, status.error || '');
  }
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
    logMixpanelWarn(`Not loaded, skipping event: ${eventName}`);
    // Log status for debugging
    const status = getMixpanelStatus();
    if (status.error) {
      logMixpanelWarn(status.error);
    }
    return;
  }

  try {
    window.mixpanel!.track(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
    debug.log('[Mixpanel] Event tracked:', eventName, properties);
  } catch (error) {
    logMixpanelError('Error tracking event:', error);
  }
};

/**
 * Set user properties
 * @param properties - Properties to set for the user
 */
export const setUserProperties = (properties: Record<string, any>): void => {
  if (!isMixpanelLoaded()) {
    logMixpanelWarn('Not loaded, skipping user properties');
    return;
  }

  try {
    window.mixpanel!.people.set(properties);
    debug.log('[Mixpanel] User properties set:', properties);
  } catch (error) {
    logMixpanelError('Error setting user properties:', error);
  }
};

/**
 * Set user properties only once (won't overwrite existing values)
 * @param properties - Properties to set for the user
 */
export const setUserPropertiesOnce = (properties: Record<string, any>): void => {
  if (!isMixpanelLoaded()) {
    logMixpanelWarn('Not loaded, skipping user properties (once)');
    return;
  }

  try {
    window.mixpanel!.people.set_once(properties);
    debug.log('[Mixpanel] User properties set once:', properties);
  } catch (error) {
    logMixpanelError('Error setting user properties once:', error);
  }
};

/**
 * Increment a numeric user property
 * @param property - Property name to increment
 * @param value - Amount to increment by (default: 1)
 */
export const incrementUserProperty = (property: string, value: number = 1): void => {
  if (!isMixpanelLoaded()) {
    logMixpanelWarn('Not loaded, skipping increment');
    return;
  }

  try {
    window.mixpanel!.people.increment(property, value);
    debug.log(`[Mixpanel] Incremented ${property} by ${value}`);
  } catch (error) {
    logMixpanelError('Error incrementing property:', error);
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
    logMixpanelWarn('Not loaded, skipping identify');
    return;
  }

  try {
    window.mixpanel!.identify(userId);
    if (properties) {
      window.mixpanel!.people.set(properties);
    }
    debug.log('[Mixpanel] User identified:', userId);
  } catch (error) {
    logMixpanelError('Error identifying user:', error);
  }
};

/**
 * Reset Mixpanel tracking (call on logout)
 */
export const resetTracking = (): void => {
  if (!isMixpanelLoaded()) {
    logMixpanelWarn('Not loaded, skipping reset');
    return;
  }

  try {
    window.mixpanel!.reset();
    debug.log('[Mixpanel] Tracking reset');
  } catch (error) {
    logMixpanelError('Error resetting:', error);
  }
};

/**
 * Register super properties (included with every event)
 * @param properties - Properties to register
 */
export const registerSuperProperties = (properties: Record<string, any>): void => {
  if (!isMixpanelLoaded()) {
    logMixpanelWarn('Not loaded, skipping super properties');
    return;
  }

  try {
    window.mixpanel!.register(properties);
    debug.log('[Mixpanel] Super properties registered:', properties);
  } catch (error) {
    logMixpanelError('Error registering super properties:', error);
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

