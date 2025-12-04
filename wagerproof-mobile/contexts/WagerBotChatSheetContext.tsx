import React, { createContext, useContext, useRef, ReactNode } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';

interface WagerBotChatSheetContextType {
  openChatSheet: () => void;
  closeChatSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet>;
}

const WagerBotChatSheetContext = createContext<WagerBotChatSheetContextType | undefined>(undefined);

export function WagerBotChatSheetProvider({ children }: { children: ReactNode }) {
  const bottomSheetRef = useRef<BottomSheet>(null);

  console.log('⭐ WagerBotChatSheetProvider RENDERING');
  console.log('⭐ bottomSheetRef created:', bottomSheetRef);

  const openChatSheet = () => {
    console.log('🔵 openChatSheet called');
    console.log('🔵 bottomSheetRef.current:', bottomSheetRef.current);
    if (bottomSheetRef.current) {
      console.log('🔵 Calling snapToIndex(0)');
      bottomSheetRef.current.snapToIndex(0);
      console.log('🔵 snapToIndex called');
    } else {
      console.error('🔴 bottomSheetRef.current is NULL!');
    }
  };

  const closeChatSheet = () => {
    console.log('🔵 closeChatSheet called');
    bottomSheetRef.current?.close();
  };

  return (
    <WagerBotChatSheetContext.Provider
      value={{
        openChatSheet,
        closeChatSheet,
        bottomSheetRef,
      }}
    >
      {children}
    </WagerBotChatSheetContext.Provider>
  );
}

export function useWagerBotChatSheet() {
  const context = useContext(WagerBotChatSheetContext);
  if (context === undefined) {
    throw new Error('useWagerBotChatSheet must be used within a WagerBotChatSheetProvider');
  }
  return context;
}

