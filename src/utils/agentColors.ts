/**
 * Agent avatar color handling. `avatar_color` is either a solid "#hex" or
 * "gradient:#a,#b". Previously copy-pasted across AgentCard,
 * PublicAgentDetail and AgentLeaderboard — single source of truth now.
 */

export const DEFAULT_AGENT_COLOR = '#6366f1';

export function parseAvatarColor(value: string): { isGradient: boolean; colors: string[] } {
  if (value.startsWith('gradient:')) {
    return { isGradient: true, colors: value.replace('gradient:', '').split(',') };
  }
  return { isGradient: false, colors: [value] };
}

export function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) return value.replace('gradient:', '').split(',')[0];
  return value;
}

/** CSS background for avatar tiles: gradient string or the solid color. */
export function getAvatarBackground(value: string): string {
  if (value.startsWith('gradient:')) {
    const [c1, c2] = value.replace('gradient:', '').split(',');
    return `linear-gradient(135deg, ${c1}, ${c2 ?? deriveDarkerPartner(c1)})`;
  }
  return value;
}

/**
 * Darker companion for solid-color agents so tiles can always be two-tone
 * (mirrors the iOS `shaded(by:)` helper).
 */
export function deriveDarkerPartner(hex: string, factor = 0.55): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const r = Math.round(parseInt(raw.substring(0, 2), 16) * factor);
  const g = Math.round(parseInt(raw.substring(2, 4), 16) * factor);
  const b = Math.round(parseInt(raw.substring(4, 6), 16) * factor);
  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** [primary, secondary] pair for gradients/tiles regardless of stored format. */
export function getAgentColorPair(value: string | null | undefined): [string, string] {
  const parsed = parseAvatarColor(value || DEFAULT_AGENT_COLOR);
  const primary = parsed.colors[0] || DEFAULT_AGENT_COLOR;
  const secondary = parsed.isGradient && parsed.colors[1] ? parsed.colors[1] : deriveDarkerPartner(primary);
  return [primary, secondary];
}
