import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { EditorPick, GameData } from '@/types/editorsPicks';

interface PickDetailSheetContextType {
  isOpen: boolean;
  selectedPick: EditorPick | null;
  selectedGameData: GameData | null;
  openPickDetail: (pick: EditorPick, gameData: GameData) => void;
  closeSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const PickDetailSheetContext = createContext<PickDetailSheetContextType | undefined>(undefined);

export function PickDetailSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPick, setSelectedPick] = useState<EditorPick | null>(null);
  const [selectedGameData, setSelectedGameData] = useState<GameData | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openPickDetail = useCallback((pick: EditorPick, gameData: GameData) => {
    // Set the data first
    setSelectedPick(pick);
    setSelectedGameData(gameData);
    setIsOpen(true);
    
    // Then open the sheet with a small delay to ensure data is set
    requestAnimationFrame(() => {
      bottomSheetRef.current?.snapToIndex(0);
    });
  }, []);

  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.close();
    // Delay state reset to allow animation to complete
    setTimeout(() => {
      setIsOpen(false);
      setSelectedPick(null);
      setSelectedGameData(null);
    }, 300);
  }, []);

  return (
    <PickDetailSheetContext.Provider
      value={{
        isOpen,
        selectedPick,
        selectedGameData,
        openPickDetail,
        closeSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </PickDetailSheetContext.Provider>
  );
}

export function usePickDetailSheet() {
  const context = useContext(PickDetailSheetContext);
  if (context === undefined) {
    throw new Error('usePickDetailSheet must be used within a PickDetailSheetProvider');
  }
  return context;
}
