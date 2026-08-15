import * as React from 'react';
import { CircleDollarSign, Sigma } from 'lucide-react';
import { SegmentedControl, WidgetCard } from '@/components/ios';
import { useMLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import { useMLBModelBreakdownAccuracy } from '@/hooks/useMLBModelBreakdownAccuracy';
import { type MLBPredictionRow } from '../../../api/mlbGames';
import { mlbMoneylineHeadline, mlbTotalHeadline } from '../../headlines/mlb';
import { MLB_EDGE_SCALE, moneylineOutcome } from '../../charts';
import {
  fetchMlbSportsbookOdds,
  preferredQuote,
  quotesForMarket,
  useSportsbookPreference,
  type SportsbookGameOdds,
} from '../../sportsbooks';
import {
  deriveFullMl,
  F5MlPanel,
  F5TotalPanel,
  FullMlPanel,
  FullTotalPanel,
  lookupBucketAccuracy,
  toNum,
  type TeamVisuals,
} from './shared';

type Segment = 'full' | 'f5';

interface MlbMarketSectionProps {
  raw: MLBPredictionRow;
  awayAbbrev: string;
  homeAbbrev: string;
  away: TeamVisuals;
  home: TeamVisuals;
}

/**
 * One market, one widget, one segment at a time.
 *
 * These used to live inside Projected Score (which also carried the score row
 * and both markets) and again inside First-Five Splits — so the F5 panels were
 * rendered twice in the same stack. Splitting per market means each card answers
 * a single question, and the Full/1st 5 toggle keeps only one answer on screen.
 */
function MarketSection({
  title,
  icon,
  raw,
  awayAbbrev,
  homeAbbrev,
  away,
  home,
  subtitle,
  renderFull,
  renderF5,
  hasF5,
}: MlbMarketSectionProps & {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  renderFull: (props: PanelProps) => React.ReactNode;
  renderF5: (props: PanelProps) => React.ReactNode;
  hasF5: boolean;
}) {
  const [segment, setSegment] = React.useState<Segment>('full');
  const [bookOdds, setBookOdds] = React.useState<SportsbookGameOdds | null>(null);
  const { selectedKeys } = useSportsbookPreference();
  const { data: modelAccuracy } = useMLBBucketAccuracy();
  const { data: breakdownRows = [] } = useMLBModelBreakdownAccuracy();

  React.useEffect(() => {
    let cancelled = false;
    fetchMlbSportsbookOdds(raw.game_pk)
      .then((odds) => {
        if (!cancelled) setBookOdds(odds);
      })
      .catch(() => {
        if (!cancelled) setBookOdds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [raw.game_pk]);

  const panelProps = { raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows, away, home, bookOdds, selectedBookKeys: selectedKeys };
  // A row with no F5 model data shouldn't offer a dead toggle.
  const active = hasF5 ? segment : 'full';
  // One derivation shared with FullMlPanel, so the headline quotes the exact
  // numbers the bar under it draws (headlines/README rule 1).
  const ml = deriveFullMl(raw, awayAbbrev, homeAbbrev, away, home);
  const bookMlPrice = bookOdds
    ? preferredQuote(quotesForMarket(bookOdds, { kind: 'moneyline', isHome: ml.pickIsHome }), selectedKeys)?.price ?? null
    : null;
  const barPrice = bookMlPrice ?? ml.price;
  const barOutcome =
    barPrice !== null && ml.prob !== null && ml.prob > 0 && ml.prob < 1
      ? moneylineOutcome(barPrice, ml.prob, MLB_EDGE_SCALE)
      : null;
  const displayEdge = barOutcome ? barOutcome.edge : ml.displayEdge;
  const pickLine = barPrice ?? (ml.pickIsHome ? toNum(raw.home_ml) : toNum(raw.away_ml));
  const mlAcc = ml.storedEdge === null
    ? null
    : lookupBucketAccuracy(
        modelAccuracy,
        'full_ml',
        ml.storedEdge,
        ml.pickIsHome ? 'home' : 'away',
        pickLine === null ? undefined : pickLine < 0 ? 'favorite' : 'underdog',
      );
  const totalEdge = toNum(raw.ou_edge);
  const totalDirection =
    raw.ou_direction === 'OVER' || raw.ou_direction === 'UNDER' ? raw.ou_direction : null;
  const bookTotalLine = bookOdds && totalDirection
    ? preferredQuote(quotesForMarket(bookOdds, { kind: 'total', isOver: totalDirection === 'OVER' }), selectedKeys)?.line ?? null
    : null;
  const marketTotal = bookTotalLine ?? toNum(raw.total_line);
  const totalAcc = totalEdge === null || totalDirection === null
    ? null
    : lookupBucketAccuracy(
        modelAccuracy,
        'full_ou',
        totalEdge,
        undefined,
        undefined,
        totalDirection.toLowerCase(),
      );
  const deterministicHeadline = title === 'Moneyline'
    ? mlbMoneylineHeadline({
        pickTeam: ml.pickTeam,
        pickEdge: displayEdge,
        otherEdge: ml.otherDisplayEdge,
        pickProbPct: ml.prob === null ? null : ml.prob * 100,
        // The bar's threshold when there is a price, else model − edge, which is
        // what the fallback row prints. Either way it is the number on screen.
        vegasPct:
          barOutcome?.breakEvenPercent ??
          (ml.prob === null || displayEdge === null ? null : ml.prob * 100 - displayEdge),
        line: pickLine,
        favDog: pickLine === null ? undefined : pickLine < 0 ? 'favorite' : 'underdog',
        acc: mlAcc,
      })
    : mlbTotalHeadline({
        direction: totalDirection,
        edge: totalEdge,
        fairTotal: toNum(raw.ou_fair_total),
        marketTotal,
        acc: totalAcc,
        strength: raw.ou_strong_signal
          ? 'Strong'
          : raw.ou_moderate_signal
            ? 'Moderate'
            : 'Weak',
      });

  return (
    <WidgetCard
      icon={icon}
      title={title}
      headline={deterministicHeadline ?? undefined}
      subtitle={subtitle}
      accessory={
        hasF5 ? (
          <SegmentedControl
            size="sm"
            options={[
              { value: 'full', label: 'Full Game' },
              { value: 'f5', label: '1st 5' },
            ]}
            value={active}
            onChange={(value) => setSegment(value as Segment)}
          />
        ) : undefined
      }
    >
      {active === 'full' ? renderFull(panelProps) : renderF5(panelProps)}
    </WidgetCard>
  );
}

type PanelProps = Parameters<typeof FullMlPanel>[0];

/** Does this row carry first-five model output at all? */
export function hasF5Data(raw: MLBPredictionRow): boolean {
  return (
    toNum(raw.f5_fair_total) !== null ||
    toNum(raw.f5_home_win_prob) !== null ||
    toNum(raw.f5_away_win_prob) !== null ||
    toNum(raw.f5_home_ml_edge_pct) !== null ||
    toNum(raw.f5_away_ml_edge_pct) !== null ||
    toNum(raw.f5_ou_edge) !== null
  );
}

export function MlbMoneylineSection(props: MlbMarketSectionProps) {
  return (
    <MarketSection
      {...props}
      title="Moneyline"
      subtitle="Who the model thinks wins outright, and whether that's better value than the Vegas price."
      icon={<CircleDollarSign />}
      hasF5={hasF5Data(props.raw)}
      renderFull={(p) => <FullMlPanel {...p} />}
      renderF5={(p) => <F5MlPanel {...p} />}
    />
  );
}

export function MlbTotalSection(props: MlbMarketSectionProps) {
  return (
    <MarketSection
      {...props}
      title="Total"
      subtitle="How many runs the model expects versus the Vegas line, and which way that leans."
      icon={<Sigma />}
      hasF5={hasF5Data(props.raw)}
      renderFull={(p) => <FullTotalPanel {...p} />}
      renderF5={(p) => <F5TotalPanel {...p} />}
    />
  );
}
