import * as React from 'react';
import type { TeamRef } from '@/features/games/types';

export function TeamDisc({ team, size }: { team: TeamRef; size: number }) {
  const [failed, setFailed] = React.useState(false);
  const showLogo = Boolean(team.logoUrl) && !failed;

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm"
      style={{ width: size, height: size }}
    >
      {showLogo ? (
        <img
          src={team.logoUrl ?? undefined}
          alt=""
          style={{ width: size * 0.7, height: size * 0.7 }}
          className="object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="px-0.5 text-center font-bold leading-none text-neutral-900" style={{ fontSize: Math.max(9, size * 0.26) }}>
          {team.abbrev.slice(0, 4)}
        </span>
      )}
    </span>
  );
}

/** Logos sit on a white disc so a dark mark still reads on the dark page. */
export function TeamMarks({ away, home, size = 32 }: { away: TeamRef; home: TeamRef; size?: number }) {
  return (
    <span className="flex shrink-0 items-center">
      <span className="relative z-10">
        <TeamDisc team={away} size={size} />
      </span>
      <span style={{ marginLeft: -size * 0.28 }}>
        <TeamDisc team={home} size={size} />
      </span>
    </span>
  );
}
