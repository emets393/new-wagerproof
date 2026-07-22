import { PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentAvatarTile } from './AgentAvatarTile';

export interface AgentRailItem {
  id: string;
  name: string;
  color?: string | null;
  emoji?: string | null;
  spriteIndex?: number | null;
}

interface AgentsAvatarRailProps {
  items: AgentRailItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onExpand: () => void;
}

/** Compact master-column shown while a full ticket occupies the third pane. */
export function AgentsAvatarRail({ items, selectedId, onSelect, onExpand }: AgentsAvatarRailProps) {
  return (
    <aside className="flex h-full w-[72px] shrink-0 flex-col border-r border-border/60 bg-background/55 backdrop-blur-xl">
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-border/50">
        <button
          type="button"
          onClick={onExpand}
          title="Show agent list"
          aria-label="Show agent list"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground shadow-sm transition hover:bg-background hover:text-foreground"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              title={`Open ${item.name} in agent list`}
              aria-label={`Open ${item.name} in agent list`}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'relative grid h-14 w-full place-items-center rounded-2xl transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                selected && 'bg-primary/10 ring-1 ring-primary/35',
              )}
            >
              <AgentAvatarTile
                agentId={item.id}
                spriteIndexOverride={item.spriteIndex}
                emoji={item.emoji}
                color={item.color}
                size={42}
                round
              />
              {selected && <span className="absolute -right-0.5 h-5 w-1 rounded-l-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
