import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { EditorPick, GameData } from '@/types/editorsPicks';

interface PickDetailSheetContextType {
  isOpen: boolean;
  selectedPick: EditorPick | null;
  selectedGameData: GameData | null;
  openPickDetail: (pick: EditorPick, gameData: GameData) => void;
  closePickDetail: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const PickDetailSheetContext = createContext<PickDetailSheetContextType | undefined>(undefined);

export function PickDetailSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPick, setSelectedPick] = useState<EditorPick | null>(null);
  const [selectedGameData, setSelectedGameData] = useState<GameData | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openPickDetail = useCallback((pick: EditorPick, gameData: GameData) => {
    setSelectedPick(pick);
    setSelectedGameData(gameData);
    setIsOpen(true);
    // Use setTimeout to ensure state is committed and component re-rendered
    setTimeout(() => {
      bottomSheetRef.current?.expand();
    }, 100);
  }, []);

  const closePickDetail = useCallback(() => {
    bottomSheetRef.current?.close();
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
        closePickDetail,
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
