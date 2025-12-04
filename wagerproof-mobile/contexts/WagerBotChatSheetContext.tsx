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

  const openChatSheet = () => {
    bottomSheetRef.current?.snapToIndex(0);
  };

  const closeChatSheet = () => {
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

