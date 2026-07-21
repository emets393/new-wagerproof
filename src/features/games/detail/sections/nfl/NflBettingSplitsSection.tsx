import * as React from 'react';
import { Chip } from '@heroui/react';
import { ArrowDown, ArrowUp, Users } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import type { NFLPrediction } from '../../../api/nflGames';
import type { GameFeedItem, TeamRef } from '../../../types';
import { TeamMark } from './shared';

interface ParsedBettingSplit {
  team: string;
  /** null when the label carries a lean but no number — do not invent 50%. */
  percentage: number | null;
  isSharp: boolean;
  isPublic: boolean;
  /** For totals: "over" or "under". */
  direction?: 'over' | 'under';
}

// Port of NFL.tsx parseBettingSplit. The percentage used to default to 50 when
// the label had no number in it; nothing rendered it, so the fake value was
// invisible. It's a bar now, so an absent percentage stays null.
const parseBettingSplit = (label: string | null): ParsedBettingSplit | null => {
  if (!label) return null;

  const lowerLabel = label.toLowerCase();

  const percentMatch = label.match(/(\d+)%/);
  const percentage = percentMatch ? parseInt(percentMatch[1], 10) : null;

  const isSharp = lowerLabel.includes('sharp');
  const isPublic = lowerLabel.includes('public');

  let team = '';
  let direction: 'over' | 'under' | undefined = undefined;

  // Check for Over/Under (for totals)
  if (lowerLabel.includes('over')) {
    direction = 'over';
    team = 'Over';
  } else if (lowerLabel.includes('under')) {
    direction = 'under';
    team = 'Under';
  } else {
    // Extract team name (usually after "on" keyword)
    const teamMatch = label.match(/on\s+([A-Za-z\s]+?)(?:\s*\(|$)/);
    if (teamMatch) {
      team = teamMatch[1].trim();
    }
  }

  return { team, percentage, isSharp, isPublic, direction };
};

/** Resolve the parsed side back to a feed team so the row can show a real logo. */
const matchTeam = (name: string, game: GameFeedItem): TeamRef | null => {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  for (const team of [game.awayTeam, game.homeTeam]) {
    const teamName = team.name.toLowerCase();
    if (teamName === needle || teamName.startsWith(needle) || needle.startsWith(teamName)) {
      return team;
    }
  }
  return null;
};

const OVER_FILL = '#10b981';
const UNDER_FILL = '#3b82f6';

/**
 * One market's money lean: which side, how heavy, and whether it's sharp or
 * public money. The percentage is a divided bar rather than a number in a
 * colored pill — 68% and 52% used to look identical.
 */
function SplitRow({
  market,
  side,
  mark,
  fill,
  data,
}: {
  market: string;
  side: string;
  mark: React.ReactNode;
  fill: string;
  data: ParsedBettingSplit;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {market}
        </span>
        {mark}
        <span className="min-w-0 truncate text-[13px] font-bold text-foreground">{side}</span>
        {(data.isSharp || data.isPublic) && (
          <Chip
            size="sm"
            variant="flat"
            color={data.isSharp ? 'success' : 'secondary'}
            classNames={{ base: 'h-4 shrink-0', content: 'px-1 text-[9px] font-bold uppercase' }}
          >
            {data.isSharp ? 'Sharp' : 'Public'}
          </Chip>
        )}
        {data.percentage !== null && (
          <span className="ml-auto shrink-0 text-[13px] font-bold tabular-nums text-foreground">
            {data.percentage}%
          </span>
        )}
      </div>

      {data.percentage !== null ? (
        <div
          className="flex h-2 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${data.percentage}% of ${market} money on ${side}`}
        >
          <div style={{ width: `${data.percentage}%`, backgroundColor: fill }} />
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/70">Lean reported without a percentage.</p>
      )}
    </div>
  );
}

/**
 * Public Betting Facts, ported from GameDetailsModal's NFL splits block:
 * sportsbook money-flow lean parsed from the *_splits_label fields.
 */
export function NflBettingSplitsSection({ game }: { game: GameFeedItem }) {
  const raw = game.raw as NFLPrediction;
  if (!raw.ml_splits_label && !raw.spread_splits_label && !raw.total_splits_label) return null;

  const ml = parseBettingSplit(raw.ml_splits_label);
  const spread = parseBettingSplit(raw.spread_splits_label);
  const total = parseBettingSplit(raw.total_splits_label);

  const mlTeam = ml?.team ? matchTeam(ml.team, game) : null;
  const spreadTeam = spread?.team ? matchTeam(spread.team, game) : null;

  const rows: React.ReactNode[] = [];

  if (ml?.team) {
    rows.push(
      <SplitRow
        key="ml"
        market="Moneyline"
        side={mlTeam?.abbrev ?? ml.team}
        mark={mlTeam ? <TeamMark team={mlTeam} size={22} /> : null}
        fill={mlTeam?.colors.primary ?? 'hsl(var(--primary))'}
        data={ml}
      />,
    );
  }
  if (spread?.team) {
    rows.push(
      <SplitRow
        key="spread"
        market="Spread"
        side={spreadTeam?.abbrev ?? spread.team}
        mark={spreadTeam ? <TeamMark team={spreadTeam} size={22} /> : null}
        fill={spreadTeam?.colors.primary ?? 'hsl(var(--primary))'}
        data={spread}
      />,
    );
  }
  if (total?.direction) {
    const isOver = total.direction === 'over';
    rows.push(
      <SplitRow
        key="total"
        market="Total"
        side={isOver ? 'OVER' : 'UNDER'}
        // Over/Under keeps green+up / blue+down wherever it appears.
        mark={
          <span
            className={cn(
              'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full',
              isOver
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                : 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
            )}
          >
            {isOver ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          </span>
        }
        fill={isOver ? OVER_FILL : UNDER_FILL}
        data={total}
      />,
    );
  }

  if (rows.length === 0) return null;

  return (
    <WidgetCard
      icon={<Users />}
      title="Public Betting Facts"
      subtitle="Where the money actually placed at sportsbooks is landing — a different source from the live prediction-market prices above."
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">{rows}</div>
    </WidgetCard>
  );
}
