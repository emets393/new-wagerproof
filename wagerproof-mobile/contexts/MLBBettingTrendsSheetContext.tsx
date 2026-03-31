import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { MLBGameTrendsData } from '@/types/mlbBettingTrends';

interface MLBBettingTrendsSheetContextType {
  selectedGameTrends: MLBGameTrendsData | null;
  openTrendsSheet: (game: MLBGameTrendsData) => void;
  closeTrendsSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet | null>;
}

const noop = () => {};
const noopRef = { current: null };

const MLBBettingTrendsSheetContext = createContext<MLBBettingTrendsSheetContextType>({
  selectedGameTrends: null,
  openTrendsSheet: noop,
  closeTrendsSheet: noop,
  bottomSheetRef: noopRef,
});

export function MLBBettingTrendsSheetProvider({ children }: { children: ReactNode }) {
  const [selectedGameTrends, setSelectedGameTrends] = useState<MLBGameTrendsData | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openTrendsSheet = (game: MLBGameTrendsData) => {
    setSelectedGameTrends(game);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const closeTrendsSheet = () => {
    setSelectedGameTrends(null);
    bottomSheetRef.current?.close();
  };

  return (
    <MLBBettingTrendsSheetContext.Provider
      value={{
        selectedGameTrends,
        openTrendsSheet,
        closeTrendsSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </MLBBettingTrendsSheetContext.Provider>
  );
}

export function useMLBBettingTrendsSheet() {
  return useContext(MLBBettingTrendsSheetContext);
}
