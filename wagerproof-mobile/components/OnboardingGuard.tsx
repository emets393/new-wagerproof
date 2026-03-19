import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { useOnboarding } from '../contexts/OnboardingContext';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { isCompleted, completionOverride } = useOnboarding();
  const router = useRouter();
  const segments = useSegments();
  const theme = useTheme();
  const [onboardingStatus, setOnboardingStatus] = useState<{
    completed: boolean | null;
    loading: boolean;
  }>({ completed: null, loading: true });
  // Track whether we've ever successfully fetched onboarding status.
  // After the first fetch, we render children optimistically instead of showing a spinner.
  const hasEverFetched = useRef(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setOnboardingStatus({ completed: null, loading: false });
        return;
      }

      // Check onboarding status silently (no console.log — it crosses the RN bridge)
      // Only show loading spinner on the very first check.
      // Subsequent checks (e.g. user object reference changes) run silently in the background.
      if (!hasEverFetched.current) {
        setOnboardingStatus((prev) => ({ ...prev, loading: true }));
      }

      try {
        // Race the query against a 5s timeout so users never stare at a spinner on bad internet
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Onboarding check timed out')), 5000)
        );

        const { data: profile, error } = await Promise.race([
          supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('user_id', user.id)
            .single(),
          timeout,
        ]);

        if (error) {
          setOnboardingStatus({ completed: null, loading: false });
          hasEverFetched.current = true;
          return;
        }

        setOnboardingStatus({
          completed: profile?.onboarding_completed ?? false,
          loading: false,
        });
        hasEverFetched.current = true;
      } catch {
        setOnboardingStatus({ completed: null, loading: false });
        hasEverFetched.current = true;
      }
    };

    checkOnboardingStatus();
  }, [user?.id]); // Only re-check when the user ID actually changes, not on every user object reference change

  useEffect(() => {
    if (authLoading || onboardingStatus.loading) return;

    const inOnboardingGroup = segments[0] === '(onboarding)';
    const effectiveCompleted = completionOverride ?? (isCompleted || onboardingStatus.completed === true);

    // If user is authenticated and hasn't completed onboarding, redirect to onboarding
    if (user && effectiveCompleted === false && !inOnboardingGroup) {
      router.replace('/(onboarding)');
    }

    // If user is authenticated and has completed onboarding, redirect to main app
    if (user && effectiveCompleted === true && inOnboardingGroup) {
      router.replace('/(drawer)/(tabs)');
    }
  }, [user, authLoading, onboardingStatus, segments, isCompleted, completionOverride, router]);

  // Only show full-screen loading spinner on initial auth load + first onboarding check.
  // After the first successful fetch, always render children (navigation useEffect handles routing).
  if (authLoading || (onboardingStatus.loading && !hasEverFetched.current && !isCompleted)) {
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
