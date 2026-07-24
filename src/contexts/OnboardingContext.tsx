import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import debug from '@/utils/debug';
import type { AgentProfile } from '@/types/agent';
import { createAgent } from '@/services/agentService';
import { getPrimaryColor } from '@/utils/agentColors';
import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_PITCH_SLIDE_COUNT,
  BETTOR_TYPE_ACCENTS,
  CAROUSEL_STEPS,
  DEFAULT_ACCENT,
  EMPTY_AGENT_DRAFT,
  EMPTY_SURVEY,
  ONBOARDING_STEPS,
  buildOnboardingData,
  isCarouselStep,
  type AgentDraft,
  type OnboardingStepId,
  type OnboardingSurvey,
} from '@/components/onboarding/flow';

interface OnboardingContextType {
  step: OnboardingStepId;
  stepIndex: number;
  direction: number;
  /** 0…1 progress across the carousel portion of the flow. */
  carouselProgress: number;
  accent: string;
  isLaunchMode: boolean;

  survey: OnboardingSurvey;
  updateSurvey: (data: Partial<OnboardingSurvey>) => void;

  draft: AgentDraft;
  updateDraft: (data: Partial<AgentDraft>) => void;

  // Step-specific gates (mirror OnboardingPageSpec gating on iOS)
  termsChecked: boolean;
  setTermsChecked: (v: boolean) => void;
  hasSeenCostReveal: boolean;
  setCostRevealSeen: () => void;
  hasSeenReclaimReveal: boolean;
  setReclaimRevealSeen: () => void;
  hasChosenArchetype: boolean;
  setHasChosenArchetype: (v: boolean) => void;
  pitchSlide: number;

  canAdvance: boolean;
  canGoBack: boolean;
  nextStep: () => void;
  prevStep: () => void;

  /** Real agent creation, kicked off by the generation cinematic. */
  createDraftAgent: () => Promise<AgentProfile | null>;
  createdAgent: AgentProfile | null;
  creationError: string | null;

  /** Persist onboarding_data + onboarding_completed (fire-and-forget, once). */
  markComplete: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

function initialStepIndex(): number {
  const params = new URLSearchParams(window.location.search);
  const stepParam = params.get('step');
  if (!stepParam) return 0;
  // Accept both a 1-based number and a step id (admin testing).
  const asNumber = parseInt(stepParam, 10);
  if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= ONBOARDING_STEPS.length) {
    return asNumber - 1;
  }
  const byId = ONBOARDING_STEPS.indexOf(stepParam as OnboardingStepId);
  return byId >= 0 ? byId : 0;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [direction, setDirection] = useState(0);
  const [survey, setSurvey] = useState<OnboardingSurvey>(EMPTY_SURVEY);
  const [draft, setDraft] = useState<AgentDraft>(EMPTY_AGENT_DRAFT);
  const [isLaunchMode, setIsLaunchMode] = useState(false);

  const [termsChecked, setTermsChecked] = useState(false);
  const [hasSeenCostReveal, setHasSeenCostReveal] = useState(false);
  const [hasSeenReclaimReveal, setHasSeenReclaimReveal] = useState(false);
  const [hasChosenArchetype, setHasChosenArchetype] = useState(false);
  const [pitchSlide, setPitchSlide] = useState(0);

  const [createdAgent, setCreatedAgent] = useState<AgentProfile | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const creationPromiseRef = useRef<Promise<AgentProfile | null> | null>(null);
  const completedRef = useRef(false);

  const step = ONBOARDING_STEPS[stepIndex];

