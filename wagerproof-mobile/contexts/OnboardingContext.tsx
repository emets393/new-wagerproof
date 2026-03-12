import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { useUserProfile } from './UserProfileContext';
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
  onboardingData: OnboardingData;
  nextStep: () => void;
  prevStep: () => void;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  submitOnboardingData: () => Promise<void>;
  markOnboardingCompleted: (createdAgentId?: string, persistOnly?: boolean) => Promise<void>;
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
  const { setOnboardingCompleted } = useUserProfile();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const hasTrackedStart = useRef(false);
  // Tracks whether we have already persisted onboarding_completed=true to the DB.
  // Separate from the navigation trigger so that the AgentBuilder's early
  // crash-safety write doesn't accidentally skip the final steps.
  const hasPersistedToDb = useRef(false);
  // Tracks whether we have already signalled the guard to navigate away.
  const hasTriggeredNavigation = useRef(false);
  const currentStepRef = useRef(1);

  // Agent builder form state
  const [agentFormState, setAgentFormState] = useState<CreateAgentFormState>({
    ...INITIAL_FORM_STATE,
    personality_params: { ...INITIAL_FORM_STATE.personality_params },
    custom_insights: { ...INITIAL_FORM_STATE.custom_insights },
  });
  const [createdAgentId, setCreatedAgentIdState] = useState<string | null>(null);

  // Track onboarding started when first mounted
  useEffect(() => {
    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackOnboardingStarted();
      trackOnboardingStepViewed(1);
    }
  }, []);

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

  useEffect(() => {
    return () => {
      if (!hasCompletedOnboarding.current) {
        trackOnboardingAbandoned(currentStepRef.current);
      }
    };
  }, []);

  const nextStep = () => {
    if (isTransitioning) {
      console.log('Ignoring nextStep - already transitioning');
      return;
    }

    console.log('nextStep called, current step:', currentStep);

    // Start transition immediately - defer analytics to after animation
    setIsTransitioning(true);
    setDirection(1);
    setCurrentStep((prev) => {
      console.log('Setting step from', prev, 'to', prev + 1);
      return prev + 1;
    });

    // Defer analytics tracking to after animations complete
    const completedStep = currentStep;
    InteractionManager.runAfterInteractions(() => {
      trackOnboardingStepCompleted(completedStep, undefined, ONBOARDING_TOTAL_STEPS);
    });

    // Reset transition flag after animation completes (match total animation duration)
    setTimeout(() => setIsTransitioning(false), 400);
  };

  const prevStep = () => {
    setDirection(-1);
    setCurrentStep((prev) => prev - 1);
  };

  const updateOnboardingData = (data: Partial<OnboardingData>) => {
    setOnboardingData((prev) => ({ ...prev, ...data }));
  };

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

  /**
   * Persist onboarding completion to the database and, optionally, signal the
   * OnboardingGuard to navigate the user to the main app.
   *
   * @param createdAgentId  The agent ID returned from the agent-creation step.
   * @param persistOnly     When `true`, only writes to the DB without updating
   *                        the shared UserProfileContext state.  Use this for
   *                        the early "crash-safety" write in AgentBuilder so that
   *                        a crash after agent creation doesn't send the user back
   *                        through onboarding — but without prematurely navigating
   *                        away from the generation / agent-born steps.
   *                        Defaults to `false` (i.e. the final completion call).
   */
  const markOnboardingCompleted = useCallback(
    async (createdAgentId?: string, persistOnly = false) => {
      if (!user) {
        console.error('[OnboardingContext] User not authenticated');
        throw new Error('User not authenticated');
      }

      // Optimistically signal the guard to navigate right away (for the final
      // completion call).  We do this BEFORE the async Supabase write so the UI
      // transition starts immediately.
      if (!persistOnly && !hasTriggeredNavigation.current) {
        hasTriggeredNavigation.current = true;
        setOnboardingCompleted(true);
      }

      // Skip the DB write if we already persisted (idempotent — handles the
      // case where AgentBuilder's early write ran first).
      if (hasPersistedToDb.current) {
        console.log('[OnboardingContext] Already persisted — skipping DB write');
        return;
      }

      const payloadOnboardingData = createdAgentId
        ? { ...onboardingData, createdAgentId }
        : onboardingData;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            onboarding_data: payloadOnboardingData,
            onboarding_completed: true,
          })
          .eq('user_id', user.id)
          .select();

        if (error) {
          console.error('[OnboardingContext] Error updating profile:', error);
          // Rollback the optimistic navigation signal on failure
          if (!persistOnly) {
            hasTriggeredNavigation.current = false;
            setOnboardingCompleted(false);
          }
          throw error;
        }

        console.log('[OnboardingContext] Profile updated successfully:', data);
        hasPersistedToDb.current = true;

        trackOnboardingStepCompleted(currentStepRef.current, undefined, ONBOARDING_TOTAL_STEPS);
        trackOnboardingCompleted({
          favoriteSports: payloadOnboardingData.favoriteSports,
          bettorType: payloadOnboardingData.bettorType,
          mainGoal: payloadOnboardingData.mainGoal,
          acquisitionSource: payloadOnboardingData.acquisitionSource,
        });
      } catch (err) {
        // Ensure rollback happened if we threw above
        if (!persistOnly && hasTriggeredNavigation.current) {
          hasTriggeredNavigation.current = false;
          setOnboardingCompleted(false);
        }
        throw err;
      }
    },
    [onboardingData, user, setOnboardingCompleted]
  );

  const resetOnboarding = useCallback(() => {
    console.log('[OnboardingContext] Resetting onboarding context to step 1');
    hasPersistedToDb.current = false;
    hasTriggeredNavigation.current = false;
    setCurrentStep(1);
    setDirection(0);
    setOnboardingData({});
    setIsTransitioning(false);
    setAgentFormState({
      ...INITIAL_FORM_STATE,
      personality_params: { ...INITIAL_FORM_STATE.personality_params },
      custom_insights: { ...INITIAL_FORM_STATE.custom_insights },
    });
    setCreatedAgentIdState(null);
  }, []);

  const submitOnboardingData = async () => {
    if (!user) {
      console.error('[OnboardingContext] User not authenticated');
      throw new Error('User not authenticated');
    }

    console.log('[OnboardingContext] Submitting onboarding data for user:', user.id);

    try {
      // persistOnly=false → optimistically update UserProfileContext so the guard
      // navigates immediately, then persist to DB in the background.
      await markOnboardingCompleted(undefined, false);
    } catch (err) {
      console.error('[OnboardingContext] Unexpected error during onboarding submission:', err);
      throw err;
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        direction,
        isTransitioning,
        onboardingData,
        nextStep,
        prevStep,
        updateOnboardingData,
        submitOnboardingData,
        markOnboardingCompleted,
        resetOnboarding,
        agentFormState,
        updateAgentFormState,
        updateAgentPersonalityParam,
        updateAgentCustomInsight,
        applyArchetypePreset,
        setCreatedAgentId,
      }}
    >
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
