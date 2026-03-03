import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { getConditionalParams, PersonalityParams, Sport } from '@/types/agent';

interface Props {
  params: PersonalityParams;
  selectedSports: Sport[];
  onParamChange: <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => void;
}

function Section({
  title,
  description,
  badges,
  children,
}: {
  title: string;
  description: string;
  badges?: string[];
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/70 p-5 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:bg-white/[0.05]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Signals</p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {badges?.length ? (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span key={badge} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
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

const TRUST_LABELS: [string, string, string, string, string] = ['Ignore', 'Low', 'Moderate', 'High', 'Full'];

export function Screen4_DataAndConditions({ params, selectedSports, onParamChange }: Props) {
  const conditional = getConditionalParams(selectedSports);
  const sportBadges = selectedSports.map((sport) => sport.toUpperCase());

  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-background/90 via-background/75 to-primary/10 p-6 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Data Controls</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Make the rules easier to scan.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Group the decision logic by signal type so the agent reads like a system, not a long checklist.
        </p>
      </section>

      <Section
        title="Market Trust"
        description="Set how heavily this agent leans on core projections and external markets."
        badges={sportBadges}
      >
        <ScaleField
          label="Trust Polymarket"
          description="How much the agent should respect prediction market pricing."
          value={params.trust_polymarket}
          onChange={(v) => onParamChange('trust_polymarket', v as any)}
          labels={TRUST_LABELS}
        />
        <ToggleField
          label="Flag Polymarket divergence"
          description="Highlight spots where market pricing and Vegas disagree in a meaningful way."
          checked={params.polymarket_divergence_flag}
          onCheckedChange={(v) => onParamChange('polymarket_divergence_flag', v as any)}
        />
        <ToggleField
          label="Skip weak slates"
          description="Let the agent stay quiet instead of forcing low-conviction picks."
          checked={params.skip_weak_slates}
          onCheckedChange={(v) => onParamChange('skip_weak_slates', v as any)}
        />
      </Section>

      {conditional.showPublicBetting ? (
        <Section
          title="Football Filters"
          description="Only shows when football is selected, so the screen stays scoped to relevant toggles."
          badges={selectedSports.filter((sport) => sport === 'nfl' || sport === 'cfb').map((sport) => sport.toUpperCase())}
        >
          <ToggleField
            label="Fade public betting"
            description="Push the agent toward contrarian positions when the crowd piles onto one side."
            checked={!!params.fade_public}
            onCheckedChange={(v) => onParamChange('fade_public', v as any)}
          />
          {conditional.showWeather ? (
            <ToggleField
              label="Weather impacts totals"
              description="Bring wind, rain, and other outdoor conditions into total bets."
              checked={!!params.weather_impacts_totals}
              onCheckedChange={(v) => onParamChange('weather_impacts_totals', v as any)}
            />
          ) : null}
        </Section>
      ) : null}

      {conditional.showTeamRatings || conditional.showBackToBacks ? (
        <Section
          title="Basketball Filters"
          description="Basketball-specific signals are separated so they do not crowd the universal settings."
          badges={selectedSports.filter((sport) => sport === 'nba' || sport === 'ncaab').map((sport) => sport.toUpperCase())}
        >
          {conditional.showBackToBacks ? (
            <ToggleField
              label="Fade back-to-backs"
              description="Apply a penalty to teams in tighter rest spots."
              checked={!!params.fade_back_to_backs}
              onCheckedChange={(v) => onParamChange('fade_back_to_backs', v as any)}
            />
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
