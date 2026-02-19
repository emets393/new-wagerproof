import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentGenerationTerminal, AgentPerformanceCharts, AgentPickAuditPanel, AgentPickCard } from '@/components/agents';
import { useAgent, useAgentPicks, useGenerateAgentPicks } from '@/hooks/useAgents';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { AgentPick, GeneratePicksResponse, PICK_RESULTS, SPORTS, PickResult, Sport } from '@/types/agent';

export default function AgentDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: agent, isLoading: agentLoading } = useAgent(id);
  const { isAdmin } = useAgentEntitlements();

  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all');
  const [resultFilter, setResultFilter] = useState<PickResult | 'all'>('all');
  const [selectedPick, setSelectedPick] = useState<AgentPick | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [lastGenerationResult, setLastGenerationResult] = useState<GeneratePicksResponse | null>(null);

  const { data: picks, isLoading: picksLoading, refetch } = useAgentPicks(id, {
    sport: sportFilter === 'all' ? undefined : sportFilter,
    result: resultFilter === 'all' ? undefined : resultFilter,
  });

  const generateMutation = useGenerateAgentPicks();
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!id) return;
    setGenerateError(null);
    setTerminalStatus('generating');
    try {
      const result = await generateMutation.mutateAsync({ agentId: id, isAdmin });
      setLastGenerationResult(result);
      setTerminalStatus('success');
      refetch();
    } catch (err: any) {
      const message = err?.message || 'Failed to generate picks.';
      setGenerateError(message);
      setTerminalStatus('error');
    }
  };

  const handleOpenAudit = (pick: AgentPick) => {
    setSelectedPick((prev) => (prev?.id === pick.id ? null : pick));
  };

  const sortedPicks = useMemo(() => (picks || []), [picks]);

  if (agentLoading) return <div className="py-10 text-center">Loading agent...</div>;
  if (!agent) return <div className="py-10 text-center">Agent not found.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/agents')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>{agent.avatar_emoji || '🤖'}</span>
              <span>{agent.name}</span>
            </h1>
            <p className="text-sm text-muted-foreground">{agent.preferred_sports.map((s) => s.toUpperCase()).join(' • ')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/agents/${id}/settings`)}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
            <Sparkles className="mr-2 h-4 w-4" />
            {generateMutation.isPending ? 'Generating...' : 'Generate Picks'}
          </Button>
        </div>
      </div>

      {generateError ? <p className="text-sm text-destructive">{generateError}</p> : null}

      <AgentPerformanceCharts agent={agent} />
      <AgentGenerationTerminal status={terminalStatus} errorMessage={generateError} result={lastGenerationResult} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Picks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Select value={sportFilter} onValueChange={(v) => setSportFilter(v as any)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sport" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sports</SelectItem>
                {SPORTS.map((sport) => (
                  <SelectItem key={sport} value={sport}>{sport.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as any)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Result" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                {PICK_RESULTS.map((result) => (
                  <SelectItem key={result} value={result}>{result.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {picksLoading ? <p className="text-sm text-muted-foreground">Loading picks...</p> : null}
          {!picksLoading && sortedPicks.length === 0 ? <p className="text-sm text-muted-foreground">No picks found for current filters.</p> : null}

          {!selectedPick ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sortedPicks.map((pick) => (
                <AgentPickCard key={pick.id} pick={pick} onOpenAudit={handleOpenAudit} />
              ))}
            </div>
          ) : (
            <AgentPickAuditPanel pick={selectedPick} onBack={() => setSelectedPick(null)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
