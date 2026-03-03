import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { PersonalityParams } from '@/types/agent';

interface Props {
  params: PersonalityParams;
  onParamChange: <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => void;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/70 p-5 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:bg-white/[0.05]">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Setup</p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ScaleField({
  label,
  description,
  value,
  onChange,
  labels,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  labels: [string, string, string, string, string];
}) {
  return (
    <div className="rounded-3xl border border-border/50 bg-background/70 p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold text-foreground">{label}</Label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
          {labels[value - 1]}
        </div>
      </div>
      <div className="mt-4">
        <Slider min={1} max={5} step={1} value={[value]} onValueChange={(arr) => onChange(arr[0])} />
        <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[10px] font-medium text-muted-foreground">
          {labels.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-border/50 bg-background/70 p-4 backdrop-blur-md">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {checked ? 'On' : 'Off'}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function Screen3_Personality({ params, onParamChange }: Props) {
  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-background/90 via-background/75 to-primary/10 p-6 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Agent Mindset</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Shape the voice before the rules.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Keep these settings broad and readable so the agent feels intentional instead of over-configured.
        </p>
      </section>

      <Section
        title="Core Personality"
        description="Define how aggressive, selective, and value-oriented your agent should feel."
      >
        <ScaleField
          label="Risk tolerance"
          description="Controls how comfortable the agent is taking on higher-variance spots."
          value={params.risk_tolerance}
          onChange={(v) => onParamChange('risk_tolerance', v as any)}
          labels={['Very safe', 'Safe', 'Balanced', 'Aggressive', 'High risk']}
        />
        <ScaleField
          label="Underdog lean"
          description="Shifts the preference between favorites and plus-money opportunities."
          value={params.underdog_lean}
          onChange={(v) => onParamChange('underdog_lean', v as any)}
          labels={['Chalk', 'Favs', 'Balanced', 'Dogs', 'Dogs only']}
        />
        <ScaleField
          label="Confidence threshold"
          description="Raises or lowers the bar before the agent is willing to make a pick."
          value={params.confidence_threshold}
          onChange={(v) => onParamChange('confidence_threshold', v as any)}
          labels={['Any edge', 'Low', 'Moderate', 'High', 'Very picky']}
        />
        <ScaleField
          label="Trust model"
          description="Sets how much the agent should defer to the core model probabilities."
          value={params.trust_model}
          onChange={(v) => onParamChange('trust_model', v as any)}
          labels={['Light', 'Low', 'Balanced', 'High', 'Full']}
        />
        <ToggleField
          label="Chase value"
          description="Prefer bets where market pricing looks softer than the model says it should be."
          checked={params.chase_value}
          onCheckedChange={(v) => onParamChange('chase_value', v as any)}
        />
      </Section>

      <Section
        title="Bet Selection"
        description="Reduce clutter by telling the agent how often it should fire and whether to skip weak slates."
      >
        <ScaleField
          label="Max picks per day"
          description="Keeps the agent focused instead of flooding the card with marginal plays."
          value={params.max_picks_per_day}
          onChange={(v) => onParamChange('max_picks_per_day', v as any)}
          labels={['1 pick', '2 picks', '3 picks', '4 picks', '5 picks']}
        />
        <ToggleField
          label="Skip weak slates"
          description="Allow the agent to stay quiet on thin or low-quality betting boards."
          checked={params.skip_weak_slates}
          onCheckedChange={(v) => onParamChange('skip_weak_slates', v as any)}
        />
      </Section>
    </div>
  );
}
