import * as React from 'react';
import { cn } from '@/lib/utils';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import { agentSpriteIndex } from '@/utils/agentSprites';
import type { ConsensusAvatar, GameAgentConsensus } from '@/services/agentConsensusService';

const MAX_VISIBLE = 4;

/** avatar_color is either a hex string or "gradient:#aaa,#bbb". */
export function avatarBackground(color: string | null): string {
  if (!color) return '#64748b';
  if (color.startsWith('gradient:')) {
    const [from, to] = color.replace('gradient:', '').split(',');
    return `linear-gradient(135deg, ${from}, ${to ?? from})`;
  }
  return color;
}

/**
 * Overlapping agent bubbles ringed in the card surface. Each bubble is the
 * agent's PIXEL-PERSON sprite, never an emoji — the sprite is the agent's
 * identity across the product. `avatar_color` is only the halo behind it.
 */
function AvatarStack({
  avatars,
  overflow,
  ringClass,
}: {
  avatars: ConsensusAvatar[];
  overflow: number;
  ringClass: string;
}) {
  if (avatars.length === 0) return null;
  return (
    <div className="flex shrink-0 -space-x-1.5">
      {avatars.map((a, i) => (
        <span
          key={a.avatarId}
          title={a.name}
          className={cn(
            'flex h-5 w-5 items-end justify-center overflow-hidden rounded-full border',
            ringClass
          )}
          style={{ background: avatarBackground(a.color), zIndex: MAX_VISIBLE - i }}
        >
          {/* Slightly taller than the bubble and bottom-anchored so the sprite's
              head fills the circle instead of floating in the middle. */}
          <PixelSpriteAvatar spriteIndex={agentSpriteIndex(a.avatarId, a.spriteIndex)} height={22} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[8px] font-bold leading-none',
            ringClass,
            'bg-slate-900/10 text-slate-600 dark:bg-white/15 dark:text-white/75'
          )}
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

/**
 * Agent-consensus row on a game card. ONE shape, two treatments:
 *   flagged  → emerald strip: avatar stack + "31 of 35 on <SIDE>" + CONSENSUS
 *   agents   → the same line, muted, no chip
 *   none     → renders nothing
 *
 * The unflagged tier used to render a bare participation count ("45 agents")
 * beside winning-SIDE faces — a number that says how many agents ran that day,
 * not what they think, next to a stack making a claim it never stated. Both
 * tiers now name the side and carry the denominator; colour alone separates
 * "worth pointing at" from "here's what they did".
 *
 * The count alone is deliberately NOT enough to earn the flag: agents bet
 * nearly every game, so participation flags ~96% of a slate. Only agreement
 * (see get_game_agent_consensus) turns the strip green.
 */
export function AgentConsensusStrip({ consensus }: { consensus: GameAgentConsensus }) {
  const { agents, side, sideAgents, marketAgents, flagged, avatars } = consensus;
  if (agents <= 0) return null;

  const visible = avatars.slice(0, MAX_VISIBLE);
  // Always the WINNING side, in both tiers — the stack is claiming "these
  // agents are on this side", so counting the whole game beside it mislabels
  // the faces.
  const overflow = sideAgents - visible.length;

  if (!flagged) {
    return (
      <div className="relative mt-1.5 flex items-center gap-1.5">
        <AvatarStack
          avatars={visible}
          overflow={overflow}
          ringClass="border-white/70 dark:border-white/15"
        />
        <span className="truncate text-[10px] font-medium text-muted-foreground">
          {sideAgents} of {marketAgents} on <span className="font-bold uppercase">{side}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="relative mt-1.5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5">
      <AvatarStack
        avatars={visible}
        overflow={overflow}
        ringClass="border-emerald-50 dark:border-emerald-950"
      />

      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
        {sideAgents} of {marketAgents} on <span className="font-bold uppercase">{side}</span>
      </span>

      {/* Not "Bet": that reads as an instruction from the app, and it sat one
          row away from the model-signal badges, which are a different claim. */}
      <span className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
        Consensus
      </span>
    </div>
  );
}
