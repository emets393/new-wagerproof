import { AnimatePresence, motion } from "framer-motion";
import { OnboardingProvider, useOnboarding } from "@/contexts/OnboardingContext";
import { ProgressIndicator } from "@/components/onboarding/ProgressIndicator";
import { PersonalizationIntro } from "@/components/onboarding/steps/Step1_PersonalizationIntro";
import { TermsAcceptance } from "@/components/onboarding/steps/Step1b_TermsAcceptance";
import { SportsSelection } from "@/components/onboarding/steps/Step2_SportsSelection";
import { AgeConfirmation } from "@/components/onboarding/steps/Step3_AgeConfirmation";
import { BettorTypeSelection } from "@/components/onboarding/steps/Step4_BettorType";
import { PrimaryGoalSelection } from "@/components/onboarding/steps/Step5_PrimaryGoal";
import { FeatureSpotlight } from "@/components/onboarding/steps/Step6_FeatureSpotlight";
import { CompetitorComparison } from "@/components/onboarding/steps/Step6b_CompetitorComparison";
import { EmailOptIn } from "@/components/onboarding/steps/Step7_EmailOptIn";
import { SocialProof } from "@/components/onboarding/steps/Step8_SocialProof";
import { ValueClaim } from "@/components/onboarding/steps/Step9_ValueClaim";
import { MethodologyClaim1 } from "@/components/onboarding/steps/Step10_Methodology1";
import { MethodologyClaim2 } from "@/components/onboarding/steps/Step11_Methodology2";
import { AcquisitionSource } from "@/components/onboarding/steps/Step12_AcquisitionSource";
import { DataTransparency } from "@/components/onboarding/steps/Step13_DataTransparency";
import { EarlyAccess } from "@/components/onboarding/steps/Step14_EarlyAccess";
import { Paywall } from "@/components/onboarding/steps/Step15_Paywall";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import Dither from "@/components/Dither";
import { useRef, useState, useEffect } from "react";
import type { PaywallHandle } from "@/components/Paywall";
import debug from "@/utils/debug";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const stepComponents = {
  1: PersonalizationIntro,
  2: TermsAcceptance,
  3: SportsSelection,
  4: AgeConfirmation,
  5: BettorTypeSelection,
  6: PrimaryGoalSelection,
  7: FeatureSpotlight,
  8: CompetitorComparison,
  9: EmailOptIn,
  10: SocialProof,
  11: ValueClaim,
  12: MethodologyClaim1,
  13: MethodologyClaim2,
  14: AcquisitionSource,
  15: DataTransparency,
  16: EarlyAccess,
  17: Paywall,
};

const TOTAL_STEPS = 17;

