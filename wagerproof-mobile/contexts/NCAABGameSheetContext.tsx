import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { NCAABGame } from '@/types/ncaab';

interface NCAABGameSheetContextType {
  selectedGame: NCAABGame | null;
  openGameSheet: (game: NCAABGame) => void;
  closeGameSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const NCAABGameSheetContext = createContext<NCAABGameSheetContextType | undefined>(undefined);

export function NCAABGameSheetProvider({ children }: { children: ReactNode }) {
  const [selectedGame, setSelectedGame] = useState<NCAABGame | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openGameSheet = (game: NCAABGame) => {
    setSelectedGame(game);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const closeGameSheet = () => {
    setSelectedGame(null);
    bottomSheetRef.current?.close();
  };

  return (
    <NCAABGameSheetContext.Provider
      value={{
        selectedGame,
        openGameSheet,
        closeGameSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </NCAABGameSheetContext.Provider>
  );
}

export function useNCAABGameSheet() {
  const context = useContext(NCAABGameSheetContext);
  if (context === undefined) {
    throw new Error('useNCAABGameSheet must be used within an NCAABGameSheetProvider');
  }
  return context;
}

