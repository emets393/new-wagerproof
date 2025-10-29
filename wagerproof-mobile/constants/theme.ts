import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Brand colors from the web app
export const honeydew = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
};

// Light theme configuration
export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: honeydew[600],
    primaryContainer: honeydew[100],
    secondary: honeydew[500],
    secondaryContainer: honeydew[50],
    tertiary: honeydew[700],
    tertiaryContainer: honeydew[200],
    surface: '#ffffff',
    surfaceVariant: '#f5f5f5',
    surfaceDisabled: '#e0e0e0',
    background: '#ffffff',
    error: '#ef4444',
    errorContainer: '#fee2e2',
    onPrimary: '#ffffff',
    onPrimaryContainer: honeydew[900],
    onSecondary: '#ffffff',
    onSecondaryContainer: honeydew[900],
    onTertiary: '#ffffff',
    onTertiaryContainer: honeydew[900],
    onSurface: '#1f2937',
    onSurfaceVariant: '#6b7280',
    onSurfaceDisabled: '#9ca3af',
    onError: '#ffffff',
    onErrorContainer: '#7f1d1d',
    onBackground: '#1f2937',
    outline: '#d1d5db',
    outlineVariant: '#e5e7eb',
    inverseSurface: '#1f2937',
    inverseOnSurface: '#ffffff',
    inversePrimary: honeydew[400],
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.4)',
  },
  roundness: 2,
};

// Dark theme configuration
export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: honeydew[500],
    primaryContainer: honeydew[900],
    secondary: honeydew[400],
    secondaryContainer: honeydew[800],
    tertiary: honeydew[300],
    tertiaryContainer: honeydew[700],
    surface: '#1f2937',
    surfaceVariant: '#374151',
    surfaceDisabled: '#4b5563',
    background: '#111827',
    error: '#ef4444',
    errorContainer: '#7f1d1d',
    onPrimary: '#000000',
    onPrimaryContainer: honeydew[100],
    onSecondary: '#000000',
    onSecondaryContainer: honeydew[100],
    onTertiary: '#000000',
    onTertiaryContainer: honeydew[100],
    onSurface: '#f9fafb',
    onSurfaceVariant: '#d1d5db',
    onSurfaceDisabled: '#9ca3af',
    onError: '#000000',
    onErrorContainer: '#fee2e2',
    onBackground: '#f9fafb',
    outline: '#4b5563',
    outlineVariant: '#6b7280',
    inverseSurface: '#f9fafb',
    inverseOnSurface: '#1f2937',
    inversePrimary: honeydew[600],
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.6)',
  },
  roundness: 2,
};

// Spacing constants
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Typography
export const typography = {
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// Layout constants
export const layout = {
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  iconSize: {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
  },
};

// Semantic colors for betting displays (theme-aware)
export const getBettingColors = (isDark: boolean) => ({
  awayMoneyline: isDark ? '#60A5FA' : '#2563EB',    // Blue
  homeMoneyline: isDark ? '#4ADE80' : '#16A34A',    // Green
  success: isDark ? '#4ADE80' : '#16A34A',          // Green
  successLight: isDark ? '#166534' : '#DEF7EC',
  successDark: isDark ? '#BBF7D0' : '#047857',
  warning: isDark ? '#FBBF24' : '#F59E0B',          // Amber/Orange
  warningLight: isDark ? '#78350F' : '#FED7AA',
  warningDark: isDark ? '#FDE68A' : '#EA580C',
  danger: isDark ? '#F87171' : '#DC2626',           // Red
  dangerLight: isDark ? '#7F1D1D' : '#FEE2E2',
  dangerDark: isDark ? '#FCA5A5' : '#991B1B',
  info: isDark ? '#60A5FA' : '#2563EB',             // Blue
  infoLight: isDark ? '#1E3A8A' : '#DBEAFE',
  infoDark: isDark ? '#93C5FD' : '#1E40AF',
  purple: isDark ? '#A78BFA' : '#9333EA',           // Purple
  purpleLight: isDark ? '#4C1D95' : '#F3E8FF',
  gold: '#FFD700',
  neutral: isDark ? '#9CA3AF' : '#6B7280',
});

