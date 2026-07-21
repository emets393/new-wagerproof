import { CalendarClock, ListChecks, Percent } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import {
  DirectionWord,
  OpposedRateBar,
  OverRateHeader,
  OverRateRow,
  PageFiller,
  SituationPair,
  TeamMark,
} from '../shared';
import { Pager, usePaged } from './paging';
import type { TrendsFeedItem } from '../../types';

/**
 * Angles per page. Each block is three lines tall, so three fills the card
 * without making the pager scroll out of view.
 */
const ANGLES_PER_PAGE = 3;

/** Reserved height per angle block, used to pad short pages so the pager holds still. */
const SIDE_BLOCK_PX = 72;
const TOTAL_BLOCK_PX = 84;

/**
 * Moneyline win rate for each situational angle, one opposed bar per angle.
 * The legacy page printed these as a grid of raw percentages where nothing said
 * which number was good; here each angle reads as "who owns this spot" at a
 * glance and the numbers are the detail.
 */
export function MlbSideAnglesSection({ game }: { game: TrendsFeedItem }) {
  const angles = game.angles;
  const { page, setPage, pageCount, visible } = usePaged(angles, ANGLES_PER_PAGE);

  if (angles.length === 0) return null;

  return (
    <WidgetCard
      icon={<Percent />}
      title="Moneyline by situation"
      subtitle="Each team's season win rate in this exact spot. The wider, brighter side of every bar is the team the situation has favored."
      accessory={
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
          {angles.length} situations
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
          {visible.map((angle) => (
            <div key={angle.key} className="space-y-1.5 py-2 first:pt-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold text-foreground">{angle.label}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {angle.away.situation} / {angle.home.situation}
                </span>
              </div>
              <OpposedRateBar
                away={game.away}
                home={game.home}
                awayPct={angle.away.sidePct}
                homePct={angle.home.sidePct}
                lean={angle.sideLean}
                size={20}
              />
            </div>
          ))}
          <PageFiller count={ANGLES_PER_PAGE - visible.length} height={SIDE_BLOCK_PX} />
        </div>
        <Pager
          pageCount={pageCount}
          page={page}
          onChange={setPage}
          label="Moneyline situation pages"
        />
      </div>
    </WidgetCard>
  );
}

/**
 * Over rate for each angle, per team, as bars diverging from a 50% center line.
 * The angle's own over/under consensus sits in the header of each block, so a
 * block that says OVER and shows two green bars is self-consistent.
 */
export function MlbTotalAnglesSection({ game }: { game: TrendsFeedItem }) {
  const angles = game.angles;
  const { page, setPage, pageCount, visible } = usePaged(angles, ANGLES_PER_PAGE);

  if (angles.length === 0) return null;

  const withLean = angles.filter((a) => a.ouLean !== null).length;

  return (
    <WidgetCard
      icon={<ListChecks />}
      title="Over rate by situation"
      subtitle="How often each team's games cleared the total in this spot. Bars grow right of the center line when the spot leans over, left when it leans under."
      accessory={
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
          {withLean}/{angles.length} with a lean
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
          {visible.map((angle) => (
            <div key={angle.key} className="py-2 first:pt-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold text-foreground">{angle.label}</span>
                <DirectionWord direction={angle.ouLean} className="text-[11px] font-bold" />
              </div>
              <OverRateHeader />
              <OverRateRow team={game.away} pct={angle.away.overPct} record={angle.away.ouRecord} />
              <OverRateRow team={game.home} pct={angle.home.overPct} record={angle.home.ouRecord} />
            </div>
          ))}
          <PageFiller count={ANGLES_PER_PAGE - visible.length} height={TOTAL_BLOCK_PX} />
        </div>
        <Pager
          pageCount={pageCount}
          page={page}
          onChange={setPage}
          label="Over rate situation pages"
        />
      </div>
    </WidgetCard>
  );
}

/**
 * The spots themselves, with no percentages. Every rate in the cards above is
 * conditioned on these labels, and without them a "62% in this spot" number
 * doesn't say what the spot is.
 */
export function MlbSituationsSection({ game }: { game: TrendsFeedItem }) {
  if (game.angles.length === 0) return null;

  return (
    <WidgetCard
      icon={<CalendarClock />}
      title="Today's spots"
      subtitle="The situation each team is in for this game — the condition behind every percentage on this page."
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
          <span className="w-[92px] shrink-0">Angle</span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <TeamMark team={game.away} size={14} />
            {game.away.abbrev}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <TeamMark team={game.home} size={14} />
            {game.home.abbrev}
          </span>
        </div>
        <div className="divide-y divide-black/5 dark:divide-white/10">
          {game.angles.map((angle) => (
            <SituationPair key={angle.key} angle={angle} away={game.away} home={game.home} />
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}
