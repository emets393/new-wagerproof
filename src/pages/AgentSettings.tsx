import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { useAgent, useDeleteAgent, useUpdateAgent } from '@/hooks/useAgents';
import { CustomInsights, PersonalityParams, Sport, SPORTS } from '@/types/agent';
import { Screen3_Personality, Screen4_DataAndConditions, Screen5_CustomInsights } from '@/components/agents/creation';

interface AgentSettingsForm {
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  preferred_sports: Sport[];
  personality_params: PersonalityParams;
  custom_insights: CustomInsights;
  is_public: boolean;
  is_active: boolean;
  auto_generate: boolean;
}

export default function AgentSettings() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: agent, isLoading } = useAgent(id);
  const updateMutation = useUpdateAgent();
  const deleteMutation = useDeleteAgent();
  const { isAdmin, isPro } = useAgentEntitlements();

  const [form, setForm] = useState<AgentSettingsForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) return;
    setForm({
      name: agent.name,
      avatar_emoji: agent.avatar_emoji,
      avatar_color: agent.avatar_color,
      preferred_sports: agent.preferred_sports,
      personality_params: agent.personality_params,
      custom_insights: agent.custom_insights,
      is_public: agent.is_public,
      is_active: agent.is_active,
      auto_generate: agent.auto_generate,
    });
  }, [agent]);

  const updatePersonality = <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => {
    if (!form) return;
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        personality_params: {
          ...prev.personality_params,
          [key]: value,
        },
      };
    });
  };

  const updateInsight = <K extends keyof CustomInsights>(key: K, value: CustomInsights[K]) => {
    if (!form) return;
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        custom_insights: {
          ...prev.custom_insights,
          [key]: value,
        },
      };
    });
  };

  const toggleSport = (sport: Sport) => {
    if (!form) return;
    const exists = form.preferred_sports.includes(sport);
    const nextSports = exists
      ? form.preferred_sports.filter((s) => s !== sport)
      : [...form.preferred_sports, sport];
    setForm({ ...form, preferred_sports: nextSports });
  };

  const handleSave = async () => {
    if (!id || !form) return;
    setError(null);
    if (form.name.trim().length === 0) {
      setError('Agent name is required.');
      return;
    }
    if (form.preferred_sports.length === 0) {
      setError('Select at least one sport.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        agentId: id,
        data: {
          name: form.name.trim(),
          avatar_emoji: form.avatar_emoji,
          avatar_color: form.avatar_color,
          preferred_sports: form.preferred_sports,
          personality_params: form.personality_params,
          custom_insights: form.custom_insights,
          is_public: form.is_public,
          is_active: form.is_active,
          auto_generate: form.auto_generate,
        },
      });
      navigate(`/agents/${id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings.');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/agents');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete agent.');
    }
  };

  if (isLoading || !form) return <div className="py-10 text-center">Loading settings...</div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(`/agents/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Agent Settings</h1>
            <p className="text-sm text-muted-foreground">Edit profile, activity, and automation settings.</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Core details and appearance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-emoji">Emoji</Label>
              <Input
                id="agent-emoji"
                value={form.avatar_emoji}
                onChange={(e) => setForm({ ...form, avatar_emoji: e.target.value })}
                maxLength={8}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-color">Avatar Color</Label>
            <Input
              id="agent-color"
              value={form.avatar_color}
              onChange={(e) => setForm({ ...form, avatar_color: e.target.value })}
              placeholder="#6366f1 or gradient:#6366f1,#22c55e"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sports</CardTitle>
          <CardDescription>Select which sports this agent covers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((sport) => {
              const selected = form.preferred_sports.includes(sport);
              return (
                <Button
                  key={sport}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  className="uppercase"
                  onClick={() => toggleSport(sport)}
                >
                  {sport}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>Control whether this agent runs and auto-generates picks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="agent-active" className="font-medium">Agent Active</Label>
              <p className="text-xs text-muted-foreground mt-1">When disabled, autopilot turns off.</p>
            </div>
            <Switch
              id="agent-active"
              checked={form.is_active}
              onCheckedChange={(checked) =>
                setForm({
                  ...form,
                  is_active: checked,
                  auto_generate: checked ? form.auto_generate : false,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="agent-auto-generate" className="font-medium">Autopilot / Auto-generate</Label>
              <p className="text-xs text-muted-foreground mt-1">Generate picks daily when games are available.</p>
            </div>
            <Switch
              id="agent-auto-generate"
              checked={form.auto_generate}
              disabled={!form.is_active}
              onCheckedChange={(checked) => setForm({ ...form, auto_generate: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Screen3_Personality params={form.personality_params} onParamChange={updatePersonality} />
      <Screen4_DataAndConditions
        params={form.personality_params}
        selectedSports={form.preferred_sports}
        onParamChange={updatePersonality}
      />
      <Screen5_CustomInsights insights={form.custom_insights} onInsightChange={updateInsight} />

      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Public profiles appear on leaderboard.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="agent-public" className="font-medium">Public Agent</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {!isPro && !isAdmin ? 'Upgrade required for public agent access.' : 'Allow other users to discover this agent.'}
            </p>
          </div>
          <Switch
            id="agent-public"
            checked={form.is_public}
            disabled={!isPro && !isAdmin}
            onCheckedChange={(checked) => setForm({ ...form, is_public: checked })}
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Delete this agent and all associated picks.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4 mr-2" />
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Agent'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The agent and related picks will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
