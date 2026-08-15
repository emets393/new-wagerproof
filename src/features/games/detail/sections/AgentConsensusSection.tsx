import * as React from 'react';
import { ArrowDown, ArrowUp, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetCard } from '@/components/ios';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import { agentSpriteIndex } from '@/utils/agentSprites';
import { avatarBackground } from '../../components/AgentConsensusStrip';
import {
  VERDICT_WORD,
  consensusBarLegend,
  consensusHeadline,
  consensusOtherAgents,
  consensusSlateRankLabel,
  consensusVerdict,
  mostBackedLabel,
  sharePopulationLabel,
  type ConsensusVerdict,
} from '../../consensusCopy';
import type { ConsensusAvatar, GameAgentConsensus } from '@/services/agentConsensusService';

/**
 * "What are the public agents betting on this game?" — one card, one question
 * (WIDGET_DESIGN.md §1). The answer is the SIDE they agree on, not the raw
 * count: agents bet nearly every game, so a count says nothing on its own.
 *
 * The card states a VERDICT and hides the mechanism (WIDGET_DESIGN.md §2, §4).
 * Field size is not a bullish signal — it is the sample size that makes the
 * percentage trustworthy — so it lives in the bar legend, not in a gate readout.
 * See .claude/docs/18_agent_consensus.md.
 */

/** Chip tones. Emerald is Tailwind emerald-500, the token this feature owns. */
const VERDICT_CHIP: Record<ConsensusVerdict, string> = {
  consensus: 'bg-emerald-500 text-white',
  lean: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  split: 'bg-black/[0.06] text-muted-foreground dark:bg-white/10',
  tooFew: 'bg-black/[0.06] text-muted-foreground dark:bg-white/10',
};

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
 * The market split as ONE divided bar (WIDGET_DESIGN.md §5): leader ·
 * runner-up · everyone else. The old single fill drew the other 49% as an
 * unlabelled grey remainder, which made a coin flip read as a lean.
 *
 * Segments are agent counts over `marketAgents`. Dividing by every agent on the
 * game compares one selection against a field spread across six bet shapes,
 * which reads as disagreement even when the market itself is unanimous.
 */
function AgreementBar({ consensus }: { consensus: GameAgentConsensus }) {
  const { marketAgents, sideAgents, runnerUpAgents, flagged } = consensus;
  const total = Math.max(marketAgents, 1);
  const leaderPct = Math.min(100, (sideAgents / total) * 100);
  const runnerUpPct = Math.min(100 - leaderPct, ((runnerUpAgents ?? 0) / total) * 100);
  const otherPct = Math.max(
    0,
    Math.min(100 - leaderPct - runnerUpPct, (consensusOtherAgents(consensus) / total) * 100)
  );
  const rank = consensusSlateRankLabel(consensus);

  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
        <div
          className={cn(
            'h-full transition-[width]',
            flagged ? 'bg-emerald-500' : 'bg-foreground/55'
          )}
          style={{ width: `${leaderPct}%` }}
        />
        {runnerUpPct > 0 && (
          <div className="h-full bg-muted-foreground/45" style={{ width: `${runnerUpPct}%` }} />
        )}
        {otherPct > 0 && (
          <div className="h-full bg-muted-foreground/20" style={{ width: `${otherPct}%` }} />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        {/* Named counts, so the percentage has a visible numerator AND a visible
            denominator instead of one bar and a bare number. */}
        <span className="truncate">{consensusBarLegend(consensus).join(' · ')}</span>
        {/* Replaces "flag needs N". Reading 51% against today's board is what
            makes it mean anything; the gate behind the verdict is not shown. */}
        {rank && <span className="shrink-0">{rank}</span>}
      </div>
    </div>
  );
}

export function AgentConsensusSection({ consensus }: { consensus?: GameAgentConsensus }) {
  // No agents on this game is a normal state (picks land through the day), and
  // an empty card is worse than no card.
  if (!consensus || consensus.agents <= 0) return null;

  const { side, sideAgents, agreement, avatars } = consensus;
  const dir = sideDirection(side);
  const pct = Math.round(agreement * 100);
  const verdict = consensusVerdict(consensus);

  return (
    <WidgetCard
      icon={<UsersRound className="h-3.5 w-3.5" />}
      title="Agent Consensus"
      subtitle="Independent picks from the public AI agents on this game."
      headline={consensusHeadline(consensus)}
      accessory={
        // Always present — its COLOUR is what makes a consensus game pop, not
        // its existence. A chip on only the ~21% that flag leaves the other 79%
        // looking unlabelled rather than deliberately quiet. "Bet" is retired:
        // it read as an instruction from the app and collided with the
        // model-signal badges the same card carries.
        <span
          className={cn(
            'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
            VERDICT_CHIP[verdict]
          )}
        >
          {verdict === 'consensus' && <span className="h-1.5 w-1.5 rounded-full bg-white/90" />}
          {VERDICT_WORD[verdict]}
        </span>
      }
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {/* The pick — largest thing in the card (WIDGET_DESIGN.md §2). */}
        <div className="flex items-center gap-3 pb-3">
          <AvatarRow avatars={avatars} total={sideAgents} />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              {mostBackedLabel(consensus)}
            </div>
            <div
              className={cn(
                'flex items-start gap-1 text-xl font-bold leading-tight',
                dir === 'over' && 'text-emerald-600 dark:text-emerald-400',
                dir === 'under' && 'text-blue-600 dark:text-blue-400',
                dir === null && 'text-foreground'
              )}
            >
              {dir === 'over' && <ArrowUp className="mt-1 h-4 w-4 shrink-0" />}
              {dir === 'under' && <ArrowDown className="mt-1 h-4 w-4 shrink-0" />}
              {/* Wraps rather than truncates: a selection like "Pittsburgh
                  Pirates F5 -0.5" is unreadable clipped, and the pick is the
                  one thing this card exists to state. */}
              <span className="break-words">{side}</span>
            </div>
          </div>
          {/* Suppressed on `tooFew`: "50%" off a 2-agent market is theatre, and
              the headline already says how few bet it. */}
          {verdict !== 'tooFew' && (
            <div className="shrink-0 text-right">
              <div className="text-xl font-bold leading-tight text-foreground">{pct}%</div>
              {/* "agree" alone never said agree with WHOM, or over which
                  population — the denominator is the agents who bet this
                  market, not everyone who bet the game. */}
              <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                {sharePopulationLabel(consensus)}
              </div>
            </div>
          )}
        </div>

        <div className="pt-3">
          <AgreementBar consensus={consensus} />
        </div>
      </div>
    </WidgetCard>
  );
}
