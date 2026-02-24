import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Globe, Lock, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentPerformanceCharts, AgentPickCard, AgentPickAuditPanel } from '@/components/agents';
import { useAgent, useAgentPicks } from '@/hooks/useAgents';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  AgentPick,
  PersonalityParams,
  PICK_RESULTS,
  PickResult,
  Sport,
  SPORTS,
  formatNetUnits,
  formatRecord,
  formatStreak,
} from '@/types/agent';

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

function getPersonalityPills(params: PersonalityParams | null | undefined): string[] {
  if (!params) return [];
  const pills: string[] = [];

  const riskMap: Record<number, string> = { 1: 'Very Safe', 2: 'Conservative', 4: 'Aggressive', 5: 'High Risk' };
  if (params.risk_tolerance && riskMap[params.risk_tolerance]) pills.push(riskMap[params.risk_tolerance]);

  const betTypeMap: Record<string, string> = { spread: 'Spreads', moneyline: 'Moneylines', total: 'Totals' };
  if (params.preferred_bet_type && betTypeMap[params.preferred_bet_type]) pills.push(betTypeMap[params.preferred_bet_type]);

  const underdogMap: Record<number, string> = { 1: 'Chalk Only', 2: 'Favors Favorites', 4: 'Likes Underdogs', 5: 'Underdog Hunter' };
  if (params.underdog_lean && underdogMap[params.underdog_lean]) pills.push(underdogMap[params.underdog_lean]);

  const ouMap: Record<number, string> = { 1: 'Unders', 2: 'Leans Under', 4: 'Leans Over', 5: 'Overs' };
  if (params.over_under_lean && ouMap[params.over_under_lean]) pills.push(ouMap[params.over_under_lean]);

  if (params.chase_value) pills.push('Value Hunter');
  if (params.fade_public) pills.push('Fades Public');

  const confMap: Record<number, string> = { 1: 'Takes Any Edge', 4: 'Selective', 5: 'Very Picky' };
  if (params.confidence_threshold && confMap[params.confidence_threshold]) pills.push(confMap[params.confidence_threshold]);

  if (params.weather_impacts_totals) pills.push('Weather Aware');
  if (params.ride_hot_streaks) pills.push('Streak Rider');
  if (params.fade_cold_streaks) pills.push('Fades Cold Streaks');

  return pills.slice(0, 5);
}

function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) return value.replace('gradient:', '').split(',')[0];
  return value;
}

function getAvatarBackground(value: string): string {
  if (value.startsWith('gradient:')) {
    const [c1, c2] = value.replace('gradient:', '').split(',');
    return `linear-gradient(135deg, ${c1}, ${c2})`;
  }
  return value;
}

function LockedPlaceholderCard() {
  return (
    <Card className="border-border/70 bg-card/95 overflow-hidden">
      <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[160px]">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">Upgrade to Pro to view picks</p>
      </CardContent>
    </Card>
  );
}

