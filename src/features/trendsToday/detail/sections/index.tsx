import { HoopsAngleSection } from './HoopsAngleSection';
import {
  MlbSideAnglesSection,
  MlbSituationsSection,
  MlbTotalAnglesSection,
} from './MlbAngleSections';
import { SideVerdictSection, TotalVerdictSection } from './VerdictSections';
import type { TrendsFeedItem } from '../../types';

/**
 * Per-sport widget stacks. All three sports open with the same two verdict
 * cards (one question each: which side, and over or under); MLB then goes
 * deeper with a card per market plus the raw spots, while hoops fold their
 * detail into a single record-carrying table.
 */
export function TrendsSportSections({ game }: { game: TrendsFeedItem }) {
  if (game.sport === 'mlb') {
    return (
      <>
        <SideVerdictSection game={game} />
        <TotalVerdictSection game={game} />
        <MlbSideAnglesSection game={game} />
        <MlbTotalAnglesSection game={game} />
        <MlbSituationsSection game={game} />
      </>
    );
  }

  return (
    <>
      <SideVerdictSection game={game} />
      <TotalVerdictSection game={game} />
      <HoopsAngleSection game={game} />
    </>
  );
}
