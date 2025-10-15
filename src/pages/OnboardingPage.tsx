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
import Dither from "@/components/Dither";

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
  const { currentStep, direction } = useOnboarding();

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
        className="relative z-10 w-full max-w-4xl mx-4 bg-black/30 backdrop-blur-3xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
        }}
      >
        {/* Progress Indicator */}
        <div className="p-6 pb-0">
          <ProgressIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>
        
        {/* Content Area */}
        <div className="relative h-[600px] overflow-y-auto overflow-x-hidden onboarding-scroll">
          <AnimatePresence initial={false} custom={direction} mode="wait">
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
              className={`absolute inset-0 p-8 min-h-full flex justify-center ${
                currentStep === 6 || currentStep === 7 ? 'items-start' : 'items-center'
              }`}
            >
              <div className="w-full">
                <CurrentStepComponent />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
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
