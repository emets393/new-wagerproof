import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCreateAgent } from '@/hooks/useAgents';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { useUserAgents } from '@/hooks/useAgents';
import {
  ArchetypeId,
  CreateAgentFormState,
  CustomInsights,
  DEFAULT_CUSTOM_INSIGHTS,
  DEFAULT_PERSONALITY_PARAMS,
  INITIAL_FORM_STATE,
  PersonalityParams,
} from '@/types/agent';
import {
  Screen1_SportArchetype,
  Screen2_Identity,
  Screen3_Personality,
  Screen4_DataAndConditions,
  Screen5_CustomInsights,
  Screen6_Review,
} from '@/components/agents/creation';

const TOTAL_STEPS = 6;

export default function AgentCreate() {
  const navigate = useNavigate();
  const createMutation = useCreateAgent();
  const { data: agents } = useUserAgents();
  const { canCreateAnotherAgent, isPro } = useAgentEntitlements();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateAgentFormState>(INITIAL_FORM_STATE);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateForm = <K extends keyof CreateAgentFormState>(key: K, value: CreateAgentFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePersonality = <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => {
    setForm((prev) => ({ ...prev, personality_params: { ...prev.personality_params, [key]: value } }));
  };

  const updateInsight = <K extends keyof CustomInsights>(key: K, value: CustomInsights[K]) => {
    setForm((prev) => ({ ...prev, custom_insights: { ...prev.custom_insights, [key]: value } }));
  };

  const applyArchetype = (
    archetypeId: ArchetypeId | null,
    personalityParams?: Partial<PersonalityParams>,
    customInsights?: CustomInsights
  ) => {
    setForm((prev) => ({
      ...prev,
      archetype: archetypeId,
      personality_params: archetypeId ? { ...DEFAULT_PERSONALITY_PARAMS, ...personalityParams } : { ...DEFAULT_PERSONALITY_PARAMS },
      custom_insights: archetypeId && customInsights ? { ...customInsights } : { ...DEFAULT_CUSTOM_INSIGHTS },
    }));
  };

  const validationError = useMemo(() => {
    if (step === 0 && form.preferred_sports.length === 0) return 'Select at least one sport.';
    if (step === 1 && form.name.trim().length === 0) return 'Agent name is required.';
    if (step === 1 && form.avatar_emoji.trim().length === 0) return 'Agent emoji is required.';
    return null;
  }, [step, form]);

  const handleCreate = async () => {
    setSubmitError(null);

    const totalCount = agents?.length || 0;
    const activeCount = agents?.filter((a) => a.is_active).length || 0;
    if (!canCreateAnotherAgent(activeCount, totalCount)) {
      setSubmitError(
        isPro
          ? 'Agent limit reached: 10 active and 30 total.'
          : 'Free plan supports 1 active agent. Upgrade for more.'
      );
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        name: form.name.trim(),
        avatar_emoji: form.avatar_emoji,
        avatar_color: form.avatar_color,
        preferred_sports: form.preferred_sports,
        archetype: form.archetype,
        personality_params: form.personality_params,
        custom_insights: form.custom_insights,
        auto_generate: form.auto_generate,
      });
      navigate(`/agents/${created.id}`);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to create agent.');
    }
  };

  const stepTitle = ['Sport & Style', 'Identity', 'Personality', 'Data & Conditions', 'Custom Insights', 'Review'][step];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Create Agent</h1>
          <p className="text-sm text-muted-foreground">Step {step + 1} of {TOTAL_STEPS}: {stepTitle}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/agents')}>Cancel</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="h-2 bg-muted rounded overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
          </div>
        </CardContent>
      </Card>

      {step === 0 && (
        <Screen1_SportArchetype
          selectedSports={form.preferred_sports}
          selectedArchetype={form.archetype}
          onSportsChange={(sports) => updateForm('preferred_sports', sports)}
          onArchetypeChange={applyArchetype}
        />
      )}
      {step === 1 && (
        <Screen2_Identity
          name={form.name}
          emoji={form.avatar_emoji}
          color={form.avatar_color}
          onNameChange={(v) => updateForm('name', v)}
          onEmojiChange={(v) => updateForm('avatar_emoji', v)}
          onColorChange={(v) => updateForm('avatar_color', v)}
        />
      )}
      {step === 2 && <Screen3_Personality params={form.personality_params} onParamChange={updatePersonality} />}
      {step === 3 && <Screen4_DataAndConditions params={form.personality_params} selectedSports={form.preferred_sports} onParamChange={updatePersonality} />}
      {step === 4 && <Screen5_CustomInsights insights={form.custom_insights} onInsightChange={updateInsight} />}
      {step === 5 && <Screen6_Review state={form} onAutoGenerateChange={(value) => updateForm('auto_generate', value)} />}

      {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}
      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep((prev) => Math.max(prev - 1, 0))} disabled={step === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        {step < TOTAL_STEPS - 1 ? (
          <Button onClick={() => !validationError && setStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1))} disabled={!!validationError}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={createMutation.isPending || !!validationError}>
            <Check className="mr-2 h-4 w-4" /> {createMutation.isPending ? 'Creating...' : 'Create Agent'}
          </Button>
        )}
      </div>
    </div>
  );
}
