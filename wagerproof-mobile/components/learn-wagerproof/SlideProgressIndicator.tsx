import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';
import { TOTAL_SLIDES } from '@/contexts/LearnWagerProofContext';

interface SlideProgressIndicatorProps {
  currentSlide: number;
  onDotPress: (index: number) => void;
}

const WAGERPROOF_GREEN = '#00E676';

export function SlideProgressIndicator({ currentSlide, onDotPress }: SlideProgressIndicatorProps) {
  const { isDark } = useThemeContext();

  return (
    <View style={styles.container}>
      {Array.from({ length: TOTAL_SLIDES }).map((_, index) => {
        const isActive = index === currentSlide;
        return (
          <TouchableOpacity
            key={index}
            onPress={() => onDotPress(index)}
            hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
          >
            <View
              style={[
                styles.dot,
                {
                  width: isActive ? 10 : 8,
                  height: isActive ? 10 : 8,
                  backgroundColor: isActive
                    ? WAGERPROOF_GREEN
                    : isDark
                      ? 'rgba(255, 255, 255, 0.3)'
                      : 'rgba(0, 0, 0, 0.2)',
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dot: {
    borderRadius: 5,
  },
});
