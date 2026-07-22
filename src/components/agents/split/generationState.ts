import type { GeneratePicksResponse } from '@/types/agent';

export type TerminalStatus = 'idle' | 'generating' | 'success' | 'error';

export interface AgentGenerationProgress {
  phase?: string;
  phaseDetail?: string;
  currentTool?: string;
  currentToolDetail?: string;
  turn?: number;
  maxTurns?: number;
  toolCalls?: number;
  picksAccepted?: number;
  picksRejected?: number;
}

/**
 * Per-agent pick-generation state, lifted to the split page so the 5-minute
 * polling promise survives switching between agents (the terminal reappears
 * live when the user returns to a still-generating agent).
 */
export interface AgentGenerationState {
  status: TerminalStatus;
  error: string | null;
  result: GeneratePicksResponse | null;
  progress: AgentGenerationProgress | null;
}

export type GenerationByAgent = Record<string, AgentGenerationState>;

const GENERATION_STORAGE_KEY = 'wagerproof-active-agent-generations-v1';
const GENERATION_EVENT = 'wagerproof:agent-generation-state';
const GENERATION_STALE_AFTER_MS = 12 * 60 * 1000;

interface PersistedGeneration {
  state: AgentGenerationState;
  updatedAt: number;
}

type PersistedGenerations = Record<string, PersistedGeneration>;

function readPersisted(): PersistedGenerations {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GENERATION_STORAGE_KEY) || '{}') as PersistedGenerations;
    const cutoff = Date.now() - GENERATION_STALE_AFTER_MS;
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value?.state?.status === 'generating' && value.updatedAt >= cutoff));
  } catch {
    return {};
  }
}

export function loadActiveGenerations(): GenerationByAgent {
  return Object.fromEntries(Object.entries(readPersisted()).map(([agentId, value]) => [agentId, value.state]));
}

/** Keeps active terminal state alive across route unmounts in the same app session. */
export function persistActiveGeneration(agentId: string, state: AgentGenerationState) {
  if (typeof window === 'undefined') return;
  const next = readPersisted();
  next[agentId] = { state, updatedAt: Date.now() };
  window.localStorage.setItem(GENERATION_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(GENERATION_EVENT));
}

export function clearActiveGeneration(agentId: string) {
  if (typeof window === 'undefined') return;
  const next = readPersisted();
  delete next[agentId];
  window.localStorage.setItem(GENERATION_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(GENERATION_EVENT));
}

export function subscribeToActiveGenerations(listener: (state: GenerationByAgent) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const notify = () => listener(loadActiveGenerations());
  window.addEventListener(GENERATION_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(GENERATION_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}
