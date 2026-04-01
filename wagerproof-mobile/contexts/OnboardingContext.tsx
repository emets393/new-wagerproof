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

interface SavedOnboardingProgress {
  userId: string;
  currentStep: number;
  onboardingData: OnboardingData;
  savedAt: number;
}

/** Persist form progress so users don't lose 18 steps of input on a crash/restart. */
async function saveOnboardingProgress(userId: string, step: number, data: OnboardingData): Promise<void> {
  try {
    const progress: SavedOnboardingProgress = { userId, currentStep: step, onboardingData: data, savedAt: Date.now() };
    await AsyncStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

/** Restore saved onboarding progress (returns null if none or expired > 7 days). */
async function restoreOnboardingProgress(userId: string): Promise<SavedOnboardingProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_PROGRESS_KEY);
    if (!raw) return null;
    const progress = JSON.parse(raw) as SavedOnboardingProgress;
    // Only restore if same user and < 7 days old
    if (progress.userId !== userId) return null;
    if (Date.now() - progress.savedAt > 7 * 24 * 60 * 60 * 1000) {
      await AsyncStorage.removeItem(ONBOARDING_PROGRESS_KEY);
      return null;
    }
    return progress;
  } catch {
    return null;
  }
}

/** Clear saved onboarding progress (called on completion). */
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
  isCompleting: boolean;
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
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionOverride, setCompletionOverride] = useState<boolean | null>(null);
  const hasTrackedStart = useRef(false);
  const hasCompletedOnboarding = useRef(false);
  const currentStepRef = useRef(1);
  const completionPromiseRef = useRef<Promise<void> | null>(null);
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

  // Restore saved onboarding progress on mount (resume from where user left off)
  const hasRestoredProgress = useRef(false);
  useEffect(() => {
    if (!user?.id || hasRestoredProgress.current) return;
    hasRestoredProgress.current = true;
    restoreOnboardingProgress(user.id).then((progress) => {
      if (progress && progress.currentStep > 1) {
        console.log(`Restoring onboarding progress: step ${progress.currentStep}`);
        setCurrentStep(progress.currentStep);
        setOnboardingData(progress.onboardingData);
      }
    });
  }, [user?.id]);

  // Persist form progress after each step change (debounced to avoid excessive writes)
  useEffect(() => {
    if (!user?.id || currentStep <= 1) return;
    const timer = setTimeout(() => {
      saveOnboardingProgress(user.id, currentStep, onboardingData);
    }, 500);
    return () => clearTimeout(timer);
  }, [user?.id, currentStep, onboardingData]);

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
        console.error('User not authenticated');
        throw new Error('User not authenticated');
      }

      if (hasCompletedOnboarding.current) {
        return;
      }

      // Read from ref so this callback never depends on onboardingData state
      const currentData = onboardingDataRef.current;
      const payloadOnboardingData = agentId
        ? { ...currentData, createdAgentId: agentId }
        : currentData;

      // Always cache locally FIRST so the user is never re-shown onboarding
      await cacheOnboardingCompleted(currentUser.id);
      await clearOnboardingProgress();

      // Race against 8s timeout so bad internet never freezes the flow
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Onboarding save timed out')), 8000)
      );

      try {
        const { error } = await Promise.race([
          supabase
            .from('profiles')
            .update({
              onboarding_data: payloadOnboardingData,
              onboarding_completed: true,
            })
            .eq('user_id', currentUser.id),
          timeout,
        ]);

        if (error) {
          throw error;
        }
      } catch (saveError) {
        // DB write failed — queue for retry on network recovery.
        // The local cache already marks onboarding as complete so the user is never blocked.
        console.warn('Onboarding save failed, queuing for retry:', saveError);
        await enqueueWrite({
          type: 'onboarding_completion',
          userId: currentUser.id,
          payload: { onboardingData: payloadOnboardingData },
        });
        // Don't re-throw — the user should proceed regardless
      }

      hasCompletedOnboarding.current = true;
      trackOnboardingStepCompleted(currentStepRef.current, undefined, ONBOARDING_TOTAL_STEPS);
      trackOnboardingCompleted({
        favoriteSports: payloadOnboardingData.favoriteSports,
        bettorType: payloadOnboardingData.bettorType,
        mainGoal: payloadOnboardingData.mainGoal,
        acquisitionSource: payloadOnboardingData.acquisitionSource,
      });
    },
    [] // Stable — reads from refs, no state dependencies
  );

  const completeOnboarding = useCallback(async (agentId?: string) => {
    if (completionPromiseRef.current) {
      return completionPromiseRef.current;
    }

    setIsCompleting(true);
    setIsCompleted(true);
    setCompletionOverride(true);

    // markOnboardingCompleted now handles its own error recovery (local cache + queue),
    // so it should never throw. But guard just in case.
    const completionPromise = markOnboardingCompleted(agentId)
      .catch((error) => {
        console.error('Background onboarding completion failed:', error);
        // Even on unexpected errors, keep the user moving — local cache is already set
      })
      .finally(() => {
        completionPromiseRef.current = null;
        setIsCompleting(false);
      });

    completionPromiseRef.current = completionPromise;
    return completionPromise;
  }, [markOnboardingCompleted]);

  const resetOnboarding = useCallback(() => {
    hasTrackedStart.current = false;
    hasCompletedOnboarding.current = false;
    wasInOnboardingRef.current = false;
    completionPromiseRef.current = null;
    setCurrentStep(1);
    setDirection(0);
    setOnboardingData({});
    setIsTransitioning(false);
    setIsCompleting(false);
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
    isCompleting,
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
    isCompleting,
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
