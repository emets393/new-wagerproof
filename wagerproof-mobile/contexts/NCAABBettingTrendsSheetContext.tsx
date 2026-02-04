import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { NCAABGameTrendsData } from '@/types/ncaabBettingTrends';

interface NCAABBettingTrendsSheetContextType {
  selectedGameTrends: NCAABGameTrendsData | null;
  openTrendsSheet: (game: NCAABGameTrendsData) => void;
  closeTrendsSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const NCAABBettingTrendsSheetContext = createContext<NCAABBettingTrendsSheetContextType | undefined>(undefined);

export function NCAABBettingTrendsSheetProvider({ children }: { children: ReactNode }) {
  const [selectedGameTrends, setSelectedGameTrends] = useState<NCAABGameTrendsData | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openTrendsSheet = (game: NCAABGameTrendsData) => {
    setSelectedGameTrends(game);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const closeTrendsSheet = () => {
    setSelectedGameTrends(null);
    bottomSheetRef.current?.close();
  };

  return (
    <NCAABBettingTrendsSheetContext.Provider
      value={{
        selectedGameTrends,
        openTrendsSheet,
        closeTrendsSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </NCAABBettingTrendsSheetContext.Provider>
  );
}

export function useNCAABBettingTrendsSheet() {
  const context = useContext(NCAABBettingTrendsSheetContext);
  if (context === undefined) {
    throw new Error('useNCAABBettingTrendsSheet must be used within an NCAABBettingTrendsSheetProvider');
  }
  return context;
}
