const STORAGE_KEY = 'wagerproof.agent-picks-seen.v1';

type SeenLedger = Record<string, string>;

function readLedger(): SeenLedger {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as SeenLedger)
      : {};
  } catch {
    return {};
  }
}

export function hasFreshAgentPicks(agentId: string, lastGeneratedAt: string | null): boolean {
  if (!lastGeneratedAt) return false;
  const seenAt = readLedger()[agentId];
  return !seenAt || new Date(lastGeneratedAt).getTime() > new Date(seenAt).getTime();
}

export function markAgentPicksSeen(agentId: string, lastGeneratedAt: string | null): void {
  if (typeof window === 'undefined' || !lastGeneratedAt) return;
  const ledger = readLedger();
  ledger[agentId] = lastGeneratedAt;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
}
