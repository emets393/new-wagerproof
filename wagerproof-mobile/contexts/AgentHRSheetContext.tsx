import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { AgentWithPerformance } from '@/types/agent';

interface AgentHRSheetContextType {
  isOpen: boolean;
  agents: AgentWithPerformance[];
  openSheet: (agents: AgentWithPerformance[]) => void;
  closeSheet: () => void;
  bottomSheetRef: React.RefObject<BottomSheet | null>;
}

const AgentHRSheetContext = createContext<AgentHRSheetContextType | undefined>(undefined);

export function AgentHRSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [agents, setAgents] = useState<AgentWithPerformance[]>([]);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const openSheet = useCallback((agentData: AgentWithPerformance[]) => {
    setAgents(agentData);
    setIsOpen(true);
    requestAnimationFrame(() => {
      bottomSheetRef.current?.snapToIndex(0);
    });
  }, []);

  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.close();
    setTimeout(() => {
      setIsOpen(false);
    }, 300);
  }, []);

  return (
    <AgentHRSheetContext.Provider
      value={{ isOpen, agents, openSheet, closeSheet, bottomSheetRef }}
    >
      {children}
    </AgentHRSheetContext.Provider>
  );
}

export function useAgentHRSheet() {
  const context = useContext(AgentHRSheetContext);
  if (context === undefined) {
    throw new Error('useAgentHRSheet must be used within an AgentHRSheetProvider');
  }
  return context;
}
