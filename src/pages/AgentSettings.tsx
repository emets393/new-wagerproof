import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  Gauge,
  Globe2,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Input,
  Select,
  SelectItem,
  Skeleton,
  Switch,
} from '@heroui/react';
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
import { CustomInsights, PersonalityParams, Sport, SPORTS, US_TIMEZONES, toggleSportSelection } from '@/types/agent';
import { Screen3_Personality, Screen4_DataAndConditions, Screen5_CustomInsights } from '@/components/agents/creation';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import { agentSpriteIndex } from '@/utils/agentSprites';

interface AgentSettingsForm {
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  sprite_index: number;
  preferred_sports: Sport[];
  personality_params: PersonalityParams;
  custom_insights: CustomInsights;
  is_public: boolean;
  is_active: boolean;
  auto_generate: boolean;
  auto_generate_time: string;
  auto_generate_timezone: string;
}

const AGENT_GRADIENTS = [
  'gradient:#6366f1,#ec4899',
  'gradient:#8b5cf6,#06b6d4',
  'gradient:#ef4444,#f97316',
  'gradient:#22c55e,#06b6d4',
  'gradient:#f97316,#eab308',
  'gradient:#ec4899,#8b5cf6',
  'gradient:#06b6d4,#6366f1',
  'gradient:#22c55e,#eab308',
  'gradient:#ef4444,#ec4899',
  'gradient:#8b5cf6,#f97316',
  'gradient:#3b82f6,#22c55e',
  'gradient:#f59e0b,#ef4444',
  'gradient:#14b8a6,#8b5cf6',
  'gradient:#6366f1,#3b82f6',
  'gradient:#dc2626,#7c3aed',
  'gradient:#0ea5e9,#22d3ee',
] as const;

const sectionLinks = [
  { id: 'identity', label: 'Identity', icon: Bot },
  { id: 'coverage', label: 'Coverage', icon: Trophy },
  { id: 'automation', label: 'Automation', icon: Zap },
  { id: 'strategy', label: 'Strategy', icon: Gauge },
  { id: 'visibility', label: 'Visibility', icon: Globe2 },
];

function avatarBackground(value: string) {
  if (value?.startsWith('gradient:')) {
    const [from, to] = value.replace('gradient:', '').split(',');
    return `linear-gradient(135deg, ${from || '#00e676'}, ${to || '#0f9f6e'})`;
  }
  return value || '#00e676';
}

function SettingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-16">
      <Skeleton className="h-44 w-full rounded-[28px]" />
      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <Skeleton className="hidden h-72 rounded-2xl lg:block" />
        <div className="space-y-5">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, eyebrow, title, description }: {
  icon: typeof Bot;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Icon className="size-[18px]" />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">{eyebrow}</p>
        <h2 className="mt-0.5 text-lg font-semibold tracking-[-0.015em] text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function AgentSettings() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: agent, isLoading } = useAgent(id);
  const updateMutation = useUpdateAgent();
  const deleteMutation = useDeleteAgent();
  const { isAdmin, isPro, canUseAutopilot } = useAgentEntitlements();

  const [form, setForm] = useState<AgentSettingsForm | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) return;
    const nextForm: AgentSettingsForm = {
      name: agent.name,
      avatar_emoji: agent.avatar_emoji,
      avatar_color: agent.avatar_color,
      sprite_index: agentSpriteIndex(agent.id, agent.sprite_index),
      preferred_sports: agent.preferred_sports,
      personality_params: agent.personality_params,
      custom_insights: agent.custom_insights,
      is_public: agent.is_public,
      is_active: agent.is_active,
      auto_generate: agent.auto_generate,
      auto_generate_time: agent.auto_generate_time || '09:00',
      auto_generate_timezone: agent.auto_generate_timezone || 'America/New_York',
    };
    setForm(nextForm);
    setSavedSnapshot(JSON.stringify(nextForm));
  }, [agent]);

  const isDirty = useMemo(() => Boolean(form && JSON.stringify(form) !== savedSnapshot), [form, savedSnapshot]);

  const updatePersonality = <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => {
    setForm((prev) => prev ? { ...prev, personality_params: { ...prev.personality_params, [key]: value } } : prev);
  };

  const updateInsight = <K extends keyof CustomInsights>(key: K, value: CustomInsights[K]) => {
    setForm((prev) => prev ? { ...prev, custom_insights: { ...prev.custom_insights, [key]: value } } : prev);
  };

  const toggleSport = (sport: Sport) => {
    setForm((prev) => prev ? { ...prev, preferred_sports: toggleSportSelection(prev.preferred_sports, sport) } : prev);
  };

  const handleSave = async () => {
    if (!id || !form) return;
    setError(null);
    if (form.name.trim().length === 0) return setError('Give your agent a name before saving.');
    if (form.preferred_sports.length === 0) return setError('Select at least one sport for this agent.');

    try {
      const cleanForm = { ...form, name: form.name.trim() };
      await updateMutation.mutateAsync({ agentId: id, data: cleanForm });
      setForm(cleanForm);
      setSavedSnapshot(JSON.stringify(cleanForm));
    } catch (err: any) {
      setError(err instanceof Error ? err.message : err?.message || 'Failed to save settings.');
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

  if (isLoading || !form) return <SettingsSkeleton />;

  return (
    <main className="mx-auto w-full max-w-7xl pb-28 lg:pb-16">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-emerald-600/15 bg-gradient-to-br from-[#fffef9] to-[#edf8f1] px-5 py-5 text-slate-950 shadow-[0_24px_70px_-42px_rgba(5,90,55,0.28)] dark:border-emerald-500/15 dark:from-[#07140f] dark:to-[#07140f] dark:text-white dark:shadow-[0_24px_80px_-40px_rgba(0,230,118,0.45)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(16,185,129,0.14),transparent_34%),linear-gradient(115deg,rgba(255,255,255,0.55),transparent_45%)] dark:bg-[radial-gradient(circle_at_78%_10%,rgba(0,230,118,0.19),transparent_34%),linear-gradient(115deg,rgba(255,255,255,0.04),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-[22%] hidden w-px bg-gradient-to-b from-transparent via-emerald-900/10 to-transparent dark:via-white/10 md:block" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <Button
              isIconOnly
              aria-label="Back to agents"
              variant="flat"
              className="absolute left-0 top-0 size-10 min-w-10 bg-white/70 text-slate-700 shadow-sm dark:bg-white/10 dark:text-white md:static"
              onPress={() => navigate(`/agents?selected=${id}`)}
            >
              <ArrowLeft className="size-[18px]" />
            </Button>
            <div
              className="ml-12 flex size-[72px] shrink-0 items-center justify-center rounded-[22px] border border-white/20 text-4xl shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_16px_40px_-18px_rgba(0,0,0,0.8)] md:ml-0 sm:size-20"
              style={{ background: avatarBackground(form.avatar_color) }}
            >
              <PixelSpriteAvatar spriteIndex={form.sprite_index} height={64} />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Chip size="sm" variant="flat" classNames={{ base: form.is_active ? 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-slate-900/5 text-slate-500 dark:bg-white/10 dark:text-white/60' }}>
                  <span className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${form.is_active ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-white/40'}`} />{form.is_active ? 'Live' : 'Paused'}</span>
                </Chip>
                {form.auto_generate && <Chip size="sm" variant="flat" className="bg-amber-500/15 text-amber-700 dark:bg-amber-300/15 dark:text-amber-200">Autopilot</Chip>}
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300/90">Agent control center</p>
              <h1 className="truncate text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{form.name || 'Unnamed agent'}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-white/60">Tune the strategy, schedule, and public profile from one place.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:min-w-[300px]">
            {[
              { label: 'Sports', value: form.preferred_sports.length, icon: Trophy },
              { label: 'Mode', value: form.auto_generate ? 'Auto' : 'Manual', icon: Zap },
              { label: 'Profile', value: form.is_public ? 'Public' : 'Private', icon: Eye },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-emerald-950/10 bg-white/60 px-3 py-3 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.055] dark:shadow-none">
                <stat.icon className="mb-2 size-4 text-emerald-600 dark:text-emerald-300" />
                <p className="text-sm font-semibold">{stat.value}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-white/45">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-danger-500/25 bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-600 dark:text-danger-400">
          {error}
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="sticky top-24 hidden lg:block">
          <Card shadow="none" className="border border-divider bg-content1/70 backdrop-blur-xl">
            <CardBody className="gap-1 p-2">
              <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-default-400">Configuration</p>
              {sectionLinks.map(({ id: sectionId, label, icon: Icon }) => (
                <a key={sectionId} href={`#${sectionId}`} className="group flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-default-500 transition-colors hover:bg-default-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                  <Icon className="size-4 text-default-400 group-hover:text-emerald-500" />
                  {label}
                  <ChevronRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              ))}
              <Divider className="my-2" />
              <div className="rounded-xl bg-default-100/70 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="size-4 text-emerald-500" />Changes stay private</div>
                <p className="mt-1.5 text-[11px] leading-4 text-default-400">Nothing updates until you save.</p>
              </div>
            </CardBody>
          </Card>
        </aside>

        <div className="min-w-0 space-y-5">
          <Card id="identity" shadow="sm" className="scroll-mt-24 border border-divider bg-content1/80">
            <CardBody className="gap-6 p-5 sm:p-6">
              <SectionHeading icon={Bot} eyebrow="01 · Identity" title="Make the agent recognizable" description="A clear name and visual signature make it easier to scan in picks, rankings, and reports." />
              <Divider />
              <Input label="Agent name" labelPlacement="outside" value={form.name} onValueChange={(name) => setForm({ ...form, name })} maxLength={50} variant="bordered" placeholder="e.g. The Line Reader" />

              <div>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div><p className="text-sm font-semibold">Pixel character</p><p className="mt-1 text-xs text-default-400">Choose who represents this agent in HQ, cards, and rankings.</p></div>
                  <Chip size="sm" variant="flat" className="bg-emerald-500/10 text-emerald-500">Character {form.sprite_index + 1}</Chip>
                </div>
                <div role="radiogroup" aria-label="Pixel character" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {Array.from({ length: 8 }, (_, spriteIndex) => {
                    const selected = form.sprite_index === spriteIndex;
                    return (
                      <button key={spriteIndex} type="button" role="radio" aria-checked={selected} aria-label={`Character ${spriteIndex + 1}`} onClick={() => setForm({ ...form, sprite_index: spriteIndex })} className={`group relative flex h-[86px] items-end justify-center overflow-hidden rounded-2xl border pb-2 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selected ? 'border-emerald-500 bg-emerald-500/15 shadow-[0_0_0_1px_rgba(16,185,129,.35),0_12px_30px_-18px_rgba(16,185,129,.9)]' : 'border-divider bg-default-100/60 hover:-translate-y-0.5 hover:border-default-400'}`}>
                        <div className="absolute inset-x-2 bottom-2 h-5 rounded-[50%] bg-black/10 blur-md" />
                        <PixelSpriteAvatar spriteIndex={spriteIndex} height={64} className="relative transition-transform group-hover:scale-105" />
                        {selected && <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-emerald-500 text-black"><Check className="size-3" /></span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3"><p className="text-sm font-semibold">Signature gradient</p><p className="mt-1 text-xs text-default-400">This color orb follows the agent through status, charts, and profile surfaces.</p></div>
                <div role="radiogroup" aria-label="Agent gradient" className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                  {AGENT_GRADIENTS.map((gradient, index) => {
                    const selected = form.avatar_color.toLowerCase() === gradient.toLowerCase();
                    return (
                      <button key={gradient} type="button" role="radio" aria-checked={selected} aria-label={`Gradient ${index + 1}`} onClick={() => setForm({ ...form, avatar_color: gradient })} className="group relative grid aspect-square place-items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                        <span className={`absolute inset-1 rounded-full blur-md transition-opacity ${selected ? 'opacity-55' : 'opacity-0 group-hover:opacity-30'}`} style={{ background: avatarBackground(gradient) }} />
                        <span className={`relative grid size-12 place-items-center rounded-full border shadow-[inset_0_2px_5px_rgba(255,255,255,.35),0_8px_18px_-8px_rgba(0,0,0,.65)] transition-transform group-hover:scale-105 ${selected ? 'scale-105 border-white ring-2 ring-emerald-500 ring-offset-2 ring-offset-background' : 'border-white/25'}`} style={{ background: avatarBackground(gradient) }}>
                          {selected && <span className="grid size-6 place-items-center rounded-full bg-white text-black shadow"><Check className="size-3.5" /></span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card id="coverage" shadow="sm" className="scroll-mt-24 border border-divider bg-content1/80">
            <CardBody className="gap-6 p-5 sm:p-6">
              <SectionHeading icon={Trophy} eyebrow="02 · Coverage" title="Choose the leagues this agent watches" description="Keep the signal focused. The strategy controls below adapt to the sports you select here." />
              <Divider />
              <div className="flex flex-wrap gap-2">
                {SPORTS.map((sport) => {
                  const selected = form.preferred_sports.includes(sport);
                  return (
                    <Button key={sport} type="button" size="sm" radius="full" variant={selected ? 'solid' : 'bordered'} color={selected ? 'success' : 'default'} startContent={selected ? <Check className="size-3.5" /> : undefined} onPress={() => toggleSport(sport)} className={selected ? 'font-semibold text-black' : 'font-medium'}>
                      {sport.toUpperCase()}
                    </Button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card id="automation" shadow="sm" className="scroll-mt-24 border border-divider bg-content1/80">
            <CardBody className="gap-6 p-5 sm:p-6">
              <SectionHeading icon={Zap} eyebrow="03 · Automation" title="Decide when this agent goes to work" description="Pause all activity or let Autopilot produce a daily card when qualifying games are available." />
              <Divider />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex min-h-[92px] items-center justify-between gap-4 rounded-2xl border border-divider bg-default-50 p-4 dark:bg-default-50/40">
                  <div><p className="text-sm font-semibold">Agent active</p><p className="mt-1 text-xs leading-5 text-default-400">Pausing also switches off Autopilot.</p></div>
                  <Switch aria-label="Agent active" color="success" isSelected={form.is_active} onValueChange={(is_active) => setForm({ ...form, is_active, auto_generate: is_active ? form.auto_generate : false })} />
                </div>
                <div className="flex min-h-[92px] items-center justify-between gap-4 rounded-2xl border border-divider bg-default-50 p-4 dark:bg-default-50/40">
                  <div><p className="flex items-center gap-2 text-sm font-semibold">Daily Autopilot {!canUseAutopilot && <Chip size="sm" variant="flat" color="warning">Pro</Chip>}</p><p className="mt-1 text-xs leading-5 text-default-400">{canUseAutopilot ? 'Generate picks when the slate qualifies.' : 'Upgrade to unlock scheduled picks.'}</p></div>
                  <Switch aria-label="Daily Autopilot" color="success" isSelected={form.auto_generate} isDisabled={!form.is_active || !canUseAutopilot} onValueChange={(auto_generate) => setForm({ ...form, auto_generate })} />
                </div>
              </div>

              {form.auto_generate && form.is_active && canUseAutopilot && (
                <div className="grid gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 sm:grid-cols-[160px_1fr]">
                  <Input type="time" label="Preferred time" labelPlacement="outside" value={form.auto_generate_time} onValueChange={(auto_generate_time) => setForm({ ...form, auto_generate_time })} variant="bordered" startContent={<Clock3 className="size-4 text-default-400" />} />
                  <Select label="Timezone" labelPlacement="outside" selectedKeys={[form.auto_generate_timezone]} onSelectionChange={(keys) => setForm({ ...form, auto_generate_timezone: String(Array.from(keys)[0]) })} variant="bordered">
                    {US_TIMEZONES.map((tz) => <SelectItem key={tz.value}>{tz.label}</SelectItem>)}
                  </Select>
                </div>
              )}
            </CardBody>
          </Card>

          <section id="strategy" className="scroll-mt-24 space-y-5">
            <div className="flex items-center gap-3 px-1 pt-2">
              <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500"><Sparkles className="size-[18px]" /></div>
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">04 · Strategy</p><h2 className="text-lg font-semibold tracking-[-0.015em]">Shape how this agent thinks</h2></div>
            </div>
            <Screen3_Personality params={form.personality_params} selectedSports={form.preferred_sports} onParamChange={updatePersonality} />
            <Screen4_DataAndConditions params={form.personality_params} selectedSports={form.preferred_sports} onParamChange={updatePersonality} />
            <Screen5_CustomInsights insights={form.custom_insights} onInsightChange={updateInsight} />
          </section>

          <Card id="visibility" shadow="sm" className="scroll-mt-24 border border-divider bg-content1/80">
            <CardBody className="gap-6 p-5 sm:p-6">
              <SectionHeading icon={Globe2} eyebrow="05 · Visibility" title="Control who can discover this agent" description="Public agents can appear on the leaderboard and be explored by other WagerProof members." />
              <Divider />
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-divider bg-default-50 p-4 dark:bg-default-50/40">
                <div><p className="flex items-center gap-2 text-sm font-semibold">Public profile {!isPro && !isAdmin && <Chip size="sm" variant="flat" color="warning">Pro</Chip>}</p><p className="mt-1 text-xs leading-5 text-default-400">{!isPro && !isAdmin ? 'Upgrade to publish agents to the leaderboard.' : 'Let other members discover this strategy and its record.'}</p></div>
                <Switch aria-label="Public profile" color="success" isSelected={form.is_public} isDisabled={!isPro && !isAdmin} onValueChange={(is_public) => setForm({ ...form, is_public })} />
              </div>
            </CardBody>
          </Card>

          <Card shadow="none" className="border border-danger-500/25 bg-danger-500/[0.035]">
            <CardBody className="flex-row items-center justify-between gap-4 p-5 sm:p-6">
              <div><p className="text-sm font-semibold text-danger-600 dark:text-danger-400">Retire this agent</p><p className="mt-1 text-xs leading-5 text-default-400">Permanently remove the agent and all associated picks.</p></div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button color="danger" variant="flat" startContent={<Trash2 className="size-4" />} isLoading={deleteMutation.isPending}>Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete {form.name}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. The agent and every related pick will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Keep agent</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete agent</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-background/90 p-3 backdrop-blur-xl lg:left-auto lg:right-6 lg:bottom-6 lg:w-auto lg:rounded-2xl lg:border lg:shadow-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 lg:mx-0">
          <div className="hidden min-w-[120px] pl-2 sm:block"><p className="text-xs font-semibold">{isDirty ? 'Unsaved changes' : 'Everything is saved'}</p><p className="text-[11px] text-default-400">{isDirty ? 'Review and save when ready.' : 'Your agent is up to date.'}</p></div>
          <Button color="success" className="w-full font-semibold text-black sm:w-auto" startContent={!updateMutation.isPending && <Save className="size-4" />} isLoading={updateMutation.isPending} isDisabled={!isDirty} onPress={handleSave}>
            {updateMutation.isPending ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      </div>
    </main>
  );
}
