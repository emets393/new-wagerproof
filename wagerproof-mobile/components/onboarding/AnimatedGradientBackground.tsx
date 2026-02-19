import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { Canvas, Group, RadialGradient, Rect, vec, Blur } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, Easing, useDerivedValue, interpolateColor } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface ColorScheme {
  colors: string[][];
}

interface AnimatedGradientBackgroundProps {
  colorScheme?: ColorScheme;
  duration?: number;
}

// Predefined color schemes for different steps
export const gradientColorSchemes = {
  primary: {
    colors: [
      ['#22c55e', '#16a34a', '#15803d'], // Green
      ['#3b82f6', '#2563eb', '#1d4ed8'], // Blue
      ['#8b5cf6', '#7c3aed', '#6d28d9'], // Purple
    ],
  },
  warm: {
    colors: [
      ['#f59e0b', '#d97706', '#b45309'], // Amber
      ['#ef4444', '#dc2626', '#b91c1c'], // Red
      ['#ec4899', '#db2777', '#be185d'], // Pink
    ],
  },
  cool: {
    colors: [
      ['#06b6d4', '#0891b2', '#0e7490'], // Cyan
      ['#3b82f6', '#2563eb', '#1d4ed8'], // Blue
      ['#8b5cf6', '#7c3aed', '#6d28d9'], // Purple
    ],
  },
  energetic: {
    colors: [
      ['#22c55e', '#16a34a', '#15803d'], // Green
      ['#f59e0b', '#d97706', '#b45309'], // Amber
      ['#ec4899', '#db2777', '#be185d'], // Pink
    ],
  },
  calm: {
    colors: [
      ['#6366f1', '#4f46e5', '#4338ca'], // Indigo
      ['#8b5cf6', '#7c3aed', '#6d28d9'], // Purple
      ['#06b6d4', '#0891b2', '#0e7490'], // Cyan
    ],
  },
  // Green shades for agent onboarding pages
  greenPrimary: {
    colors: [
      ['#00E676', '#00C853', '#00A843'], // Bright green
      ['#22c55e', '#16a34a', '#15803d'], // Emerald
      ['#69F0AE', '#4ADE80', '#22c55e'], // Light mint
    ],
  },
  greenMint: {
    colors: [
      ['#69F0AE', '#4ADE80', '#22c55e'], // Light mint
      ['#00C853', '#00A843', '#008038'], // Medium green
      ['#00E676', '#69F0AE', '#4ADE80'], // Bright to mint
    ],
  },
  greenForest: {
    colors: [
      ['#2E7D32', '#1B5E20', '#0D3D0D'], // Forest green
      ['#00C853', '#00A843', '#008038'], // Medium green
      ['#4ADE80', '#22c55e', '#16a34a'], // Lime to emerald
    ],
  },
  greenTeal: {
    colors: [
      ['#00BFA5', '#00897B', '#00695C'], // Teal green
      ['#00E676', '#00C853', '#00A843'], // Bright green
      ['#2E7D32', '#1B5E20', '#0D3D0D'], // Forest green
    ],
  },
  // Dark background for agent config pages
  dark: {
    colors: [
      ['#1a1a1a', '#0f0f0f', '#080808'],
      ['#252525', '#151515', '#0a0a0a'],
      ['#1e1e1e', '#111111', '#090909'],
    ],
  },
};

