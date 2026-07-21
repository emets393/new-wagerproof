import { LayoutList } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import {
  DirectionWord,
  OpposedRateBar,
  OverRateHeader,
  OverRateRow,
  PageFiller,
  TeamMark,
  formatPct,
} from '../shared';
import { Pager, usePaged } from './paging';
import type { TrendAngle, TrendsFeedItem } from '../../types';

/** Hoops blocks carry ATS records plus O/U rows, so fewer fit per page than MLB's. */
const ANGLES_PER_PAGE = 2;
const BLOCK_PX = 168;

/** ATS record beside its cover rate, one column each rather than a joined sentence. */
function AtsRecordRow({
  team,
  record,
  pct,
  dimmed,
}: {
  team: TrendsFeedItem['away'];
  record: string | null;
  pct: number | null;
  dimmed: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2 py-0.5', dimmed && 'opacity-60')}>
      <span className="flex w-[52px] shrink-0 items-center gap-1.5">
        <TeamMark team={team} size={16} dimmed={dimmed} />
        <span className="truncate text-[11px] font-semibold text-foreground">{team.abbrev}</span>
      </span>
      <span className="w-14 shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {record ?? '—'}
      </span>
      <span className="w-11 shrink-0 text-right text-[11px] font-bold tabular-nums text-foreground">
        {formatPct(pct, 1)}
      </span>
      <span className="min-w-0 flex-1" />
    </div>
  );
}

function AngleBlock({ angle, game }: { angle: TrendAngle; game: TrendsFeedItem }) {
  return (
    <div className="space-y-2 py-2.5 first:pt-0">
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

      <div className="border-t border-black/5 pt-1.5 dark:border-white/10">
        <div className="flex items-center gap-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
          <span className="w-[52px] shrink-0">ATS</span>
          <span className="w-14 shrink-0">Record</span>
          <span className="w-11 shrink-0 text-right">Cover</span>
          <span className="min-w-0 flex-1" />
        </div>
        <AtsRecordRow
          team={game.away}
          record={angle.away.sideRecord}
          pct={angle.away.sidePct}
          dimmed={angle.sideLean === 'home'}
        />
        <AtsRecordRow
          team={game.home}
          record={angle.home.sideRecord}
          pct={angle.home.sidePct}
          dimmed={angle.sideLean === 'away'}
        />
      </div>

      <div className="border-t border-black/5 pt-1.5 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-2 pb-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            Total
          </span>
          <DirectionWord direction={angle.ouLean} className="text-[11px] font-bold" />
        </div>
        <OverRateHeader />
        <OverRateRow team={game.away} pct={angle.away.overPct} record={angle.away.ouRecord} />
        <OverRateRow team={game.home} pct={angle.home.overPct} record={angle.home.ouRecord} />
      </div>
    </div>
  );
}

/**
 * NBA / NCAAB angle detail: one paged block per situation carrying both the ATS
 * comparison and the over/under read. Hoops rows ship real W-L records, so the
 * sample size sits beside every rate — a 100% cover rate over three games and a
 * 62% one over forty are not the same claim.
 */
export function HoopsAngleSection({ game }: { game: TrendsFeedItem }) {
  const angles = game.angles;
  const { page, setPage, pageCount, visible } = usePaged(angles, ANGLES_PER_PAGE);

  if (angles.length === 0) return null;

  return (
    <WidgetCard
      icon={<LayoutList />}
      title="Situation by situation"
      subtitle="Every angle behind the reads above, with the record each rate came from."
      accessory={
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
          {angles.length} situations
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
          {visible.map((angle) => (
            <AngleBlock key={angle.key} angle={angle} game={game} />
          ))}
          <PageFiller count={ANGLES_PER_PAGE - visible.length} height={BLOCK_PX} />
        </div>
        <Pager pageCount={pageCount} page={page} onChange={setPage} label="Situation pages" />
      </div>
    </WidgetCard>
  );
}
