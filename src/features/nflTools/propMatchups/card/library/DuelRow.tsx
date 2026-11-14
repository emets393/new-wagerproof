import type { ReactNode } from 'react';

export type DuelTone = 'pos' | 'neg' | 'nil';
export type DuelSide = 'player' | 'defense';

function reachPct(reach: number) {
  return reach.toFixed(1);
}

export function DuelRow({
  label,
  detail,
  tone,
  side,
  value,
  rank,
  reach,
  winner,
  mark,
  duel = true,
}: {
  label: string;
  detail?: string;
  tone: DuelTone;
  side: DuelSide;
  value: string;
  rank?: string;
  reach: number;
  winner?: string;
  mark?: ReactNode;
  duel?: boolean;
}) {
  const width = `${reachPct(reach)}%`;
  const barStyle =
    side === 'defense'
      ? { right: '50%', width }
      : { left: '50%', width };
  const tipStyle =
    side === 'defense'
      ? { right: `calc(50% + ${width} - 9px)` }
      : { left: `calc(50% + ${width} - 9px)` };
  const showTip = duel && tone !== 'nil' && mark != null;

  return (
    <div className={duel ? 'row duel' : 'row'}>
      <div className="rl">
        <span className="sec">{label}</span>
        {detail ? <em>{detail}</em> : null}
      </div>
      <div className="rr">
        {duel && winner ? (
          <span className={`win ${tone}`}>
            {tone === 'nil' ? null : mark}
            {winner}
          </span>
        ) : null}
        <b className={tone}>{value}</b>
        {rank ? <s>{rank}</s> : null}
      </div>
      <div className="track">
        <i className="zero" />
        <i className={`bar ${tone}`} style={barStyle} />
        {showTip ? (
          <span className="tip" style={tipStyle}>
            {mark}
          </span>
        ) : null}
      </div>
    </div>
  );
}
