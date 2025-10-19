import { useState } from 'react';
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

export function useOnboarding() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});

  const nextStep = () => {
    debug.log('nextStep called, current step:', currentStep);
    setDirection(1);
    setCurrentStep((prev) => {
      debug.log('Setting step from', prev, 'to', prev + 1);
      return prev + 1;
    });
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

    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_data: onboardingData,
        onboarding_completed: true,
      })
      .eq('user_id', user.id);

    if (error) {
      debug.error('Error updating profile:', error);
    } else {
      debug.log('Profile updated successfully!');
      // Handle successful submission, e.g., redirect to the dashboard
    }
  };

  return {
    currentStep,
    direction,
    onboardingData,
    nextStep,
    prevStep,
    updateOnboardingData,
    submitOnboardingData,
  };
}
