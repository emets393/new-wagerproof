import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TeamDiscInfo {
  logoUrl: string | null;
  abbrev: string;
  color: string;
}

function TeamDisc({ team, size }: { team: TeamDiscInfo; size: number }) {
  const [imgFailed, setImgFailed] = React.useState(false);

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/70 backdrop-blur-md dark:border-white/15 dark:bg-white/10"
      style={{
        width: size,
        height: size,
        // Team-tinted glass: color wash + faint halo, like teamGlassDisc on iOS
        backgroundImage: `radial-gradient(circle at 35% 30%, ${team.color}40, transparent 75%)`,
        boxShadow: `0 2px 10px ${team.color}33`,
      }}
    >
      {team.logoUrl && !imgFailed ? (
        <img
          src={team.logoUrl}
          alt={team.abbrev}
          style={{ width: size * 0.62, height: size * 0.62 }}
          className="object-contain"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className="font-bold text-foreground"
          style={{ fontSize: Math.max(10, size * 0.28) }}
        >
          {team.abbrev}
        </span>
      )}
    </div>
  );
}

interface TeamLogoDiscsProps {
  away: TeamDiscInfo;
  home: TeamDiscInfo;
  /** Disc diameter in px. Feed cards ~44, detail hero ~72. */
  size?: number;
  /** Negative overlap between discs, as on iOS merged logo pairs. */
  overlap?: number;
  className?: string;
}

/**
 * Overlapping team-tinted glass discs (away in front-left, home behind-right).
 */
export function TeamLogoDiscs({
  away,
  home,
  size = 44,
  overlap = 10,
  className,
}: TeamLogoDiscsProps) {
  return (
    <div className={cn('flex items-center', className)}>
      <div className="z-10">
        <TeamDisc team={away} size={size} />
      </div>
      <div style={{ marginLeft: -overlap }}>
        <TeamDisc team={home} size={size} />
      </div>
    </div>
  );
}
