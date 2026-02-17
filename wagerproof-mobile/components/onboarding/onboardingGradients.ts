import { gradientColorSchemes } from './AnimatedGradientBackground';

// Map each onboarding step to a gradient color scheme
export const stepGradients = {
  1: gradientColorSchemes.primary,      // PersonalizationIntro (Welcome)
  2: gradientColorSchemes.energetic,    // TermsAcceptance
  3: gradientColorSchemes.cool,         // SportsSelection
  4: gradientColorSchemes.calm,         // AgeConfirmation
  5: gradientColorSchemes.primary,      // BettorTypeSelection
  6: gradientColorSchemes.warm,         // AcquisitionSource
  7: gradientColorSchemes.energetic,    // PrimaryGoalSelection
  8: gradientColorSchemes.cool,         // ValueClaim ("Stop guessing")
  9: gradientColorSchemes.warm,         // FeatureSpotlight
  10: gradientColorSchemes.calm,        // DataTransparency (How we keep it fair)
  11: gradientColorSchemes.greenPrimary, // AgentValue1 - 24/7
  12: gradientColorSchemes.greenMint,    // AgentValue2 - Virtual Assistant
  13: gradientColorSchemes.greenForest,  // AgentValue3 - Multiple Strategies
  14: gradientColorSchemes.greenTeal,    // AgentValue4 - Leaderboard
  15: gradientColorSchemes.dark,         // Agent Builder: Sport & Archetype
  16: gradientColorSchemes.dark,         // Agent Builder: Identity
  17: gradientColorSchemes.dark,         // Agent Builder: Personality
  18: gradientColorSchemes.dark,         // Agent Builder: Data & Conditions
  19: gradientColorSchemes.dark,         // Agent Builder: Custom Insights
  20: gradientColorSchemes.dark,         // Agent Builder: Review & Create
  21: gradientColorSchemes.dark,         // AgentGenerationStep
  22: gradientColorSchemes.dark,         // AgentBornStep
};

export type StepNumber = keyof typeof stepGradients;
