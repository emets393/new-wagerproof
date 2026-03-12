/**
 * UserProfileContext
 *
 * Manages the user's profile state (specifically onboarding completion) at the root
 * level so that both OnboardingGuard and OnboardingContext can share a single source
 * of truth without independent Supabase queries.
 *
 * This eliminates the race condition where OnboardingGuard would redirect back to
 * onboarding step 1 immediately after the user completed onboarding — because the
 * guard's local onboarding state was stale (never updated when OnboardingContext
 * marked completion).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

interface UserProfileContextType {
  /** Whether the user has completed onboarding. `null` means not yet loaded. */
  onboardingCompleted: boolean | null;
  /** True while the initial profile fetch is in-flight. */
  profileLoading: boolean;
  /**
   * Optimistically update the onboarding-completed state.
   * Call this before (or immediately after) the Supabase write so that
   * OnboardingGuard reacts instantly instead of waiting for a refetch.
   */
  setOnboardingCompleted: (value: boolean) => void;
}

const UserProfileContext = createContext<UserProfileContextType>({
  onboardingCompleted: null,
  profileLoading: true,
  setOnboardingCompleted: () => {},
});

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // Unauthenticated — clear state without showing a spinner on next login
      setOnboardingCompleted(null);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);

    supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .single()
      .then(({ data: profile, error }) => {
        if (cancelled) return;

        if (error) {
          console.error('[UserProfileContext] Error fetching profile:', error);
          // Treat errors as "not completed" so the user can retry onboarding
          setOnboardingCompleted(false);
        } else {
          setOnboardingCompleted(profile?.onboarding_completed ?? false);
        }
        setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]); // Re-fetch only when the user identity changes

  const handleSetOnboardingCompleted = useCallback((value: boolean) => {
    setOnboardingCompleted(value);
  }, []);

  return (
    <UserProfileContext.Provider
      value={{
        onboardingCompleted,
        profileLoading,
        setOnboardingCompleted: handleSetOnboardingCompleted,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
