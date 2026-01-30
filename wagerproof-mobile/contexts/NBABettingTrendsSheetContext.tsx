import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { NBAGameTrendsData } from '@/types/nbaBettingTrends';

interface NBABettingTrendsSheetContextType {
  selectedGameTrends: NBAGameTrendsData | null;
  openTrendsSheet: (game: NBAGameTrendsData) => void;
  closeTrendsSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const NBABettingTrendsSheetContext = createContext<NBABettingTrendsSheetContextType | undefined>(undefined);

export function NBABettingTrendsSheetProvider({ children }: { children: ReactNode }) {
  const [selectedGameTrends, setSelectedGameTrends] = useState<NBAGameTrendsData | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openTrendsSheet = (game: NBAGameTrendsData) => {
    setSelectedGameTrends(game);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const closeTrendsSheet = () => {
    setSelectedGameTrends(null);
    bottomSheetRef.current?.close();
  };

  return (
    <NBABettingTrendsSheetContext.Provider
      value={{
        selectedGameTrends,
        openTrendsSheet,
        closeTrendsSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </NBABettingTrendsSheetContext.Provider>
  );
}

export function useNBABettingTrendsSheet() {
  const context = useContext(NBABettingTrendsSheetContext);
  if (context === undefined) {
    throw new Error('useNBABettingTrendsSheet must be used within an NBABettingTrendsSheetProvider');
  }
  return context;
}
