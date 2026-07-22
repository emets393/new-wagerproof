import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgentParlayCard } from '../AgentParlayCard';
import { AgentPickAuditPanel } from '../AgentPickAuditPanel';
import { AgentPickCard } from '../AgentPickCard';
import type { AgentHistoryItem } from './AgentPicksSection';

interface TicketDetailPaneProps {
  item: AgentHistoryItem;
  accent?: string;
  onClose: () => void;
}

export function TicketDetailPane({ item, accent, onClose }: TicketDetailPaneProps) {
  const [showAudit, setShowAudit] = React.useState(false);
  const itemId = item.kind === 'pick' ? item.pick.id : item.parlay.id;

  React.useEffect(() => {
    setShowAudit(false);
  }, [itemId]);

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background/45">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-foreground">Full Ticket Details</h2>
          <p className="truncate text-xs text-muted-foreground">
            Complete selection, grading, and agent reasoning data.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={onClose} aria-label="Close ticket details">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mx-auto max-w-2xl p-4 pb-12 sm:p-6">
        {showAudit && item.kind === 'pick' ? (
          <AgentPickAuditPanel pick={item.pick} onBack={() => setShowAudit(false)} />
        ) : item.kind === 'pick' ? (
          <AgentPickCard pick={item.pick} accent={accent} onOpenAudit={() => setShowAudit(true)} />
        ) : (
          <AgentParlayCard parlay={item.parlay} accent={accent} />
        )}
      </div>
    </div>
  );
}
