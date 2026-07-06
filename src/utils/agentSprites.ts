/**
 * Agent pixel-sprite selection — mirrors iOS Agent.spriteIndex /
 * AgentSpriteIndex.forSeed so web, iOS and RN all pick the same character.
 * Sprites are 8 pre-drawn sheets in public/pixel-office/avatar_{0..7}.png
 * (384×576, 8 cols × 9 rows of 48×64 frames).
 */

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** Stable FNV-1a(id) % 8 — matches the Swift implementation exactly. */
export function spriteIndexForSeed(seed: string): number {
  let h = FNV_OFFSET;
  const bytes = new TextEncoder().encode(seed);
  for (const b of bytes) {
    h = ((h ^ BigInt(b)) * FNV_PRIME) & MASK_64;
  }
  return Number(h % 8n);
}

/** Explicit avatar_profiles.sprite_index override wins; else hash the id. */
export function agentSpriteIndex(agentId: string, spriteIndexOverride?: number | null): number {
  if (
    spriteIndexOverride !== null &&
    spriteIndexOverride !== undefined &&
    spriteIndexOverride >= 0 &&
    spriteIndexOverride <= 7
  ) {
    return spriteIndexOverride;
  }
  return spriteIndexForSeed(agentId);
}
