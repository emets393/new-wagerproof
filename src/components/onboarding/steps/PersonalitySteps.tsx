/**
 * Personality builder steps — web port of OnboardingPersonalityPages:
 * mindset (instincts), bet style (playbook), data trust (data diet) and
 * sport-specific rules.
 */
import { useEffect, useState } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  LabeledSlider,
  SectionCard,
  SegmentedPicker,
  StepHeader,
  ToggleRow,
} from '@/components/onboarding/OnboardingShared';
import { SLIDER_LABELS } from '@/components/onboarding/flow';
import { fetchPresetArchetypes } from '@/services/agentService';
import type { MarketKey, PersonalityParams } from '@/types/agent';
import { MARKET_KEYS } from '@/types/agent';

function usePersonality() {
  const { draft, updateDraft } = useOnboarding();
  const params = draft.personality_params;
  const setParams = (partial: Partial<PersonalityParams>) => {
    updateDraft({ personality_params: { ...params, ...partial } });
  };
  return { params, setParams, sports: draft.preferred_sports, archetype: draft.archetype };
}

/** "Pre-tuned by {preset}" note under the header when a preset was chosen. */
function PresetNote() {
  const { draft } = useOnboarding();
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!draft.archetype) {
      setName(null);
      return;
    }
    let live = true;
    fetchPresetArchetypes()
      .then((presets) => {
        if (!live) return;
        setName(presets.find((p) => p.id === draft.archetype)?.name ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [draft.archetype]);
  if (!name) return null;
  return (
    <p className="-mt-3 mb-5 text-center text-xs font-semibold text-white/45">Pre-tuned by {name}</p>
  );
}

// ── Mindset ──────────────────────────────────────────────────────────────────

export function BuilderMindsetStep() {
  const { params, setParams } = usePersonality();
  return (
    <div className="w-full">
      <StepHeader
        title="Set its instincts"
        subtitle="Its temperament — a high-risk dog hunter reads a whole different board than a chalk grinder."
      />
      <PresetNote />
      <SectionCard>
        <LabeledSlider
          label="Risk Tolerance"
          value={params.risk_tolerance}
          onChange={(v) => setParams({ risk_tolerance: v })}
          labels={SLIDER_LABELS.risk_tolerance}
        />
        <LabeledSlider
          label="Underdog Lean"
          value={params.underdog_lean}
          onChange={(v) => setParams({ underdog_lean: v })}
          labels={SLIDER_LABELS.underdog_lean}
        />
        <LabeledSlider
          label="Over/Under Lean"
          value={params.over_under_lean}
          onChange={(v) => setParams({ over_under_lean: v })}
          labels={SLIDER_LABELS.over_under_lean}
        />
        <LabeledSlider
          label="Confidence Threshold"
          value={params.confidence_threshold}
          onChange={(v) => setParams({ confidence_threshold: v })}
          labels={SLIDER_LABELS.confidence_threshold}
        />
      </SectionCard>
    </div>
  );
}

// ── Bet style ────────────────────────────────────────────────────────────────

const BET_TYPE_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'spread', label: 'Spread' },
  { value: 'moneyline', label: 'ML' },
  { value: 'total', label: 'Total' },
  { value: 'prop', label: 'Props' },
] as const;

const MARKET_LABELS: Record<MarketKey, string> = {
  spread: 'Spread',
  moneyline: 'Moneyline',
  total: 'Total',
  team_total: 'Team Total',
  prop: 'Player Props',
};

const PROPS_EMPHASIS_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'allow', label: 'Allow' },
  { value: 'emphasize', label: 'Emphasize' },
] as const;

