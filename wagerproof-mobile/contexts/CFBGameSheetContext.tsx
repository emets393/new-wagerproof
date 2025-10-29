import React, { createContext, useContext, useRef, useState } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { CFBPrediction } from '@/types/cfb';

interface CFBGameSheetContextType {
  selectedGame: CFBPrediction | null;
  openGameSheet: (game: CFBPrediction) => void;
  closeGameSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const CFBGameSheetContext = createContext<CFBGameSheetContextType | undefined>(undefined);

export function CFBGameSheetProvider({ children }: { children: React.ReactNode }) {
  const [selectedGame, setSelectedGame] = useState<CFBPrediction | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openGameSheet = (game: CFBPrediction) => {
    setSelectedGame(game);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const closeGameSheet = () => {
    setSelectedGame(null);
    bottomSheetRef.current?.close();
  };

  return (
    <CFBGameSheetContext.Provider
      value={{
        selectedGame,
        openGameSheet,
        closeGameSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </CFBGameSheetContext.Provider>
  );
}

export function useCFBGameSheet() {
  const context = useContext(CFBGameSheetContext);
  if (!context) {
    throw new Error('useCFBGameSheet must be used within CFBGameSheetProvider');
  }
  return context;
}