export default function PublicAgentDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: agent, isLoading: agentLoading } = useAgent(id);
  const { canViewAgentPicks, isPro } = useAgentEntitlements();

  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all');
  const [resultFilter, setResultFilter] = useState<PickResult | 'all'>('all');
  const [selectedPick, setSelectedPick] = useState<AgentPick | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnAgent = agent?.user_id === user?.id;

  const { data: picks, isLoading: picksLoading } = useAgentPicks(
    canViewAgentPicks ? id : undefined,
    {
      sport: sportFilter === 'all' ? undefined : sportFilter,
      result: resultFilter === 'all' ? undefined : resultFilter,
    }
  );

  // Check follow status
  useEffect(() => {
    if (!user?.id || !id) return;

    (async () => {
      const { data } = await (supabase as any)
        .from('user_avatar_follows')
        .select('id')
        .eq('user_id', user.id)
        .eq('avatar_id', id)
        .maybeSingle();

      setIsFollowing(!!data);
    })();
  }, [user?.id, id]);

  const handleToggleFollow = useCallback(async () => {
    if (!user?.id || !id || followLoading) return;
    setFollowLoading(true);

    try {
      if (isFollowing) {
        await (supabase as any)
          .from('user_avatar_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('avatar_id', id);
        setIsFollowing(false);
      } else {
        await (supabase as any)
          .from('user_avatar_follows')
          .insert({ user_id: user.id, avatar_id: id });
        setIsFollowing(true);
      }
    } catch {
      // Silently fail — follow is non-critical
    } finally {
      setFollowLoading(false);
    }
  }, [user?.id, id, isFollowing, followLoading]);

  const pills = useMemo(() => getPersonalityPills(agent?.personality_params), [agent?.personality_params]);
  const sortedPicks = useMemo(() => picks || [], [picks]);

  if (agentLoading) return <div className="py-10 text-center">Loading agent...</div>;
  if (!agent) return <div className="py-10 text-center">Agent not found.</div>;

  const perf = agent.performance;
  const avatarColor = getPrimaryColor(agent.avatar_color || '#6366f1');
  const avatarBg = getAvatarBackground(agent.avatar_color || '#6366f1');

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate('/agents')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{agent.name}</h1>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div
              className="h-20 w-20 rounded-2xl grid place-items-center text-4xl shrink-0"
              style={{ background: avatarBg }}
            >
              {agent.avatar_emoji || '\u{1F916}'}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-3">
              <div>
                <h2 className="text-xl font-bold">{agent.name}</h2>
                <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Globe className="h-3 w-3" /> Public Agent
                  </Badge>
                  {agent.preferred_sports.map((sport) => (
                    <Badge key={sport} variant="secondary" className="text-xs">
                      {SPORT_LABELS[sport]}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Personality pills */}
              {pills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {pills.map((pill) => (
                    <Badge key={pill} variant="outline" className="text-[11px]" style={{ borderColor: `${avatarColor}40`, color: avatarColor }}>
                      {pill}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Own agent banner or Follow button */}
      {isOwnAgent ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 text-center text-sm text-primary font-medium">
            This is your agent
          </CardContent>
        </Card>
      ) : (
        <Button
          variant={isFollowing ? 'outline' : 'default'}
          className="w-full sm:w-auto"
          onClick={handleToggleFollow}
          disabled={followLoading}
        >
          {isFollowing ? (
            <><UserMinus className="mr-2 h-4 w-4" /> Unfollow</>
          ) : (
            <><UserPlus className="mr-2 h-4 w-4" /> Follow</>
          )}
        </Button>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Record" value={formatRecord(perf)} />
        <StatCard
          label="Net Units"
          value={isPro ? formatNetUnits(perf?.net_units ?? 0) : undefined}
          locked={!isPro}
          positive={perf ? perf.net_units >= 0 : undefined}
        />
        <StatCard
          label="Win Rate"
          value={perf?.win_rate ? `${(perf.win_rate * 100).toFixed(1)}%` : '--'}
        />
        <StatCard label="Streak" value={formatStreak(perf?.current_streak ?? 0)} />
      </div>

      {/* Performance Charts */}
      {canViewAgentPicks ? (
        <AgentPerformanceCharts agent={agent} />
      ) : (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-2">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Upgrade to Pro to view performance charts</p>
          </CardContent>
        </Card>
      )}

      {/* Pick History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pick History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canViewAgentPicks ? (
            <>
              <div className="flex flex-wrap gap-3">
                <Select value={sportFilter} onValueChange={(v) => setSportFilter(v as Sport | 'all')}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sport" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sports</SelectItem>
                    {SPORTS.map((sport) => (
                      <SelectItem key={sport} value={sport}>{sport.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as PickResult | 'all')}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Result" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All results</SelectItem>
                    {PICK_RESULTS.map((result) => (
                      <SelectItem key={result} value={result}>{result.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {picksLoading && <p className="text-sm text-muted-foreground">Loading picks...</p>}
              {!picksLoading && sortedPicks.length === 0 && <p className="text-sm text-muted-foreground">No picks found for current filters.</p>}

              {!selectedPick ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {sortedPicks.map((pick) => (
                    <AgentPickCard key={pick.id} pick={pick} onOpenAudit={(p) => setSelectedPick(p)} />
                  ))}
                </div>
              ) : (
                <AgentPickAuditPanel pick={selectedPick} onBack={() => setSelectedPick(null)} />
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <LockedPlaceholderCard />
              <LockedPlaceholderCard />
              <LockedPlaceholderCard />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  locked,
  positive,
}: {
  label: string;
  value?: string;
  locked?: boolean;
  positive?: boolean;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="py-3 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        {locked ? (
          <div className="flex items-center gap-1 mt-1">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Pro</span>
          </div>
        ) : (
          <p className={`text-lg font-semibold mt-1 ${positive === true ? 'text-emerald-500' : positive === false ? 'text-red-500' : ''}`}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
