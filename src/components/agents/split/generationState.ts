import type { GeneratePicksResponse } from '@/types/agent';

export type TerminalStatus = 'idle' | 'generating' | 'success' | 'error';

/**
 * Per-agent pick-generation state, lifted to the split page so the 5-minute
 * polling promise survives switching between agents (the terminal reappears
 * live when the user returns to a still-generating agent).
 */
export interface AgentGenerationState {
  status: TerminalStatus;
  error: string | null;
  result: GeneratePicksResponse | null;
}

export type GenerationByAgent = Record<string, AgentGenerationState>;
