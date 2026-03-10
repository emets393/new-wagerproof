import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
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
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const hasTrackedStart = useRef(false);
  const hasCompletedOnboarding = useRef(false);
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

  const markOnboardingCompleted = useCallback(
    async (createdAgentId?: string) => {
      if (!user) {
        console.error('User not authenticated');
        throw new Error('User not authenticated');
      }

      if (hasCompletedOnboarding.current) {
        return;
      }

      const payloadOnboardingData = createdAgentId
        ? { ...onboardingData, createdAgentId }
        : onboardingData;

      const { data, error } = await supabase
        .from('profiles')
        .update({
          onboarding_data: payloadOnboardingData,
          onboarding_completed: true,
        })
        .eq('user_id', user.id)
        .select();

      if (error) {
        console.error('Error updating profile:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }

      console.log('Profile updated successfully!');
      console.log('Updated data:', data);

      hasCompletedOnboarding.current = true;
      trackOnboardingStepCompleted(currentStepRef.current, undefined, ONBOARDING_TOTAL_STEPS);
      trackOnboardingCompleted({
        favoriteSports: payloadOnboardingData.favoriteSports,
        bettorType: payloadOnboardingData.bettorType,
        mainGoal: payloadOnboardingData.mainGoal,
        acquisitionSource: payloadOnboardingData.acquisitionSource,
      });
    },
    [onboardingData, user]
  );

  const resetOnboarding = useCallback(() => {
    console.log('Resetting onboarding context to step 1');
    hasCompletedOnboarding.current = false;
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
      console.error('User not authenticated');
      throw new Error('User not authenticated');
    }

    console.log('Submitting onboarding data for user:', user.id);
    console.log('Onboarding data:', onboardingData);

    try {
      await markOnboardingCompleted();
    } catch (err) {
      console.error('Unexpected error during onboarding submission:', err);
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
