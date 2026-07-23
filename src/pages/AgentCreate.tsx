import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAgent, useCreateAgent } from '@/hooks/useAgents';
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
import { AgentAvatarTile } from '@/components/agents/split/AgentAvatarTile';
import { cn } from '@/lib/utils';

const TOTAL_STEPS = 6;

export default function AgentCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copySourceId = searchParams.get('copy') || undefined;
  const { data: copySource, isLoading: copySourceLoading } = useAgent(copySourceId);
  const createMutation = useCreateAgent();
  const { data: agents } = useUserAgents();
  const { canCreateAnotherAgent, isPro } = useAgentEntitlements();

  const [step, setStep] = useState(0);
  const [choosingStartingPoint, setChoosingStartingPoint] = useState(!!copySourceId);
  const [startingPoint, setStartingPoint] = useState<'copy' | 'customize'>(
    copySourceId ? 'copy' : 'customize',
  );
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
        auto_generate_time: form.auto_generate_time,
        auto_generate_timezone: form.auto_generate_timezone,
      });
      navigate(`/agents?selected=${created.id}`);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to create agent.');
    }
  };

  const continueFromStartingPoint = () => {
    if (startingPoint === 'copy' && copySource) {
      setForm({
        preferred_sports: [...copySource.preferred_sports],
        archetype: copySource.archetype,
        name: `${copySource.name} Copy`,
        avatar_emoji: copySource.avatar_emoji,
        avatar_color: copySource.avatar_color,
        personality_params: { ...copySource.personality_params },
        custom_insights: { ...copySource.custom_insights },
        auto_generate: false,
        auto_generate_time: copySource.auto_generate_time,
        auto_generate_timezone: copySource.auto_generate_timezone,
      });
    } else {
      setForm(INITIAL_FORM_STATE);
    }
    setChoosingStartingPoint(false);
  };

  const stepTitle = ['Sport & Style', 'Identity', 'Personality', 'Data & Conditions', 'Custom Insights', 'Review'][step];

  if (choosingStartingPoint) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Create Agent</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Pick a starting point</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Start with this agent&apos;s strategy already filled in, or customize a new build from scratch.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/agents')}>Cancel</Button>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled={copySourceLoading || !copySource}
            onClick={() => setStartingPoint('copy')}
            className={cn(
              'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all',
              startingPoint === 'copy'
                ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]'
                : 'border-border/70 bg-card/70 hover:border-primary/40 hover:bg-card',
            )}
          >
            {copySource ? (
              <AgentAvatarTile
                agentId={copySource.id}
                spriteIndexOverride={copySource.sprite_index}
                emoji={copySource.avatar_emoji}
                color={copySource.avatar_color}
                size={58}
              />
            ) : (
              <span className="h-[58px] w-[58px] animate-pulse rounded-2xl bg-muted" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[15px] font-extrabold">
                <Sparkles className="h-4 w-4 text-primary" />
                Copy this build
              </span>
              <span className="mt-1 block truncate text-sm font-semibold text-foreground">
                {copySourceLoading ? 'Loading agent…' : copySource?.name || 'Agent unavailable'}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                Prefill the sports, strategy, personality, and insights. Your copy starts with a fresh 0-0 record.
              </span>
            </span>
            <span
              className={cn(
                'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                startingPoint === 'copy' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
              )}
            >
              {startingPoint === 'copy' && <Check className="h-3 w-3" />}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStartingPoint('customize')}
            className={cn(
              'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all',
              startingPoint === 'customize'
                ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]'
                : 'border-border/70 bg-card/70 hover:border-primary/40 hover:bg-card',
            )}
          >
            <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-2xl bg-muted">
              <SlidersHorizontal className="h-6 w-6 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold">Customize</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                Start empty and choose every part of the build yourself.
              </span>
            </span>
            <span
              className={cn(
                'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                startingPoint === 'customize' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
              )}
            >
              {startingPoint === 'customize' && <Check className="h-3 w-3" />}
            </span>
          </button>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={continueFromStartingPoint}
            disabled={startingPoint === 'copy' && (copySourceLoading || !copySource)}
            className="rounded-full px-5"
          >
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

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
          existingNames={agents?.map((a) => a.name)}
        />
      )}
      {step === 2 && <Screen3_Personality params={form.personality_params} selectedSports={form.preferred_sports} onParamChange={updatePersonality} />}
      {step === 3 && <Screen4_DataAndConditions params={form.personality_params} selectedSports={form.preferred_sports} onParamChange={updatePersonality} />}
      {step === 4 && <Screen5_CustomInsights insights={form.custom_insights} onInsightChange={updateInsight} />}
      {step === 5 && <Screen6_Review state={form} onAutoGenerateChange={(value) => updateForm('auto_generate', value)} onAutoGenerateTimeChange={(value) => updateForm('auto_generate_time', value)} onAutoGenerateTimezoneChange={(value) => updateForm('auto_generate_timezone', value)} />}

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
