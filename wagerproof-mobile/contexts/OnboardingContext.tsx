import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { enqueueWrite } from '../services/offlineQueue';
import {
  ONBOARDING_TOTAL_STEPS,
  trackOnboardingStarted,
  trackOnboardingStepViewed,
  trackOnboardingStepCompleted,
  trackOnboardingCompleted,
  trackOnboardingAbandoned,
} from '../services/analytics';
import {
  CreateAgentFormState,
  INITIAL_FORM_STATE,
  PersonalityParams,
  CustomInsights,
  ArchetypeId,
  DEFAULT_PERSONALITY_PARAMS,
  DEFAULT_CUSTOM_INSIGHTS,
} from '@/types/agent';

// ─── Deferred Supabase write ────────────────────────────────────────────────
// Runs in background after onboarding is marked complete locally.
// Never blocks the user. Falls back to offline queue on failure.
function syncOnboardingToServer(userId: string, data: OnboardingData) {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Onboarding sync timed out')), 8000)
  );

  Promise.race([
    supabase
      .from('profiles')
      .update({ onboarding_data: data, onboarding_completed: true })
      .eq('user_id', userId),
    timeout,
  ])
    .then(({ error }: any) => {
      if (error) throw error;
    })
    .catch((err) => {
      console.warn('Background onboarding sync failed, queuing:', err);
      enqueueWrite({
        type: 'onboarding_completion',
        userId,
        payload: { onboardingData: data },
      }).catch(() => {});
    });
}

// ─── AsyncStorage keys for offline resilience ────────────────────────────────
const ONBOARDING_COMPLETED_KEY_PREFIX = '@wagerproof/onboarding-completed/';
const ONBOARDING_PROGRESS_KEY = '@wagerproof/onboarding-progress';

function getOnboardingCompletedKey(userId: string) {
  return `${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`;
}

/** Cache onboarding completion locally so the app never re-shows onboarding on network failure. */
export async function cacheOnboardingCompleted(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(getOnboardingCompletedKey(userId), 'true');
  } catch {}
}

/** Check if onboarding was cached as completed locally (survives app restarts). */
export async function isOnboardingCachedAsCompleted(userId: string): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(getOnboardingCompletedKey(userId));
    return val === 'true';
  } catch {
    return false;
  }
}

/** Clear any stale saved progress (called on completion). */
async function clearOnboardingProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_PROGRESS_KEY);
  } catch {}
}

export interface OnboardingData {
  favoriteSports?: string[];
  age?: number;
  bettorType?: 'casual' | 'serious' | 'professional';
  mainGoal?: string;
  emailOptIn?: boolean;
  phoneNumber?: string;
  acquisitionSource?: string;
  termsAcceptedAt?: string;
  agentFormState?: CreateAgentFormState;
  createdAgentId?: string;
}

