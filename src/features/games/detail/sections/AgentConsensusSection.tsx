import * as React from 'react';
import { ArrowDown, ArrowUp, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetCard } from '@/components/ios';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import { agentSpriteIndex } from '@/utils/agentSprites';
import { avatarBackground } from '../../components/AgentConsensusStrip';
import type { ConsensusAvatar, GameAgentConsensus } from '@/services/agentConsensusService';

/**
 * "What are the public agents betting on this game?" — one card, one question
 * (WIDGET_DESIGN.md §1). The answer is the SIDE they agree on, not the raw
 * count: agents bet nearly every game, so a count says nothing on its own.
 * See .claude/docs/18_agent_consensus.md.
 */

/** O/U picks carry colour + direction on the word itself (WIDGET_DESIGN.md §7). */
function sideDirection(side: string): 'over' | 'under' | null {
  const s = side.trim().toLowerCase();
  if (s.startsWith('over')) return 'over';
  if (s.startsWith('under')) return 'under';
  return null;
}

function AvatarRow({ avatars, total }: { avatars: ConsensusAvatar[]; total: number }) {
  if (avatars.length === 0) return null;
  const overflow = total - avatars.length;
  return (
    <div className="flex shrink-0 items-center -space-x-2">
      {avatars.map((a, i) => (
        <span
          key={a.avatarId}
          title={a.name}
          className="flex h-8 w-8 items-end justify-center overflow-hidden rounded-full border-2 border-[hsl(var(--background))]"
          style={{
            background: avatarBackground(a.color),
            zIndex: avatars.length - i,
          }}
        >
          <PixelSpriteAvatar spriteIndex={agentSpriteIndex(a.avatarId, a.spriteIndex)} height={34} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-[hsl(var(--background))] bg-black/[0.06] px-1 text-[10px] font-bold text-muted-foreground dark:bg-white/10"
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

/**
 * Agreement as one divided bar (WIDGET_DESIGN.md §5) with the flag threshold
 * ticked, so "how close was this to earning a BET flag" is readable without a
 * second sentence.
 */
function AgreementBar({ consensus }: { consensus: GameAgentConsensus }) {
  const { agents, sideAgents, threshold, flagged } = consensus;
  const sidePct = agents > 0 ? (sideAgents / agents) * 100 : 0;
  // The threshold is an agent COUNT; place its tick on the same 0-agents scale.
  const thresholdPct = agents > 0 ? Math.min(100, (threshold / agents) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            flagged ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          )}
          style={{ width: `${sidePct}%` }}
        />
        {thresholdPct > 0 && thresholdPct < 100 && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-foreground/45"
            style={{ left: `${thresholdPct}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          <span className="font-bold text-foreground">{sideAgents}</span> of {agents} agents
        </span>
        <span>
          flag needs {threshold}
          {flagged ? ' · cleared' : ''}
        </span>
      </div>
    </div>
  );
}

export function AgentConsensusSection({ consensus }: { consensus?: GameAgentConsensus }) {
  // No agents on this game is a normal state (picks land through the day), and
  // an empty card is worse than no card.
  if (!consensus || consensus.agents <= 0) return null;

  const { agents, side, sideAgents, agreement, flagged, avatars } = consensus;
  const dir = sideDirection(side);
  const pct = Math.round(agreement * 100);

  const headline = flagged
    ? `${sideAgents} of ${agents} agents are on ${side} — ${pct}% agreement.`
    : `Agents are split on this game: the most-backed side is ${side}, with only ${pct}% agreement.`;

  return (
    <WidgetCard
      icon={<UsersRound className="h-3.5 w-3.5" />}
      title="Agent Consensus"
      subtitle="What the public AI agents bet on this game, and how much they agree."
      headline={headline}
      accessory={
        flagged ? (
          <span className="flex items-center gap-1 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
            Bet
          </span>
        ) : undefined
      }
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {/* The pick — largest thing in the card (WIDGET_DESIGN.md §2). */}
        <div className="flex items-center gap-3 pb-3">
          <AvatarRow avatars={avatars} total={sideAgents} />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Most-backed side
            </div>
            <div
              className={cn(
                'flex items-center gap-1 text-xl font-bold leading-tight',
                dir === 'over' && 'text-emerald-600 dark:text-emerald-400',
                dir === 'under' && 'text-blue-600 dark:text-blue-400',
                dir === null && 'text-foreground'
              )}
            >
              {dir === 'over' && <ArrowUp className="h-4 w-4 shrink-0" />}
              {dir === 'under' && <ArrowDown className="h-4 w-4 shrink-0" />}
              <span className="truncate">{side}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xl font-bold leading-tight text-foreground">{pct}%</div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              agree
            </div>
          </div>
        </div>

        <div className="pt-3">
          <AgreementBar consensus={consensus} />
        </div>
      </div>
    </WidgetCard>
  );
}
