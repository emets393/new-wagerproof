import { Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentPick } from '@/types/agent';
import { useToast } from '@/hooks/use-toast';

interface AgentPickAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pick: AgentPick | null;
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function AgentPickAuditModal({ open, onOpenChange, pick }: AgentPickAuditModalProps) {
  const { toast } = useToast();

  const copyJson = (value: unknown) => {
    navigator.clipboard.writeText(stringify(value));
    toast({
      title: 'Copied',
      description: 'Audit payload copied to clipboard.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Pick Audit</DialogTitle>
          <DialogDescription>
            {pick ? `${pick.matchup} • ${pick.pick_selection}` : 'No pick selected'}
          </DialogDescription>
        </DialogHeader>

        {!pick ? null : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{pick.sport.toUpperCase()}</Badge>
              <Badge variant="outline">{pick.bet_type.toUpperCase()}</Badge>
              <Badge variant="outline">{pick.result.toUpperCase()}</Badge>
              <Badge variant="outline">Confidence {pick.confidence}/5</Badge>
              <Badge variant="outline">{pick.units}u</Badge>
            </div>

            <Tabs defaultValue="reasoning">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
                <TabsTrigger value="trace">Decision Trace</TabsTrigger>
                <TabsTrigger value="payload">Audit Payload</TabsTrigger>
              </TabsList>

              <TabsContent value="reasoning" className="space-y-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Model Reasoning</p>
                  <p className="text-sm leading-relaxed">{pick.reasoning_text}</p>
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Key Factors</p>
                  {pick.key_factors?.length ? (
                    <ul className="space-y-2 text-sm">
                      {pick.key_factors.map((factor, idx) => (
                        <li key={`${pick.id}-audit-factor-${idx}`}>{factor}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No key factors were recorded for this pick.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="trace" className="space-y-4">
                {pick.ai_decision_trace ? (
                  <>
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Rationale Summary</p>
                      <p className="text-sm leading-relaxed">{pick.ai_decision_trace.rationale_summary}</p>
                    </div>

                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Personality Alignment</p>
                      <p className="text-sm leading-relaxed">{pick.ai_decision_trace.personality_alignment}</p>
                    </div>

                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Leaned Metrics</p>
                      {pick.ai_decision_trace.leaned_metrics.length ? (
                        <div className="space-y-2">
                          {pick.ai_decision_trace.leaned_metrics.map((metric, idx) => (
                            <div key={`${pick.id}-metric-${idx}`} className="rounded border border-border/70 p-2">
                              <p className="text-sm font-medium">{metric.metric_key}: {metric.metric_value}</p>
                              <p className="text-sm text-muted-foreground">{metric.why_it_mattered}</p>
                              <p className="text-xs text-muted-foreground mt-1">Trait: {metric.personality_trait}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No leaned metrics were recorded.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">No decision trace is available for this pick.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payload" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => copyJson(pick.ai_audit_payload || pick.archived_game_data)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy JSON
                  </Button>
                </div>
                <pre className="rounded-md border bg-muted/20 p-3 text-xs overflow-x-auto">
                  {stringify(pick.ai_audit_payload || pick.archived_game_data)}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