  useEffect(() => {
    async function fetchLaunchMode() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('launch_mode')
          .single();
        if (error) {
          debug.error('Error fetching launch mode:', error);
          setIsLaunchMode(false);
        } else {
          setIsLaunchMode(data?.launch_mode || false);
        }
      } catch (err) {
        debug.error('Unexpected error fetching launch mode:', err);
        setIsLaunchMode(false);
      }
    }
    fetchLaunchMode();
  }, []);

  const updateSurvey = useCallback((data: Partial<OnboardingSurvey>) => {
    setSurvey((prev) => ({ ...prev, ...data }));
  }, []);

  const updateDraft = useCallback((data: Partial<AgentDraft>) => {
    setDraft((prev) => ({ ...prev, ...data }));
  }, []);

  // Accent color tracks bettor type, then the agent's own color once the
  // builder identity is customized (mirrors OnboardingTheme on iOS).
  const accent = useMemo(() => {
    const builderSportsIndex = ONBOARDING_STEPS.indexOf('builderArchetype');
    if (stepIndex >= builderSportsIndex && draft.avatar_color) {
      return getPrimaryColor(draft.avatar_color);
    }
    if (survey.bettorType) return BETTOR_TYPE_ACCENTS[survey.bettorType];
    return DEFAULT_ACCENT;
  }, [stepIndex, draft.avatar_color, survey.bettorType]);

  const trimmedName = draft.name.trim();

  const canAdvance = useMemo(() => {
    switch (step) {
      case 'terms':
        return termsChecked;
      case 'bettorType':
        return !!survey.bettorType;
      case 'acquisitionSource':
        return !!survey.acquisitionSource;
      case 'primaryGoal':
        return !!survey.mainGoal;
      case 'researchTime':
        return !!survey.researchTimeBucket;
      case 'weeklyStakes':
        return !!survey.weeklyStakesBucket;
      case 'researchCost':
        return hasSeenCostReveal;
      case 'researchReclaim':
        return hasSeenReclaimReveal;
      case 'builderSports':
        return draft.preferred_sports.length > 0;
      case 'builderArchetype':
        return hasChosenArchetype;
      case 'builderIdentity':
        return trimmedName.length > 0 && trimmedName.length <= AGENT_NAME_MAX_LENGTH;
      default:
        return true;
    }
  }, [step, termsChecked, survey, hasSeenCostReveal, hasSeenReclaimReveal, draft.preferred_sports, hasChosenArchetype, trimmedName]);

  const nextStep = useCallback(() => {
    setDirection(1);
    setStepIndex((prev) => {
      const current = ONBOARDING_STEPS[prev];
      if (current === 'terms') {
        // Stamp acceptance when the user actually taps "I agree — continue".
        setSurvey((s) => ({
          ...s,
          termsAcceptedAt: s.termsAcceptedAt ?? new Date().toISOString(),
          overEighteenAttested: true,
        }));
      }
      if (current === 'agentValueIntro' && pitchSlide < AGENT_PITCH_SLIDE_COUNT - 1) {
        setPitchSlide((slide) => slide + 1);
        return prev;
      }
      return Math.min(prev + 1, ONBOARDING_STEPS.length - 1);
    });
  }, [pitchSlide]);

  const prevStep = useCallback(() => {
    setDirection(-1);
    setStepIndex((prev) => {
      const current = ONBOARDING_STEPS[prev];
      if (current === 'agentValueIntro' && pitchSlide > 0) {
        setPitchSlide((slide) => slide - 1);
        return prev;
      }
      return Math.max(prev - 1, 0);
    });
  }, [pitchSlide]);

  const canGoBack = stepIndex > 0 && isCarouselStep(step);

  const carouselProgress = useMemo(() => {
    if (!isCarouselStep(step)) return 1;
    return (stepIndex + 1) / CAROUSEL_STEPS.length;
  }, [step, stepIndex]);

  const createDraftAgent = useCallback((): Promise<AgentProfile | null> => {
    if (creationPromiseRef.current) return creationPromiseRef.current;
    const promise = (async () => {
      if (!user) {
        setCreationError('Not signed in');
        return null;
      }
      try {
        const agent = await createAgent(user.id, {
          name: draft.name.trim(),
          avatar_emoji: draft.avatar_emoji,
          avatar_color: draft.avatar_color,
          sprite_index: draft.sprite_index,
          preferred_sports: draft.preferred_sports,
          archetype: draft.archetype,
          personality_params: draft.personality_params,
          custom_insights: draft.custom_insights,
          auto_generate: true,
          auto_generate_time: '09:00',
          auto_generate_timezone: 'America/New_York',
          is_widget_favorite: false,
        });
        setCreatedAgent(agent);
        return agent;
      } catch (err: any) {
        debug.error('Onboarding agent creation failed:', err);
        setCreationError(err?.message || 'Failed to create agent');
        return null;
      }
    })();
    creationPromiseRef.current = promise;
    return promise;
  }, [user, draft]);

  const markComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    if (!user) {
      debug.error('markComplete: user not authenticated');
      return;
    }

    const payload = buildOnboardingData(survey, draft);
    debug.log('Marking onboarding complete for user:', user.id, payload);

    // Fire-and-forget like iOS — never block the flow on the network.
    supabase
      .from('profiles')
      .update({ onboarding_data: payload as any, onboarding_completed: true })
      .eq('user_id', user.id)
      .then(({ error }) => {
        if (error) debug.error('Error updating profile with onboarding data:', error);
        else debug.log('Onboarding data saved');
      });
  }, [user, survey, draft]);

  return (
    <OnboardingContext.Provider
      value={{
        step,
        stepIndex,
        direction,
        carouselProgress,
        accent,
        isLaunchMode,
        survey,
        updateSurvey,
        draft,
        updateDraft,
        termsChecked,
        setTermsChecked,
        hasSeenCostReveal,
        setCostRevealSeen: () => setHasSeenCostReveal(true),
        hasSeenReclaimReveal,
        setReclaimRevealSeen: () => setHasSeenReclaimReveal(true),
        hasChosenArchetype,
        setHasChosenArchetype,
        pitchSlide,
        canAdvance,
        canGoBack,
        nextStep,
        prevStep,
        createDraftAgent,
        createdAgent,
        creationError,
        markComplete,
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
