import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { MLBGame } from '@/types/mlb';

interface MLBGameSheetContextType {
  selectedGame: MLBGame | null;
  openGameSheet: (game: MLBGame) => void;
  closeGameSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const MLBGameSheetContext = createContext<MLBGameSheetContextType | undefined>(undefined);

export function MLBGameSheetProvider({ children }: { children: ReactNode }) {
  const [selectedGame, setSelectedGame] = useState<MLBGame | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openGameSheet = (game: MLBGame) => {
    setSelectedGame(game);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const closeGameSheet = () => {
    setSelectedGame(null);
    bottomSheetRef.current?.close();
  };

  return (
    <MLBGameSheetContext.Provider
      value={{
        selectedGame,
        openGameSheet,
        closeGameSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </MLBGameSheetContext.Provider>
  );
}

export function useMLBGameSheet() {
  const context = useContext(MLBGameSheetContext);
  if (context === undefined) {
    throw new Error('useMLBGameSheet must be used within an MLBGameSheetProvider');
  }
  return context;
}
