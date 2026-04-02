import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { useOnboarding, isOnboardingCachedAsCompleted, cacheOnboardingCompleted } from '../contexts/OnboardingContext';
import { hasPendingOnboardingCompletion } from '../services/offlineQueue';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * Routing guard that determines whether to show onboarding or main app.
 *
 * Architecture:
 * 1. Reads local AsyncStorage cache (instant, ~1-5ms) to determine initial route.
 *    This means zero spinner between splash and first screen.
 * 2. Background-validates against Supabase (non-blocking).
 *    If DB disagrees with cache, updates state reactively.
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { isCompleted, completionOverride } = useOnboarding();
  const router = useRouter();
  const segments = useSegments();

  // null = unknown (don't redirect), true/false = resolved
  const [localCompleted, setLocalCompleted] = useState<boolean | null>(null);
  const hasCheckedLocal = useRef(false);

  // Step 1: Fast local cache check (runs once per user, instant)
  useEffect(() => {
    if (!user?.id) {
      setLocalCompleted(null);
      hasCheckedLocal.current = false;
      return;
    }
    if (hasCheckedLocal.current) return;
    hasCheckedLocal.current = true;

    // Read from AsyncStorage — no network, no spinner
    Promise.all([
      isOnboardingCachedAsCompleted(user.id),
      hasPendingOnboardingCompletion(user.id),
    ]).then(([cached, pending]) => {
      setLocalCompleted(cached || pending);
    });

    // Step 2: Background validation against DB (non-blocking, fire and forget)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    );

    Promise.race([
      supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single(),
      timeout,
    ])
      .then(({ data: profile, error }: any) => {
        if (error) return; // Network failed — trust local cache
        const dbCompleted = profile?.onboarding_completed ?? false;
        setLocalCompleted(dbCompleted);
        // Sync cache if DB says completed but local didn't know
        if (dbCompleted) cacheOnboardingCompleted(user.id);
      })
      .catch(() => {
        // Timeout or network error — local cache is authoritative
      });
  }, [user?.id]);

  // Routing effect — runs when state changes
  useEffect(() => {
    if (authLoading) return;

    const inOnboardingGroup = segments[0] === '(onboarding)';
    const effectiveCompleted = completionOverride ?? (isCompleted || localCompleted === true);

    // Only redirect on definitive false, never on null (unknown)
    if (user && effectiveCompleted === false && !inOnboardingGroup) {
      router.replace('/(onboarding)');
    }

    if (user && effectiveCompleted === true && inOnboardingGroup) {
      router.replace('/(drawer)/(tabs)');
    }
  }, [user, authLoading, localCompleted, segments, isCompleted, completionOverride, router]);

  // No spinner — always render children immediately.
  // The splash screen covers the initial frame; by the time it fades,
  // the local cache check has resolved and routing is correct.
  return <>{children}</>;
}