export function AnimatedGradientBackground({
  colorScheme = gradientColorSchemes.primary,
  duration = 8000,
}: AnimatedGradientBackgroundProps) {
  // Animation progress (0 to 3 for color transitions within a scheme)
  const progress = useSharedValue(0);
  
  // Transition progress for color scheme changes (0 to 1)
  const transitionProgress = useSharedValue(1);
  
  // Store the previous color scheme
  const prevColorScheme = useSharedValue(colorScheme);
  
  useEffect(() => {
    // When color scheme changes, animate transition
    if (prevColorScheme.value !== colorScheme) {
      transitionProgress.value = 0;
      transitionProgress.value = withTiming(1, {
        duration: 600,
        easing: Easing.inOut(Easing.ease),
      });
      
      // Update previous after starting transition
      setTimeout(() => {
        prevColorScheme.value = colorScheme;
      }, 0);
    }
  }, [colorScheme]);

  // Positions for three gradient blobs
  const blob1X = useSharedValue(width * 0.3);
  const blob1Y = useSharedValue(height * 0.2);
  
  const blob2X = useSharedValue(width * 0.7);
  const blob2Y = useSharedValue(height * 0.5);
  
  const blob3X = useSharedValue(width * 0.5);
  const blob3Y = useSharedValue(height * 0.8);

  useEffect(() => {
    // Color transition animation
    progress.value = withRepeat(
      withTiming(2.99, {
        duration: duration * 3,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false
    );

    // Blob 1 movement
    blob1X.value = withRepeat(
      withTiming(width * 0.7, {
        duration: duration,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    blob1Y.value = withRepeat(
      withTiming(height * 0.5, {
        duration: duration * 1.3,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    // Blob 2 movement
    blob2X.value = withRepeat(
      withTiming(width * 0.2, {
        duration: duration * 1.2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    blob2Y.value = withRepeat(
      withTiming(height * 0.7, {
        duration: duration * 0.9,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    // Blob 3 movement
    blob3X.value = withRepeat(
      withTiming(width * 0.6, {
        duration: duration * 1.1,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    blob3Y.value = withRepeat(
      withTiming(height * 0.3, {
        duration: duration * 1.4,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [duration]);

  // Convert positions to Skia-compatible vectors
  const blob1Position = useDerivedValue(() => {
    return vec(blob1X.value, blob1Y.value);
  });

  const blob2Position = useDerivedValue(() => {
    return vec(blob2X.value, blob2Y.value);
  });

  const blob3Position = useDerivedValue(() => {
    return vec(blob3X.value, blob3Y.value);
  });

  // Interpolate colors for each blob with transition support
  const blob1Colors = useDerivedValue(() => {
    const index = Math.floor(progress.value);
    const nextIndex = (index + 1) % colorScheme.colors.length;
    const localProgress = progress.value - index;
    
    // Get colors from current scheme
    const currentColors = [
      interpolateColor(
        localProgress,
        [0, 1],
        [colorScheme.colors[index][0], colorScheme.colors[nextIndex][0]]
      ),
      interpolateColor(
        localProgress,
        [0, 1],
        [colorScheme.colors[index][1], colorScheme.colors[nextIndex][1]]
      ),
      interpolateColor(
        localProgress,
        [0, 1],
        [colorScheme.colors[index][2], colorScheme.colors[nextIndex][2]]
      ),
    ];
    
    // If transitioning, blend with previous scheme colors
    if (transitionProgress.value < 1) {
      const prevIndex = Math.floor(progress.value);
      const prevNextIndex = (prevIndex + 1) % prevColorScheme.value.colors.length;
      
      const prevColors = [
        interpolateColor(
          localProgress,
          [0, 1],
          [prevColorScheme.value.colors[prevIndex][0], prevColorScheme.value.colors[prevNextIndex][0]]
        ),
        interpolateColor(
          localProgress,
          [0, 1],
          [prevColorScheme.value.colors[prevIndex][1], prevColorScheme.value.colors[prevNextIndex][1]]
        ),
        interpolateColor(
          localProgress,
          [0, 1],
          [prevColorScheme.value.colors[prevIndex][2], prevColorScheme.value.colors[prevNextIndex][2]]
        ),
      ];
      
      // Interpolate between previous and current colors
      return [
        interpolateColor(transitionProgress.value, [0, 1], [prevColors[0], currentColors[0]]),
        interpolateColor(transitionProgress.value, [0, 1], [prevColors[1], currentColors[1]]),
        interpolateColor(transitionProgress.value, [0, 1], [prevColors[2], currentColors[2]]),
      ];
    }
    
    return currentColors;
  });

  const blob2Colors = useDerivedValue(() => {
    const index = (Math.floor(progress.value) + 1) % colorScheme.colors.length;
    const nextIndex = (index + 1) % colorScheme.colors.length;
    const localProgress = progress.value - Math.floor(progress.value);

    const currentColors = [
      interpolateColor(
        localProgress,
        [0, 1],
        [colorScheme.colors[index][0], colorScheme.colors[nextIndex][0]]
      ),
      interpolateColor(
        localProgress,
        [0, 1],
        [colorScheme.colors[index][1], colorScheme.colors[nextIndex][1]]
      ),
      interpolateColor(
        localProgress,
        [0, 1],
        [colorScheme.colors[index][2], colorScheme.colors[nextIndex][2]]
      ),
    ];
    
    if (transitionProgress.value < 1) {
      const prevIndex = (Math.floor(progress.value) + 1) % prevColorScheme.value.colors.length;
      const prevNextIndex = (prevIndex + 1) % prevColorScheme.value.colors.length;
      
      const prevColors = [
        interpolateColor(
          localProgress,
          [0, 1],
          [prevColorScheme.value.colors[prevIndex][0], prevColorScheme.value.colors[prevNextIndex][0]]
        ),
        interpolateColor(
          localProgress,
          [0, 1],
          [prevColorScheme.value.colors[prevIndex][1], prevColorScheme.value.colors[prevNextIndex][1]]
        ),
        interpolateColor(
          localProgress,
          [0, 1],
          [prevColorScheme.value.colors[prevIndex][2], prevColorScheme.value.colors[prevNextIndex][2]]
        ),
      ];
      
      return [
        interpolateColor(transitionProgress.value, [0, 1], [prevColors[0], currentColors[0]]),
        interpolateColor(transitionProgress.value, [0, 1], [prevColors[1], currentColors[1]]),
        interpolateColor(transitionProgress.value, [0, 1], [prevColors[2], currentColors[2]]),
      ];
    }
    
    return currentColors;
  });

  const blob3Colors = useDerivedValue(() => {
    const index = (Math.floor(progress.value) + 2) % colorScheme.colors.length;
    const nextIndex = (index + 1) % colorScheme.colors.length;
    const localProgress = progress.value - Math.floor(progress.value);

    const currentColors = [
      interpolateColor(
        localProgress,
        [0, 1],
        [colorScheme.colors[index][0], colorScheme.colors[nextIndex][0]]
      ),
      interpolateColor(
        localProgress,
        [0, 1],
        [colorScheme.colors[index][1], colorScheme.colors[nextIndex][1]]
      ),
      interpolateColor(
        localProgress,
        [0, 1],
        [colorScheme.colors[index][2], colorScheme.colors[nextIndex][2]]
      ),
    ];
    
    if (transitionProgress.value < 1) {
      const prevIndex = (Math.floor(progress.value) + 2) % prevColorScheme.value.colors.length;
      const prevNextIndex = (prevIndex + 1) % prevColorScheme.value.colors.length;
      
      const prevColors = [
        interpolateColor(
          localProgress,
          [0, 1],
          [prevColorScheme.value.colors[prevIndex][0], prevColorScheme.value.colors[prevNextIndex][0]]
        ),
        interpolateColor(
          localProgress,
          [0, 1],
          [prevColorScheme.value.colors[prevIndex][1], prevColorScheme.value.colors[prevNextIndex][1]]
        ),
        interpolateColor(
          localProgress,
          [0, 1],
          [prevColorScheme.value.colors[prevIndex][2], prevColorScheme.value.colors[prevNextIndex][2]]
        ),
      ];
      
      return [
        interpolateColor(transitionProgress.value, [0, 1], [prevColors[0], currentColors[0]]),
        interpolateColor(transitionProgress.value, [0, 1], [prevColors[1], currentColors[1]]),
        interpolateColor(transitionProgress.value, [0, 1], [prevColors[2], currentColors[2]]),
      ];
    }
    
    return currentColors;
  });

  return (
    <Canvas style={styles.canvas}>
      <Group>
        <Blur blur={80} />
        
        {/* Background base */}
        <Rect x={0} y={0} width={width} height={height} color="#000000" />
        
        {/* Blob 1 */}
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={blob1Position}
            r={width * 0.6}
            colors={blob1Colors}
          />
        </Rect>

        {/* Blob 2 */}
        <Rect x={0} y={0} width={width} height={height} opacity={0.8}>
          <RadialGradient
            c={blob2Position}
            r={width * 0.5}
            colors={blob2Colors}
          />
        </Rect>

        {/* Blob 3 */}
        <Rect x={0} y={0} width={width} height={height} opacity={0.7}>
          <RadialGradient
            c={blob3Position}
            r={width * 0.55}
            colors={blob3Colors}
          />
        </Rect>
      </Group>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
});

