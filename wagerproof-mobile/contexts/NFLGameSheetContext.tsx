import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { NFLPrediction } from '@/types/nfl';

interface NFLGameSheetContextType {
  selectedGame: NFLPrediction | null;
  openGameSheet: (game: NFLPrediction) => void;
  closeGameSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const NFLGameSheetContext = createContext<NFLGameSheetContextType | undefined>(undefined);

export function NFLGameSheetProvider({ children }: { children: ReactNode }) {
  const [selectedGame, setSelectedGame] = useState<NFLPrediction | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openGameSheet = (game: NFLPrediction) => {
    setSelectedGame(game);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const closeGameSheet = () => {
    setSelectedGame(null);
    bottomSheetRef.current?.close();
  };

  return (
    <NFLGameSheetContext.Provider
      value={{
        selectedGame,
        openGameSheet,
        closeGameSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </NFLGameSheetContext.Provider>
  );
}

export function useNFLGameSheet() {
  const context = useContext(NFLGameSheetContext);
  if (context === undefined) {
    throw new Error('useNFLGameSheet must be used within an NFLGameSheetProvider');
  }
  return context;
}

