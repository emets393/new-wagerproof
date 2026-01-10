/**
 * Analytics Context Provider
 *
 * Initializes Mixpanel and provides analytics functions throughout the app.
 * Handles user identification on auth state changes.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  initializeAnalytics,
  isAnalyticsReady,
  identifyUser,
  setUserProperties,
  resetAnalytics,
  trackAppOpened,
  trackSignIn,
  trackSignUp,
  trackSignOut as analyticsSignOut,
} from '../services/analytics';

interface AnalyticsContextType {
  isInitialized: boolean;
  trackSignUp: (authMethod: 'email' | 'google' | 'apple') => void;
  trackSignIn: (authMethod: 'email' | 'google' | 'apple') => void;
  trackSignOut: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasIdentified, setHasIdentified] = useState(false);

  // Initialize analytics on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeAnalytics();
        setIsInitialized(true);
        trackAppOpened();
      } catch (error) {
        console.error('📊 AnalyticsContext: Failed to initialize:', error);
      }
    };

    init();
  }, []);

  // Identify user when auth state changes
  useEffect(() => {
    if (!isInitialized || authLoading) return;

    const handleUserChange = async () => {
      if (user?.id) {
        // User is logged in
        if (!hasIdentified) {
          await identifyUser(user.id, {
            $email: user.email || undefined,
            $name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
          });
          setHasIdentified(true);

          // Set additional user properties
          setUserProperties({
            user_id: user.id,
            email: user.email || 'unknown',
            created_at: user.created_at || new Date().toISOString(),
          });
        }
      } else {
        // User logged out
        if (hasIdentified) {
          resetAnalytics();
          setHasIdentified(false);
        }
      }
    };

    handleUserChange();
  }, [user?.id, isInitialized, authLoading, hasIdentified]);

  const handleTrackSignUp = useCallback((authMethod: 'email' | 'google' | 'apple') => {
    if (isAnalyticsReady()) {
      trackSignUp(authMethod);
    }
  }, []);

  const handleTrackSignIn = useCallback((authMethod: 'email' | 'google' | 'apple') => {
    if (isAnalyticsReady()) {
      trackSignIn(authMethod);
    }
  }, []);

  const handleTrackSignOut = useCallback(() => {
    if (isAnalyticsReady()) {
      analyticsSignOut();
    }
    setHasIdentified(false);
  }, []);

  return (
    <AnalyticsContext.Provider
      value={{
        isInitialized,
        trackSignUp: handleTrackSignUp,
        trackSignIn: handleTrackSignIn,
        trackSignOut: handleTrackSignOut,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}
