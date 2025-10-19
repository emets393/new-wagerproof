import React, { createContext, useContext, useState } from 'react';
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
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [isTransitioning, setIsTransitioning] = useState(false);

  const nextStep = () => {
    if (isTransitioning) {
      debug.log('Ignoring nextStep - already transitioning');
      return;
    }
    
    debug.log('nextStep called, current step:', currentStep);
    setIsTransitioning(true);
    setDirection(1);
    setCurrentStep((prev) => {
      debug.log('Setting step from', prev, 'to', prev + 1);
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
