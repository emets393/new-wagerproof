import { gradientColorSchemes } from './AnimatedGradientBackground';

// Map each onboarding step to a gradient color scheme
export const stepGradients = {
  1: gradientColorSchemes.primary,      // Welcome - Primary green
  2: gradientColorSchemes.energetic,    // Sports selection - Energetic
  3: gradientColorSchemes.cool,         // Age confirmation - Cool
  4: gradientColorSchemes.calm,         // Bettor type - Calm
  5: gradientColorSchemes.primary,      // Primary goal - Primary
  6: gradientColorSchemes.energetic,    // Feature spotlight - Energetic
  7: gradientColorSchemes.cool,         // Competitor comparison - Cool
  8: gradientColorSchemes.warm,         // Email opt-in - Warm
  9: gradientColorSchemes.primary,      // Social proof - Primary
  10: gradientColorSchemes.energetic,   // Value claim - Energetic
  11: gradientColorSchemes.calm,        // Methodology 1 - Calm
  12: gradientColorSchemes.cool,        // Methodology 2 - Cool
  13: gradientColorSchemes.warm,        // Acquisition - Warm
  14: gradientColorSchemes.calm,        // Data transparency - Calm
  15: gradientColorSchemes.energetic,   // Early access - Energetic
  16: gradientColorSchemes.primary,     // Paywall - Primary
};

export type StepNumber = keyof typeof stepGradients;

