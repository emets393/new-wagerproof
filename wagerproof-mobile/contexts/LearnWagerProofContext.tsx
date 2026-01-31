import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LEARN_SHEET_STORAGE_KEY = '@wagerproof_has_seen_learn_sheet';

interface LearnWagerProofContextType {
  isOpen: boolean;
  currentSlide: number;
  openLearnSheet: () => void;
  closeLearnSheet: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (index: number) => void;
  markAsSeen: () => Promise<void>;
  checkIfSeen: () => Promise<boolean>;
  bottomSheetRef: React.RefObject<BottomSheet | null>;
}

const LearnWagerProofContext = createContext<LearnWagerProofContextType | undefined>(undefined);

export const TOTAL_SLIDES = 6;

export function LearnWagerProofProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openLearnSheet = useCallback(() => {
    setCurrentSlide(0);
    setIsOpen(true);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const closeLearnSheet = useCallback(() => {
    setIsOpen(false);
    bottomSheetRef.current?.close();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, TOTAL_SLIDES - 1));
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < TOTAL_SLIDES) {
      setCurrentSlide(index);
    }
  }, []);

  const markAsSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(LEARN_SHEET_STORAGE_KEY, 'true');
    } catch (error) {
      console.error('Error marking learn sheet as seen:', error);
    }
  }, []);

  const checkIfSeen = useCallback(async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(LEARN_SHEET_STORAGE_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Error checking learn sheet status:', error);
      return false;
    }
  }, []);

  return (
    <LearnWagerProofContext.Provider
      value={{
        isOpen,
        currentSlide,
        openLearnSheet,
        closeLearnSheet,
        nextSlide,
        prevSlide,
        goToSlide,
        markAsSeen,
        checkIfSeen,
        bottomSheetRef,
      }}
    >
      {children}
    </LearnWagerProofContext.Provider>
  );
}

export function useLearnWagerProof() {
  const context = useContext(LearnWagerProofContext);
  if (context === undefined) {
    throw new Error('useLearnWagerProof must be used within a LearnWagerProofProvider');
  }
  return context;
}
