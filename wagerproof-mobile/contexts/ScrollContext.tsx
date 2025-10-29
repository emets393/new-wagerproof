import React, { createContext, useContext, useRef } from 'react';
import { Animated } from 'react-native';

interface ScrollContextType {
  scrollY: Animated.Value;
  scrollYClamped: Animated.AnimatedDiffClamp;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Calculate total collapsible height
  const HEADER_HEIGHT = 50 + 36 + 16;
  const SEARCH_HEIGHT = 48;
  const PILLS_HEIGHT = 72;
  const SORT_HEIGHT = 48;
  const TOTAL_COLLAPSIBLE_HEIGHT = HEADER_HEIGHT + SEARCH_HEIGHT + PILLS_HEIGHT + SORT_HEIGHT;
  
  // Create diffClamp at the context level so it's shared
  const scrollYClamped = useRef(
    Animated.diffClamp(scrollY, 0, TOTAL_COLLAPSIBLE_HEIGHT)
  ).current;

  return (
    <ScrollContext.Provider value={{ scrollY, scrollYClamped }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScroll must be used within a ScrollProvider');
  }
  return context;
}

