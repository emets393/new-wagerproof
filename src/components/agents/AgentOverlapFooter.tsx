import { AgentPickOverlap } from '@/types/agent';

interface AgentOverlapFooterProps {
  overlap: AgentPickOverlap;
}

const MAX_VISIBLE = 5;

function parseAvatarColor(color: string): { isGradient: boolean; colors: string[] } {
  if (color.startsWith('gradient:')) {
    return { isGradient: true, colors: color.replace('gradient:', '').split(',') };
  }
  return { isGradient: false, colors: [color] };
}

/**
 * "N other agents made this pick" — overlapping avatar bubbles. Styled for the
 * dark boarding-pass ticket: each bubble is ringed in the cardstock color so the
 * stack reads as punched into the ticket.
 */
export function AgentOverlapFooter({ overlap }: AgentOverlapFooterProps) {
  if (overlap.totalCount === 0) return null;

  const visible = overlap.agents.slice(0, MAX_VISIBLE);
  const overflow = overlap.totalCount - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-2 border-t border-stone-300 pt-3 dark:border-white/10">
      <div className="flex -space-x-2">
        {visible.map((agent, i) => {
          const { isGradient, colors } = parseAvatarColor(agent.avatar_color);
          return (
            <div
              key={agent.avatar_id}
              className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#f8f5ed] text-[10px] dark:border-[#141927]"
              style={{
                background: isGradient
                  ? `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
                  : colors[0],
                zIndex: MAX_VISIBLE - i,
              }}
              title={agent.name}
            >
              {agent.avatar_emoji}
            </div>
          );
        })}
        {overflow > 0 && (
          <div
            className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#f8f5ed] bg-slate-900/10 text-[9px] font-semibold text-slate-600 dark:border-[#141927] dark:bg-white/10 dark:text-white/70"
            style={{ zIndex: 0 }}
          >
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-xs text-slate-500 dark:text-white/55">
        {overlap.totalCount === 1
          ? '1 other agent made this pick'
          : `${overlap.totalCount} other agents made this pick`}
      </span>
    </div>
  );
}