function OnboardingContent() {
  const { currentStep, direction, isLaunchMode, nextStep, submitOnboardingData } = useOnboarding();
  const paywallRef = useRef<PaywallHandle>(null);
  const [, forceUpdate] = useState({});
  const [onboardingMarkedComplete, setOnboardingMarkedComplete] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Steps that have scrollable content and need floating buttons
  const scrollableSteps = [7, 8, 10, 11, 12, 13, 17];
  const hasScrollableContent = scrollableSteps.includes(currentStep);
  const isPaywallStep = currentStep === 17;

  // Handle "Not Right Now" for freemium mode
  const handleNotRightNow = async () => {
    debug.log('🚪 "Not Right Now" clicked - enabling freemium mode');
    
    // Set localStorage flag to indicate user bypassed paywall
    localStorage.setItem('wagerproof_paywall_bypassed', 'true');
    
    // Fetch user's onboarding data to determine which sport page to redirect to
    try {
      if (!user) {
        debug.warn('No user found, redirecting to NFL by default');
        navigate('/nfl');
        return;
      }

      const { data: profile, error } = await (supabase as any)
        .from('profiles')
        .select('onboarding_data')
        .eq('user_id', user.id)
        .single();

      if (error) {
        debug.error('Error fetching profile:', error);
        navigate('/nfl'); // Default to NFL on error
        return;
      }

      const onboardingData = profile?.onboarding_data as { favoriteSports?: string[] } | null;
      const favoriteSports = onboardingData?.favoriteSports || [];
      
      debug.log('User favorite sports:', favoriteSports);

      // Redirect to College Football if it's in favorites, otherwise NFL
      if (favoriteSports.includes('College Football')) {
        debug.log('Redirecting to College Football page');
        navigate('/college-football');
      } else {
        debug.log('Redirecting to NFL page');
        navigate('/nfl');
      }
    } catch (err) {
      debug.error('Unexpected error fetching user data:', err);
      navigate('/nfl'); // Default to NFL on error
    }
  };

  // Mark onboarding as complete when user reaches the paywall step
  useEffect(() => {
    if (isPaywallStep && !onboardingMarkedComplete) {
      debug.log('User reached paywall step, marking onboarding as complete');
      submitOnboardingData();
      setOnboardingMarkedComplete(true);
    }
  }, [isPaywallStep, onboardingMarkedComplete, submitOnboardingData]);

  // Sync Paywall state to trigger re-renders
  useEffect(() => {
    if (!isPaywallStep) return;
    
    const interval = setInterval(() => {
      forceUpdate({});
    }, 100); // Check every 100ms for state changes
    
    return () => clearInterval(interval);
  }, [isPaywallStep]);

  // Calculate total steps based on launch mode
  const getTotalSteps = () => {
    // In launch mode: steps 1-16 (skip paywall 17)
    // In paid mode: steps 1-15, then 17 (skip early access 16)
    return isLaunchMode ? 16 : 17;
  };

  // Determine if current step should be rendered
  const shouldSkipStep = () => {
    // In paid mode, skip step 16 (EarlyAccess)
    if (!isLaunchMode && currentStep === 16) {
      return true;
    }
    // In free mode, skip step 17 (Paywall)
    if (isLaunchMode && currentStep === 17) {
      return true;
    }
    return false;
  };

  // Get button text for each step
  const getButtonText = (step: number) => {
    switch (step) {
      case 7:
        return "Continue";
      case 8:
        return "I'm Ready to Win";
      case 10:
      case 11:
      case 12:
      case 13:
        return "Continue";
      case 17:
        return "Go to Checkout";
      default:
        return "Continue";
    }
  };

  // Get Paywall state for floating button
  const paywallState = paywallRef.current;
  const paywallButtonDisabled = isPaywallStep && (!paywallState?.selectedPlan || paywallState?.purchasing || paywallState?.rcLoading);
  const paywallButtonText = isPaywallStep && paywallState?.purchasing 
    ? "Processing..." 
    : isPaywallStep && paywallState?.rcLoading 
    ? "Loading..." 
    : getButtonText(currentStep);

  const CurrentStepComponent = stepComponents[currentStep] || (() => <div>Step {currentStep} not found</div>);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      {/* Dither Background Effect */}
      <div className="absolute inset-0 overflow-hidden">
        <Dither
          waveSpeed={0.05}
          waveFrequency={3}
          waveAmplitude={0.3}
          waveColor={[0.13, 0.77, 0.37]}
          colorNum={4}
          pixelSize={2}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0}
        />
      </div>
      
      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative z-10 w-full ${isPaywallStep ? 'max-w-7xl' : 'max-w-4xl'} mx-2 sm:mx-4 bg-black/30 backdrop-blur-3xl border border-white/20 rounded-xl sm:rounded-3xl shadow-2xl overflow-hidden ${isPaywallStep ? 'max-h-[99vh]' : 'max-h-[95vh]'}`}
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
        }}
      >
        {/* Progress Indicator */}
        <div className="p-4 pb-0 sm:p-6">
          <ProgressIndicator currentStep={currentStep} totalSteps={getTotalSteps()} />
        </div>
        
        {/* Content Area */}
        <div className={`relative ${isPaywallStep ? 'h-[calc(100vh-8rem)] sm:h-[800px] md:h-[900px] lg:h-[950px]' : 'h-[calc(100vh-12rem)] sm:h-[600px]'} overflow-y-auto overflow-x-hidden onboarding-scroll`}>
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {shouldSkipStep() ? (
              <motion.div
                key="skip-step"
                className="absolute inset-0 p-4 sm:p-6 md:p-8 min-h-full flex justify-center items-center"
              >
                <div className="text-white text-center">
                  <p>Redirecting...</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={currentStep}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                  scale: { duration: 0.2 },
                }}
                className={`absolute inset-0 ${
                  currentStep === 10 || currentStep === 11 || currentStep === 12 || currentStep === 13 || currentStep === 17 ? '' : 'p-4 sm:p-6 md:p-8'
                } min-h-full flex justify-center ${
                  currentStep === 7 || currentStep === 8 || currentStep === 10 || currentStep === 11 || currentStep === 12 || currentStep === 13 || currentStep === 17 ? 'items-start' : 'items-center'
                }`}
              >
                <div className={`w-full ${hasScrollableContent ? 'pb-32 sm:pb-40' : ''}`}>
                  {isPaywallStep ? (
                    <Paywall ref={paywallRef} />
                  ) : (
                    <CurrentStepComponent />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Continue Button for scrollable steps */}
        {hasScrollableContent && (
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/60 via-black/40 to-transparent border-t border-white/10 backdrop-blur-sm z-20">
            <div className="flex flex-col gap-3 items-center justify-center">
              <Button 
                onClick={isPaywallStep ? () => paywallRef.current?.handlePurchase() : nextStep}
                size="lg" 
                disabled={paywallButtonDisabled}
                className="bg-green-500 hover:bg-green-600 text-white border-0 px-8 py-3 shadow-lg disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
              >
                {isPaywallStep && (paywallState?.purchasing || paywallState?.rcLoading) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {paywallButtonText}
                  </>
                ) : (
                  <>
                    {paywallButtonText}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              
              {/* "Not Right Now" button only on paywall step */}
              {isPaywallStep && (
                <Button
                  onClick={handleNotRightNow}
                  variant="ghost"
                  size="lg"
                  className="text-white/80 hover:text-white hover:bg-white/10 px-8 py-3"
                >
                  Not Right Now
                </Button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}
