import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  CircleGauge,
  Globe2,
  MapPin,
  RotateCcw,
  Shield,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { WidgetCard } from '@/components/ios';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { cn } from '@/lib/utils';

interface TrendRow {
  game_pk: number;
  team_side: 'home' | 'away';
  last_game_situation: string | null;
  home_away_situation: string | null;
  fav_dog_situation: string | null;
  rest_bucket: string | null;
  rest_comp: string | null;
  league_situation: string | null;
  division_situation: string | null;
  win_pct_last_game: number | string | null;
  win_pct_home_away: number | string | null;
  win_pct_fav_dog: number | string | null;
  win_pct_rest_bucket: number | string | null;
  win_pct_rest_comp: number | string | null;
  win_pct_league: number | string | null;
  win_pct_division: number | string | null;
  over_pct_last_game: number | string | null;
  over_pct_home_away: number | string | null;
  over_pct_fav_dog: number | string | null;
  over_pct_rest_bucket: number | string | null;
  over_pct_rest_comp: number | string | null;
  over_pct_league: number | string | null;
  over_pct_division: number | string | null;
}

interface TrendDefinition {
  label: string;
  icon: LucideIcon;
  situation: keyof TrendRow;
  winPct: keyof TrendRow;
  overPct: keyof TrendRow;
}

const TREND_DEFINITIONS: TrendDefinition[] = [
  { label: 'Last game', icon: RotateCcw, situation: 'last_game_situation', winPct: 'win_pct_last_game', overPct: 'over_pct_last_game' },
  { label: 'Venue', icon: MapPin, situation: 'home_away_situation', winPct: 'win_pct_home_away', overPct: 'over_pct_home_away' },
  { label: 'Market role', icon: BadgeDollarSign, situation: 'fav_dog_situation', winPct: 'win_pct_fav_dog', overPct: 'over_pct_fav_dog' },
  { label: 'Days off', icon: CalendarClock, situation: 'rest_bucket', winPct: 'win_pct_rest_bucket', overPct: 'over_pct_rest_bucket' },
  { label: 'Rest edge', icon: CircleGauge, situation: 'rest_comp', winPct: 'win_pct_rest_comp', overPct: 'over_pct_rest_comp' },
  { label: 'League', icon: Globe2, situation: 'league_situation', winPct: 'win_pct_league', overPct: 'over_pct_league' },
  { label: 'Division', icon: Shield, situation: 'division_situation', winPct: 'win_pct_division', overPct: 'over_pct_division' },
];

function toPct(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseFloat(String(value).replace('%', '').trim());
  if (!Number.isFinite(parsed)) return null;
  return parsed > 0 && parsed < 1 ? parsed * 100 : parsed;
}

function formatSituation(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '—';
  const labels: Record<string, string> = {
    is_after_loss: 'After loss',
    is_after_win: 'After win',
    is_fav: 'Favorite',
    is_dog: 'Underdog',
    is_home: 'Home',
    is_away: 'Away',
    is_home_fav: 'Home favorite',
    is_away_fav: 'Away favorite',
    is_home_dog: 'Home underdog',
    is_away_dog: 'Away underdog',
    one_day_off: '1 day off',
    two_three_days_off: '2–3 days off',
    four_plus_days_off: '4+ days off',
    no_rest: 'No rest',
    rest_advantage: 'Rest advantage',
    rest_disadvantage: 'Rest disadvantage',
    rest_equal: 'Equal rest',
    equal_rest: 'Equal rest',
    non_league: 'Non-league',
    non_division: 'Non-division',
    league: 'League',
    division: 'Division',
  };
  return labels[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pctClass(value: number | null): string {
  if (value === null) return 'text-muted-foreground/60';
  if (value > 55) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 45) return 'text-rose-600 dark:text-rose-400';
  return 'text-amber-600 dark:text-amber-400';
}

function pctBarClass(value: number | null): string {
  if (value === null) return 'bg-muted-foreground/30';
  if (value > 55) return 'bg-emerald-500';
  if (value < 45) return 'bg-rose-500';
  return 'bg-amber-500';
}

function TrendMetric({ label, value }: { label: string; value: number | null }) {
  const boundedValue = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_28px] items-center gap-1">
      <span className="font-mono text-[9px] font-bold text-muted-foreground">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <span
          className={cn('block h-full rounded-full', pctBarClass(value))}
          style={{ width: `${boundedValue}%` }}
        />
      </span>
      <span className={cn('text-right font-mono text-[9px] font-bold', pctClass(value))}>
        {value === null ? '—' : `${value.toFixed(0)}%`}
      </span>
    </div>
  );
}

