import { AnimatePresence, motion } from "framer-motion";
import { OnboardingProvider, useOnboarding } from "@/contexts/OnboardingContext";
import { ProgressIndicator } from "@/components/onboarding/ProgressIndicator";
import { PersonalizationIntro } from "@/components/onboarding/steps/Step1_PersonalizationIntro";
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

const stepComponents = {
  1: PersonalizationIntro,
  2: SportsSelection,
  3: AgeConfirmation,
  4: BettorTypeSelection,
  5: PrimaryGoalSelection,
  6: FeatureSpotlight,
  7: CompetitorComparison,
  8: EmailOptIn,
  9: SocialProof,
  10: ValueClaim,
  11: MethodologyClaim1,
  12: MethodologyClaim2,
  13: AcquisitionSource,
  14: DataTransparency,
  15: EarlyAccess,
  16: Paywall,
};

const TOTAL_STEPS = 16;

function OnboardingContent() {
  const { currentStep, direction, isLaunchMode, nextStep } = useOnboarding();
  const paywallRef = useRef<PaywallHandle>(null);
  const [, forceUpdate] = useState({});

  // Steps that have scrollable content and need floating buttons
  const scrollableSteps = [6, 7, 9, 10, 11, 12, 16];
  const hasScrollableContent = scrollableSteps.includes(currentStep);
  const isPaywallStep = currentStep === 16;

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
    // In launch mode: steps 1-15 (skip paywall 16)
    // In paid mode: steps 1-14, then 16 (skip early access 15)
    return isLaunchMode ? 15 : 16;
  };

  // Determine if current step should be rendered
  const shouldSkipStep = () => {
    // In paid mode, skip step 15 (EarlyAccess)
    if (!isLaunchMode && currentStep === 15) {
      return true;
    }
    // In free mode, skip step 16 (Paywall)
    if (isLaunchMode && currentStep === 16) {
      return true;
    }
    return false;
  };

  // Get button text for each step
  const getButtonText = (step: number) => {
    switch (step) {
      case 6:
        return "Continue";
      case 7:
        return "I'm Ready to Win";
      case 9:
      case 10:
      case 11:
      case 12:
        return "Continue";
      case 16:
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
        className="relative z-10 w-full max-w-4xl mx-2 sm:mx-4 bg-black/30 backdrop-blur-3xl border border-white/20 rounded-xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[95vh]"
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
        <div className="relative h-[calc(100vh-12rem)] sm:h-[600px] overflow-y-auto overflow-x-hidden onboarding-scroll">
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
                  currentStep === 9 || currentStep === 10 || currentStep === 11 || currentStep === 12 || currentStep === 16 ? '' : 'p-4 sm:p-6 md:p-8'
                } min-h-full flex justify-center ${
                  currentStep === 6 || currentStep === 7 || currentStep === 9 || currentStep === 10 || currentStep === 11 || currentStep === 12 || currentStep === 16 ? 'items-start' : 'items-center'
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
            <div className="flex justify-center">
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
