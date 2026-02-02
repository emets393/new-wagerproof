/**
 * Meta Test Sheet Context
 *
 * Provides context for the Meta SDK debugging bottom sheet.
 * Allows opening/closing the sheet from anywhere in the app.
 */

import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';

interface MetaTestSheetContextType {
  isOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const MetaTestSheetContext = createContext<MetaTestSheetContextType | undefined>(undefined);

export function MetaTestSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openSheet = useCallback(() => {
    setIsOpen(true);
    // Open the sheet with a small delay to ensure state is set
    // Use setTimeout instead of requestAnimationFrame for better iOS compatibility
    setTimeout(() => {
      bottomSheetRef.current?.expand();
    }, 100);
  }, []);

  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.close();
    // Delay state reset to allow animation to complete
    setTimeout(() => {
      setIsOpen(false);
    }, 300);
  }, []);

  return (
    <MetaTestSheetContext.Provider
      value={{
        isOpen,
        openSheet,
        closeSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </MetaTestSheetContext.Provider>
  );
}

export function useMetaTestSheet() {
  const context = useContext(MetaTestSheetContext);
  if (context === undefined) {
    throw new Error('useMetaTestSheet must be used within a MetaTestSheetProvider');
  }
  return context;
}