export function BuilderBetStyleStep() {
  const { params, setParams, sports } = usePersonality();
  const hasNFL = sports.includes('nfl');
  const availableMarkets = MARKET_KEYS.filter((m) => (m === 'prop' ? hasNFL : true));
  const effectiveMarkets = params.allowed_markets ?? availableMarkets;

  const toggleMarket = (market: MarketKey) => {
    const next = effectiveMarkets.includes(market)
      ? effectiveMarkets.filter((m) => m !== market)
      : [...effectiveMarkets, market];
    if (next.length === 0) return; // must keep at least one market
    // A full set means "no restriction" — store unset like iOS.
    const isFullSet = availableMarkets.every((m) => next.includes(m));
    setParams({ allowed_markets: isFullSet ? undefined : next });
  };

  return (
    <div className="w-full">
      <StepHeader
        title="Choose its playbook"
        subtitle="What lands on your rail — the markets it plays, how often it fires, straights or parlays."
      />
      <PresetNote />
      <div className="flex flex-col gap-4">
        <SectionCard>
          <div>
            <p className="mb-2 text-sm font-semibold text-white">Bet Type</p>
            <SegmentedPicker
              options={BET_TYPE_OPTIONS}
              value={params.preferred_bet_type}
              onChange={(v) => setParams({ preferred_bet_type: v })}
            />
          </div>
          <LabeledSlider
            label="Max Picks Per Day"
            value={params.max_picks_per_day}
            onChange={(v) => setParams({ max_picks_per_day: v })}
            labels={SLIDER_LABELS.max_picks_per_day}
          />
          <ToggleRow
            label="Skip Weak Slates"
            description="Pass when nothing clears its bar"
            checked={params.skip_weak_slates}
            onChange={(v) => setParams({ skip_weak_slates: v })}
          />
          <ToggleRow
            label="Chase Value"
            description="Take positive-EV prices"
            checked={params.chase_value}
            onChange={(v) => setParams({ chase_value: v })}
          />
        </SectionCard>

        <SectionCard title="Parlays">
          <LabeledSlider
            label="Parlay Appetite"
            value={params.parlay_appetite ?? 1}
            onChange={(v) => setParams({ parlay_appetite: v })}
            labels={SLIDER_LABELS.parlay_appetite}
          />
          <ToggleRow
            label="Parlays Only"
            description="Every play goes on a parlay ticket"
            checked={params.parlays_only ?? false}
            onChange={(v) => setParams({ parlays_only: v })}
          />
        </SectionCard>

        <SectionCard title="Markets">
          <div className="flex flex-wrap gap-2">
            {availableMarkets.map((market) => {
              const on = effectiveMarkets.includes(market);
              return (
                <button
                  key={market}
                  type="button"
                  onClick={() => toggleMarket(market)}
                  className={
                    on
                      ? 'rounded-full bg-white px-3.5 py-2 text-xs font-bold text-black'
                      : 'rounded-full border border-white/20 bg-white/5 px-3.5 py-2 text-xs font-bold text-white/70 hover:bg-white/10'
                  }
                >
                  {MARKET_LABELS[market]}
                </button>
              );
            })}
          </div>
          {hasNFL && (
            <div>
              <p className="mb-2 text-sm font-semibold text-white">Player Props Emphasis</p>
              <SegmentedPicker
                options={PROPS_EMPHASIS_OPTIONS}
                value={params.props_emphasis ?? 'allow'}
                onChange={(v) => setParams({ props_emphasis: v })}
              />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Data trust ───────────────────────────────────────────────────────────────

function OddsLimitControl({
  label,
  description,
  value,
  onChange,
  min,
  max,
  noLimitDefault,
}: {
  label: string;
  description: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  noLimitDefault: number;
}) {
  const { accent } = useOnboarding();
  const limited = value !== null;
  return (
    <div>
      <ToggleRow
        label={label}
        description={description}
        checked={limited}
        onChange={(on) => onChange(on ? noLimitDefault : null)}
      />
      {limited && (
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={min}
            max={max}
            step={10}
            value={value ?? noLimitDefault}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: accent }}
            aria-label={label}
          />
          <span className="w-14 shrink-0 text-right text-sm font-bold text-white">
            {value! > 0 ? `+${value}` : value}
          </span>
        </div>
      )}
      {!limited && <p className="mt-1 text-right text-xs font-semibold text-white/40">No limit</p>}
    </div>
  );
}

export function BuilderDataTrustStep() {
  const { params, setParams } = usePersonality();
  return (
    <div className="w-full">
      <StepHeader
        title="Pick its data diet"
        subtitle="Whose voice wins when our model, Polymarket, and the Vegas price disagree."
      />
      <PresetNote />
      <div className="flex flex-col gap-4">
        <SectionCard>
          <LabeledSlider
            label="Trust WagerProof Model"
            value={params.trust_model}
            onChange={(v) => setParams({ trust_model: v })}
            labels={SLIDER_LABELS.trust}
          />
          <LabeledSlider
            label="Trust Polymarket"
            value={params.trust_polymarket}
            onChange={(v) => setParams({ trust_polymarket: v })}
            labels={SLIDER_LABELS.trust}
          />
          <ToggleRow
            label="Polymarket Divergence Flag"
            description="Flag hard Vegas/Polymarket splits"
            checked={params.polymarket_divergence_flag}
            onChange={(v) => setParams({ polymarket_divergence_flag: v })}
          />
        </SectionCard>

        <SectionCard title="Price limits">
          <OddsLimitControl
            label="Max Favorite Odds"
            description="Skip favorites priced steeper than this"
            value={params.max_favorite_odds}
            onChange={(v) => setParams({ max_favorite_odds: v })}
            min={-500}
            max={-100}
            noLimitDefault={-200}
          />
          <OddsLimitControl
            label="Min Underdog Odds"
            description="Only take dogs paying at least this"
            value={params.min_underdog_odds}
            onChange={(v) => setParams({ min_underdog_odds: v })}
            min={100}
            max={500}
            noLimitDefault={150}
          />
        </SectionCard>
      </div>
    </div>
  );
}

// ── Sport rules ──────────────────────────────────────────────────────────────

export function BuilderSportRulesStep() {
  const { params, setParams, sports } = usePersonality();
  const hasFootball = sports.includes('nfl') || sports.includes('cfb');
  const hasBasketball = sports.includes('nba') || sports.includes('ncaab');
  const hasNBA = sports.includes('nba');
  const hasNCAAB = sports.includes('ncaab');

  return (
    <div className="w-full">
      <StepHeader
        title="Teach it your sports"
        subtitle="Edges that only fire where they're real — weather in football, back-to-backs in hoops."
      />
      <PresetNote />
      <div className="flex flex-col gap-4">
        {hasFootball && (
          <SectionCard title="Football">
            <ToggleRow
              label="Fade the Public"
              description="Bet against the crowd"
              checked={params.fade_public ?? false}
              onChange={(v) => setParams({ fade_public: v, public_threshold: v ? (params.public_threshold ?? 3) : undefined })}
            />
            {params.fade_public && (
              <LabeledSlider
                label="Public Threshold"
                description="Fade when this share of bets is on one side"
                value={params.public_threshold ?? 3}
                onChange={(v) => setParams({ public_threshold: v })}
                labels={SLIDER_LABELS.public_threshold}
              />
            )}
            <ToggleRow
              label="Weather Impacts Totals"
              description="Wind and weather move its totals reads"
              checked={params.weather_impacts_totals ?? false}
              onChange={(v) =>
                setParams({ weather_impacts_totals: v, weather_sensitivity: v ? (params.weather_sensitivity ?? 3) : undefined })
              }
            />
            {params.weather_impacts_totals && (
              <LabeledSlider
                label="Weather Sensitivity"
                value={params.weather_sensitivity ?? 3}
                onChange={(v) => setParams({ weather_sensitivity: v })}
                labels={SLIDER_LABELS.weather_sensitivity}
              />
            )}
          </SectionCard>
        )}

        {hasBasketball && (
          <SectionCard title="Basketball">
            <LabeledSlider
              label="Trust Team Ratings"
              value={params.trust_team_ratings ?? 3}
              onChange={(v) => setParams({ trust_team_ratings: v })}
              labels={SLIDER_LABELS.trust}
            />
            <ToggleRow
              label="Pace Affects Totals"
              description="Lean on tempo when reading totals"
              checked={params.pace_affects_totals ?? false}
              onChange={(v) => setParams({ pace_affects_totals: v })}
            />
            <ToggleRow
              label="Fade Back-to-Backs"
              description="Bet against tired teams"
              checked={params.fade_back_to_backs ?? false}
              onChange={(v) => setParams({ fade_back_to_backs: v })}
            />
          </SectionCard>
        )}

        {hasNBA && (
          <SectionCard title="NBA trends">
            <LabeledSlider
              label="Weight Recent Form"
              value={params.weight_recent_form ?? 3}
              onChange={(v) => setParams({ weight_recent_form: v })}
              labels={SLIDER_LABELS.weight_recent_form}
            />
            <ToggleRow
              label="Ride Hot Streaks"
              checked={params.ride_hot_streaks ?? false}
              onChange={(v) => setParams({ ride_hot_streaks: v })}
            />
            <ToggleRow
              label="Fade Cold Streaks"
              checked={params.fade_cold_streaks ?? false}
              onChange={(v) => setParams({ fade_cold_streaks: v })}
            />
            <ToggleRow
              label="Trust ATS Trends"
              checked={params.trust_ats_trends ?? false}
              onChange={(v) => setParams({ trust_ats_trends: v })}
            />
            <ToggleRow
              label="Regress Luck"
              description="Expect runs to snap back"
              checked={params.regress_luck ?? false}
              onChange={(v) => setParams({ regress_luck: v })}
            />
          </SectionCard>
        )}

        {hasNCAAB && (
          <SectionCard title="College hoops">
            <ToggleRow
              label="Upset Alert"
              description="Flag tournament upsets"
              checked={params.upset_alert ?? false}
              onChange={(v) => setParams({ upset_alert: v })}
            />
          </SectionCard>
        )}

        <SectionCard title="Situational">
          <LabeledSlider
            label="Home Court Boost"
            description="How much home advantage matters"
            value={params.home_court_boost}
            onChange={(v) => setParams({ home_court_boost: v })}
            labels={SLIDER_LABELS.home_court_boost}
          />
        </SectionCard>
      </div>
    </div>
  );
}