interface OnboardingContextType {
  currentStep: number;
  direction: number;
  isTransitioning: boolean;
  isCompleted: boolean;
  completionOverride: boolean | null;
  onboardingData: OnboardingData;
  nextStep: () => void;
  prevStep: () => void;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  completeOnboarding: (createdAgentId?: string) => Promise<void>;
  setOnboardingIncomplete: () => void;
  submitOnboardingData: () => Promise<void>;
  markOnboardingCompleted: (createdAgentId?: string) => Promise<void>;
  resetOnboarding: () => void;
  agentFormState: CreateAgentFormState;
  updateAgentFormState: <K extends keyof CreateAgentFormState>(key: K, value: CreateAgentFormState[K]) => void;
  updateAgentPersonalityParam: <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => void;
  updateAgentCustomInsight: <K extends keyof CustomInsights>(key: K, value: CustomInsights[K]) => void;
  applyArchetypePreset: (archetypeId: ArchetypeId | null, params?: Partial<PersonalityParams>, insights?: CustomInsights) => void;
  setCreatedAgentId: (id: string) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const segments = useSegments();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionOverride, setCompletionOverride] = useState<boolean | null>(null);
  const hasTrackedStart = useRef(false);
  const hasCompletedOnboarding = useRef(false);
  const currentStepRef = useRef(1);
  const wasInOnboardingRef = useRef(false);

  // Stable refs so markOnboardingCompleted/submitOnboardingData don't depend on state
  const onboardingDataRef = useRef<OnboardingData>({});
  onboardingDataRef.current = onboardingData;
  const userRef = useRef(user);
  userRef.current = user;

  // Agent builder form state
  const [agentFormState, setAgentFormState] = useState<CreateAgentFormState>({
    ...INITIAL_FORM_STATE,
    personality_params: { ...INITIAL_FORM_STATE.personality_params },
    custom_insights: { ...INITIAL_FORM_STATE.custom_insights },
  });
  const [createdAgentId, setCreatedAgentIdState] = useState<string | null>(null);

  // No per-step progress saving — onboarding is lightweight and local.
  // If the app crashes, the user starts fresh. This is intentional.

  useEffect(() => {
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const wasInOnboarding = wasInOnboardingRef.current;

    if (inOnboardingGroup && !hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackOnboardingStarted();
      trackOnboardingStepViewed(currentStepRef.current);
    }

    if (
      wasInOnboarding &&
      !inOnboardingGroup &&
      hasTrackedStart.current &&
      !hasCompletedOnboarding.current &&
      !isCompleted
    ) {
      trackOnboardingAbandoned(currentStepRef.current);
    }

    wasInOnboardingRef.current = inOnboardingGroup;
  }, [segments, isCompleted]);

  // Track step views only. Step completion is emitted on successful forward progression.
  // Deferred to avoid blocking the transition animation.
  useEffect(() => {
    currentStepRef.current = currentStep;
    if (hasTrackedStart.current && currentStep > 1) {
      const handle = InteractionManager.runAfterInteractions(() => {
        trackOnboardingStepViewed(currentStep);
      });
      return () => handle.cancel();
    }
  }, [currentStep]);

  // Ref-based guard prevents double-taps without causing re-renders.
  // The `isTransitioning` state is only for UI (button loading indicators).
  const transitionLockRef = useRef(false);

  const nextStep = useCallback(() => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;

    // Batch all state updates together to minimize re-render cascades
    setIsTransitioning(true);
    setDirection(1);
    setCurrentStep((prev) => prev + 1);

    // Defer analytics tracking to after animations complete
    const completedStep = currentStepRef.current;
    InteractionManager.runAfterInteractions(() => {
      trackOnboardingStepCompleted(completedStep, undefined, ONBOARDING_TOTAL_STEPS);
    });

    // Reset after animation completes
    setTimeout(() => {
      transitionLockRef.current = false;
      setIsTransitioning(false);
    }, 350);
  }, []); // Stable — guard is a ref, no state deps

  const prevStep = useCallback(() => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;
    setDirection(-1);
    setCurrentStep((prev) => prev - 1);
    setTimeout(() => { transitionLockRef.current = false; }, 350);
  }, []);

  const updateOnboardingData = useCallback((data: Partial<OnboardingData>) => {
    setOnboardingData((prev) => ({ ...prev, ...data }));
  }, []);

  // Agent form state helpers
  const updateAgentFormState = useCallback(
    <K extends keyof CreateAgentFormState>(key: K, value: CreateAgentFormState[K]) => {
      setAgentFormState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateAgentPersonalityParam = useCallback(
    <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => {
      setAgentFormState((prev) => ({
        ...prev,
        personality_params: {
          ...prev.personality_params,
          [key]: value,
        },
      }));
    },
    []
  );

  const updateAgentCustomInsight = useCallback(
    <K extends keyof CustomInsights>(key: K, value: CustomInsights[K]) => {
      setAgentFormState((prev) => ({
        ...prev,
        custom_insights: {
          ...prev.custom_insights,
          [key]: value,
        },
      }));
    },
    []
  );

  const applyArchetypePreset = useCallback(
    (
      archetypeId: ArchetypeId | null,
      personalityParams?: Partial<PersonalityParams>,
      customInsights?: CustomInsights
    ) => {
      setAgentFormState((prev) => ({
        ...prev,
        archetype: archetypeId,
        personality_params: archetypeId
          ? { ...DEFAULT_PERSONALITY_PARAMS, ...personalityParams }
          : { ...DEFAULT_PERSONALITY_PARAMS },
        custom_insights: archetypeId && customInsights
          ? { ...customInsights }
          : { ...DEFAULT_CUSTOM_INSIGHTS },
      }));
    },
    []
  );

  const setCreatedAgentId = useCallback((id: string) => {
    setCreatedAgentIdState(id);
    setOnboardingData((prev) => ({ ...prev, createdAgentId: id }));
  }, []);

  const markOnboardingCompleted = useCallback(
    async (agentId?: string) => {
      const currentUser = userRef.current;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      if (hasCompletedOnboarding.current) return;
      hasCompletedOnboarding.current = true;

      const currentData = onboardingDataRef.current;
      const payloadData = agentId
        ? { ...currentData, createdAgentId: agentId }
        : currentData;

      // LOCAL ONLY — write cache + clear stale progress. Never blocks.
      cacheOnboardingCompleted(currentUser.id).catch(() => {});
      clearOnboardingProgress().catch(() => {});

      // Background sync to Supabase — fire and forget, never blocks the user
      syncOnboardingToServer(currentUser.id, payloadData);

      // Analytics — deferred, non-blocking
      InteractionManager.runAfterInteractions(() => {
        trackOnboardingStepCompleted(currentStepRef.current, undefined, ONBOARDING_TOTAL_STEPS);
        trackOnboardingCompleted({
          favoriteSports: payloadData.favoriteSports,
          bettorType: payloadData.bettorType,
          mainGoal: payloadData.mainGoal,
          acquisitionSource: payloadData.acquisitionSource,
        });
      });
    },
    []
  );

  const completeOnboarding = useCallback(async (agentId?: string) => {
    // Instant — sets local state, everything else is background
    setIsCompleted(true);
    setCompletionOverride(true);
    await markOnboardingCompleted(agentId);
  }, [markOnboardingCompleted]);

  const resetOnboarding = useCallback(() => {
    hasTrackedStart.current = false;
    hasCompletedOnboarding.current = false;
    wasInOnboardingRef.current = false;
    setCurrentStep(1);
    setDirection(0);
    setOnboardingData({});
    setIsTransitioning(false);
    setIsCompleted(false);
    setCompletionOverride(false);
    setAgentFormState({
      ...INITIAL_FORM_STATE,
      personality_params: { ...INITIAL_FORM_STATE.personality_params },
      custom_insights: { ...INITIAL_FORM_STATE.custom_insights },
    });
    setCreatedAgentIdState(null);
  }, []);

  const submitOnboardingData = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) {
      console.error('User not authenticated');
      throw new Error('User not authenticated');
    }

    try {
      await completeOnboarding();
    } catch (err) {
      console.error('Unexpected error during onboarding submission:', err);
      throw err;
    }
  }, [completeOnboarding]);

  const contextValue = useMemo(() => ({
    currentStep,
    direction,
    isTransitioning,
    isCompleted,
    completionOverride,
    onboardingData,
    nextStep,
    prevStep,
    updateOnboardingData,
    completeOnboarding,
    setOnboardingIncomplete: resetOnboarding,
    submitOnboardingData,
    markOnboardingCompleted,
    resetOnboarding,
    agentFormState,
    updateAgentFormState,
    updateAgentPersonalityParam,
    updateAgentCustomInsight,
    applyArchetypePreset,
    setCreatedAgentId,
  }), [
    currentStep,
    direction,
    isTransitioning,
    isCompleted,
    completionOverride,
    onboardingData,
    nextStep,
    prevStep,
    updateOnboardingData,
    completeOnboarding,
    resetOnboarding,
    submitOnboardingData,
    markOnboardingCompleted,
    agentFormState,
    updateAgentFormState,
    updateAgentPersonalityParam,
    updateAgentCustomInsight,
    applyArchetypePreset,
    setCreatedAgentId,
  ]);

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
