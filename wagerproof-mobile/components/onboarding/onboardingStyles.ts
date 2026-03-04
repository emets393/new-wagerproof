import { StyleSheet } from 'react-native';

export const onboardingCta = StyleSheet.create({
  button: {
    borderRadius: 50,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    paddingVertical: 16,
  },
  fixedBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});

/** Gradient colors for the frosted bottom fade behind fixed buttons */
export const BOTTOM_FADE_COLORS = ['transparent', 'rgba(15, 17, 23, 0.85)', '#0f1117'] as const;
export const BOTTOM_FADE_LOCATIONS = [0, 0.4, 1] as const;
