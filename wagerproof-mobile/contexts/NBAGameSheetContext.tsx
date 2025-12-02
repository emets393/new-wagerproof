import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { NBAGame } from '@/types/nba';

interface NBAGameSheetContextType {
  selectedGame: NBAGame | null;
  openGameSheet: (game: NBAGame) => void;
  closeGameSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const NBAGameSheetContext = createContext<NBAGameSheetContextType | undefined>(undefined);

export function NBAGameSheetProvider({ children }: { children: ReactNode }) {
  const [selectedGame, setSelectedGame] = useState<NBAGame | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openGameSheet = (game: NBAGame) => {
    setSelectedGame(game);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const closeGameSheet = () => {
    setSelectedGame(null);
    bottomSheetRef.current?.close();
  };

  return (
    <NBAGameSheetContext.Provider
      value={{
        selectedGame,
        openGameSheet,
        closeGameSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </NBAGameSheetContext.Provider>
  );
}

export function useNBAGameSheet() {
  const context = useContext(NBAGameSheetContext);
  if (context === undefined) {
    throw new Error('useNBAGameSheet must be used within an NBAGameSheetProvider');
  }
  return context;
}

