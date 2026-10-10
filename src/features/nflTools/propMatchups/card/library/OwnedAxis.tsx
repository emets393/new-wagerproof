import type { ReactNode } from 'react';

export function OwnedAxis({
  defense,
  player,
  middle = 'league',
}: {
  defense: ReactNode;
  player: ReactNode;
  middle?: string;
}) {
  return (
    <div className="axis duel-ax">
      <div className="ends">
        <span className="e">{defense}</span>
        <span className="m">{middle}</span>
        <span className="e r">{player}</span>
      </div>
    </div>
  );
}
