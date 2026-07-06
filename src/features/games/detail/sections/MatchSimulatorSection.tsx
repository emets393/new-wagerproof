import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WidgetCard } from '@/components/ios';
import { getContrastingTextColor } from '@/utils/teamColors';
import type { GameFeedItem, TeamRef } from '../../types';

/**
 * Match Simulator, ported from GameDetailsModal (CFB/NCAAB/NBA block). The
 * modal kept sim state per-card in the page (sim*ById props); here it's local
 * to the section and resets whenever the selected game changes.
 */

// Spinning football loader for simulator (CFB)
const FootballLoader = () => (
  <svg
    className="h-8 w-8 animate-spin mr-2"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <ellipse cx="32" cy="32" rx="28" ry="18" fill="currentColor" className="text-orange-600" />
    <path d="M32 14 L32 50 M16 32 L48 32 M20 20 L44 44 M20 44 L44 20" stroke="white" strokeWidth="2" />
  </svg>
);

// Spinning basketball loader for simulator (NBA/NCAAB)
const BasketballLoader = () => (
  <svg
    className="h-8 w-8 animate-spin mr-2"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="32" cy="32" r="28" fill="currentColor" className="text-orange-600" />
    <path d="M32 4 Q20 20 20 32 Q20 44 32 60" stroke="white" strokeWidth="1.5" fill="none" />
    <path d="M32 4 Q44 20 44 32 Q44 44 32 60" stroke="white" strokeWidth="1.5" fill="none" />
    <line x1="32" y1="4" x2="32" y2="60" stroke="white" strokeWidth="1.5" />
    <ellipse cx="32" cy="32" rx="28" ry="8" stroke="white" strokeWidth="1.5" fill="none" transform="rotate(90 32 32)" />
  </svg>
);

/** Team circle: adapter-resolved logo with initials fallback (React-state port of the modal's DOM onError swap). */
function TeamDisc({ team }: { team: TeamRef }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => setImgFailed(false), [team.logoUrl]);

  const logoUrl = team.logoUrl;
  const hasLogo = !!logoUrl && logoUrl !== '/placeholder.svg' && logoUrl.trim() !== '' && !imgFailed;

  return (
    <div
      className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-1 sm:mb-2 rounded-full flex items-center justify-center border-2 transition-transform duration-200 shadow-lg overflow-hidden"
      style={{
        background: hasLogo
          ? 'transparent'
          : `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary})`,
        borderColor: `${team.colors.primary}`,
      }}
    >
      {hasLogo ? (
        <img
          src={logoUrl as string}
          alt={team.name}
          className="w-full h-full object-contain p-1"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className="text-xs sm:text-sm font-bold drop-shadow-md"
          style={{ color: getContrastingTextColor(team.colors.primary, team.colors.secondary) }}
        >
          {team.abbrev}
        </span>
      )}
    </div>
  );
}

export function MatchSimulatorSection({ game }: { game: GameFeedItem }) {
  const league = game.sport;
  const [loading, setLoading] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-game reset: switching selection mid-simulation must not reveal the
  // new game's score, so kill any pending timeout too.
  React.useEffect(() => {
    setLoading(false);
    setRevealed(false);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [game.id]);

  if (league !== 'cfb' && league !== 'ncaab' && league !== 'nba') return null;

  const raw = game.raw as Record<string, unknown>;
  const isBasketball = league === 'ncaab' || league === 'nba';

  // Verbatim field fallbacks from the modal: basketball rows carry
  // *_score_pred, CFB rows carry pred_*_points.
  const scoreFor = (side: 'away' | 'home'): string => {
    const val = isBasketball
      ? ((raw[`${side}_score_pred`] ?? raw[`pred_${side}_score`]) as number | null | undefined)
      : ((raw[`pred_${side}_points`] ?? raw[`pred_${side}_score`]) as number | null | undefined);
    return val !== null && val !== undefined ? Math.round(Number(val)).toString() : '-';
  };

  const simulate = () => {
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setRevealed(true);
    }, 2500);
  };

  return (
    <WidgetCard icon={<Sparkles />} title="Match Simulator">
      <div className="space-y-4 text-center">
        {!revealed && (
          <div className="flex justify-center">
            <Button
              disabled={loading}
              onClick={simulate}
              className="px-6 py-6 text-lg font-bold bg-card dark:bg-card text-foreground dark:text-foreground border-2 border-border shadow-md hover:bg-muted/50"
            >
              {loading ? (
                <span className="flex items-center">
                  {isBasketball ? <BasketballLoader /> : <FootballLoader />} Simulating…
                </span>
              ) : (
                'Simulate Match'
              )}
            </Button>
          </div>
        )}

        {revealed && (
          <div className="flex justify-between items-center bg-gradient-to-br from-orange-50 to-orange-50 dark:from-orange-950/30 dark:to-orange-950/30 p-3 sm:p-4 rounded-lg border border-border">
            <div className="text-center flex-1">
              <TeamDisc team={game.awayTeam} />
              <div className="text-xl sm:text-2xl font-bold text-foreground">{scoreFor('away')}</div>
            </div>

            <div className="text-center px-3 sm:px-4">
              <div className="text-base sm:text-lg font-bold text-muted-foreground">VS</div>
            </div>

            <div className="text-center flex-1">
              <TeamDisc team={game.homeTeam} />
              <div className="text-xl sm:text-2xl font-bold text-foreground">{scoreFor('home')}</div>
            </div>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
