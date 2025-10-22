import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

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
  resetOnboarding: () => void;
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

  const resetOnboarding = useCallback(() => {
    console.log('Resetting onboarding context to step 1');
    setCurrentStep(1);
    setDirection(0);
    setOnboardingData({});
    setIsTransitioning(false);
  }, []); // Empty deps - this function doesn't depend on any external values

  const submitOnboardingData = async () => {
    if (!user) {
      console.error("User not authenticated");
      return;
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
      } else {
        console.log('Profile updated successfully!');
        console.log('Updated data:', data);
      }
    } catch (err) {
      console.error('Unexpected error during onboarding submission:', err);
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

