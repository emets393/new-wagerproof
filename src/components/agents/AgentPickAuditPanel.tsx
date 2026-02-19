import { Copy, ArrowLeft } from 'lucide-react';
import Dither from '@/components/Dither';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentPick } from '@/types/agent';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext';

interface AgentPickAuditPanelProps {
  pick: AgentPick;
  onBack: () => void;
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function AgentPickAuditPanel({ pick, onBack }: AgentPickAuditPanelProps) {
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const copyJson = (value: unknown) => {
    navigator.clipboard.writeText(stringify(value));
    toast({
      title: 'Copied',
      description: 'Audit payload copied to clipboard.',
    });
  };

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="absolute inset-0">
        <Dither />
      </div>
      <div className="relative z-10 p-4">
        <div
          className="rounded-xl border p-4 md:p-5 space-y-4"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: isDark ? '0 8px 32px 0 rgba(31, 38, 135, 0.5)' : '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
            borderColor: isDark ? 'rgba(0, 230, 118, 0.25)' : 'rgba(0, 186, 98, 0.28)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-mono mb-1" style={{ color: isDark ? '#9fb3ad' : '#7f908c' }}>
                terminal://pick-audit/{pick.id}
              </p>
              <h3 className="text-lg font-semibold truncate">{pick.matchup}</h3>
              <p className="text-sm text-muted-foreground truncate">{pick.pick_selection}</p>
            </div>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Picks
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{pick.sport.toUpperCase()}</Badge>
            <Badge variant="outline">{pick.bet_type.toUpperCase()}</Badge>
            <Badge variant="outline">{pick.result.toUpperCase()}</Badge>
            <Badge variant="outline">Confidence {pick.confidence}/5</Badge>
            <Badge variant="outline">{pick.units}u</Badge>
          </div>

          <Tabs defaultValue="analysis">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="payload">Audit Payload</TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="space-y-3 mt-3">
              <div className="rounded-md border p-3 bg-background/30">
                <p className="text-xs font-medium text-muted-foreground mb-2">Model Reasoning</p>
                <p className="text-sm leading-relaxed">{pick.reasoning_text}</p>
              </div>

              <div className="relative rounded-md overflow-hidden">
                <div className="absolute inset-0">
                  <Dither />
                </div>
                <div
                  className="relative z-10 rounded-md border p-3"
                  style={{
                    background: isDark ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.68)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    borderColor: isDark ? 'rgba(0, 230, 118, 0.22)' : 'rgba(0, 186, 98, 0.22)',
                  }}
                >
                  <p className="text-xs font-medium mb-2" style={{ color: isDark ? '#9fb3ad' : '#5b6e69' }}>
                    Key Factors
                  </p>
                  {pick.key_factors?.length ? (
                    <ul className="space-y-2 text-sm">
                      {pick.key_factors.map((factor, idx) => (
                        <li key={`${pick.id}-audit-factor-${idx}`} className="font-mono">
                          {'>'} {factor}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No key factors were recorded for this pick.</p>
                  )}
                </div>
              </div>
              {pick.ai_decision_trace ? (
                <>
                  <div className="rounded-md border p-3 bg-background/30">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Rationale Summary</p>
                    <p className="text-sm leading-relaxed">{pick.ai_decision_trace.rationale_summary}</p>
                  </div>

                  <div className="rounded-md border p-3 bg-background/30">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Personality Alignment</p>
                    <p className="text-sm leading-relaxed">{pick.ai_decision_trace.personality_alignment}</p>
                  </div>

                  <div className="rounded-md border p-3 bg-background/30">
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
                <div className="rounded-md border p-3 bg-background/30">
                  <p className="text-sm text-muted-foreground">No decision trace is available for this pick.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="payload" className="space-y-3 mt-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => copyJson(pick.ai_audit_payload || pick.archived_game_data)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </div>
              <pre className="rounded-md border bg-background/40 p-3 text-xs overflow-x-auto">
                {stringify(pick.ai_audit_payload || pick.archived_game_data)}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
