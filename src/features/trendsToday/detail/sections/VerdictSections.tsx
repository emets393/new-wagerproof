import { Scale, Sigma } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import {
  AgreementMeter,
  DirectionWord,
  LeanCallout,
  OpposedRateBar,
  OverRateHeader,
  OverRateRow,
  Recommendation,
  formatPct,
} from '../shared';
import { SIDE_MARKET_LABEL, SIDE_MARKET_SHORT, type TrendsFeedItem } from '../../types';

/**
 * "Which side do today's situations favor?" — the headline read on the side
 * market (moneyline for MLB, ATS for hoops), stated before any evidence.
 *
 * These are historical rates for the spots both teams are in today, not model
 * projections, so the card leads with how many situations agree rather than with
 * a single percentage: one 70% angle out of seven is a coin flip dressed up.
 */
export function SideVerdictSection({ game }: { game: TrendsFeedItem }) {
  const { verdict, away, home, sport } = game;
  const pickTeam = verdict.side === 'away' ? away : verdict.side === 'home' ? home : undefined;
  const otherTeam = verdict.side === 'away' ? home : away;

  return (
    <WidgetCard
      icon={<Scale />}
      title={`${SIDE_MARKET_SHORT[sport]} trend read`}
      subtitle={`How often each team has won ${SIDE_MARKET_LABEL[sport].toLowerCase()} bets in the exact spots they're in today, averaged across every situation.`}
    >
      <div className="space-y-3">
        <Recommendation
          market={`${SIDE_MARKET_LABEL[sport]} lean`}
          pickTeam={pickTeam}
          pickText={pickTeam ? undefined : 'No lean'}
          edge={verdict.sideMarginPts !== null ? `${verdict.sideMarginPts.toFixed(1)} pts` : '—'}
          edgeCaption="avg gap"
        />

        <AgreementMeter
          agree={verdict.sideAgree}
          total={verdict.sideTotal}
          label={
            pickTeam
              ? `situations favor ${pickTeam.abbrev}`
              : 'situations split evenly between these teams'
          }
          emptyLabel="No situation has rates for both teams yet."
        />

        <OpposedRateBar
          away={away}
          home={home}
          awayPct={verdict.awayAvgSidePct}
          homePct={verdict.homeAvgSidePct}
          lean={verdict.side}
          size={28}
        />

        {pickTeam && verdict.sideMarginPts !== null && (
          <LeanCallout>
            <span className="font-bold text-foreground">{pickTeam.abbrev}</span> has hit{' '}
            <span className="font-bold text-foreground">{verdict.sideMarginPts.toFixed(1)} pts</span>{' '}
            more often than <span className="font-bold text-foreground">{otherTeam.abbrev}</span> in
            these spots
          </LeanCallout>
        )}
      </div>
    </WidgetCard>
  );
}

/**
 * "Over or under?" — the total read. Over/under carries green + up arrow and
 * blue + down arrow on the word itself, so the direction is legible before any
 * number is read.
 */
export function TotalVerdictSection({ game }: { game: TrendsFeedItem }) {
  const { verdict, away, home } = game;
  const tone = verdict.total === 'over' ? 'over' : verdict.total === 'under' ? 'under' : 'primary';

  return (
    <WidgetCard
      icon={<Sigma />}
      title="Total trend read"
      subtitle="How often these teams' games have gone over the total in today's situations. A rate near 50% means the spot says nothing either way."
    >
      <div className="space-y-3">
        <Recommendation
          market="Total lean"
          pickDirection={verdict.total}
          pickText={verdict.total === null ? 'No lean' : undefined}
          edge={
            verdict.totalMarginPts !== null ? `${verdict.totalMarginPts.toFixed(1)} pts` : '—'
          }
          edgeCaption="off even"
        />

        <AgreementMeter
          agree={verdict.totalAgree}
          total={verdict.totalTotal}
          tone={tone}
          label={
            verdict.total
              ? `situations lean ${verdict.total}`
              : 'situations reached a total consensus'
          }
          emptyLabel="No situation reached an over/under consensus — both teams' rates sit near even."
        />

        <div>
          <OverRateHeader />
          <OverRateRow team={away} pct={verdict.awayAvgOverPct} record={null} />
          <OverRateRow team={home} pct={verdict.homeAvgOverPct} record={null} />
        </div>

        {verdict.total !== null && (
          <LeanCallout>
            Both teams' situations point the same way &rarr; leans{' '}
            <DirectionWord
              direction={verdict.total}
              showIcon={false}
              className="inline-flex font-bold"
            />
            {verdict.awayAvgOverPct !== null && verdict.homeAvgOverPct !== null && (
              <>
                {' '}
                ({away.abbrev} {formatPct(verdict.awayAvgOverPct, 0)} / {home.abbrev}{' '}
                {formatPct(verdict.homeAvgOverPct, 0)} over)
              </>
            )}
          </LeanCallout>
        )}
      </div>
    </WidgetCard>
  );
}
