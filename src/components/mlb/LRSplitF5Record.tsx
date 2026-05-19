import type { LRSplitEntry } from '@/hooks/useMLBRegressionReport';
import type { F5SplitRow } from '@/types/mlbF5Splits';
import { findSplitRow } from '@/utils/mlbF5Splits';
import { F5SplitHandednessLabel } from '@/components/mlb/F5SplitHandednessLabel';
import {
  aggregateF5SplitByHand,
  formatF5Record,
  handHpLabel,
  normalizeHomeAway,
  normalizeOppSpHand,
  otherHomeAway,
  splitLocationLabel,
  teamAbbrFromLrSplitName,
} from '@/utils/f5SplitLabels';
import { Star } from 'lucide-react';

interface LRSplitF5RecordProps {
  split: LRSplitEntry;
  splitLookup: Map<string, F5SplitRow>;
  compact?: boolean;
}

function winPctClass(pct: number | null | undefined): string {
  if (pct == null) return '';
  if (pct >= 60) return 'text-green-400';
  if (pct <= 40) return 'text-red-400';
  return '';
}

export function LRSplitF5Record({ split, splitLookup, compact }: LRSplitF5RecordProps) {
  const hand = normalizeOppSpHand(split.opponent_sp_hand);
  const tonightHa = normalizeHomeAway(split.home_away);
  const teamAbbr = teamAbbrFromLrSplitName(split.team_name);

  if (!hand || !tonightHa) {
    const record =
      split.f5_ties > 0
        ? `${split.f5_wins}-${split.f5_losses}-${split.f5_ties}`
        : `${split.f5_wins}-${split.f5_losses}`;
    return (
      <div className={compact ? 'text-[10px] text-muted-foreground' : 'text-xs text-muted-foreground'}>
        F5: {record}
        {split.f5_win_pct != null ? ` (${split.f5_win_pct}%)` : ''}
      </div>
    );
  }

  const matchupRow = findSplitRow(splitLookup, teamAbbr, tonightHa, hand);
  const otherHa = otherHomeAway(tonightHa);
  const otherRow = findSplitRow(splitLookup, teamAbbr, otherHa, hand);
  const seasonTotal = aggregateF5SplitByHand(splitLookup, teamAbbr, hand);

  const matchupRecord = matchupRow?.f5_record ?? null;
  const matchupPct = matchupRow?.f5_win_pct ?? null;
  const matchupGames = matchupRow?.games ?? null;

  const seasonRecord = seasonTotal?.f5_record ?? formatF5Record(split.f5_wins, split.f5_losses, split.f5_ties);
  const seasonPct = seasonTotal?.f5_win_pct ?? split.f5_win_pct;

  const otherRecord = otherRow?.f5_record ?? '—';

  if (compact) {
    return (
      <div className="text-right space-y-0.5">
        <div className="text-[10px] sm:text-xs font-medium text-foreground">
          <F5SplitHandednessLabel homeAway={tonightHa} oppSpHand={hand} games={matchupGames} />
          {': '}
          {matchupRecord ?? '—'}
          {matchupPct != null ? ` (${matchupPct}%)` : ''}
        </div>
        <div className="text-[9px] text-muted-foreground">
          Season vs {handHpLabel(hand)}: {seasonRecord}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-right min-w-[9rem]">
      <div className="text-sm leading-snug">
        <span className="text-muted-foreground">F5 vs {handHpLabel(hand)} — </span>
        <span className={`font-semibold ${winPctClass(matchupPct)}`}>
          <F5SplitHandednessLabel
            homeAway={tonightHa}
            oppSpHand={hand}
            games={matchupGames}
            variant="title"
            className="font-semibold text-foreground cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2"
          />
          {': '}
          {matchupRecord ?? '—'}
          {matchupPct != null ? ` (${matchupPct}%)` : ''}
          <Star className="inline h-3 w-3 ml-0.5 text-amber-500 fill-amber-500/80 align-[-2px]" aria-hidden />
        </span>
      </div>
      <div className="text-xs text-muted-foreground leading-snug">
        <span>Season total: {seasonRecord}</span>
        {seasonPct != null ? <span> ({seasonPct}%)</span> : null}
        <span>
          {' · '}
          Other split ({splitLocationLabel(otherHa).toLowerCase()}): {otherRecord}
        </span>
      </div>
    </div>
  );
}
