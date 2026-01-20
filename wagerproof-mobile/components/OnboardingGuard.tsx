import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const theme = useTheme();
  const [onboardingStatus, setOnboardingStatus] = useState<{
    completed: boolean | null;
    loading: boolean;
  }>({ completed: null, loading: true });
  const previousSegmentRef = useRef<string | null>(null);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setOnboardingStatus({ completed: null, loading: false });
        return;
      }

      console.log('Checking onboarding status for user:', user.id);
      setOnboardingStatus((prev) => ({ ...prev, loading: true }));

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          console.error('Error details:', error);
          // If there's an error, assume onboarding is not completed to be safe
          setOnboardingStatus({ completed: false, loading: false });
          return;
        }

        console.log('Onboarding status from database:', profile?.onboarding_completed);
        setOnboardingStatus({
          completed: profile?.onboarding_completed ?? false,
          loading: false,
        });
      } catch (error) {
        console.error('Unexpected error checking onboarding status:', error);
        setOnboardingStatus({ completed: false, loading: false });
      }
    };

    checkOnboardingStatus();
  }, [user]); // Only check when user changes

  // Refetch when leaving onboarding route
  useEffect(() => {
    const currentSegment = segments[0];
    const wasInOnboarding = previousSegmentRef.current === '(onboarding)';
    const notInOnboardingAnymore = currentSegment !== '(onboarding)';
    
    // If we just left the onboarding screen, refetch the status
    if (wasInOnboarding && notInOnboardingAnymore && user) {
      console.log('Just left onboarding, refetching status...');
      const refetchStatus = async () => {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('user_id', user.id)
            .single();

          if (!error && profile) {
            console.log('Refetched onboarding status:', profile.onboarding_completed);
            setOnboardingStatus({
              completed: profile.onboarding_completed ?? false,
              loading: false,
            });
          }
        } catch (error) {
          console.error('Error refetching onboarding status:', error);
        }
      };
      refetchStatus();
    }
    
    previousSegmentRef.current = currentSegment;
  }, [segments, user]);

  useEffect(() => {
    if (authLoading || onboardingStatus.loading) return;

    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inAuthGroup = segments[0] === '(auth)';

    // If user is authenticated and hasn't completed onboarding, redirect to onboarding
    if (user && onboardingStatus.completed === false && !inOnboardingGroup) {
      console.log('Redirecting to onboarding...');
      router.replace('/(onboarding)');
    }

    // If user is authenticated and has completed onboarding, redirect to main app
    if (user && onboardingStatus.completed === true && inOnboardingGroup) {
      console.log('Onboarding already completed, redirecting to main app...');
      router.replace('/(drawer)/(tabs)');
    }
  }, [user, authLoading, onboardingStatus, segments]);

  // Show loading while checking auth or onboarding status
  if (authLoading || onboardingStatus.loading) {
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

