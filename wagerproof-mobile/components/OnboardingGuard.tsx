/**
 * OnboardingGuard
 *
 * Route guard that controls whether an authenticated user sees the onboarding
 * flow or the main app.
 *
 * Previously this component maintained its own Supabase query to determine
 * onboarding status, and also ran a second "refetch on exit" query whenever
 * the user navigated away from the onboarding route group. This created a
 * race condition:
 *
 *   1. OnboardingContext.markOnboardingCompleted() updated Supabase but
 *      NOT this component's local state.
 *   2. StepAgentBorn then called router.replace() to navigate to the main app.
 *   3. This component's useEffect fired, saw onboardingCompleted === false
 *      (stale), and immediately redirected the user BACK to onboarding step 1.
 *   4. The refetch-on-exit query eventually returned true, triggering a third
 *      navigation to the main app — producing the visible "flash to step 1" jank.
 *
 * The fix is to read onboarding status from UserProfileContext, a single
 * shared source of truth. OnboardingContext now updates that context
 * optimistically when marking completion, so this guard reacts instantly
 * with the correct state and fires exactly one navigation.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../contexts/UserProfileContext';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { onboardingCompleted, profileLoading } = useUserProfile();
  const router = useRouter();
  const segments = useSegments();
  const theme = useTheme();

  useEffect(() => {
    // Wait until both auth and profile status are resolved before making
    // any routing decisions — this prevents flickering navigations.
    if (authLoading || profileLoading) return;

    const inOnboardingGroup = segments[0] === '(onboarding)';

    // Authenticated user who has not completed onboarding → show onboarding
    if (user && onboardingCompleted === false && !inOnboardingGroup) {
      console.log('[OnboardingGuard] Redirecting to onboarding...');
      router.replace('/(onboarding)');
      return;
    }

    // Authenticated user who HAS completed onboarding but is still on an
    // onboarding route (e.g. deep-linked or stale navigation stack) → main app
    if (user && onboardingCompleted === true && inOnboardingGroup) {
      console.log('[OnboardingGuard] Onboarding complete — redirecting to main app...');
      router.replace('/(drawer)/(tabs)');
    }
  }, [user, authLoading, onboardingCompleted, profileLoading, segments]);

  // Show a full-screen spinner while we're resolving auth or profile state.
  // This is the only "loading" gate; once resolved the guard never re-enters
  // this state (onboardingCompleted comes from an in-memory context, not a
  // fresh DB query).
  if (authLoading || profileLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
