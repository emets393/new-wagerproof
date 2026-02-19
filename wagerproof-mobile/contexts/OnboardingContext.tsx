import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import {
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
  onboardingData: OnboardingData;
  nextStep: () => void;
  prevStep: () => void;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  submitOnboardingData: () => Promise<void>;
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
  const previousStep = useRef(1);

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

  // Track step changes
  useEffect(() => {
    if (currentStep !== previousStep.current) {
      // Track completion of previous step
      trackOnboardingStepCompleted(previousStep.current);
      // Track viewing of new step
      trackOnboardingStepViewed(currentStep);
      previousStep.current = currentStep;
    }
  }, [currentStep]);

  const nextStep = () => {
    if (isTransitioning) {
      console.log('Ignoring nextStep - already transitioning');
      return;
    }

    console.log('nextStep called, current step:', currentStep);
    setIsTransitioning(true);
    setDirection(1);
    setCurrentStep((prev) => {
      console.log('Setting step from', prev, 'to', prev + 1);
      return prev + 1;
    });

    // Reset transition flag after animation completes
    setTimeout(() => setIsTransitioning(false), 300);
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

  const resetOnboarding = useCallback(() => {
    console.log('Resetting onboarding context to step 1');
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
      console.error("User not authenticated");
      throw new Error("User not authenticated");
    }

    console.log('Submitting onboarding data for user:', user.id);
    console.log('Onboarding data:', onboardingData);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          onboarding_data: onboardingData,
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
          code: error.code
        });
        throw error;
      } else {
        console.log('Profile updated successfully!');
        console.log('Updated data:', data);

        // Track onboarding completion with collected data
        trackOnboardingStepCompleted(currentStep); // Track final step completion
        trackOnboardingCompleted({
          favoriteSports: onboardingData.favoriteSports,
          bettorType: onboardingData.bettorType,
          mainGoal: onboardingData.mainGoal,
          acquisitionSource: onboardingData.acquisitionSource,
        });
      }
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
        onboardingData,
        nextStep,
        prevStep,
        updateOnboardingData,
        submitOnboardingData,
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
