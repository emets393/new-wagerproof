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

export function AgentOverlapFooter({ overlap }: AgentOverlapFooterProps) {
  if (overlap.totalCount === 0) return null;

  const visible = overlap.agents.slice(0, MAX_VISIBLE);
  const overflow = overlap.totalCount - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
      <div className="flex -space-x-2">
        {visible.map((agent, i) => {
          const { isGradient, colors } = parseAvatarColor(agent.avatar_color);
          return (
            <div
              key={agent.avatar_id}
              className="relative flex items-center justify-center h-6 w-6 rounded-full border-2 border-card text-[10px]"
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
            className="relative flex items-center justify-center h-6 w-6 rounded-full border-2 border-card bg-muted text-[9px] font-semibold text-muted-foreground"
            style={{ zIndex: 0 }}
          >
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {overlap.totalCount === 1
          ? '1 other agent made this pick'
          : `${overlap.totalCount} other agents made this pick`}
      </span>
    </div>
  );
}
