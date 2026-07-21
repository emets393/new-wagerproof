import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Flame,
  MoonStar,
  PersonStanding,
  Shield,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { WidgetCard } from '@/components/ios';
import {
  PARLAY_CATEGORY_TITLE,
  legFractionText,
  legOddsText,
  propLegs,
  type ParlayGodCategory,
  type ParlayLeg,
} from '@/features/parlayGod';
import { useMLBPlayerPropsL10 } from '@/hooks/useMLBPlayerPropsL10';
import { mlbHeadshotUrl } from '@/utils/mlbPitcherMatchups';

const CATEGORY_ICONS: Partial<Record<ParlayGodCategory, LucideIcon>> = {
  recentForm: Flame,
  alternateLines: SlidersHorizontal,
  dayNight: MoonStar,
  armType: PersonStanding,
  versusOpponent: Shield,
};

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function PlayerHeadshot({ leg }: { leg: ParlayLeg }) {
  const src = leg.playerId === null ? null : mlbHeadshotUrl(leg.playerId, 96);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-muted shadow-sm dark:border-white/15">
      {src && !failed ? (
        <img
          src={src}
          alt={`${leg.subject} headshot`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-xs font-black text-muted-foreground">{initials(leg.subject)}</span>
      )}
    </div>
  );
}

function PropCheatRow({ leg }: { leg: ParlayLeg }) {
  const CategoryIcon = CATEGORY_ICONS[leg.category] ?? Flame;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-[#141414]">
      <div className="flex items-start gap-2.5">
        <PlayerHeadshot leg={leg} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-foreground">
            {leg.subject} — {leg.betText}
          </p>
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {PARLAY_CATEGORY_TITLE[leg.category]}
          </p>
          <p className="truncate text-xs font-bold text-muted-foreground">{leg.matchupLabel}</p>
        </div>
        <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-black text-primary">
          {legOddsText(leg)}
        </span>
      </div>

      <div className="rounded-[10px] bg-muted/35 p-2">
        <div className="text-[9px] font-bold uppercase leading-tight text-muted-foreground">
          Player prop
        </div>
        <div className="text-xs font-bold text-foreground">{leg.betText}</div>
      </div>

      <div className="flex items-start gap-1.5">
        <CategoryIcon className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <p className="min-w-0 flex-1 text-xs font-medium leading-tight text-muted-foreground">
          {leg.evidence}
        </p>
        <span className="min-w-[2.5rem] shrink-0 text-right font-mono text-xs font-black tabular-nums text-emerald-500">
          100%
        </span>
      </div>

      <div className="flex items-center gap-1.5 border-t border-black/5 pt-2 dark:border-white/10">
        <Flame className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold text-muted-foreground">Perfect tracked sample</span>
        <span className="ml-auto rounded-full bg-emerald-500/[0.14] px-1.5 py-0.5 font-mono text-[10px] font-black text-emerald-500">
          {legFractionText(leg)}
        </span>
      </div>
    </div>
  );
}

interface MlbPropsCheatsSectionProps {
  gamePk: number;
  awayAbbrev: string;
  homeAbbrev: string;
  gameTimeEt: string | null;
}

export function MlbPropsCheatsSection({
  gamePk,
  awayAbbrev,
  homeAbbrev,
  gameTimeEt,
}: MlbPropsCheatsSectionProps) {
  const { data: props = [], isLoading } = useMLBPlayerPropsL10(gamePk);

  const relevantLegs = useMemo(() => {
    const legs = propLegs([
      {
        gamePk,
        awayAbbr: awayAbbrev,
        homeAbbr: homeAbbrev,
        gameTimeEt,
        teamByPlayerId: new Map<number, string>(),
        props,
      },
    ]).sort((a, b) => b.streakN - a.streakN);

    const seen = new Set<string>();
    return legs.filter((leg) => {
      const key = `${leg.subject}|${leg.betText}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
  }, [awayAbbrev, gamePk, gameTimeEt, homeAbbrev, props]);

  const accessory = (
    <Link
      to="/today-in-sports"
      className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
    >
      Today&apos;s Outliers <ArrowUpRight className="h-3 w-3" />
    </Link>
  );

  return (
    <WidgetCard
      icon={<Flame />}
      title="Props Cheats"
      subtitle="Player props with a perfect hit streak in at least one tracked situation."
      accessory={accessory}
    >
      {isLoading ? (
        <div className="space-y-2" aria-label="Loading props cheats">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-[174px] animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : relevantLegs.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No perfect-streak prop cheats have qualified for this matchup yet.
        </p>
      ) : (
        <div className="space-y-2">
          {relevantLegs.map((leg) => (
            <PropCheatRow key={leg.id} leg={leg} />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-2.5 text-[10px] text-muted-foreground dark:border-white/10">
        <span>Perfect historical streaks are not predictions.</span>
        <span className="shrink-0 font-semibold">Bet responsibly.</span>
      </div>
    </WidgetCard>
  );
}
