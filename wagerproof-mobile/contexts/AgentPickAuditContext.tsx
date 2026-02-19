import React, { createContext, useCallback, useContext, useState } from 'react';
import { AgentPick } from '@/types/agent';

interface AgentPickAuditContextType {
  selectedAgentPick: AgentPick | null;
  setAgentPickForAudit: (pick: AgentPick | null) => void;
  clearAgentPickAudit: () => void;
}

const AgentPickAuditContext = createContext<AgentPickAuditContextType | undefined>(undefined);

export function AgentPickAuditProvider({ children }: { children: React.ReactNode }) {
  const [selectedAgentPick, setSelectedAgentPick] = useState<AgentPick | null>(null);

  const setAgentPickForAudit = useCallback((pick: AgentPick | null) => {
    setSelectedAgentPick(pick);
  }, []);

  const clearAgentPickAudit = useCallback(() => {
    setSelectedAgentPick(null);
  }, []);

  return (
    <AgentPickAuditContext.Provider
      value={{ selectedAgentPick, setAgentPickForAudit, clearAgentPickAudit }}
    >
      {children}
    </AgentPickAuditContext.Provider>
  );
}

export function useAgentPickAudit() {
  const context = useContext(AgentPickAuditContext);
  if (!context) {
    throw new Error('useAgentPickAudit must be used within an AgentPickAuditProvider');
  }
  return context;
}

