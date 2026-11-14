import type { ReactNode } from 'react';
import { TeamMark } from './Marks';

export type ContextChip = {
  label: string;
  value: string;
  suppressed?: boolean;
};

export type GameSide = {
  team: string;
  name: string;
  color?: string;
};

export function ContextStrip({
  kicker,
  chips = [],
  matchup,
  facts = [],
}: {
  kicker: ReactNode;
  chips?: ContextChip[];
  matchup?: { away: GameSide; home: GameSide; detail: string };
  facts?: { label: string; value: string }[];
}) {
  return (
    <div className="ctx">
      <div className="ctx-h">{kicker}</div>
      {matchup ? (
        <div className="gamehead">
          <TeamMark team={matchup.away.team} title={matchup.away.name} color={matchup.away.color} size={44} />
          <div className="gamehead-copy">
            <div className="gamehead-name">
              {matchup.away.name} at {matchup.home.name}
            </div>
            <div className="gamehead-sub">{matchup.detail}</div>
          </div>
          <TeamMark team={matchup.home.team} title={matchup.home.name} color={matchup.home.color} size={44} />
        </div>
      ) : null}
      {facts.length > 0 ? (
        <div className="gamefacts">
          {facts.map((fact) => (
            <div className="vcell" key={fact.label}>
              <div className="k">{fact.label}</div>
              <div className="v">{fact.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {chips.length > 0 ? (
        <div className="ctx-grid">
          {chips.map((chip) => (
            <div className={chip.suppressed ? 'chip off' : 'chip'} key={chip.label}>
              <dt>{chip.label}</dt>
              <dd>{chip.value}</dd>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
