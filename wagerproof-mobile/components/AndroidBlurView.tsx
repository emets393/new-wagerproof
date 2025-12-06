import React from 'react';
import { Platform, View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { useThemeContext } from '@/contexts/ThemeContext';

interface AndroidBlurViewProps extends BlurViewProps {
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

/**
 * Android-compatible BlurView wrapper that provides fallbacks
 * when blur effects are not supported on Android devices.
 * 
 * On Android, blur effects may not work due to:
 * - Battery saver mode
 * - Device compatibility
 * - System settings (Developer Options > Allow window-level blurs)
 * 
 * This component uses BlurView on Android with proper fallback colors,
 * ensuring a consistent appearance even when blur doesn't work.
 */
export function AndroidBlurView({ 
  intensity = 80, 
  tint = 'light',
  style,
  children,
  ...props 
}: AndroidBlurViewProps) {
  const { isDark } = useThemeContext();

  // Determine fallback background color based on tint
  const getFallbackColor = () => {
    try {
      if (tint === 'dark') {
        return isDark ? '#1e1e1e' : '#000000';
      } else if (tint === 'light') {
        return isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.95)';
      } else {
        // Default tint
        return isDark ? '#1e1e1e' : 'rgba(255, 255, 255, 0.95)';
      }
    } catch (error) {
      console.error('Error getting fallback color:', error);
      return 'rgba(255, 255, 255, 0.95)'; // Safe fallback
    }
  };

  const fallbackColor = getFallbackColor();

  // On Android, BlurView often doesn't work reliably due to system settings
  // and device compatibility. Use a solid semi-transparent background instead
  // which provides a similar visual effect and always works.
  if (Platform.OS === 'android') {
    // Combine the fallback color with any existing backgroundColor in style
    const styleArray = Array.isArray(style) ? style : [style];
    const existingStyle = styleArray.reduce((acc, s) => ({ ...acc, ...(s || {}) }), {});
    
    // Remove any existing backgroundColor to use our fallback
    const { backgroundColor, ...restStyle } = existingStyle;
    
    const mergedStyle: ViewStyle = {
      backgroundColor: fallbackColor,
      ...restStyle,
    };

    return (
      <View style={mergedStyle}>
        {children}
      </View>
    );
  }

  // On iOS, use the native BlurView with proper fallback color
  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      reducedTransparencyFallbackColor={fallbackColor}
      style={style}
      {...props}
    >
      {children}
    </BlurView>
  );
}

