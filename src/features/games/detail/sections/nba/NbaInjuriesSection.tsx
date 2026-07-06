import * as React from 'react';
import { Stethoscope, AlertCircle } from 'lucide-react';
import { WidgetCard, SkeletonBlock } from '@/components/ios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { NbaInjuryReport } from './useNbaMatchupOverview';
import type { GameFeedItem, TeamRef } from '../../../types';

/**
 * NBA injury report + cumulative Injury Impact Score, ported from
 * MatchupOverviewModal. Impact = sum of -PIE across a team's injured players
 * (more negative = more production sidelined = red).
 */

const calculateInjuryImpact = (injuries: NbaInjuryReport[]): number => {
  if (injuries.length === 0) return 0.0;
  return injuries.reduce((sum, injury) => {
    if (injury.avg_pie_season === null || injury.avg_pie_season === undefined) return sum;
    const pie =
      typeof injury.avg_pie_season === 'string'
        ? parseFloat(injury.avg_pie_season)
        : injury.avg_pie_season;
    return sum + (isNaN(pie) ? 0 : -pie);
  }, 0);
};

const formatPIE = (pie: string | number | null): string => {
  if (pie === null || pie === undefined) return 'N/A';
  const pieNum = typeof pie === 'string' ? parseFloat(pie) : pie;
  if (isNaN(pieNum)) return 'N/A';
  return pieNum.toFixed(4);
};

const sortByPIE = (injuries: NbaInjuryReport[]): NbaInjuryReport[] => {
  return [...injuries].sort((a, b) => {
    const pieA =
      a.avg_pie_season === null || a.avg_pie_season === undefined
        ? null
        : typeof a.avg_pie_season === 'string'
          ? parseFloat(a.avg_pie_season)
          : a.avg_pie_season;
    const pieB =
      b.avg_pie_season === null || b.avg_pie_season === undefined
        ? null
        : typeof b.avg_pie_season === 'string'
          ? parseFloat(b.avg_pie_season)
          : b.avg_pie_season;
    const valueA = pieA === null || isNaN(pieA) ? -Infinity : pieA;
    const valueB = pieB === null || isNaN(pieB) ? -Infinity : pieB;
    return valueB - valueA;
  });
};

function TeamHeader({ team }: { team: TeamRef }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => setImgFailed(false), [team.logoUrl]);

  const hasLogo =
    !!team.logoUrl && team.logoUrl !== '/placeholder.svg' && team.logoUrl.trim() !== '' && !imgFailed;

  return (
    <div className="flex flex-col items-center gap-2 mb-3">
      {hasLogo && (
        <img
          src={team.logoUrl as string}
          alt={team.name}
          className="w-10 h-10 object-contain"
          onError={() => setImgFailed(true)}
        />
      )}
      <h3 className="text-sm font-semibold text-center text-foreground">{team.name}</h3>
    </div>
  );
}

function InjuryTable({ injuries, accentColor }: { injuries: NbaInjuryReport[]; accentColor: string }) {
  if (injuries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center">No injuries reported</p>;
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_72px_72px] gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
        <div>Player</div>
        <div>Status</div>
        <div className="text-right">PIE</div>
      </div>
      <div className="divide-y divide-border">
        {sortByPIE(injuries).map((injury, index) => (
          <div
            key={`${injury.player_name}-${index}`}
            className="grid grid-cols-[1fr_72px_72px] gap-2 px-3 py-2 text-sm hover:bg-muted/30"
          >
            <div className="font-medium truncate text-foreground">{injury.player_name}</div>
            <div className="text-muted-foreground truncate">{injury.status}</div>
            <div className="font-semibold text-right" style={{ color: accentColor }}>
              {formatPIE(injury.avg_pie_season)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NbaInjuriesSection({
  game,
  injuries,
  loading,
  error,
}: {
  game: GameFeedItem;
  injuries: NbaInjuryReport[];
  loading: boolean;
  error: string | null;
}) {
  const raw = game.raw as Record<string, unknown>;
  const awayTeamName = (raw.away_team as string) || game.awayTeam.name;
  const homeTeamName = (raw.home_team as string) || game.homeTeam.name;

  // Case-insensitive exact team_name match, as in the modal.
  const awayInjuries = injuries.filter((injury) => {
    if (!awayTeamName || !injury.team_name) return false;
    return injury.team_name.toLowerCase() === awayTeamName.toLowerCase();
  });
  const homeInjuries = injuries.filter((injury) => {
    if (!homeTeamName || !injury.team_name) return false;
    return injury.team_name.toLowerCase() === homeTeamName.toLowerCase();
  });

  const awayInjuryImpact = calculateInjuryImpact(awayInjuries);
  const homeInjuryImpact = calculateInjuryImpact(homeInjuries);

  return (
    <WidgetCard icon={<Stethoscope />} title="Injuries" className="@xl:col-span-2">
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <SkeletonBlock height={28} />
            <SkeletonBlock height={72} />
          </div>
          <div className="space-y-3">
            <SkeletonBlock height={28} />
            <SkeletonBlock height={72} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <TeamHeader team={game.awayTeam} />
              <InjuryTable injuries={awayInjuries} accentColor={game.awayTeam.colors.primary} />
            </div>
            <div>
              <TeamHeader team={game.homeTeam} />
              <InjuryTable injuries={homeInjuries} accentColor={game.homeTeam.colors.primary} />
            </div>
          </div>

          {/* Cumulative Injury Impact Score — only meaningful once someone is hurt */}
          {(awayInjuries.length > 0 || homeInjuries.length > 0) && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 border-b border-border text-center">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cumulative Injury Impact Score
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-6 px-4 py-3 text-sm">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {game.awayTeam.abbrev}
                  </span>
                  <span
                    className="font-semibold text-lg"
                    style={{
                      color:
                        awayInjuryImpact < homeInjuryImpact
                          ? 'red'
                          : awayInjuryImpact > homeInjuryImpact
                            ? 'green'
                            : 'inherit',
                    }}
                  >
                    {awayInjuryImpact.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {game.homeTeam.abbrev}
                  </span>
                  <span
                    className="font-semibold text-lg"
                    style={{
                      color:
                        homeInjuryImpact < awayInjuryImpact
                          ? 'red'
                          : homeInjuryImpact > awayInjuryImpact
                            ? 'green'
                            : 'inherit',
                    }}
                  >
                    {homeInjuryImpact.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
