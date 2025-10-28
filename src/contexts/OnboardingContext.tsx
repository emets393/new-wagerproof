import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import debug from '@/utils/debug';

export interface OnboardingData {
  favoriteSports?: string[];
  age?: number;
  bettorType?: 'casual' | 'serious' | 'professional';
  mainGoal?: string;
  emailOptIn?: boolean;
  phoneNumber?: string;
  acquisitionSource?: string;
}

interface OnboardingContextType {
  currentStep: number;
  direction: number;
  onboardingData: OnboardingData;
  nextStep: () => void;
  prevStep: () => void;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  submitOnboardingData: () => Promise<void>;
  isLaunchMode: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLaunchMode, setIsLaunchMode] = useState(false);
  const [launchModeLoaded, setLaunchModeLoaded] = useState(false);

  // Fetch launch mode setting
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
      } finally {
        setLaunchModeLoaded(true);
      }
    }

    fetchLaunchMode();
  }, []);

  const getNextStepNumber = (prev: number) => {
    // In paid mode (isLaunchMode = false), skip step 15 (EarlyAccess) and go to step 16 (Paywall)
    if (!isLaunchMode && prev === 14) {
      return 16;
    }
    // In launch mode (free), skip step 16 (Paywall) and go to step 15 (EarlyAccess)
    if (isLaunchMode && prev === 15) {
      return 17; // This would be past the final step, triggering completion
    }
    return prev + 1;
  };

  const nextStep = () => {
    if (isTransitioning) {
      debug.log('Ignoring nextStep - already transitioning');
      return;
    }
    
    debug.log('nextStep called, current step:', currentStep);
    setIsTransitioning(true);
    setDirection(1);
    setCurrentStep((prev) => {
      const next = getNextStepNumber(prev);
      debug.log('Setting step from', prev, 'to', next);
      return next;
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

  const submitOnboardingData = async () => {
    if (!user) {
      debug.error("User not authenticated");
      return;
    }

    debug.log('Submitting onboarding data for user:', user.id);
    debug.log('Onboarding data:', onboardingData);

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
        debug.error('Error updating profile:', error);
        debug.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        debug.log('Profile updated successfully!');
        debug.log('Updated data:', data);
      }
    } catch (err) {
      debug.error('Unexpected error during onboarding submission:', err);
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
        isLaunchMode,
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
