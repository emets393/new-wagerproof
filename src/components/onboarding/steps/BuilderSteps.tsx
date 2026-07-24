/**
 * Agent builder steps: sports, archetype starting point, standing orders
 * (custom insights) and identity (name / character / color). Web port of
 * OnboardingBuilderPages.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { StepHeader } from '@/components/onboarding/OnboardingShared';
import {
  AGENT_NAME_MAX_LENGTH,
  AVATAR_COLOR_OPTIONS,
  SPORT_OPTIONS,
  SPRITE_COUNT,
} from '@/components/onboarding/flow';
import { fetchPresetArchetypes } from '@/services/agentService';
import { DEFAULT_CUSTOM_INSIGHTS, DEFAULT_PERSONALITY_PARAMS, toggleSportSelection } from '@/types/agent';
import type { CustomInsights, PresetArchetype } from '@/types/agent';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import { getAvatarBackground, getPrimaryColor } from '@/utils/agentColors';

// ── Sports ───────────────────────────────────────────────────────────────────

export function BuilderSportsStep() {
  const { draft, updateDraft, accent } = useOnboarding();
  return (
    <div className="w-full">
      <StepHeader
        title="Which sports should your agent work?"
        subtitle="Pick every league you want it to research — adjust anytime."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SPORT_OPTIONS.map((sport, index) => {
          const selected = draft.preferred_sports.includes(sport.value);
          return (
            <motion.button
              key={sport.value}
              type="button"
              onClick={() => updateDraft({ preferred_sports: toggleSportSelection(draft.preferred_sports, sport.value) })}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.06 * index }}
              className={cn(
                'rounded-2xl border px-4 py-5 text-lg font-extrabold transition-all',
                selected ? 'border-transparent text-black' : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
              )}
              style={selected ? { background: accent } : undefined}
            >
              {sport.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Archetype ────────────────────────────────────────────────────────────────

export function BuilderArchetypeStep() {
  const { draft, updateDraft, hasChosenArchetype, setHasChosenArchetype } = useOnboarding();
  const [presets, setPresets] = useState<PresetArchetype[]>([]);
  const [selection, setSelection] = useState<string | null>(
    hasChosenArchetype ? (draft.archetype ?? 'custom') : null
  );

  useEffect(() => {
    let live = true;
    fetchPresetArchetypes()
      .then((all) => {
        if (live) setPresets(all.slice(0, 3));
      })
      .catch(() => {
        // Non-critical — the Customize path still works without presets.
      });
    return () => {
      live = false;
    };
  }, []);

  const chooseCustom = () => {
    setSelection('custom');
    setHasChosenArchetype(true);
    updateDraft({
      archetype: null,
      personality_params: { ...DEFAULT_PERSONALITY_PARAMS },
      custom_insights: { ...DEFAULT_CUSTOM_INSIGHTS },
    });
  };

  const choosePreset = (preset: PresetArchetype) => {
    setSelection(preset.id);
    setHasChosenArchetype(true);
    // Merge preset over defaults; keep the sports the user just picked.
    updateDraft({
      archetype: preset.id,
      personality_params: { ...DEFAULT_PERSONALITY_PARAMS, ...preset.personality_params },
      custom_insights: { ...preset.custom_insights },
    });
  };

  return (
    <div className="w-full">
      <StepHeader
        title="Pick a starting point"
        subtitle="Preset or custom — either way, you'll walk its full personality on the next pages."
      />

      <button
        type="button"
        onClick={chooseCustom}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left transition-all',
          selection === 'custom'
            ? 'border-transparent bg-white/10 ring-2 ring-white'
            : 'border-white/15 bg-white/5 hover:bg-white/10'
        )}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
          <Pencil className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-base font-bold text-white">Customize</span>
          <span className="block text-sm text-white/60">
            Start balanced and shape every dial yourself on the next pages
          </span>
        </span>
      </button>

      {presets.length > 0 && (
        <>
          <p className="my-4 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
            Or pick a preset
          </p>
          <div className="flex flex-col gap-3">
            {presets.map((preset) => {
              const selected = selection === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => choosePreset(preset)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left transition-all',
                    selected
                      ? 'border-transparent bg-white/10 ring-2'
                      : 'border-white/15 bg-white/5 hover:bg-white/10'
                  )}
                  style={selected ? ({ '--tw-ring-color': preset.color } as React.CSSProperties) : undefined}
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl"
                    style={{ background: `${preset.color}26` }}
                  >
                    {preset.emoji}
                  </span>
                  <span>
                    <span className="block text-base font-bold text-white">{preset.name}</span>
                    <span className="block text-sm text-white/60">{preset.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Custom insights (standing orders) ────────────────────────────────────────

const INSIGHT_FIELDS: { key: keyof CustomInsights; title: string; maxLength: number; placeholder: string }[] = [
  {
    key: 'betting_philosophy',
    title: 'Betting Philosophy',
    maxLength: 500,
    placeholder: 'e.g., Only take plays with a real edge over the market...',
  },
  {
    key: 'perceived_edges',
    title: 'Perceived Edges',
    maxLength: 500,
    placeholder: 'e.g., Mispriced totals in divisional games, especially in bad weather...',
  },
  {
    key: 'avoid_situations',
    title: 'Situations to Avoid',
    maxLength: 300,
    placeholder: 'e.g., No primetime games, skip uncertain QB situations...',
  },
  {
    key: 'target_situations',
    title: 'Target Situations',
    maxLength: 300,
    placeholder: 'e.g., Home dogs off a bye, early-season totals before lines adjust...',
  },
];

export function BuilderInsightsStep() {
  const { draft, updateDraft } = useOnboarding();

  const setInsight = (key: keyof CustomInsights, value: string) => {
    updateDraft({
      custom_insights: { ...draft.custom_insights, [key]: value.length > 0 ? value : null },
    });
  };

  return (
    <div className="w-full">
      <StepHeader
        title="Tell it your rules"
        subtitle="Optional. Anything here goes straight into its research brief as standing orders."
      />
      <div className="flex flex-col gap-4">
        {INSIGHT_FIELDS.map((field) => {
          const value = draft.custom_insights[field.key] ?? '';
          return (
            <div key={field.key} className="text-left">
              <div className="mb-1.5 flex items-baseline justify-between">
                <label className="text-sm font-semibold text-white" htmlFor={`insight-${field.key}`}>
                  {field.title}
                </label>
                <span className="text-[11px] text-white/40">
                  {value.length}/{field.maxLength}
                </span>
              </div>
              <textarea
                id={`insight-${field.key}`}
                value={value}
                maxLength={field.maxLength}
                onChange={(e) => setInsight(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Identity ─────────────────────────────────────────────────────────────────

export function BuilderIdentityStep() {
  const { draft, updateDraft } = useOnboarding();
  const previewSprite = draft.sprite_index ?? 0;
  const nameTooLong = draft.name.trim().length > AGENT_NAME_MAX_LENGTH;

  return (
    <div className="w-full">
      <StepHeader title="Name your agent" subtitle="This is who you'll see grinding the research." />

      {/* Preview */}
      <div className="mb-5 flex justify-center">
        <div
          className="grid h-24 w-24 place-items-center overflow-hidden rounded-3xl"
          style={{
            background: getAvatarBackground(draft.avatar_color),
            boxShadow: `0 8px 30px ${getPrimaryColor(draft.avatar_color)}55`,
          }}
        >
          <PixelSpriteAvatar spriteIndex={previewSprite} height={84} />
        </div>
      </div>

      {/* Name */}
      <div className="mb-5 text-left">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => updateDraft({ name: e.target.value })}
          placeholder="e.g., Sharp Shooter, The Oracle"
          maxLength={AGENT_NAME_MAX_LENGTH + 10}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-base font-semibold text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
        />
        <div className="mt-1 flex justify-between text-[11px]">
          <span className="text-red-400">{nameTooLong && 'Name must be 50 characters or less'}</span>
          <span className="text-white/40">
            {draft.name.length}/{AGENT_NAME_MAX_LENGTH}
          </span>
        </div>
      </div>

      {/* Character */}
      <p className="mb-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Character</p>
      <div className="mb-5 grid grid-cols-4 gap-2.5">
        {Array.from({ length: SPRITE_COUNT }, (_, i) => {
          const selected = (draft.sprite_index ?? 0) === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => updateDraft({ sprite_index: i })}
              className={cn(
                'grid place-items-center rounded-xl border bg-white/5 py-2.5 transition-all',
                selected ? 'border-white ring-1 ring-white' : 'border-white/12 hover:bg-white/10'
              )}
              aria-label={`Character ${i + 1}`}
            >
              <PixelSpriteAvatar spriteIndex={i} height={48} />
            </button>
          );
        })}
      </div>

      {/* Color */}
      <p className="mb-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Color</p>
      <div className="grid grid-cols-8 gap-2">
        {AVATAR_COLOR_OPTIONS.map((color) => {
          const selected = draft.avatar_color === color;
          return (
            <button
              key={color}
              type="button"
              onClick={() => updateDraft({ avatar_color: color })}
              className={cn(
                'aspect-square rounded-full transition-transform',
                selected ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black' : 'hover:scale-105'
              )}
              style={{ background: getAvatarBackground(color) }}
              aria-label={`Color ${color}`}
            />
          );
        })}
      </div>
    </div>
  );
}
