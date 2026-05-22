type AgentPickDisplayInput = {
  sport?: string | null;
  period?: string | null;
  bet_type?: string | null;
  pick_selection?: string | null;
};

export function isF5AgentPick(pick: AgentPickDisplayInput): boolean {
  return pick.period === 'f5' || /\bF5\b/i.test(pick.pick_selection ?? '');
}

export function formatAgentPickSelection(
  pick: AgentPickDisplayInput,
  selection = pick.pick_selection ?? '',
): string {
  if (!isF5AgentPick(pick) || /\bF5\b/i.test(selection)) return selection;

  if (pick.bet_type === 'moneyline' && /\bML$/i.test(selection.trim())) {
    return selection.trim().replace(/\s+ML$/i, ' F5 ML');
  }

  return `${selection.trim()} F5`;
}

export function formatAgentBetTypeLabel(baseLabel: string, pick: AgentPickDisplayInput): string {
  return isF5AgentPick(pick) ? `F5 ${baseLabel}` : baseLabel;
}
