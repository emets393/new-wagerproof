import { ArrowDown, ArrowUp, Sigma, Target, TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { formatHalfNoSign, roundToHalf } from '../../edgeExplanations';
import { CFB_EDGE_SCALE, ModelEdgeRail, SpreadCoverBar, type EdgeScale } from '../../charts';
import {
  EmptyNote,
  PickSideRow,
  Recommendation,
  STACK,
  formatSignedHalf,
} from './shared';
import { collegeSpreadHeadline, collegeTotalHeadline } from '../../headlines/shared';
import type { TeamRef } from '../../../types';

/**
 * The two model-prediction widgets shared by CFB and NCAAB.
 *
 * Previously both sports shipped one "Model Predictions" card that answered
 * three questions at once (spread pick, total pick, and two prose blocks) inside
 * tinted boxes. One card per market, recommendation first — see
 * `detail/WIDGET_DESIGN.md`.
 */

export interface CollegeModelInput {
  away: TeamRef;
  home: TeamRef;
  /** Model spread, home-relative. */
  predSpread: number | null;
  /** Vegas home spread minus the model's; > 0 puts the edge on the home team. */
  homeSpreadDiff: number | null;
  /** Book's home spread, used to back out the model number when it's missing. */
  vegasHomeSpread: number | null;
  /** Model total. */
  predOverLine: number | null;
  /** Model total minus the book's; > 0 leans Over. */
  overLineDiff: number | null;
  vegasTotal: number | null;
  /**
   * Per-sport chart thresholds. CFB and NCAAB share these cards but not their
   * scales — a college-football spread window on a basketball margin makes every
   * marker pin. Defaults to CFB so an omission fails visibly on the wrong sport
   * rather than silently mislabelling both.
   */
  scale?: EdgeScale;
}

export function hasSpreadData(input: CollegeModelInput): boolean {
  return input.predSpread !== null || input.homeSpreadDiff !== null;
}

export function hasTotalData(input: CollegeModelInput): boolean {
  return input.predOverLine !== null || input.overLineDiff !== null || input.vegasTotal !== null;
}

/**
 * Same gate the legacy modal used: without any model output there is nothing to
 * say, and a stack of "unavailable" cards is worse than no cards.
 */
export function hasCollegeModelOutput(input: CollegeModelInput): boolean {
  return (
    input.predSpread !== null ||
    input.homeSpreadDiff !== null ||
    input.predOverLine !== null ||
    input.overLineDiff !== null
  );
}

/**
 * Spread: which side, how far the model is from the number, and the two lines
 * side by side.
 */
export function CollegeSpreadSection({ input }: { input: CollegeModelInput }) {
  const { away, home, predSpread, homeSpreadDiff, vegasHomeSpread, scale = CFB_EDGE_SCALE } = input;

  if (!hasSpreadData(input)) return null;

  // No edge to state — show the projection and say so rather than implying a pick.
  if (homeSpreadDiff === null) {
    return (
      <WidgetCard
        icon={<Target />}
        title="Spread"
        subtitle="What the model makes this game's spread, before comparing it to the book."
      >
        <div className={STACK}>
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Model spread ({home.abbrev})
            </span>
            <span className="ml-auto text-xl font-bold tabular-nums text-foreground">
              {formatSignedHalf(predSpread)}
            </span>
          </div>
          <EmptyNote>
            We don&apos;t have a Vegas spread to compare against yet, so there&apos;s no edge to
            call. Check back closer to kickoff.
          </EmptyNote>
        </div>
      </WidgetCard>
    );
  }

  const pickIsHome = homeSpreadDiff > 0;
  const pickTeam = pickIsHome ? home : away;
  const sign = pickIsHome ? 1 : -1;

  // Whichever of the two numbers we have, the other follows from the edge, so
  // model / Vegas / edge on screen always reconcile exactly (WIDGET_DESIGN #10).
  const modelHome = predSpread ?? (vegasHomeSpread !== null ? vegasHomeSpread - homeSpreadDiff : null);
  const vegasHome = modelHome !== null ? modelHome + homeSpreadDiff : null;

  // Flip to the edge team's perspective; from there the model's line is always
  // the friendlier one, by exactly |homeSpreadDiff| points. Rounded to the half
  // point the card PRINTS, and the edge is then derived from those two rounded
  // figures — otherwise the bar's cushion (a full-precision subtraction) and the
  // recommendation's edge (roundToHalf) disagree by up to a quarter point.
  const modelDisplay = modelHome !== null ? roundToHalf(modelHome * sign) : null;
  const vegasDisplay = vegasHome !== null ? roundToHalf(vegasHome * sign) : null;
  const absEdge =
    modelDisplay !== null && vegasDisplay !== null
      ? Math.abs(vegasDisplay - modelDisplay)
      : Math.abs(homeSpreadDiff);

  const pickLabel = vegasDisplay !== null
    ? `${pickTeam.abbrev} ${formatSignedHalf(vegasDisplay)}`
    : pickTeam.abbrev;

  return (
    <WidgetCard
      icon={<Target />}
      title="Spread"
      headline={collegeSpreadHeadline({
        awayName: away.name,
        homeName: home.name,
        pickIsHome,
        absEdge,
      }) ?? undefined}
      subtitle="Which side the model would take against the Vegas number, and how far apart the two lines are."
    >
      <div className={STACK}>
        <Recommendation
          market="Spread"
          pick={pickLabel}
          team={pickTeam}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          edge={`+${roundToHalf(absEdge)}`}
        />

        {/* `modelDisplay` is the pick team's fair SPREAD; the bar plots MARGIN, so
            it is negated exactly once, here. Its cushion is vegasDisplay −
            modelDisplay — the same subtraction that produced `absEdge`. */}
        {modelDisplay !== null && vegasDisplay !== null && (
          <SpreadCoverBar
            line={vegasDisplay}
            modelMargin={-modelDisplay}
            scale={scale}
            pickAbbrev={pickTeam.abbrev}
            opponentAbbrev={(pickIsHome ? away : home).abbrev}
          />
        )}

        {vegasHome !== null && (
          <PickSideRow
            away={away}
            home={home}
            awayValue={formatSignedHalf(-vegasHome)}
            homeValue={formatSignedHalf(vegasHome)}
            pickIsHome={pickIsHome}
          />
        )}
      </div>
    </WidgetCard>
  );
}

/** Total: which way the model leans and by how many points. */
export function CollegeTotalSection({ input }: { input: CollegeModelInput }) {
  const { predOverLine, overLineDiff, vegasTotal, scale = CFB_EDGE_SCALE } = input;

  if (!hasTotalData(input)) return null;

  if (overLineDiff === null) {
    return (
      <WidgetCard
        icon={<Sigma />}
        title="Total"
        subtitle="What the model makes this game's total, before comparing it to the book."
      >
        <div className={STACK}>
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Model total
            </span>
            <span className="ml-auto text-xl font-bold tabular-nums text-foreground">
              {formatHalfNoSign(predOverLine ?? vegasTotal)}
            </span>
          </div>
          <EmptyNote>
            No Over/Under edge yet — we need both the model total and a posted line to call a
            direction.
          </EmptyNote>
        </div>
      </WidgetCard>
    );
  }

  const isOver = overLineDiff > 0;
  // Same reconciliation rule as the spread card: derive whichever number is
  // missing from the edge, round both to the half point the card prints, then
  // take the edge from those two figures so the rail and the recommendation
  // report one subtraction.
  const rawModel = predOverLine ?? (vegasTotal !== null ? vegasTotal + overLineDiff : null);
  const model = rawModel !== null ? roundToHalf(rawModel) : null;
  const vegas = rawModel !== null ? roundToHalf(rawModel - overLineDiff) : null;
  const absEdge =
    model !== null && vegas !== null ? Math.abs(model - vegas) : Math.abs(overLineDiff);
  const direction = isOver ? 'OVER' : 'UNDER';

  return (
    <WidgetCard
      icon={<Sigma />}
      title="Total"
      headline={collegeTotalHeadline({ isOver, absEdge }) ?? undefined}
      subtitle="How many points the model expects compared with the Vegas total, and which way that leans."
    >
      <div className={STACK}>
        <Recommendation
          market="Total"
          pick={vegas !== null ? `${direction} ${formatHalfNoSign(vegas)}` : direction}
          tone={isOver ? 'over' : 'under'}
          icon={isOver ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          edge={`+${roundToHalf(absEdge)}`}
        />

        {/* Vegas is derived from the model figure, so sign(model − vegas) always
            equals `isOver` and the rail's zone label can't contradict the pick. */}
        {model !== null && vegas !== null && (
          <ModelEdgeRail
            market={vegas}
            model={model}
            scale={scale}
            format={(v) => roundToHalf(v).toString()}
          />
        )}
      </div>
    </WidgetCard>
  );
}