function TeamTrendCell({ row, definition }: { row: TrendRow; definition: TrendDefinition }) {
  const winPct = toPct(row[definition.winPct]);
  const overPct = toPct(row[definition.overPct]);

  return (
    <div className="min-w-0 rounded-lg bg-black/[0.025] px-2 py-1.5 dark:bg-white/[0.04]">
      <p className="truncate text-[10px] font-medium text-muted-foreground">
        {formatSituation(row[definition.situation])}
      </p>
      <div className="mt-1 space-y-1">
        <TrendMetric label="ML" value={winPct} />
        <TrendMetric label="OVER" value={overPct} />
      </div>
    </div>
  );
}

async function fetchMatchupTrends(gamePk: number): Promise<TrendRow[]> {
  const { data, error } = await collegeFootballSupabase
    .from('mlb_situational_trends_today')
    .select('*')
    .eq('game_pk', gamePk);

  if (error) throw new Error(error.message);
  return (data ?? []) as TrendRow[];
}

interface MlbBettingTrendsSectionProps {
  gamePk: number;
  awayAbbrev: string;
  homeAbbrev: string;
  awayLogoUrl: string | null;
  homeLogoUrl: string | null;
  awayColor: string;
  homeColor: string;
}

function TeamMark({ abbrev, logoUrl, color }: { abbrev: string; logoUrl: string | null; color: string }) {
  return (
    <div className="flex min-w-[88px] flex-col items-center gap-1.5">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full border border-black/10 bg-white/80 shadow-sm dark:border-white/15 dark:bg-white/10"
        style={{ boxShadow: `0 4px 16px ${color}30` }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={`${abbrev} logo`} className="h-10 w-10 object-contain" />
        ) : (
          <span className="text-sm font-black" style={{ color }}>{abbrev}</span>
        )}
      </div>
      <span className="text-sm font-black tracking-wide text-foreground">{abbrev}</span>
    </div>
  );
}

export function MlbBettingTrendsSection({
  gamePk,
  awayAbbrev,
  homeAbbrev,
  awayLogoUrl,
  homeLogoUrl,
  awayColor,
  homeColor,
}: MlbBettingTrendsSectionProps) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['mlb-situational-trends', gamePk],
    queryFn: () => fetchMatchupTrends(gamePk),
    staleTime: 5 * 60 * 1000,
  });

  const away = data.find((row) => row.team_side === 'away');
  const home = data.find((row) => row.team_side === 'home');
  const fullToolPath = `/mlb/todays-betting-trends?focusGamePk=${gamePk}`;

  const accessory = (
    <Link
      to={fullToolPath}
      className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
    >
      Full tool <ArrowUpRight className="h-3 w-3" />
    </Link>
  );

  return (
    <WidgetCard
      icon={<TrendingUp />}
      title="Today's Betting Trends"
      subtitle="Historical win and Over rates for each team in today's situation—not model projections."
      accessory={accessory}
      className="@xl:col-span-2"
    >
      {isLoading ? (
        <div className="space-y-2" aria-label="Loading betting trends">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Matchup trends are temporarily unavailable. Open the full tool to try again.
        </p>
      ) : !away || !home ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Situational trends have not been published for this matchup yet.
        </p>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-center gap-5 border-b border-black/5 pb-3 dark:border-white/10">
            <TeamMark abbrev={awayAbbrev} logoUrl={awayLogoUrl} color={awayColor} />
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">at</span>
            <TeamMark abbrev={homeAbbrev} logoUrl={homeLogoUrl} color={homeColor} />
          </div>
          <div className="mb-1 grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Situation</span>
            <span>{awayAbbrev}</span>
            <span>{homeAbbrev}</span>
          </div>
          <div className="space-y-1.5">
            {TREND_DEFINITIONS.map((definition) => (
              <div
                key={definition.label}
                className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5"
              >
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                  <definition.icon className="h-3.5 w-3.5 shrink-0" />
                  {definition.label}
                </span>
                <TeamTrendCell row={away} definition={definition} />
                <TeamTrendCell row={home} definition={definition} />
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
